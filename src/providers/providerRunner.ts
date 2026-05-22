import { JobStatus } from '@prisma/client';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import { checkJobDuplicate } from '../services/jobDeduplication';
import { evaluateJobPriority, type JobPriorityLevel, type JobPriorityResult } from '../services/jobPriority';
import { evaluateCollectedJobQuality } from '../services/jobQualityFilter';
import { normalizeCollectedJob } from './normalizeCollectedJob';
import { activeJobProviders } from './providerRegistry';
import type { JobSourceProvider, NormalizedCollectedJob, ProviderRepositorySummary } from './types';

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
  ignoredByQuality: number;
  highPriority: number;
  mediumPriority: number;
  lowPriority: number;
  repositoryErrors: number;
  errors: ProviderRunnerError[];
  repositorySummaries: ProviderRepositorySummary[];
};

type PrioritizedCollectedJob = {
  originalIndex: number;
  normalizedJob: NormalizedCollectedJob;
  repositorySummary?: ProviderRepositorySummary;
  priorityResult: JobPriorityResult;
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
    ignoredByQuality: 0,
    highPriority: 0,
    mediumPriority: 0,
    lowPriority: 0,
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
        summary.ignoredByQuality += collectResult.ignoredByQuality ?? 0;
        summary.repositoryErrors += collectResult.errors?.length ?? 0;
        summary.errors.push(...(collectResult.errors ?? []));
        for (const repositorySummary of collectResult.repositorySummaries ?? []) {
          repositorySummaries.set(repositorySummary.source, repositorySummary);
        }
      }

      const prioritizedJobs: PrioritizedCollectedJob[] = [];

      for (const [originalIndex, collectedJob] of collectedJobs.entries()) {
        const normalizedJob = normalizeCollectedJob(collectedJob, provider.name);
        const repositorySummary = repositorySummaries.get(normalizedJob.source);
        const qualityResult = evaluateCollectedJobQuality({
          ...normalizedJob,
          collectedAt: collectedJob.collectedAt ?? new Date(),
        });

        if (!qualityResult.accepted) {
          summary.ignoredByQuality += 1;
          if (repositorySummary) {
            repositorySummary.ignoredByQuality += 1;
          }
          logger.info('Vaga coletada ignorada por filtro de qualidade.', {
            provider: provider.name,
            source: normalizedJob.source,
            title: normalizedJob.title,
            url: normalizedJob.url,
            reasons: qualityResult.reasons,
            score: qualityResult.score,
          });
          continue;
        }

        const priorityResult = evaluateJobPriority(normalizedJob);
        logger.info('Prioridade calculada para vaga coletada.', {
          provider: provider.name,
          source: normalizedJob.source,
          title: normalizedJob.title,
          priority: priorityResult.priority,
          score: priorityResult.score,
          reasons: priorityResult.reasons,
        });

        prioritizedJobs.push({
          originalIndex,
          normalizedJob,
          repositorySummary,
          priorityResult,
        });
      }

      const orderedJobs = [...prioritizedJobs].sort((a, b) => {
        const priorityDifference = getPrioritySortValue(a.priorityResult.priority) - getPrioritySortValue(b.priorityResult.priority);

        if (priorityDifference !== 0) {
          return priorityDifference;
        }

        return a.originalIndex - b.originalIndex;
      });

      for (const { normalizedJob, repositorySummary, priorityResult } of orderedJobs) {
        const duplicateCheck = await checkJobDuplicate(normalizedJob);

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
        incrementPrioritySummary(summary, priorityResult.priority);
        if (repositorySummary) {
          repositorySummary.created += 1;
        }
        logger.info('Vaga coletada criada como rascunho.', {
          provider: provider.name,
          jobId: job.id,
          title: job.title,
          priority: priorityResult.priority,
          priorityScore: priorityResult.score,
          priorityReasons: priorityResult.reasons,
          possibleDuplicateJobId: duplicateCheck.possibleDuplicateByTitleAndCompany?.id,
        });
      }

      for (const repositorySummary of repositorySummaries.values()) {
        summary.repositorySummaries.push(repositorySummary);
        logger.info('Resumo da coleta por fonte do provider.', {
          provider: provider.name,
          source: repositorySummary.source,
          totalRead: repositorySummary.totalIssuesRead,
          created: repositorySummary.created,
          ignoredByDate: repositorySummary.ignoredByDate,
          ignoredBySeniority: repositorySummary.ignoredBySeniority,
          ignoredByMissingEntryLevel: repositorySummary.ignoredByMissingEntryLevel,
          ignoredByLocation: repositorySummary.ignoredByLocation,
          ignoredByQuality: repositorySummary.ignoredByQuality,
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

function getPrioritySortValue(priority: JobPriorityLevel): number {
  if (priority === 'HIGH') {
    return 0;
  }

  if (priority === 'MEDIUM') {
    return 1;
  }

  return 2;
}

function incrementPrioritySummary(summary: ProviderRunnerSummary, priority: JobPriorityLevel): void {
  if (priority === 'HIGH') {
    summary.highPriority += 1;
    return;
  }

  if (priority === 'MEDIUM') {
    summary.mediumPriority += 1;
    return;
  }

  summary.lowPriority += 1;
}
