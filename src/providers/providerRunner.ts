import { JobStatus } from '@prisma/client';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import { publishAdminEvent } from '../services/adminEvents';
import { checkJobDuplicate } from '../services/jobDeduplication';
import { evaluateJobForQueue, type JobQueueDecision } from '../services/jobPolicy';
import type { JobPriorityLevel } from '../services/jobPriority';
import { getSchedulerSettings, normalizeSchedulerSettings } from '../services/schedulerSettings';
import { normalizeCollectedJob } from './normalizeCollectedJob';
import { automaticJobProviders } from './providerRegistry';
import type { JobSourceProvider, NormalizedCollectedJob, ProviderRepositorySummary } from './types';

export type ProviderRunnerError = {
  provider: string;
  message: string;
};

export type AutomatedJobCollectionSummary = {
  providersExecuted: number;
  analyzed: number;
  rejectedByDomain: number;
  rejectedByQuality: number;
  rejectedDuplicates: number;
  rejectedByPriority: number;
  selectedForApproval: number;
  approvedAsPending: number;
  errors: ProviderRunnerError[];
  repositoryErrors: number;
  dailyLimit: number;
  pendingCount: number;
  queueTarget: number;
  slotsToCreate: number;
  approvedJobIds: string[];
  repositorySummaries: ProviderRepositorySummary[];
};

type PrioritizedCollectedJob = {
  originalIndex: number;
  normalizedJob: NormalizedCollectedJob;
  repositorySummary?: ProviderRepositorySummary;
  decision: JobQueueDecision;
};

type AutomatedCollectionCandidate = PrioritizedCollectedJob & {
  provider: string;
};

