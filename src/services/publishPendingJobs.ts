import { JobPost, JobStatus } from '@prisma/client';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import { publishAdminEvent } from './adminEvents';
import { generateJobMessage } from './aiMessageGenerator';
import { sendDiscordJobMessage } from './discordPublisher';
import { buildFallbackJobMessage } from './jobMessage';

const MAX_GENERATED_MESSAGE_LENGTH = 1600;
const MIN_GENERATED_MESSAGE_LENGTH = 80;
const BATCH_SEND_DELAY_MS = 1000;

export type PublishPendingJobsResult = {
  total: number;
  sent: number;
  failed: number;
};

export type PublishSingleJobResult =
  | {
      status: 'sent';
      message: string;
    }
  | {
      status: 'skipped';
      message: string;
    }
  | {
      status: 'failed';
      message: string;
    };

export async function publishPendingJobs(options: { limit?: number; trigger?: 'manual' | 'scheduled' } = {}): Promise<PublishPendingJobsResult> {
  const limit = options.limit ?? 5;
  const trigger = options.trigger ?? 'manual';

  logger.info('Buscando vagas pendentes para publicacao.', { limit });
  publishAdminEvent({
    type: 'publish',
    status: 'started',
    title: trigger === 'scheduled' ? 'Envio automatico iniciado' : 'Envio manual iniciado',
    message: `Buscando ate ${limit} vagas PENDING para envio.`,
    details: {
      trigger,
      limit,
    },
  });

  if (limit <= 0) {
    logger.info('Publicacao de vagas pendentes ignorada porque o limite e zero.', { limit });
    publishAdminEvent({
      type: 'publish',
      status: 'skipped',
      title: 'Envio ignorado',
      message: 'O limite de envio e zero.',
      details: {
        trigger,
        limit,
      },
    });
    return {
      total: 0,
      sent: 0,
      failed: 0,
    };
  }

  const jobs = await prisma.jobPost.findMany({
    where: { status: JobStatus.PENDING },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  const result: PublishPendingJobsResult = {
    total: jobs.length,
    sent: 0,
    failed: 0,
  };

  logger.info('Vagas pendentes encontradas.', { total: jobs.length });
  publishAdminEvent({
    type: 'publish',
    status: jobs.length > 0 ? 'progress' : 'skipped',
    title: 'Fila de envio consultada',
    message: jobs.length > 0 ? `${jobs.length} vagas encontradas para envio.` : 'Nenhuma vaga PENDING encontrada.',
    details: {
      trigger,
      total: jobs.length,
    },
  });

  for (const [index, job] of jobs.entries()) {
    publishAdminEvent({
      type: 'publish',
      status: 'progress',
      title: 'Enviando vaga',
      message: `${index + 1}/${jobs.length}: ${job.title ?? 'Vaga sem titulo'}.`,
      details: {
        trigger,
        jobId: job.id,
        title: job.title,
      },
    });
    const publishResult = await publishSingleJob(job);

    if (publishResult.status === 'sent') {
      result.sent += 1;
    }

    if (publishResult.status === 'failed') {
      result.failed += 1;
    }
    publishAdminEvent({
      type: 'publish',
      status: publishResult.status === 'sent' ? 'success' : publishResult.status === 'failed' ? 'error' : 'warning',
      title: publishResult.status === 'sent' ? 'Vaga enviada' : 'Envio da vaga atualizado',
      message: `${job.title ?? 'Vaga sem titulo'}: ${publishResult.message}`,
      details: {
        trigger,
        jobId: job.id,
        result: publishResult.status,
      },
    });

    if (index < jobs.length - 1 && publishResult.status === 'sent') {
      await delay(BATCH_SEND_DELAY_MS);
    }
  }

  logger.info('Publicacao de vagas pendentes finalizada.', result);
  publishAdminEvent({
    type: 'publish',
    status: result.failed > 0 ? 'warning' : result.sent > 0 ? 'success' : 'skipped',
    title: 'Envio finalizado',
    message: `Encontradas: ${result.total}. Enviadas: ${result.sent}. Erros: ${result.failed}.`,
    details: {
      trigger,
      ...result,
    },
  });
  return result;
}

export async function publishSingleJob(job: JobPost): Promise<PublishSingleJobResult> {
  if (job.status === JobStatus.SENT) {
    return {
      status: 'skipped',
      message: 'Esta vaga ja foi enviada e nao sera reenviada.',
    };
  }

  if (!hasPublishableContent(job)) {
    return {
      status: 'skipped',
      message: 'Esta vaga ainda nao tem mensagem pronta nem dados suficientes para gerar o template de envio.',
    };
  }

  try {
    const message = await resolveJobMessage(job);
    logger.info('Mensagem resolvida para vaga.', {
      jobId: job.id,
      title: job.title,
      messageLength: message.length,
      preview: truncate(message, 180),
    });

    await sendDiscordJobMessage(job, message);

    await prisma.jobPost.update({
      where: { id: job.id },
      data: {
        status: JobStatus.SENT,
        sentAt: new Date(),
      },
    });

    logger.info('Vaga enviada para o Discord e marcada como SENT.', {
      jobId: job.id,
      title: job.title,
    });

    return {
      status: 'sent',
      message: 'Vaga enviada para o Discord.',
    };
  } catch (error) {
    await prisma.jobPost.update({
      where: { id: job.id },
      data: { status: JobStatus.ERROR },
    });

    logger.error('Erro ao enviar vaga para o Discord. Vaga marcada como ERROR.', error, {
      jobId: job.id,
      title: job.title,
    });

    return {
      status: 'failed',
      message: 'Nao foi possivel enviar esta vaga. Ela foi marcada como erro.',
    };
  }
}

export async function resolveJobMessage(job: JobPost): Promise<string> {
  const readyText = job.readyText?.trim();

  if (readyText) {
    logger.info('Usando readyText da vaga.', { jobId: job.id });
    return readyText;
  }

  const aiGeneratedText = job.aiGeneratedText?.trim();

  if (aiGeneratedText && isUsableGeneratedMessage(aiGeneratedText)) {
    logger.info('Reutilizando aiGeneratedText existente.', { jobId: job.id });
    return aiGeneratedText;
  }

  if (aiGeneratedText) {
    logger.warn('aiGeneratedText existente parece invalido e sera ignorado.', {
      jobId: job.id,
      preview: truncate(aiGeneratedText, 180),
    });
  }

  if (!job.useAi) {
    logger.info('Usando fallback deterministico porque useAi esta desativado.', { jobId: job.id });
    return buildFallbackJobMessage(job);
  }

  try {
    const generatedMessage = await generateJobMessage(job);

    if (!isUsableGeneratedMessage(generatedMessage)) {
      throw new Error(`Mensagem gerada pela IA parece invalida: ${truncate(generatedMessage, 180)}`);
    }

    await prisma.jobPost.update({
      where: { id: job.id },
      data: { aiGeneratedText: generatedMessage },
    });

    logger.info('Mensagem gerada por IA salva em aiGeneratedText.', { jobId: job.id });
    return generatedMessage;
  } catch (error) {
    logger.error('Erro ao gerar mensagem com IA. Usando fallback deterministico.', error, {
      jobId: job.id,
      title: job.title,
    });
    return buildFallbackJobMessage(job);
  }
}

function hasPublishableContent(job: JobPost): boolean {
  const aiGeneratedText = job.aiGeneratedText?.trim();

  return Boolean(
    job.readyText?.trim() ||
      (aiGeneratedText && isUsableGeneratedMessage(aiGeneratedText)) ||
      job.title?.trim() ||
      job.company?.trim() ||
      job.location?.trim() ||
      job.shortDescription?.trim() ||
      job.rawText?.trim() ||
      job.url?.trim(),
  );
}

export function isUsableGeneratedMessage(message: string): boolean {
  const trimmed = message.trim();

  if (trimmed.length < MIN_GENERATED_MESSAGE_LENGTH || trimmed.length > MAX_GENERATED_MESSAGE_LENGTH) {
    return false;
  }

  const lines = trimmed
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return false;
  }

  if (!hasJobSignal(trimmed)) {
    return false;
  }

  if (!hasApplicationSignal(trimmed)) {
    return false;
  }

  const normalizedLines = lines.map(normalizeLine);
  const uniqueLines = new Set(normalizedLines);

  if (uniqueLines.size <= 1) {
    return false;
  }

  return true;
}

function hasJobSignal(value: string): boolean {
  const normalized = normalizeLine(value);

  return /\bvaga\b/.test(normalized) || /\boportunidade\b/.test(normalized) || /\bcargo\b/.test(normalized);
}

function hasApplicationSignal(value: string): boolean {
  return /https?:\/\/\S+/i.test(value) || /candidatura|candidate|aplicar|inscri/i.test(normalizeLine(value));
}

function normalizeLine(line: string): string {
  return line
    .replace(/\s+/g, ' ')
    .replace(/[.!?]+$/g, '')
    .trim()
    .toLowerCase();
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength)}...`;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
