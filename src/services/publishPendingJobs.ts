import { JobPost, JobStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { generateJobMessage } from './aiMessageGenerator';
import { sendDiscordMessage } from './discordPublisher';
import { buildDefaultJobMessage, buildJobMessage } from './jobMessage';

export type PublishPendingJobsResult = {
  total: number;
  sent: number;
  failed: number;
};

export async function publishPendingJobs(): Promise<PublishPendingJobsResult> {
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

  for (const job of jobs) {
    try {
      const message = await resolveJobMessage(job);
      await sendDiscordMessage(message);

      await prisma.jobPost.update({
        where: { id: job.id },
        data: {
          status: JobStatus.SENT,
          sentAt: new Date(),
        },
      });

      result.sent += 1;
      console.log(`Vaga enviada para o Discord: ${job.id} - ${job.title ?? 'Sem titulo'}`);
    } catch (error) {
      await prisma.jobPost.update({
        where: { id: job.id },
        data: { status: JobStatus.ERROR },
      });

      result.failed += 1;
      console.error(`Erro ao enviar vaga para o Discord: ${job.id} - ${job.title ?? 'Sem titulo'}`, error);
    }
  }

  return result;
}

async function resolveJobMessage(job: JobPost): Promise<string> {
  const existingMessage = buildJobMessage(job);

  if (job.readyText?.trim() || job.aiGeneratedText?.trim() || !job.useAi) {
    return existingMessage;
  }

  try {
    const aiGeneratedText = await generateJobMessage(job);

    await prisma.jobPost.update({
      where: { id: job.id },
      data: { aiGeneratedText },
    });

    return aiGeneratedText;
  } catch (error) {
    console.error(`Erro ao gerar mensagem com IA para a vaga ${job.id}. Usando template padrao.`, error);
    return buildDefaultJobMessage(job);
  }
}
