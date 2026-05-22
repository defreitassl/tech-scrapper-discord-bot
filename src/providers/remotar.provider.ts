import { logger } from '../lib/logger';
import { fetchPublicJson } from '../scraping/scrapingClient';
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

const SOURCE = 'remotar';
const API_BASE_URL = 'https://api.remotar.com.br/jobs';
const SITE_BASE_URL = 'https://remotar.com.br';
const MAX_JOBS_PER_RUN = 20;
const MAX_JOB_AGE_DAYS = 30;

const SEARCH_SOURCES = [
  {
    term: 'desenvolvedor junior',
    search: 'desenvolvedor junior',
    categoryId: 13,
    tagIds: [17],
  },
  {
    term: 'estagio tecnologia',
    search: 'estagio tecnologia',
    tagIds: [10],
  },
  {
    term: 'junior tecnologia',
    search: 'junior tecnologia',
    tagIds: [17],
  },
  {
    term: 'front-end junior',
    search: 'front-end junior',
    categoryId: 13,
    tagIds: [17],
  },
  {
    term: 'backend junior',
    search: 'backend junior',
    categoryId: 13,
    tagIds: [17],
  },
  {
    term: 'suporte tecnico',
    search: 'suporte tecnico junior',
    categoryId: 2,
    tagIds: [17],
  },
  {
    term: 'qa junior',
    search: 'qa junior',
    categoryId: 8,
    tagIds: [17],
  },
  {
    term: 'dados junior',
    search: 'dados junior',
    categoryId: 4,
    tagIds: [17],
  },
  {
    term: 'remoto junior',
    search: 'junior',
    tagIds: [17, 4],
  },
];

const TECH_CATEGORY_NAMES = [
  'atendimento & suporte',
  'data science / analytics',
  'devops',
  'programacao',
  'programacao mobile',
  'qa',
  'sysadmin',
  'ux/ui',
];

