import { JobStatus } from '@prisma/client';

export const statuses = Object.values(JobStatus);

export const statusLabels: Record<JobStatus, string> = {
  [JobStatus.PENDING]: 'Pronta para envio',
  [JobStatus.SENT]: 'Enviada',
  [JobStatus.ERROR]: 'Erro',
};

export function getStatusLabel(status: JobStatus): string {
  return statusLabels[status];
}
