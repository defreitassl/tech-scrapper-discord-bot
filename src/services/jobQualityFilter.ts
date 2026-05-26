import type { CollectedJob } from '../providers/types';
import { classifyJobDomain } from './jobDomainClassifier';

export type JobQualityResult = {
  accepted: boolean;
  reasons: string[];
  score?: number;
};

const HIGH_SENIORITY_TERMS = [
  'pleno',
  'senior',
  'tech lead',
  'lead developer',
  'lead',
  'especialista',
  'staff',
  'principal',
  'arquitetura avancada',
];

const STRONG_EXPERIENCE_PATTERNS = [
  { reason: 'strong_experience:3 anos', pattern: /\b3\s*\+?\s*anos?\b/ },
  { reason: 'strong_experience:4 anos', pattern: /\b4\s*\+?\s*anos?\b/ },
  { reason: 'strong_experience:5 anos', pattern: /\b5\s*\+?\s*anos?\b/ },
  { reason: 'strong_experience:mais de 3 anos', pattern: /\bmais\s+de\s+3\s+anos?\b/ },
  { reason: 'strong_experience:experiencia solida', pattern: /\bexperiencia\s+solida\b/ },
  { reason: 'strong_experience:solida experiencia', pattern: /\bsolida\s+experiencia\b/ },
  { reason: 'strong_experience:forte experiencia', pattern: /\bforte\s+experiencia\b/ },
  { reason: 'strong_experience:dominio avancado', pattern: /\bdominio\s+avancado\b/ },
];

export function evaluateCollectedJobQuality(job: CollectedJob): JobQualityResult {
  const reasons: string[] = [];
  const description = [job.rawText, job.shortDescription].filter(Boolean).join(' ');
  const applicationText = [job.rawText, job.shortDescription].filter(Boolean).join(' ');
  const searchableText = normalizeSearchText(
    [job.title, job.company, job.level, job.stacks, job.shortDescription, job.rawText].filter(Boolean).join(' '),
  );

  if (!job.title?.trim()) {
    reasons.push('missing_title');
  }

  if (!job.url?.trim() && !containsEmail(applicationText)) {
    reasons.push('missing_application_channel');
  }

  if (!description.trim()) {
    reasons.push('missing_description');
  }

  for (const term of HIGH_SENIORITY_TERMS) {
    if (containsSearchTerm(searchableText, normalizeSearchText(term))) {
      reasons.push(`high_seniority:${term}`);
    }
  }

  for (const { reason, pattern } of STRONG_EXPERIENCE_PATTERNS) {
    if (pattern.test(searchableText)) {
      reasons.push(reason);
    }
  }

  const domainClassification = classifyJobDomain(job);
  if (domainClassification.domain === 'NON_TECH') {
    const matchedTerm = domainClassification.nonTechMatches.find((term) => term !== 'missing_tech_signal');
    reasons.push(matchedTerm ? `non_tech_domain:${matchedTerm}` : 'outside_technology_profile');
  }

  const uniqueReasons = Array.from(new Set(reasons));

  return {
    accepted: uniqueReasons.length === 0,
    reasons: uniqueReasons,
    score: Math.max(0, 100 - uniqueReasons.length * 25),
  };
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function containsSearchTerm(normalizedText: string, normalizedTerm: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${escapeRegex(normalizedTerm)}([^a-z0-9]|$)`).test(normalizedText);
}

function containsEmail(value: string): boolean {
  return /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(value);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
