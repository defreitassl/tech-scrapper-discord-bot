import type { NormalizedCollectedJob } from '../providers/types';
import { classifyJobDomain, type JobDomain } from './jobDomainClassifier';
import { evaluateJobPriority, type JobPriorityLevel, type JobPriorityResult } from './jobPriority';
import { evaluateCollectedJobQuality } from './jobQualityFilter';

export type JobQueueDecision = {
  accepted: boolean;
  rejectionReason?: string;
  domain: JobDomain;
  priority: JobPriorityLevel;
  priorityScore: number;
  reasons: string[];
  qualityScore?: number;
  qualityReasons?: string[];
};

type QueueEligibility =
  | { eligible: true; reason: 'eligible' }
  | { eligible: false; reason: string };

export function evaluateJobForQueue(job: NormalizedCollectedJob): JobQueueDecision {
  const domainClassification = classifyJobDomain(job);
  const priorityResult = evaluateJobPriority(job);

  if (domainClassification.domain === 'NON_TECH') {
    return buildDecision(domainClassification.domain, priorityResult, {
      accepted: false,
      rejectionReason: buildNonTechRejectionReason(domainClassification.nonTechMatches),
    });
  }

  const qualityResult = evaluateCollectedJobQuality({
    ...job,
    collectedAt: new Date(),
  });

  if (!qualityResult.accepted) {
    return buildDecision(domainClassification.domain, priorityResult, {
      accepted: false,
      rejectionReason: 'quality_insufficient',
      qualityScore: qualityResult.score,
      qualityReasons: qualityResult.reasons,
    });
  }

  const eligibility = isQueueEligible(job, priorityResult);

  if (!eligibility.eligible) {
    return buildDecision(domainClassification.domain, priorityResult, {
      accepted: false,
      rejectionReason: eligibility.reason,
      qualityScore: qualityResult.score,
      qualityReasons: qualityResult.reasons,
    });
  }

  return buildDecision(domainClassification.domain, priorityResult, {
    accepted: true,
    qualityScore: qualityResult.score,
    qualityReasons: qualityResult.reasons,
  });
}

export function isQueueEligible(job: NormalizedCollectedJob, priorityResult: JobPriorityResult): QueueEligibility {
  if (priorityResult.priority === 'LOW') {
    return { eligible: false, reason: 'priority_not_eligible' };
  }

  if (!job.url?.trim()) {
    return { eligible: false, reason: 'missing_url' };
  }

  if (!job.rawText?.trim() && !job.shortDescription?.trim()) {
    return { eligible: false, reason: 'missing_description' };
  }

  if (hasStrongSenioritySignal(job, priorityResult.reasons)) {
    return { eligible: false, reason: 'strong_seniority_signal' };
  }

  if (priorityResult.priority === 'HIGH') {
    return { eligible: true, reason: 'eligible' };
  }

  if (priorityResult.priority === 'MEDIUM' && isMediumEligible(job, priorityResult.score)) {
    return { eligible: true, reason: 'eligible' };
  }

  return { eligible: false, reason: 'medium_without_required_signal' };
}

export function isInternshipLike(job: NormalizedCollectedJob): boolean {
  return hasAnyNormalizedTerm([job.level, job.title, job.rawText].filter(Boolean).join(' '), [
    'estagio',
    'estagiario',
    'intern',
    'internship',
  ]);
}

export function isTraineeLike(job: NormalizedCollectedJob): boolean {
  return hasAnyNormalizedTerm([job.level, job.title, job.rawText].filter(Boolean).join(' '), ['trainee']);
}

export function isRemoteLike(job: NormalizedCollectedJob): boolean {
  return hasAnyNormalizedTerm([job.modality, job.location, job.title, job.rawText].filter(Boolean).join(' '), [
    'remoto',
    'remote',
    'home office',
  ]);
}

export function hasStrongSenioritySignal(job: NormalizedCollectedJob, priorityReasons: string[]): boolean {
  if (priorityReasons.some((reason) => reason.includes('penalty:experience_3_plus'))) {
    return true;
  }

  const text = normalizeText([job.title, job.level, job.shortDescription, job.rawText, ...priorityReasons].filter(Boolean).join(' '));

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

function buildDecision(
  domain: JobDomain,
  priorityResult: JobPriorityResult,
  result: Pick<JobQueueDecision, 'accepted' | 'rejectionReason' | 'qualityScore' | 'qualityReasons'>,
): JobQueueDecision {
  return {
    accepted: result.accepted,
    rejectionReason: result.rejectionReason,
    domain,
    priority: priorityResult.priority,
    priorityScore: priorityResult.score,
    reasons: priorityResult.reasons,
    qualityScore: result.qualityScore,
    qualityReasons: result.qualityReasons,
  };
}

function buildNonTechRejectionReason(nonTechMatches: string[]): string {
  const matchedTerm = nonTechMatches.find((term) => term !== 'missing_tech_signal');

  return matchedTerm ? `non_tech_domain:${matchedTerm}` : 'outside_technology_profile';
}

function isMediumEligible(job: NormalizedCollectedJob, priorityScore: number): boolean {
  return isInternshipLike(job) || isTraineeLike(job) || isRemoteLike(job) || priorityScore >= 75;
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
