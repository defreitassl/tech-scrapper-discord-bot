import type { CollectedJob, NormalizedCollectedJob } from '../providers/types';
import { classifyJobDomain } from './jobDomainClassifier';

export type JobPriorityLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export type JobPriorityResult = {
  priority: JobPriorityLevel;
  score: number;
  reasons: string[];
};

const ENTRY_LEVEL_PATTERNS = [
  { points: 50, reason: 'level:internship', pattern: /\b(estagio|estagiario|intern|internship)\b/ },
  { points: 35, reason: 'level:trainee', pattern: /\btrainee\b/ },
  { points: 25, reason: 'level:junior', pattern: /\b(junior|jr|entry[- ]?level)\b/ },
];

const TECH_PROFILE_TERMS = [
  'desenvolvimento',
  'desenvolvedor',
  'software',
  'frontend',
  'front end',
  'backend',
  'back end',
  'fullstack',
  'full stack',
  'dados',
  'data',
  'qa',
  'quality assurance',
  'suporte tecnico',
  'cloud',
  'devops',
];

const REMOTE_SCOPE_TERMS = [
  'brasil',
  'brazil',
  'latam',
  'latin america',
  'america latina',
  'americas',
  'global',
  'worldwide',
  'anywhere',
];

const MINAS_GERAIS_TERMS = [
  'minas gerais',
  'mg',
  'belo horizonte',
  'bh',
  'regiao metropolitana',
  'contagem',
  'betim',
  'nova lima',
  'uberlandia',
  'uberaba',
  'juiz de fora',
  'montes claros',
  'ipatinga',
  'divinopolis',
  'sete lagoas',
  'pouso alegre',
  'governador valadares',
];

const INCOMPATIBLE_REMOTE_TERMS = [
  'united states only',
  'us only',
  'usa only',
  'canada only',
  'uk only',
  'europe only',
  'eu only',
  'european union',
  'australia only',
  'new zealand only',
  'india only',
  'philippines only',
  'germany only',
  'france only',
  'spain only',
  'portugal only',
];

const OUT_OF_MINAS_GERAIS_TERMS = [
  'sao paulo',
  'sp',
  'rio de janeiro',
  'rj',
  'brasilia',
  'df',
  'curitiba',
  'pr',
  'porto alegre',
  'rs',
  'florianopolis',
  'sc',
  'recife',
  'pe',
  'salvador',
  'ba',
  'fortaleza',
  'ce',
  'goiania',
  'go',
];

const TWO_PLUS_EXPERIENCE_PATTERNS = [
  /\b2\s*\+?\s*anos?\b/,
  /\bmais\s+de\s+2\s+anos?\b/,
  /\bminimo\s+de\s+2\s+anos?\b/,
];

const THREE_PLUS_EXPERIENCE_PATTERNS = [
  /\b3\s*\+?\s*anos?\b/,
  /\b4\s*\+?\s*anos?\b/,
  /\b5\s*\+?\s*anos?\b/,
  /\bmais\s+de\s+3\s+anos?\b/,
  /\bminimo\s+de\s+3\s+anos?\b/,
  /\bexperiencia\s+solida\b/,
  /\bsolida\s+experiencia\b/,
  /\bforte\s+experiencia\b/,
  /\bdominio\s+avancado\b/,
];

