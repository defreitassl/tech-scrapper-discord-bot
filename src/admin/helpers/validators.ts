import { JobPost, JobStatus } from '@prisma/client';
import { JobFormData } from './forms';

type JobApprovalData = Pick<
  JobPost,
  'title' | 'company' | 'location' | 'shortDescription' | 'rawText' | 'readyText' | 'aiGeneratedText' | 'useAi' | 'url'
>;

export function validateJob(form: JobFormData, existingAiGeneratedText: string | null = null): string | null {
  if (!form.title && !form.rawText) {
    return 'Informe pelo menos o titulo ou o texto bruto da vaga.';
  }

  if (form.status === JobStatus.PENDING) {
    return validatePending({ ...form, aiGeneratedText: existingAiGeneratedText });
  }

  return null;
}

export function validatePending(job: JobApprovalData): string | null {
  if (job.readyText || job.aiGeneratedText || hasTemplateData(job)) {
    return null;
  }

  return 'Para deixar pronta para envio, informe dados da vaga, texto pronto, mensagem de IA existente ou URL.';
}

export function hasTemplateData(
  job: Pick<JobApprovalData, 'title' | 'company' | 'location' | 'shortDescription' | 'rawText' | 'url'>,
): boolean {
  return Boolean(job.title || job.company || job.location || job.shortDescription || job.rawText || job.url);
}