export async function runAutomatedJobCollection(
  providers: JobSourceProvider[] = automaticJobProviders,
  options: { trigger?: 'manual' | 'scheduled' } = {},
): Promise<AutomatedJobCollectionSummary> {
  // Runner executa providers, aplica jobPolicy, deduplica e cria PENDING.
  const settings = normalizeSchedulerSettings(await getSchedulerSettings());
  const pendingCount = await prisma.jobPost.count({ where: { status: JobStatus.PENDING } });
  const queueTarget = Math.min(Math.max(settings.dailyLimit * 7, settings.dailyLimit), 30);
  const slotsToCreate = Math.max(queueTarget - pendingCount, 0);
  const summary: AutomatedJobCollectionSummary = {
    providersExecuted: 0,
    analyzed: 0,
    rejectedByDomain: 0,
    rejectedByQuality: 0,
    rejectedDuplicates: 0,
    rejectedByPriority: 0,
    selectedForApproval: 0,
    approvedAsPending: 0,
    errors: [],
    repositoryErrors: 0,
    dailyLimit: settings.dailyLimit,
    pendingCount,
    queueTarget,
    slotsToCreate,
    approvedJobIds: [],
    repositorySummaries: [],
  };

  logger.info('Coleta automatizada calculou alvo da fila PENDING.', {
    dailyLimit: settings.dailyLimit,
    pendingCount,
    queueTarget,
    slotsToCreate,
    timezone: settings.timezone,
  });
  publishAdminEvent({
    type: 'collection',
    status: 'progress',
    title: 'Fila analisada',
    message: `Fila atual: ${pendingCount} pendentes. Alvo: ${queueTarget}. Novas vagas buscadas: ${slotsToCreate}.`,
    details: {
      trigger: options.trigger,
      dailyLimit: settings.dailyLimit,
      pendingCount,
      queueTarget,
      slotsToCreate,
    },
  });

  if (slotsToCreate <= 0) {
    logger.info('Fila PENDING ja esta cheia.', {
      dailyLimit: settings.dailyLimit,
      pendingCount,
      queueTarget,
    });
    publishAdminEvent({
      type: 'collection',
      status: 'skipped',
      title: 'Coleta sem novas vagas',
      message: `A fila PENDING ja atingiu o alvo de ${queueTarget} vagas.`,
      details: {
        trigger: options.trigger,
        pendingCount,
        queueTarget,
      },
    });
    return summary;
  }

  const candidates: AutomatedCollectionCandidate[] = [];

  for (const provider of providers) {
    summary.providersExecuted += 1;

    try {
      logger.info('Coleta automatizada de vagas iniciada.', { provider: provider.name });
      publishAdminEvent({
        type: 'collection',
        status: 'progress',
        title: 'Provider em coleta',
        message: `Buscando vagas em ${provider.name}.`,
        details: {
          trigger: options.trigger,
          provider: provider.name,
        },
      });
      const collectResult = await provider.collect();
      const collectedJobs = Array.isArray(collectResult) ? collectResult : collectResult.jobs;

      summary.analyzed += collectedJobs.length;
      const repositorySummaries = new Map<string, ProviderRepositorySummary>();

      if (!Array.isArray(collectResult)) {
        summary.rejectedByQuality += collectResult.ignoredByQuality ?? 0;
        summary.repositoryErrors += collectResult.errors?.length ?? 0;
        summary.errors.push(...(collectResult.errors ?? []));
        for (const repositorySummary of collectResult.repositorySummaries ?? []) {
          repositorySummaries.set(repositorySummary.source, repositorySummary);
        }
      }

      publishAdminEvent({
        type: 'collection',
        status: 'progress',
        title: 'Provider concluido',
        message: `${provider.name}: ${collectedJobs.length} vagas analisadas.`,
        details: {
          trigger: options.trigger,
          provider: provider.name,
          collectedJobs: collectedJobs.length,
          repositoryErrors: Array.isArray(collectResult) ? 0 : collectResult.errors?.length ?? 0,
        },
      });

      for (const [originalIndex, collectedJob] of collectedJobs.entries()) {
        const normalizedJob = normalizeCollectedJob(collectedJob, provider.name);
        const repositorySummary = repositorySummaries.get(normalizedJob.source);
        const decision = evaluateJobForQueue(normalizedJob);

        if (!decision.accepted) {
          if (decision.domain === 'NON_TECH') {
            summary.rejectedByDomain += 1;
          } else if (decision.rejectionReason === 'quality_insufficient') {
            summary.rejectedByQuality += 1;
          } else {
            summary.rejectedByPriority += 1;
          }

          if (repositorySummary && (decision.domain === 'NON_TECH' || decision.rejectionReason === 'quality_insufficient')) {
            repositorySummary.ignoredByQuality += 1;
          }
          logger.info('Vaga coletada recusada pela politica de fila.', {
            provider: provider.name,
            source: normalizedJob.source,
            title: normalizedJob.title,
            url: normalizedJob.url,
            rejectionReason: decision.rejectionReason,
            domain: decision.domain,
            priority: decision.priority,
            priorityScore: decision.priorityScore,
            reasons: decision.reasons,
            qualityScore: decision.qualityScore,
            qualityReasons: decision.qualityReasons,
          });
          continue;
        }

        candidates.push({
          provider: provider.name,
          originalIndex,
          normalizedJob,
          repositorySummary,
          decision,
        });
      }

      for (const repositorySummary of repositorySummaries.values()) {
        summary.repositorySummaries.push(repositorySummary);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido ao executar provider.';

      summary.errors.push({
        provider: provider.name,
        message,
      });
      logger.error('Erro ao executar provider na coleta automatizada.', error, { provider: provider.name });
      publishAdminEvent({
        type: 'collection',
        status: 'error',
        title: 'Erro em provider',
        message: `${provider.name}: ${message}`,
        details: {
          trigger: options.trigger,
          provider: provider.name,
        },
      });
    }
  }

  const orderedCandidates = candidates.sort(compareAutomatedCandidates);
  const selectedCandidates: AutomatedCollectionCandidate[] = [];
  const selectedUrlKeys = new Set<string>();
  const selectedTitleCompanyKeys = new Set<string>();

  for (const candidate of orderedCandidates) {
    if (selectedCandidates.length >= slotsToCreate) {
      summary.rejectedByPriority += 1;
      continue;
    }

    const urlKey = normalizeDuplicateKey(candidate.normalizedJob.url);
    const titleCompanyKey = getTitleCompanyDuplicateKey(candidate.normalizedJob);

    if ((urlKey && selectedUrlKeys.has(urlKey)) || (titleCompanyKey && selectedTitleCompanyKeys.has(titleCompanyKey))) {
      summary.rejectedDuplicates += 1;
      if (candidate.repositorySummary) {
        candidate.repositorySummary.ignoredDuplicates += 1;
      }
      logger.info('Vaga coletada recusada por duplicidade no lote atual.', {
        provider: candidate.provider,
        url: candidate.normalizedJob.url,
        title: candidate.normalizedJob.title,
        company: candidate.normalizedJob.company,
      });
      continue;
    }

    const duplicateCheck = await checkJobDuplicate(candidate.normalizedJob);

    if (duplicateCheck.duplicateByUrl || duplicateCheck.possibleDuplicateByTitleAndCompany) {
      summary.rejectedDuplicates += 1;
      if (candidate.repositorySummary) {
        candidate.repositorySummary.ignoredDuplicates += 1;
      }
      logger.info('Vaga coletada recusada por duplicidade.', {
        provider: candidate.provider,
        existingJobId: duplicateCheck.duplicateByUrl?.id ?? duplicateCheck.possibleDuplicateByTitleAndCompany?.id,
        url: candidate.normalizedJob.url,
        title: candidate.normalizedJob.title,
        company: candidate.normalizedJob.company,
      });
      continue;
    }

    if (urlKey) {
      selectedUrlKeys.add(urlKey);
    }
    if (titleCompanyKey) {
      selectedTitleCompanyKeys.add(titleCompanyKey);
    }
    selectedCandidates.push(candidate);
  }

  summary.selectedForApproval = selectedCandidates.length;

  for (const candidate of selectedCandidates) {
    try {
      const job = await prisma.jobPost.create({
        data: {
          ...candidate.normalizedJob,
          aiGeneratedText: null,
          status: JobStatus.PENDING,
          useAi: true,
          priority: candidate.decision.priority,
          priorityScore: candidate.decision.priorityScore,
          priorityReasons: JSON.stringify(candidate.decision.reasons),
        },
      });

      summary.approvedAsPending += 1;
      summary.approvedJobIds.push(job.id);
      incrementAutomatedRepositoryCreated(candidate.repositorySummary);

      logger.info('Vaga coletada aprovada e criada como PENDING sem gerar IA.', {
        provider: candidate.provider,
        source: candidate.normalizedJob.source,
        jobId: job.id,
        title: job.title,
        priority: candidate.decision.priority,
        priorityScore: candidate.decision.priorityScore,
        reasons: candidate.decision.reasons,
      });
      publishAdminEvent({
        type: 'collection',
        status: 'progress',
        title: 'Vaga aprovada',
        message: `${job.title ?? 'Vaga sem titulo'} entrou na fila PENDING.`,
        details: {
          trigger: options.trigger,
          provider: candidate.provider,
          jobId: job.id,
          priority: candidate.decision.priority,
          priorityScore: candidate.decision.priorityScore,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido ao criar vaga coletada.';
      summary.errors.push({ provider: candidate.provider, message });
      logger.error('Erro ao criar vaga coletada como PENDING.', error, {
        provider: candidate.provider,
        title: candidate.normalizedJob.title,
        url: candidate.normalizedJob.url,
      });
    }
  }

  logger.info('Coleta automatizada finalizada.', {
    analyzed: summary.analyzed,
    rejectedByDomain: summary.rejectedByDomain,
    rejectedByQuality: summary.rejectedByQuality,
    rejectedDuplicates: summary.rejectedDuplicates,
    rejectedByPriority: summary.rejectedByPriority,
    selectedForApproval: summary.selectedForApproval,
    approvedAsPending: summary.approvedAsPending,
    queueTarget: summary.queueTarget,
    slotsToCreate: summary.slotsToCreate,
    errors: summary.errors.length,
  });
  publishAdminEvent({
    type: 'collection',
    status: summary.errors.length > 0 ? 'warning' : 'success',
    title: 'Coleta finalizada',
    message: `${summary.approvedAsPending} vagas aprovadas, ${summary.rejectedDuplicates} duplicatas e ${summary.errors.length} erros.`,
    details: {
      trigger: options.trigger,
      analyzed: summary.analyzed,
      approvedAsPending: summary.approvedAsPending,
      rejectedByDomain: summary.rejectedByDomain,
      rejectedByQuality: summary.rejectedByQuality,
      rejectedDuplicates: summary.rejectedDuplicates,
      rejectedByPriority: summary.rejectedByPriority,
      errors: summary.errors.length,
    },
  });

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

function compareAutomatedCandidates(a: AutomatedCollectionCandidate, b: AutomatedCollectionCandidate): number {
  const priorityDifference = getPrioritySortValue(a.decision.priority) - getPrioritySortValue(b.decision.priority);

  if (priorityDifference !== 0) {
    return priorityDifference;
  }

  const scoreDifference = b.decision.priorityScore - a.decision.priorityScore;

  if (scoreDifference !== 0) {
    return scoreDifference;
  }

  return a.originalIndex - b.originalIndex;
}

function incrementAutomatedRepositoryCreated(repositorySummary?: ProviderRepositorySummary): void {
  if (repositorySummary) {
    repositorySummary.created += 1;
  }
}

function getTitleCompanyDuplicateKey(job: NormalizedCollectedJob): string | null {
  const title = normalizeDuplicateKey(job.title);
  const company = normalizeDuplicateKey(job.company);

  if (!title || !company) {
    return null;
  }

  return `${title}:${company}`;
}

function normalizeDuplicateKey(value: string | null): string | null {
  const normalized = value
    ?.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\/$/, '')
    .replace(/\s+/g, ' ');

  return normalized || null;
}
