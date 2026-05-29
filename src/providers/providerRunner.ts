import { JobPost, JobPriority, JobStatus } from '@prisma/client';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import { classifyJobDomain } from '../services/jobDomainClassifier';
import { checkJobDuplicate } from '../services/jobDeduplication';
import { evaluateJobPriority, type JobPriorityLevel, type JobPriorityResult } from '../services/jobPriority';
import { evaluateCollectedJobQuality } from '../services/jobQualityFilter';
import { getSchedulerSettings, normalizeSchedulerSettings } from '../services/schedulerSettings';
import { normalizeCollectedJob } from './normalizeCollectedJob';
import { automaticJobProviders, collectableJobProviders } from './providerRegistry';
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
  priorityResult: JobPriorityResult;
};

type AutomatedCollectionCandidate = PrioritizedCollectedJob & {
  provider: string;
};

export async function runJobProviders(
  providers: JobSourceProvider[] = collectableJobProviders,
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
            status: JobStatus.PENDING,
            useAi: true,
            priority: priorityResult.priority,
            priorityScore: priorityResult.score,
            priorityReasons: JSON.stringify(priorityResult.reasons),
          },
        });

        summary.createdJobs += 1;
        summary.created += 1;
        incrementPrioritySummary(summary, priorityResult.priority);
        if (repositorySummary) {
          repositorySummary.created += 1;
        }
        logger.info('Vaga coletada aprovada e criada como PENDING sem gerar IA.', {
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

export async function runAutomatedJobCollection(
  providers: JobSourceProvider[] = automaticJobProviders,
): Promise<AutomatedJobCollectionSummary> {
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

  if (slotsToCreate <= 0) {
    logger.info('Fila PENDING ja esta cheia.', {
      dailyLimit: settings.dailyLimit,
      pendingCount,
      queueTarget,
    });
    return summary;
  }

  const candidates: AutomatedCollectionCandidate[] = [];

  for (const provider of providers) {
    summary.providersExecuted += 1;

    try {
      logger.info('Coleta automatizada de vagas iniciada.', { provider: provider.name });
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

      for (const [originalIndex, collectedJob] of collectedJobs.entries()) {
        const normalizedJob = normalizeCollectedJob(collectedJob, provider.name);
        const repositorySummary = repositorySummaries.get(normalizedJob.source);
        const domainClassification = classifyJobDomain(normalizedJob);

        if (domainClassification.domain === 'NON_TECH') {
          summary.rejectedByDomain += 1;
          if (repositorySummary) {
            repositorySummary.ignoredByQuality += 1;
          }
          logger.info('Vaga coletada recusada por dominio nao tech.', {
            provider: provider.name,
            source: normalizedJob.source,
            title: normalizedJob.title,
            url: normalizedJob.url,
            nonTechMatches: domainClassification.nonTechMatches,
          });
          continue;
        }

        const qualityResult = evaluateCollectedJobQuality({
          ...normalizedJob,
          collectedAt: collectedJob.collectedAt ?? new Date(),
        });

        if (!qualityResult.accepted) {
          summary.rejectedByQuality += 1;
          if (repositorySummary) {
            repositorySummary.ignoredByQuality += 1;
          }
          logger.info('Vaga coletada recusada por filtro de qualidade.', {
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
        const eligibility = isCollectionApprovalEligible(buildSyntheticJob(normalizedJob, priorityResult));

        if (!eligibility.eligible) {
          summary.rejectedByPriority += 1;
          logger.info('Vaga coletada recusada por prioridade/elegibilidade.', {
            provider: provider.name,
            source: normalizedJob.source,
            title: normalizedJob.title,
            priority: priorityResult.priority,
            score: priorityResult.score,
            reason: eligibility.reason,
          });
          continue;
        }

        candidates.push({
          provider: provider.name,
          originalIndex,
          normalizedJob,
          repositorySummary,
          priorityResult,
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
          priority: candidate.priorityResult.priority,
          priorityScore: candidate.priorityResult.score,
          priorityReasons: JSON.stringify(candidate.priorityResult.reasons),
        },
      });

      summary.approvedAsPending += 1;
      summary.approvedJobIds.push(job.id);
      incrementAutomatedRepositoryCreated(candidate.repositorySummary);

      logger.info('Vaga coletada aprovada e criada como PENDING sem gerar IA.', {
        provider: candidate.provider,
        jobId: job.id,
        title: job.title,
        priority: candidate.priorityResult.priority,
        priorityScore: candidate.priorityResult.score,
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

function compareAutomatedCandidates(a: AutomatedCollectionCandidate, b: AutomatedCollectionCandidate): number {
  const priorityDifference = getPrioritySortValue(a.priorityResult.priority) - getPrioritySortValue(b.priorityResult.priority);

  if (priorityDifference !== 0) {
    return priorityDifference;
  }

  const scoreDifference = b.priorityResult.score - a.priorityResult.score;

  if (scoreDifference !== 0) {
    return scoreDifference;
  }

  return a.originalIndex - b.originalIndex;
}

function buildSyntheticJob(normalizedJob: NormalizedCollectedJob, priorityResult: JobPriorityResult): JobPost {
  const now = new Date();

  return {
    id: `collected:${normalizedJob.source}:${normalizedJob.url ?? normalizedJob.title ?? now.getTime()}`,
    ...normalizedJob,
    readyText: null,
    aiGeneratedText: null,
    useAi: true,
    status: JobStatus.PENDING,
    priority: priorityResult.priority,
    priorityScore: priorityResult.score,
    priorityReasons: JSON.stringify(priorityResult.reasons),
    sentAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

function incrementAutomatedRepositoryCreated(repositorySummary?: ProviderRepositorySummary): void {
  if (repositorySummary) {
    repositorySummary.created += 1;
  }
}

function isCollectionApprovalEligible(job: JobPost): { eligible: true; reason: 'eligible' } | { eligible: false; reason: string } {
  if (job.priority === JobPriority.LOW || !job.priority) {
    return { eligible: false, reason: 'priority_not_eligible' };
  }

  if (!job.url?.trim()) {
    return { eligible: false, reason: 'missing_url' };
  }

  if (!job.rawText?.trim() && !job.shortDescription?.trim()) {
    return { eligible: false, reason: 'missing_description' };
  }

  if (hasStrongSenioritySignal(job)) {
    return { eligible: false, reason: 'strong_seniority_signal' };
  }

  if (job.priority === JobPriority.HIGH) {
    return { eligible: true, reason: 'eligible' };
  }

  if (job.priority === JobPriority.MEDIUM && isMediumEligible(job)) {
    return { eligible: true, reason: 'eligible' };
  }

  return { eligible: false, reason: 'medium_without_required_signal' };
}

function isMediumEligible(job: JobPost): boolean {
  return isInternship(job) || isTrainee(job) || isRemote(job) || (job.priorityScore ?? 0) >= 75;
}

function hasStrongSenioritySignal(job: JobPost): boolean {
  const reasons = parsePriorityReasons(job.priorityReasons);

  if (reasons.some((reason) => reason.includes('penalty:experience_3_plus'))) {
    return true;
  }

  const text = normalizeText(
    [job.title, job.level, job.shortDescription, job.rawText, job.priorityReasons].filter(Boolean).join(' '),
  );

  return hasAnyNormalizedTerm(text, [
    'senior',
    'pleno',
    'especialista',
    'tech lead',
    'lead',
    'staff',
    'principal',
    'manager',
    'coordenador',
    'gerente',
  ]);
}

function isInternship(job: JobPost): boolean {
  return hasAnyNormalizedTerm([job.level, job.title, job.rawText].filter(Boolean).join(' '), [
    'estagio',
    'estagiario',
    'intern',
    'internship',
  ]);
}

function isTrainee(job: JobPost): boolean {
  return hasAnyNormalizedTerm([job.level, job.title, job.rawText].filter(Boolean).join(' '), ['trainee']);
}

function isRemote(job: JobPost): boolean {
  return hasAnyNormalizedTerm([job.modality, job.location, job.title, job.rawText].filter(Boolean).join(' '), [
    'remoto',
    'remote',
    'home office',
  ]);
}

function parsePriorityReasons(value: string | null): string[] {
  if (!value?.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);

    if (Array.isArray(parsed)) {
      return parsed.filter((reason): reason is string => typeof reason === 'string');
    }
  } catch {
    return [value];
  }

  return [];
}

function hasAnyNormalizedTerm(value: string | null, terms: string[]): boolean;
function hasAnyNormalizedTerm(value: string, terms: string[]): boolean;
function hasAnyNormalizedTerm(value: string | null, terms: string[]): boolean {
  const normalized = normalizeText(value ?? '');

  return terms.some((term) => containsNormalizedTerm(normalized, normalizeText(term)));
}

function containsNormalizedTerm(normalizedText: string, normalizedTerm: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${escapeRegex(normalizedTerm)}([^a-z0-9]|$)`).test(normalizedText);
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
