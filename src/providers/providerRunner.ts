import { JobStatus } from '@prisma/client';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import { checkJobDuplicate } from '../services/jobDeduplication';
import { normalizeCollectedJob } from './normalizeCollectedJob';
import { activeJobProviders } from './providerRegistry';
import type { JobSourceProvider, ProviderRepositorySummary } from './types';

export type ProviderRunnerError = {
  provider: string;
  message: string;
};

export type ProviderRunnerSummary = {
  providersExecuted: number;
  collectedJobs: number;
  totalIssuesRead: number;
  createdJobs: number;
  created: number;
  ignoredByDate: number;
  ignoredBySeniority: number;
  ignoredByMissingEntryLevel: number;
  ignoredDuplicates: number;
  possibleDuplicates: number;
  ignoredByLocation: number;
  repositoryErrors: number;
  errors: ProviderRunnerError[];
  repositorySummaries: ProviderRepositorySummary[];
};

export async function runJobProviders(
  providers: JobSourceProvider[] = activeJobProviders,
): Promise<ProviderRunnerSummary> {
  const summary: ProviderRunnerSummary = {
    providersExecuted: 0,
    collectedJobs: 0,
    totalIssuesRead: 0,
    createdJobs: 0,
    created: 0,
    ignoredByDate: 0,
    ignoredBySeniority: 0,
    ignoredByMissingEntryLevel: 0,
    ignoredDuplicates: 0,
    possibleDuplicates: 0,
    ignoredByLocation: 0,
    repositoryErrors: 0,
    errors: [],
    repositorySummaries: [],
  };

  for (const provider of providers) {
    summary.providersExecuted += 1;

    try {
      logger.info('Coleta de vagas iniciada.', { provider: provider.name });
      const collectResult = await provider.collect();
      const collectedJobs = Array.isArray(collectResult) ? collectResult : collectResult.jobs;

      summary.collectedJobs += collectedJobs.length;
      const repositorySummaries = new Map<string, ProviderRepositorySummary>();

      if (!Array.isArray(collectResult)) {
        summary.totalIssuesRead += collectResult.totalIssuesRead ?? 0;
        summary.ignoredByDate += collectResult.ignoredByDate ?? 0;
        summary.ignoredBySeniority += collectResult.ignoredBySeniority ?? 0;
        summary.ignoredByMissingEntryLevel += collectResult.ignoredByMissingEntryLevel ?? 0;
        summary.ignoredByLocation += collectResult.ignoredByLocation ?? 0;
        summary.repositoryErrors += collectResult.errors?.length ?? 0;
        summary.errors.push(...(collectResult.errors ?? []));
        for (const repositorySummary of collectResult.repositorySummaries ?? []) {
          repositorySummaries.set(repositorySummary.source, repositorySummary);
        }
      }

      for (const collectedJob of collectedJobs) {
        const normalizedJob = normalizeCollectedJob(collectedJob, provider.name);
        const duplicateCheck = await checkJobDuplicate(normalizedJob);
        const repositorySummary = repositorySummaries.get(normalizedJob.source);

        if (duplicateCheck.duplicateByUrl) {
          summary.ignoredDuplicates += 1;
          if (repositorySummary) {
            repositorySummary.ignoredDuplicates += 1;
          }
          logger.info('Vaga coletada ignorada por URL duplicada.', {
            provider: provider.name,
            existingJobId: duplicateCheck.duplicateByUrl.id,
            url: normalizedJob.url,
          });
          continue;
        }

        if (duplicateCheck.possibleDuplicateByTitleAndCompany) {
          summary.possibleDuplicates += 1;
          if (repositorySummary) {
            repositorySummary.possibleDuplicates += 1;
          }
        }

        const job = await prisma.jobPost.create({
          data: {
            ...normalizedJob,
            status: JobStatus.DRAFT,
            useAi: false,
          },
        });

        summary.createdJobs += 1;
        summary.created += 1;
        if (repositorySummary) {
          repositorySummary.created += 1;
        }
        logger.info('Vaga coletada criada como rascunho.', {
          provider: provider.name,
          jobId: job.id,
          title: job.title,
          possibleDuplicateJobId: duplicateCheck.possibleDuplicateByTitleAndCompany?.id,
        });
      }

      for (const repositorySummary of repositorySummaries.values()) {
        summary.repositorySummaries.push(repositorySummary);
        logger.info('Resumo da coleta GitHub por repositorio.', {
          provider: provider.name,
          repository: repositorySummary.source,
          totalIssuesRead: repositorySummary.totalIssuesRead,
          created: repositorySummary.created,
          ignoredByDate: repositorySummary.ignoredByDate,
          ignoredBySeniority: repositorySummary.ignoredBySeniority,
          ignoredByMissingEntryLevel: repositorySummary.ignoredByMissingEntryLevel,
          ignoredByLocation: repositorySummary.ignoredByLocation,
          ignoredDuplicates: repositorySummary.ignoredDuplicates,
          possibleDuplicates: repositorySummary.possibleDuplicates,
          errors: repositorySummary.errors,
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
