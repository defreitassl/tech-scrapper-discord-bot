import { JobPost, JobPriority, JobStatus } from '@prisma/client';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import { generateJobMessage } from './aiMessageGenerator';
import { isUsableGeneratedMessage } from './publishPendingJobs';
import { getSchedulerDailyUsage } from './schedulerOperations';
import { getSchedulerSettings, normalizeSchedulerSettings } from './schedulerSettings';

const CANDIDATE_SCAN_LIMIT = 100;

export type AutoApprovalEligibility =
  | {
      eligible: true;
      reason: 'eligible';
    }
  | {
      eligible: false;
      reason: string;
    };

export type AutoApproveJobsResult = {
  candidatesFound: number;
  approved: number;
  failed: number;
  skipped: number;
  requestedLimit: number;
  approvedJobs: JobPost[];
};

export async function autoApproveJobsForToday(): Promise<AutoApproveJobsResult> {
  const settings = normalizeSchedulerSettings(await getSchedulerSettings());
  const usage = await getSchedulerDailyUsage(settings);
  const pendingCount = await prisma.jobPost.count({ where: { status: JobStatus.PENDING } });
  const limit = Math.max(settings.dailyLimit - usage.sentToday - pendingCount, 0);

  logger.info('Autoaprovacao calculou limite para hoje.', {
    dailyLimit: settings.dailyLimit,
    sentToday: usage.sentToday,
    pendingCount,
    limit,
    timezone: settings.timezone,
  });

  return autoApproveNextJobs(limit);
}

export async function autoApproveNextJobs(limit: number): Promise<AutoApproveJobsResult> {
  const candidates = await findAutoApprovalCandidates(limit);
  const result: AutoApproveJobsResult = {
    candidatesFound: candidates.candidatesFound,
    approved: 0,
    failed: 0,
    skipped: candidates.skipped,
    requestedLimit: limit,
    approvedJobs: [],
  };

  if (limit <= 0) {
    logger.info('Autoaprovacao ignorada porque nao ha vagas necessarias para completar o limite diario.', { limit });
    return result;
  }

  for (const job of candidates.jobs) {
    try {
      logger.info('Autoaprovacao gerando mensagem com IA.', {
        jobId: job.id,
        title: job.title,
        priority: job.priority,
        priorityScore: job.priorityScore,
      });

      const generatedMessage = await generateJobMessage(job);

      if (!isUsableGeneratedMessage(generatedMessage)) {
        throw new Error('Mensagem gerada pela IA nao passou na validacao de formato.');
      }

      const approvedJob = await prisma.jobPost.update({
        where: { id: job.id },
        data: {
          aiGeneratedText: generatedMessage,
          useAi: true,
          status: JobStatus.PENDING,
        },
      });

      result.approved += 1;
      result.approvedJobs.push(approvedJob);

      logger.info('Vaga autoaprovada e colocada na fila.', {
        jobId: job.id,
        previousStatus: job.status,
        nextStatus: JobStatus.PENDING,
        priority: job.priority,
        priorityScore: job.priorityScore,
        messageLength: generatedMessage.length,
      });
    } catch (error) {
      result.failed += 1;
      logger.error('Erro na autoaprovacao de vaga. Vaga mantida como DRAFT.', error, {
        jobId: job.id,
        title: job.title,
        priority: job.priority,
        priorityScore: job.priorityScore,
      });
    }
  }

  logger.info('Autoaprovacao finalizada.', {
    candidatesFound: result.candidatesFound,
    approved: result.approved,
    failed: result.failed,
    skipped: result.skipped,
    requestedLimit: result.requestedLimit,
  });

  return result;
}

