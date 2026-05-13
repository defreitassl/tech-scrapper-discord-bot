import { JobPost, JobStatus } from '@prisma/client';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import { generateJobMessage } from './aiMessageGenerator';
import { sendDiscordMessage } from './discordPublisher';
import { buildDefaultJobMessage } from './jobMessage';

export type PublishPendingJobsResult = {
  total: number;
  sent: number;
  failed: number;
};

export async function publishPendingJobs(): Promise<PublishPendingJobsResult> {
  logger.info('Buscando vagas pendentes para publicacao.', { limit: 5 });

  const jobs = await prisma.jobPost.findMany({
    where: { status: JobStatus.PENDING },
    orderBy: { createdAt: 'asc' },
    take: 5,
  });

  const result: PublishPendingJobsResult = {
    total: jobs.length,
    sent: 0,
    failed: 0,
  };

  logger.info('Vagas pendentes encontradas.', { total: jobs.length });

  for (const job of jobs) {
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

      result.sent += 1;
      logger.info('Vaga enviada para o Discord e marcada como SENT.', {
        jobId: job.id,
        title: job.title,
      });
    } catch (error) {
      await prisma.jobPost.update({
        where: { id: job.id },
        data: { status: JobStatus.ERROR },
      });

      result.failed += 1;
      logger.error('Erro ao enviar vaga para o Discord. Vaga marcada como ERROR.', error, {
        jobId: job.id,
        title: job.title,
      });
    }
  }

  logger.info('Publicacao de vagas pendentes finalizada.', result);
  return result;
}

async function resolveJobMessage(job: JobPost): Promise<string> {
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

function isUsableGeneratedMessage(message: string): boolean {
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

  return true;
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
