import { logger } from '../lib/logger';
import { fetchPublicJson } from '../scraping/scrapingClient';
import { classifyJobDomain } from '../services/jobDomainClassifier';
import { isRecentDate } from './providerDateUtils';
import { detectEntryLevel, hasDisallowedSeniority } from './providerSeniorityUtils';
import {
  compactJoin,
  extractStacksFromText,
  normalizeSearchText,
  stripHtml,
  summarizeText,
  truncateWords,
} from './providerTextUtils';
import type { CollectedJob, JobSourceProvider, ProviderCollectResult, ProviderRepositorySummary } from './types';

const SOURCE = 'solides';
const API_BASE_URL = 'https://apigw.solides.com.br/jobs/v3/portal-vacancies-new';
const MAX_JOBS_PER_RUN = 20;
const SEARCH_LIMIT = 14;
const MAX_JOB_AGE_DAYS = 30;

const SEARCH_TERMS = [
  'estágio tecnologia',
  'desenvolvedor junior',
  'junior tecnologia',
  'suporte técnico',
  'qa junior',
  'dados junior',
  'remoto junior',
];

const MINAS_GERAIS_TERMS = [
  'minas gerais',
  'mg',
  'belo horizonte',
  'bh',
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

const TECH_AREA_NAMES = ['tecnologia', 'ti', 'informática', 'informatica'];

type SolidesApiResponse = {
  success?: boolean;
  errors?: unknown[];
  data?: {
    totalPages?: number;
    currentPage?: number;
    count?: number;
    data?: SolidesApiJob[];
  };
};

type SolidesApiJob = {
  id: string | number;
  title: string | null;
  description: string | null;
  currentState?: string | null;
  companyName: string | null;
  state?: {
    name?: string | null;
    code?: string | null;
  } | null;
  city?: {
    name?: string | null;
  } | null;
  slug?: string | null;
  redirectLink?: string | null;
  type?: string | null;
  homeOffice?: boolean | null;
  jobType?: string | null;
  salary?: {
    showRangeToApplicant?: boolean | null;
    initialRange?: number | null;
    finalRange?: number | null;
    negotiable?: boolean | null;
  } | null;
  seniority?: Array<{
    name?: string | null;
  }>;
  recruitmentContractType?: Array<{
    name?: string | null;
  }>;
  hardSkills?: Array<{
    name?: string | null;
  }>;
  occupationAreas?: Array<{
    name?: string | null;
  }>;
  benefits?: Array<{
    name?: string | null;
  }>;
  createdAt?: string | null;
  address?: {
    city?: {
      name?: string | null;
    } | null;
    state?: {
      name?: string | null;
      code?: string | null;
    } | null;
    country?: {
      name?: string | null;
    } | null;
    foreign_city?: string | null;
    foreign_state?: string | null;
  } | null;
};

export const solidesProvider: JobSourceProvider = {
  name: SOURCE,
  async collect(): Promise<ProviderCollectResult> {
    const jobs: CollectedJob[] = [];
    const seenIds = new Set<string>();
    const errors: ProviderCollectResult['errors'] = [];
    const termSummaries = SEARCH_TERMS.map((term) => createTermSummary(term));

    for (const term of SEARCH_TERMS) {
      if (jobs.length >= MAX_JOBS_PER_RUN) {
        break;
      }

      const summary = termSummaries.find((item) => item.term === term);

      if (!summary) {
        continue;
      }

      try {
        const response = await fetchPublicJson<SolidesApiResponse>(buildSearchUrl(term));
        const apiJobs = response.data?.data;

        if (!Array.isArray(apiJobs)) {
          throw new Error('Sólides retornou JSON sem lista publica de vagas.');
        }

        for (const apiJob of apiJobs) {
          summary.totalIssuesRead += 1;

          if (jobs.length >= MAX_JOBS_PER_RUN) {
            break;
          }

          const externalId = String(apiJob.id);

          if (seenIds.has(externalId)) {
            continue;
          }

          seenIds.add(externalId);

          if (apiJob.currentState && apiJob.currentState !== 'em_andamento') {
            summary.ignoredByDate += 1;
            continue;
          }

          if (apiJob.createdAt?.trim() && !isRecentDate(apiJob.createdAt, MAX_JOB_AGE_DAYS)) {
            summary.ignoredByDate += 1;
            continue;
          }

          const jobText = buildJobText(apiJob);

          if (hasDisallowedSeniority(jobText)) {
            summary.ignoredBySeniority += 1;
            continue;
          }

          const level = detectSolidesLevel(apiJob, jobText);

          if (!level) {
            summary.ignoredByMissingEntryLevel += 1;
            continue;
          }

          if (!isTechJob(apiJob, jobText)) {
            summary.ignoredByQuality += 1;
            continue;
          }

          if (!isAllowedLocation(apiJob, jobText)) {
            summary.ignoredByLocation += 1;
            continue;
          }

          jobs.push({
            ...mapSolidesJob(apiJob, jobText),
            level,
            source: summary.source,
          });
          summary.returnedByProvider = (summary.returnedByProvider ?? 0) + 1;
        }
      } catch (error) {
        summary.errors += 1;
        errors.push({
          provider: SOURCE,
          message:
            error instanceof Error
              ? `Termo "${term}": ${error.message}`
              : `Erro desconhecido ao consultar termo "${term}".`,
        });
      }

      logger.info('Resumo da coleta Sólides por termo.', {
        term,
        totalRead: summary.totalIssuesRead,
        returnedByProvider: summary.returnedByProvider ?? 0,
        ignoredByDate: summary.ignoredByDate,
        ignoredBySeniority: summary.ignoredBySeniority,
        ignoredByMissingEntryLevel: summary.ignoredByMissingEntryLevel,
        ignoredByLocation: summary.ignoredByLocation,
        ignoredByQuality: summary.ignoredByQuality,
        errors: summary.errors,
      });
    }

    const activeTermSummaries = termSummaries.filter(
      (summary) =>
        summary.totalIssuesRead > 0 ||
        (summary.returnedByProvider ?? 0) > 0 ||
        summary.ignoredByDate > 0 ||
        summary.ignoredBySeniority > 0 ||
        summary.ignoredByMissingEntryLevel > 0 ||
        summary.ignoredByLocation > 0 ||
        summary.ignoredByQuality > 0 ||
        summary.errors > 0,
    );

    return {
      jobs,
      totalIssuesRead: sumTermSummaries(activeTermSummaries, 'totalIssuesRead'),
      ignoredByDate: sumTermSummaries(activeTermSummaries, 'ignoredByDate'),
      ignoredBySeniority: sumTermSummaries(activeTermSummaries, 'ignoredBySeniority'),
      ignoredByMissingEntryLevel: sumTermSummaries(activeTermSummaries, 'ignoredByMissingEntryLevel'),
      ignoredByLocation: sumTermSummaries(activeTermSummaries, 'ignoredByLocation'),
      ignoredByQuality: sumTermSummaries(activeTermSummaries, 'ignoredByQuality'),
      errors,
      repositorySummaries: activeTermSummaries,
    };
  },
};

function createTermSummary(term: string): ProviderRepositorySummary {
  return {
    source: formatTermSource(term),
    term,
    totalIssuesRead: 0,
    returnedByProvider: 0,
    ignoredByDate: 0,
    ignoredBySeniority: 0,
    ignoredByMissingEntryLevel: 0,
    ignoredByLocation: 0,
    ignoredByQuality: 0,
    ignoredDuplicates: 0,
    possibleDuplicates: 0,
    created: 0,
    errors: 0,
  };
}

function sumTermSummaries(
  summaries: ProviderRepositorySummary[],
  field: keyof Pick<
    ProviderRepositorySummary,
    | 'totalIssuesRead'
    | 'ignoredByDate'
    | 'ignoredBySeniority'
    | 'ignoredByMissingEntryLevel'
    | 'ignoredByLocation'
    | 'ignoredByQuality'
  >,
): number {
  return summaries.reduce((total, summary) => total + summary[field], 0);
}

function formatTermSource(term: string): string {
  return `${SOURCE}:${term}`;
}

function buildSearchUrl(term: string): string {
  const url = new URL(API_BASE_URL);
  url.searchParams.set('search', '');
  url.searchParams.set('title', term);
  url.searchParams.set('locations', '');
  url.searchParams.set('take', String(SEARCH_LIMIT));
  url.searchParams.set('page', '1');

  return url.toString();
}

function mapSolidesJob(apiJob: SolidesApiJob, jobText: string): CollectedJob {
  const description = stripHtml(apiJob.description);

  return {
    externalId: String(apiJob.id),
    title: apiJob.title,
    company: apiJob.companyName,
    location: normalizeLocation(apiJob),
    modality: normalizeModality(apiJob),
    level: detectSolidesLevel(apiJob, jobText),
    stacks: normalizeStacks(apiJob, jobText),
    salaryRange: normalizeSalary(apiJob.salary),
    shortDescription: summarizeText(description, 80),
    rawText: truncateWords(jobText, 300),
    url: normalizeJobUrl(apiJob),
    source: SOURCE,
    collectedAt: new Date(),
  };
}

function buildJobText(apiJob: SolidesApiJob): string {
  return compactJoin(
    [
      apiJob.title,
      stripHtml(apiJob.description),
      apiJob.companyName,
      normalizeLocation(apiJob),
      normalizeModality(apiJob),
      getNames(apiJob.seniority).join(' '),
      getNames(apiJob.recruitmentContractType).join(' '),
      getNames(apiJob.hardSkills).join(' '),
      getNames(apiJob.occupationAreas).join(' '),
      getNames(apiJob.benefits).join(' '),
    ],
    ' ',
  );
}

function detectSolidesLevel(apiJob: SolidesApiJob, jobText: string): string | null {
  const structuredLevel = detectEntryLevel(
    compactJoin([getNames(apiJob.seniority).join(' '), getNames(apiJob.recruitmentContractType).join(' ')], ' '),
  );

  if (structuredLevel) {
    return structuredLevel;
  }

  const textLevel = detectEntryLevel(jobText);

  if (textLevel) {
    return textLevel;
  }

  return hasTechnicalSupportSignal(jobText) ? 'Júnior' : null;
}

function isTechJob(apiJob: SolidesApiJob, jobText: string): boolean {
  const categoryNames = getNames(apiJob.occupationAreas);
  const skillNames = getNames(apiJob.hardSkills);
  const domainClassification = classifyJobDomain({
    title: apiJob.title,
    stacks: skillNames.join(', '),
    shortDescription: stripHtml(apiJob.description),
    rawText: jobText,
    categoryNames,
    tagNames: skillNames,
    source: SOURCE,
  });

  if (domainClassification.domain === 'NON_TECH') {
    return false;
  }

  if (domainClassification.domain === 'TECH') {
    return true;
  }

  return hasStrongTechSignal(categoryNames, skillNames, jobText);
}

function hasStrongTechSignal(categoryNames: string[], skillNames: string[], jobText: string): boolean {
  const categories = categoryNames.map(normalizeSearchText);
  const skills = skillNames.map(normalizeSearchText);
  const text = normalizeSearchText(jobText);

  return (
    categories.some((category) => TECH_AREA_NAMES.includes(category)) ||
    skills.length > 0 ||
    extractStacksFromText(jobText) !== null ||
    [
      'desenvolvedor',
      'desenvolvimento',
      'software',
      'programador',
      'qa',
      'quality assurance',
      'dados',
      'sql',
      'suporte tecnico',
      'help desk',
      'infraestrutura',
      'ti',
    ].some((term) => text.includes(normalizeSearchText(term)))
  );
}

function isAllowedLocation(apiJob: SolidesApiJob, jobText: string): boolean {
  const modality = normalizeSearchText(normalizeModality(apiJob) ?? '');
  const location = normalizeSearchText(normalizeLocation(apiJob) ?? '');
  const text = normalizeSearchText(compactJoin([location, jobText], ' '));

  if (modality === 'remoto' || apiJob.homeOffice) {
    return !INCOMPATIBLE_REMOTE_TERMS.some((term) => text.includes(normalizeSearchText(term)));
  }

  return MINAS_GERAIS_TERMS.some((term) => text.includes(normalizeSearchText(term)));
}

function normalizeLocation(apiJob: SolidesApiJob): string | null {
  const city = apiJob.city?.name ?? apiJob.address?.city?.name ?? apiJob.address?.foreign_city;
  const state = apiJob.state?.code ?? apiJob.address?.state?.code ?? apiJob.address?.foreign_state ?? apiJob.state?.name;
  const country = apiJob.address?.country?.name;
  const location = compactJoin([city, state, country], ', ');
  const jobType = normalizeSearchText(apiJob.jobType ?? '');

  if (apiJob.homeOffice || jobType === 'remoto') {
    return location ? `Remoto - ${location}` : 'Remoto';
  }

  return location || null;
}

function normalizeModality(apiJob: SolidesApiJob): string | null {
  const jobType = normalizeSearchText(apiJob.jobType ?? '');
  const type = normalizeSearchText(apiJob.type ?? '');

  if (apiJob.homeOffice || jobType === 'remoto') {
    return 'Remoto';
  }

  if (jobType === 'hibrido' || type === 'mista') {
    return 'Híbrido';
  }

  if (jobType === 'presencial') {
    return 'Presencial';
  }

  return apiJob.jobType ?? apiJob.type ?? null;
}

function normalizeStacks(apiJob: SolidesApiJob, jobText: string): string | null {
  const hardSkills = getNames(apiJob.hardSkills);

  if (hardSkills.length > 0) {
    return hardSkills.join(', ');
  }

  return extractStacksFromText(jobText);
}

function normalizeSalary(salary?: SolidesApiJob['salary']): string | null {
  if (!salary?.showRangeToApplicant) {
    return null;
  }

  if (salary.negotiable) {
    return 'A combinar';
  }

  const from = formatMoney(salary.initialRange);
  const to = formatMoney(salary.finalRange);

  if (from && to && from !== to) {
    return `${from} a ${to}`;
  }

  return from ?? to;
}

function formatMoney(value?: number | null): string | null {
  if (!value || value <= 0) {
    return null;
  }

  return `R$ ${value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function normalizeJobUrl(apiJob: SolidesApiJob): string | null {
  if (apiJob.redirectLink?.trim() && !isLegacySolidesJobsUrl(apiJob.redirectLink)) {
    return apiJob.redirectLink;
  }

  if (!apiJob.slug) {
    return null;
  }

  return `https://${apiJob.slug}.vagas.solides.com.br/vaga/${apiJob.id}`;
}

function isLegacySolidesJobsUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return url.hostname.endsWith('.solides.jobs');
  } catch {
    return false;
  }
}

function hasTechnicalSupportSignal(value: string): boolean {
  const text = normalizeSearchText(value);

  return /\bsuporte\s+tecnico\b/.test(text) || /\bhelp\s*desk\b/.test(text) || /\bsuporte\s+de\s+ti\b/.test(text);
}

function getNames(items?: Array<{ name?: string | null }>): string[] {
  return items?.map((item) => item.name).filter((name): name is string => Boolean(name?.trim())) ?? [];
}