const TECH_TERMS = [
  'desenvolvedor',
  'desenvolvimento',
  'developer',
  'software',
  'front end',
  'front-end',
  'frontend',
  'back end',
  'back-end',
  'backend',
  'fullstack',
  'full stack',
  'suporte tecnico',
  'qa',
  'quality assurance',
  'dados',
  'data',
  'analytics',
  'devops',
  'programacao',
  'tecnologia',
  'tech',
  'ti',
  'java',
  'javascript',
  'typescript',
  'react',
  'node',
  'python',
  'php',
  'sql',
  'cloud',
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

type RemotarSearchSource = {
  term: string;
  search: string;
  categoryId?: number;
  tagIds?: number[];
};

type RemotarApiResponse = {
  meta?: {
    total?: number;
    per_page?: number;
    current_page?: number;
    last_page?: number;
  };
  data?: RemotarApiJob[];
};

type RemotarApiJob = {
  id: number;
  title: string | null;
  subtitle: string | null;
  description: string | null;
  moreInfos: string | null;
  city: string | null;
  state: string | null;
  type: 'remote' | 'hybrid' | 'on-site' | string | null;
  expired: boolean;
  expiresAt: string | null;
  externalLink: string | null;
  isExternalLink: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  integrationSource: string | null;
  company?: {
    id?: number;
    name?: string | null;
  } | null;
  jobCategories?: Array<{
    category?: {
      id?: number;
      name?: string | null;
    } | null;
  }>;
  jobTags?: Array<{
    tag?: {
      id?: number;
      name?: string | null;
    } | null;
  }>;
  jobRequirements?: Array<{
    description?: string | null;
    mandatory?: boolean;
  }>;
  jobSalary?: {
    from: number | null;
    to: number | null;
    currency: string | null;
    type: string | null;
  } | null;
};

export const remotarProvider: JobSourceProvider = {
  name: SOURCE,
  async collect(): Promise<ProviderCollectResult> {
    const jobs: CollectedJob[] = [];
    const seenIds = new Set<number>();
    const errors: ProviderCollectResult['errors'] = [];
    const sourceSummaries = SEARCH_SOURCES.map((source) => createSourceSummary(source.term));

    for (const source of SEARCH_SOURCES) {
      if (jobs.length >= MAX_JOBS_PER_RUN) {
        break;
      }

      const summary = sourceSummaries.find((item) => item.term === source.term);

      if (!summary) {
        continue;
      }

      try {
        const response = await fetchPublicJson<RemotarApiResponse>(buildSearchUrl(source));

        if (!Array.isArray(response.data)) {
          throw new Error('Remotar retornou JSON sem lista publica de vagas.');
        }

        for (const apiJob of response.data) {
          summary.totalIssuesRead += 1;

          if (jobs.length >= MAX_JOBS_PER_RUN) {
            break;
          }

          if (seenIds.has(apiJob.id)) {
            continue;
          }

          seenIds.add(apiJob.id);

          if (apiJob.expired || !isRecentDate(apiJob.createdAt, MAX_JOB_AGE_DAYS)) {
            summary.ignoredByDate += 1;
            continue;
          }

          const jobText = buildJobText(apiJob);

          if (hasDisallowedSeniority(jobText)) {
            summary.ignoredBySeniority += 1;
            continue;
          }

          const level = detectRemotarLevel(apiJob, jobText);

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
            ...mapRemotarJob(apiJob, jobText),
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
              ? `Termo "${source.term}": ${error.message}`
              : `Erro desconhecido ao consultar termo "${source.term}".`,
        });
      }

      logger.info('Resumo da coleta Remotar por termo.', {
        term: source.term,
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

    const activeSourceSummaries = sourceSummaries.filter(
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
      totalIssuesRead: sumSourceSummaries(activeSourceSummaries, 'totalIssuesRead'),
      ignoredByDate: sumSourceSummaries(activeSourceSummaries, 'ignoredByDate'),
      ignoredBySeniority: sumSourceSummaries(activeSourceSummaries, 'ignoredBySeniority'),
      ignoredByMissingEntryLevel: sumSourceSummaries(activeSourceSummaries, 'ignoredByMissingEntryLevel'),
      ignoredByLocation: sumSourceSummaries(activeSourceSummaries, 'ignoredByLocation'),
      ignoredByQuality: sumSourceSummaries(activeSourceSummaries, 'ignoredByQuality'),
      errors,
      repositorySummaries: activeSourceSummaries,
    };
  },
};

function createSourceSummary(term: string): ProviderRepositorySummary {
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

function sumSourceSummaries(
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

function buildSearchUrl(source: RemotarSearchSource): string {
  const url = new URL(API_BASE_URL);
  url.searchParams.set('search', source.search);

  if (source.tagIds?.length) {
    url.searchParams.set('tagId', source.tagIds.join(','));
  }

  if (source.categoryId) {
    url.searchParams.set('categoryId', String(source.categoryId));
  }

  return url.toString();
}

function mapRemotarJob(apiJob: RemotarApiJob, jobText: string): CollectedJob {
  const description = stripHtml(compactJoin([apiJob.description, apiJob.moreInfos], ' '));

  return {
    externalId: String(apiJob.id),
    title: apiJob.title,
    company: apiJob.company?.name ?? null,
    location: normalizeLocation(apiJob),
    modality: normalizeModality(apiJob.type),
    level: detectRemotarLevel(apiJob, jobText),
    stacks: extractStacksFromText(jobText),
    salaryRange: normalizeSalary(apiJob.jobSalary),
    shortDescription: summarizeText(description, 80),
    rawText: truncateWords(jobText, 300),
    url: buildJobUrl(apiJob),
    source: SOURCE,
    collectedAt: new Date(),
  };
}

function buildJobText(apiJob: RemotarApiJob): string {
  const requirements =
    apiJob.jobRequirements
      ?.map((requirement) => requirement.description)
      .filter((description): description is string => Boolean(description?.trim()))
      .join(' ') ?? '';

  return compactJoin(
    [
      apiJob.title,
      apiJob.subtitle,
      stripHtml(apiJob.description),
      stripHtml(apiJob.moreInfos),
      requirements,
      getCategoryNames(apiJob).join(' '),
      getTagNames(apiJob).join(' '),
      normalizeLocation(apiJob),
      apiJob.integrationSource,
    ],
    ' ',
  );
}

function detectRemotarLevel(apiJob: RemotarApiJob, jobText: string): string | null {
  const tagLevel = detectEntryLevel(getTagNames(apiJob).join(' '));

  return tagLevel ?? detectEntryLevel(jobText);
}

function isTechJob(apiJob: RemotarApiJob, jobText: string): boolean {
  const categories = getCategoryNames(apiJob).map(normalizeSearchText);

  if (categories.some((category) => TECH_CATEGORY_NAMES.includes(category))) {
    return true;
  }

  const text = normalizeSearchText(jobText);

  return TECH_TERMS.some((term) => text.includes(normalizeSearchText(term)));
}

function isAllowedLocation(apiJob: RemotarApiJob, jobText: string): boolean {
  const type = normalizeSearchText(apiJob.type ?? '');
  const location = normalizeSearchText(compactJoin([apiJob.city, apiJob.state], ' '));
  const text = normalizeSearchText(compactJoin([location, jobText], ' '));

  if (type === 'remote') {
    return !INCOMPATIBLE_REMOTE_TERMS.some((term) => text.includes(normalizeSearchText(term)));
  }

  return MINAS_GERAIS_TERMS.some((term) => text.includes(normalizeSearchText(term)));
}

function normalizeLocation(apiJob: RemotarApiJob): string | null {
  const location = compactJoin([apiJob.city, apiJob.state], ', ');

  if (apiJob.type === 'remote') {
    return location ? `Remoto - ${location}` : 'Remoto';
  }

  return location || null;
}

function normalizeModality(type?: string | null): string | null {
  if (type === 'remote') {
    return 'Remoto';
  }

  if (type === 'hybrid') {
    return 'Híbrido';
  }

  if (type === 'on-site') {
    return 'Presencial';
  }

  return type ?? null;
}

function normalizeSalary(salary?: RemotarApiJob['jobSalary']): string | null {
  if (!salary || salary.type === 'uninformed') {
    return null;
  }

  if (salary.type === 'toMatch') {
    return salary.currency ? `A combinar (${salary.currency})` : 'A combinar';
  }

  const currency = salary.currency ?? 'BRL';
  const from = formatMoney(salary.from, currency);
  const to = formatMoney(salary.to, currency);

  if (from && to && from !== to) {
    return `${from} a ${to}`;
  }

  return from ?? to;
}

function formatMoney(value: number | null, currency: string): string | null {
  if (!value || value <= 0) {
    return null;
  }

  const amount = value / 100;

  return `${currency} ${amount.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function buildJobUrl(apiJob: RemotarApiJob): string {
  const companySlug = slugify(apiJob.company?.name ?? 'empresa');
  const jobSlug = slugify(apiJob.title ?? 'vaga');

  return `${SITE_BASE_URL}/job/${apiJob.id}/${companySlug}/${jobSlug}`;
}

function getCategoryNames(apiJob: RemotarApiJob): string[] {
  return (
    apiJob.jobCategories
      ?.map((item) => item.category?.name)
      .filter((name): name is string => Boolean(name?.trim())) ?? []
  );
}

function getTagNames(apiJob: RemotarApiJob): string[] {
  return apiJob.jobTags?.map((item) => item.tag?.name).filter((name): name is string => Boolean(name?.trim())) ?? [];
}

function slugify(value: string): string {
  return normalizeSearchText(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