export function evaluateJobPriority(job: CollectedJob | NormalizedCollectedJob): JobPriorityResult {
  const reasons: string[] = [];
  let score = 0;

  const normalizedLevelText = normalizeSearchText([job.level, job.title, job.rawText].filter(Boolean).join(' '));
  const normalizedModality = normalizeSearchText(job.modality ?? '');
  const normalizedLocation = normalizeSearchText(job.location ?? '');
  const searchableText = normalizeSearchText(
    [
      job.title,
      job.company,
      job.location,
      job.modality,
      job.level,
      job.stacks,
      job.shortDescription,
      job.rawText,
      job.url,
    ]
      .filter(Boolean)
      .join(' '),
  );

  const levelMatch = ENTRY_LEVEL_PATTERNS.find(({ pattern }) => pattern.test(normalizedLevelText));
  if (levelMatch) {
    score += levelMatch.points;
    reasons.push(`${levelMatch.reason}:+${levelMatch.points}`);
  }

  if (containsSearchTerm(normalizedModality, 'remoto') || containsSearchTerm(searchableText, 'remote')) {
    score += 40;
    reasons.push('modality:remote:+40');
  } else if (containsSearchTerm(normalizedModality, 'hibrido') || containsSearchTerm(normalizedModality, 'hybrid')) {
    score += 15;
    reasons.push('modality:hybrid:+15');
  } else if (containsSearchTerm(normalizedModality, 'presencial') || containsSearchTerm(normalizedModality, 'on site')) {
    score += 5;
    reasons.push('modality:on_site:+5');
  }

  if (hasAnyTerm(normalizedLocation, REMOTE_SCOPE_TERMS) || hasAnyTerm(searchableText, REMOTE_SCOPE_TERMS)) {
    score += 20;
    reasons.push('location:remote_scope:+20');
  }

  if (hasAnyTerm(normalizedLocation, MINAS_GERAIS_TERMS) || hasAnyTerm(searchableText, MINAS_GERAIS_TERMS)) {
    score += 20;
    reasons.push('location:minas_gerais:+20');
  }

  if (isNonRemoteModality(normalizedModality) && normalizedLocation && !hasAnyTerm(normalizedLocation, MINAS_GERAIS_TERMS)) {
    score -= 30;
    reasons.push('location:other_non_remote:-30');
  }

  const domainClassification = classifyJobDomain(job);

  if (domainClassification.domain === 'NON_TECH') {
    score -= 100;
    reasons.push(`penalty:non_tech_domain:${domainClassification.nonTechMatches.join('|') || 'unknown'}:-100`);
  } else if (domainClassification.domain === 'TECH' || hasAnyTerm(searchableText, TECH_PROFILE_TERMS)) {
    score += 20;
    reasons.push('profile:technology:+20');
  } else if (domainClassification.domain === 'POSSIBLY_TECH') {
    score += 8;
    reasons.push('profile:possibly_technology:+8');
  }

  if (job.shortDescription?.trim()) {
    score += 10;
    reasons.push('quality:short_description:+10');
  }

  if (isUsefulText(job.rawText)) {
    score += 10;
    reasons.push('quality:useful_raw_text:+10');
  }

  if (job.stacks?.trim()) {
    score += 10;
    reasons.push('quality:stacks:+10');
  }

  if (job.url?.trim()) {
    score += 10;
    reasons.push('quality:url:+10');
  }

  if (THREE_PLUS_EXPERIENCE_PATTERNS.some((pattern) => pattern.test(searchableText))) {
    score -= 25;
    reasons.push('penalty:experience_3_plus:-25');
  } else if (TWO_PLUS_EXPERIENCE_PATTERNS.some((pattern) => pattern.test(searchableText))) {
    score -= 10;
    reasons.push('penalty:experience_2_plus:-10');
  }

  if (isGenericText(job.shortDescription, job.rawText)) {
    score -= 10;
    reasons.push('penalty:generic_text:-10');
  }

  if (hasIncompatibleLocation(normalizedLocation, normalizedModality, searchableText)) {
    score -= 40;
    reasons.push('penalty:incompatible_location:-40');
  }

  if (!job.shortDescription?.trim() && !isUsefulText(job.rawText)) {
    score -= 20;
    reasons.push('penalty:missing_description:-20');
  }

  if (!job.url?.trim()) {
    score -= 30;
    reasons.push('penalty:missing_url:-30');
  }

  return {
    priority: domainClassification.domain === 'NON_TECH' ? 'LOW' : classifyPriority(score),
    score,
    reasons,
  };
}

function classifyPriority(score: number): JobPriorityLevel {
  if (score >= 90) {
    return 'HIGH';
  }

  if (score >= 55) {
    return 'MEDIUM';
  }

  return 'LOW';
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function hasAnyTerm(normalizedText: string, terms: string[]): boolean {
  return terms.some((term) => containsSearchTerm(normalizedText, normalizeSearchText(term)));
}

function containsSearchTerm(normalizedText: string, normalizedTerm: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${escapeRegex(normalizedTerm)}([^a-z0-9]|$)`).test(normalizedText);
}

function isNonRemoteModality(normalizedModality: string): boolean {
  return (
    containsSearchTerm(normalizedModality, 'hibrido') ||
    containsSearchTerm(normalizedModality, 'hybrid') ||
    containsSearchTerm(normalizedModality, 'presencial') ||
    containsSearchTerm(normalizedModality, 'on site')
  );
}

function isUsefulText(value?: string | null): boolean {
  return Boolean(value?.trim() && normalizeSearchText(value).split(' ').length >= 12);
}

function isGenericText(shortDescription?: string | null, rawText?: string | null): boolean {
  const text = normalizeSearchText([shortDescription, rawText].filter(Boolean).join(' '));

  if (!text) {
    return false;
  }

  return (
    text.length < 80 ||
    /^(oportunidade|vaga|venha fazer parte|estamos contratando|confira essa vaga)\b/.test(text)
  );
}

function hasIncompatibleLocation(
  normalizedLocation: string,
  normalizedModality: string,
  normalizedSearchableText: string,
): boolean {
  if (hasAnyTerm(normalizedSearchableText, INCOMPATIBLE_REMOTE_TERMS)) {
    return true;
  }

  if (!isNonRemoteModality(normalizedModality)) {
    return false;
  }

  return hasAnyTerm(normalizedLocation, OUT_OF_MINAS_GERAIS_TERMS);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
