import { JobPost, JobStatus } from '@prisma/client';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import { generateJobMessage } from './aiMessageGenerator';
import { sendDiscordMessage } from './discordPublisher';
import { buildDefaultJobMessage } from './jobMessage';

const MAX_GENERATED_MESSAGE_LENGTH = 1600;
const MIN_ABOUT_SECTION_LINES = 3;
const MAX_ABOUT_SECTION_LINES = 6;

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

export async function publishPendingJobs(options: { limit?: number } = {}): Promise<PublishPendingJobsResult> {
  const limit = options.limit ?? 5;

  logger.info('Buscando vagas pendentes para publicacao.', { limit });

  if (limit <= 0) {
    logger.info('Publicacao de vagas pendentes ignorada porque o limite e zero.', { limit });
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

  for (const job of jobs) {
    const publishResult = await publishSingleJob(job);

    if (publishResult.status === 'sent') {
      result.sent += 1;
    }

    if (publishResult.status === 'failed') {
      result.failed += 1;
    }
  }

  logger.info('Publicacao de vagas pendentes finalizada.', result);
  return result;
}

export async function publishSingleJob(job: JobPost): Promise<PublishSingleJobResult> {
  if (job.status === JobStatus.SENT) {
    return {
      status: 'skipped',
      message: 'Esta vaga ja foi enviada e nao sera reenviada.',
    };
  }

  if (job.status === JobStatus.ARCHIVED) {
    return {
      status: 'skipped',
      message: 'Esta vaga esta arquivada e nao pode ser enviada.',
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

    await sendDiscordMessage(message);

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
    logger.info('Usando template padrao porque useAi esta desativado.', { jobId: job.id });
    return buildDefaultJobMessage(job);
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
    logger.error('Erro ao gerar mensagem com IA. Usando template padrao.', error, {
      jobId: job.id,
      title: job.title,
    });
    return buildDefaultJobMessage(job);
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
  if (message.length > MAX_GENERATED_MESSAGE_LENGTH) {
    return false;
  }

  const lines = message
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 3) {
    return false;
  }

  const normalizedLines = lines.map(normalizeLine);
  const uniqueLines = new Set(normalizedLines);

  if (uniqueLines.size <= 1) {
    return false;
  }

  const repeatedLineCount = normalizedLines.filter((line, index, allLines) => allLines.indexOf(line) !== index).length;

  if (repeatedLineCount >= 1) {
    return false;
  }

  const aboutSectionLines = countAboutSectionLines(lines);

  if (aboutSectionLines > 0 && aboutSectionLines < MIN_ABOUT_SECTION_LINES) {
    return false;
  }

  if (aboutSectionLines > MAX_ABOUT_SECTION_LINES) {
    return false;
  }

  return true;
}

function countAboutSectionLines(lines: string[]): number {
  const aboutStartIndex = lines.findIndex((line) => normalizeLine(line).includes('sobre a vaga'));

  if (aboutStartIndex === -1) {
    return 0;
  }

  let count = 0;

  for (const line of lines.slice(aboutStartIndex + 1)) {
    if (/^[^\w\s]?[\u{1F300}-\u{1FAFF}]/u.test(line) || normalizeLine(line).includes('candidatura')) {
      break;
    }

    count += 1;
  }

  return count;
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