export async function findAutoApprovalCandidates(
  limit: number,
): Promise<{ candidatesFound: number; skipped: number; jobs: JobPost[] }> {
  if (limit <= 0) {
    return {
      candidatesFound: 0,
      skipped: 0,
      jobs: [],
    };
  }

  const draftJobs = await prisma.jobPost.findMany({
    where: {
      status: JobStatus.DRAFT,
      priority: {
        in: [JobPriority.HIGH, JobPriority.MEDIUM],
      },
    },
    orderBy: [{ priorityScore: 'desc' }, { createdAt: 'desc' }],
    take: CANDIDATE_SCAN_LIMIT,
  });

  const eligibleJobs = draftJobs.filter((job) => isAutoApprovalEligible(job).eligible).sort(compareAutoApprovalCandidates);

  return {
    candidatesFound: eligibleJobs.length,
    skipped: draftJobs.length - eligibleJobs.length,
    jobs: eligibleJobs.slice(0, limit),
  };
}

export function isAutoApprovalEligible(job: JobPost): AutoApprovalEligibility {
  if (job.status !== JobStatus.DRAFT) {
    return { eligible: false, reason: 'status_not_draft' };
  }

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

function compareAutoApprovalCandidates(a: JobPost, b: JobPost): number {
  const priorityDifference = getPrioritySortValue(a.priority) - getPrioritySortValue(b.priority);

  if (priorityDifference !== 0) {
    return priorityDifference;
  }

  const categoryDifference = getAutoApprovalCategoryRank(a) - getAutoApprovalCategoryRank(b);

  if (categoryDifference !== 0) {
    return categoryDifference;
  }

  const scoreDifference = (b.priorityScore ?? -Infinity) - (a.priorityScore ?? -Infinity);

  if (scoreDifference !== 0) {
    return scoreDifference;
  }

  const levelDifference = getLevelSortValue(a) - getLevelSortValue(b);

  if (levelDifference !== 0) {
    return levelDifference;
  }

  const modalityDifference = getModalitySortValue(a) - getModalitySortValue(b);

  if (modalityDifference !== 0) {
    return modalityDifference;
  }

  return b.createdAt.getTime() - a.createdAt.getTime();
}

function getAutoApprovalCategoryRank(job: JobPost): number {
  if (isInternship(job) && isRemote(job)) {
    return 0;
  }

  if (isInternship(job) && isMinasGerais(job)) {
    return 1;
  }

  if (isTrainee(job) && isRemote(job)) {
    return 2;
  }

  if (isJunior(job) && isRemote(job)) {
    return 3;
  }

  if (isJunior(job) && isMinasGerais(job)) {
    return 4;
  }

  return 5;
}

function getPrioritySortValue(priority: JobPost['priority']): number {
  if (priority === JobPriority.HIGH) {
    return 0;
  }

  if (priority === JobPriority.MEDIUM) {
    return 1;
  }

  return 2;
}

function getLevelSortValue(job: JobPost): number {
  if (isInternship(job)) {
    return 0;
  }

  if (isTrainee(job)) {
    return 1;
  }

  if (isJunior(job)) {
    return 2;
  }

  return 3;
}

function getModalitySortValue(job: JobPost): number {
  if (isRemote(job)) {
    return 0;
  }

  if (hasAnyNormalizedTerm(job.modality, ['hibrido', 'hybrid'])) {
    return 1;
  }

  return 2;
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

function isJunior(job: JobPost): boolean {
  return hasAnyNormalizedTerm([job.level, job.title, job.rawText].filter(Boolean).join(' '), [
    'junior',
    'jr',
    'entry level',
    'entry-level',
  ]);
}

function isRemote(job: JobPost): boolean {
  return hasAnyNormalizedTerm([job.modality, job.location, job.title, job.rawText].filter(Boolean).join(' '), [
    'remoto',
    'remote',
    'home office',
  ]);
}

function isMinasGerais(job: JobPost): boolean {
  return hasAnyNormalizedTerm([job.location, job.title, job.rawText].filter(Boolean).join(' '), [
    'minas gerais',
    'mg',
    'belo horizonte',
    'bh',
    'regiao metropolitana',
    'contagem',
    'betim',
    'nova lima',
    'uberlandia',
    'juiz de fora',
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
