import { JobStatus } from '@prisma/client';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import { checkJobDuplicate } from '../services/jobDeduplication';
import { normalizeCollectedJob } from './normalizeCollectedJob';
import { activeJobProviders } from './providerRegistry';
import type { JobSourceProvider } from './types';

export type ProviderRunnerError = {
  provider: string;
  message: string;
};

export type ProviderRunnerSummary = {
  providersExecuted: number;
  collectedJobs: number;
  createdJobs: number;
  ignoredDuplicates: number;
  possibleDuplicates: number;
  errors: ProviderRunnerError[];
};

export async function runJobProviders(
  providers: JobSourceProvider[] = activeJobProviders,
): Promise<ProviderRunnerSummary> {
  const summary: ProviderRunnerSummary = {
    providersExecuted: 0,
    collectedJobs: 0,
    createdJobs: 0,
    ignoredDuplicates: 0,
    possibleDuplicates: 0,
    errors: [],
  };

  for (const provider of providers) {
    summary.providersExecuted += 1;

    try {
      logger.info('Coleta de vagas iniciada.', { provider: provider.name });
      const collectedJobs = await provider.collect();
      summary.collectedJobs += collectedJobs.length;

      for (const collectedJob of collectedJobs) {
        const normalizedJob = normalizeCollectedJob(collectedJob, provider.name);
        const duplicateCheck = await checkJobDuplicate(normalizedJob);

        if (duplicateCheck.duplicateByUrl) {
          summary.ignoredDuplicates += 1;
          logger.info('Vaga coletada ignorada por URL duplicada.', {
            provider: provider.name,
            existingJobId: duplicateCheck.duplicateByUrl.id,
            url: normalizedJob.url,
          });
          continue;
        }

        if (duplicateCheck.possibleDuplicateByTitleAndCompany) {
          summary.possibleDuplicates += 1;
        }

        const job = await prisma.jobPost.create({
          data: {
            ...normalizedJob,
            status: JobStatus.DRAFT,
            useAi: false,
          },
        });

        summary.createdJobs += 1;
        logger.info('Vaga coletada criada como rascunho.', {
          provider: provider.name,
          jobId: job.id,
          title: job.title,
          possibleDuplicateJobId: duplicateCheck.possibleDuplicateByTitleAndCompany?.id,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido ao executar provider.';

      summary.errors.push({
        provider: provider.name,
        message,
      });
      logger.error('Erro ao executar provider de vagas.', error, { provider: provider.name });
    }
  }

  return summary;
}
