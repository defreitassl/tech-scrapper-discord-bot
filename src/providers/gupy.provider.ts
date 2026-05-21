import { logger } from '../lib/logger';
import { fetchPublicJson } from '../scraping/scrapingClient';
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

const SOURCE = 'gupy';
const API_BASE_URL = 'https://employability-portal.gupy.io/api/v1/jobs';
const MAX_JOBS_PER_RUN = 20;
const SEARCH_LIMIT = 10;
const MAX_JOB_AGE_DAYS = 30;

const SEARCH_TERMS = [
  'estagio tecnologia',
  'junior tecnologia',
  'trainee tecnologia',
  'suporte tecnico junior',
  'desenvolvedor junior',
  'qa junior',
  'dados junior',
];

const MINAS_GERAIS_CITIES = [
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

type GupyApiJob = {
  id: number;
  name: string;
  description: string | null;
  careerPageName: string | null;
  type: string | null;
  publishedDate: string | null;
  applicationDeadline?: string | null;
  isRemoteWork: boolean;
  city: string | null;
  state: string | null;
  country: string | null;
  jobUrl: string | null;
  workplaceType: 'remote' | 'hybrid' | 'on-site' | string | null;
  skills?: string[];
};

type GupyApiResponse = {
  data: GupyApiJob[];
  pagination?: {
    total?: number;
    limit?: number;
    offset?: number;
  };
};

export const gupyProvider: JobSourceProvider = {
  name: SOURCE,
  async collect(): Promise<ProviderCollectResult> {
    const jobs: CollectedJob[] = [];
    const seenIds = new Set<number>();
    const errors: ProviderCollectResult['errors'] = [];
    const termSummaries = SEARCH_TERMS.map((term) => createTermSummary(term));

    for (const term of SEARCH_TERMS) {
      if (jobs.length >= MAX_JOBS_PER_RUN) {
        break;
      }

      const termSummary = termSummaries.find((summary) => summary.term === term);

      if (!termSummary) {
        continue;
      }

      try {
        const response = await fetchPublicJson<GupyApiResponse>(buildSearchUrl(term));

        if (!Array.isArray(response.data)) {
          throw new Error('Gupy retornou JSON sem lista de vagas publica.');
        }

        for (const apiJob of response.data) {
          termSummary.totalIssuesRead += 1;

          if (seenIds.has(apiJob.id)) {
            continue;
          }

          seenIds.add(apiJob.id);

          const collectedJob = mapGupyJob(apiJob);

          if (!isRecentJob(apiJob.publishedDate)) {
            termSummary.ignoredByDate += 1;
            continue;
          }

          const level = detectGupyLevel(apiJob);
          const levelText = compactJoin([apiJob.name, apiJob.description, apiJob.type], ' ');

          if (hasDisallowedSeniority(levelText)) {
            termSummary.ignoredBySeniority += 1;
            continue;
          }

          if (!level) {
            termSummary.ignoredByMissingEntryLevel += 1;
            continue;
          }

          if (!isAllowedLocation(apiJob)) {
            termSummary.ignoredByLocation += 1;
            continue;
          }

          jobs.push({
            ...collectedJob,
            level,
            source: termSummary.source,
          });
          termSummary.returnedByProvider = (termSummary.returnedByProvider ?? 0) + 1;

          if (jobs.length >= MAX_JOBS_PER_RUN) {
            break;
          }
        }
      } catch (error) {
        termSummary.errors += 1;
        errors.push({
          provider: SOURCE,
          message:
            error instanceof Error
              ? `Termo "${term}": ${error.message}`
              : `Erro desconhecido ao consultar termo "${term}".`,
        });
      }

      logger.info('Resumo da coleta Gupy por termo.', {
        term,
        totalRead: termSummary.totalIssuesRead,
        returnedByProvider: termSummary.returnedByProvider ?? 0,
        ignoredByDate: termSummary.ignoredByDate,
        ignoredBySeniority: termSummary.ignoredBySeniority,
        ignoredByMissingEntryLevel: termSummary.ignoredByMissingEntryLevel,
        ignoredByLocation: termSummary.ignoredByLocation,
        errors: termSummary.errors,
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
        summary.errors > 0,
    );

    return {
      jobs,
      totalIssuesRead: sumTermSummaries(activeTermSummaries, 'totalIssuesRead'),
      ignoredByDate: sumTermSummaries(activeTermSummaries, 'ignoredByDate'),
      ignoredBySeniority: sumTermSummaries(activeTermSummaries, 'ignoredBySeniority'),
      ignoredByMissingEntryLevel: sumTermSummaries(activeTermSummaries, 'ignoredByMissingEntryLevel'),
      ignoredByLocation: sumTermSummaries(activeTermSummaries, 'ignoredByLocation'),
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
    'totalIssuesRead' | 'ignoredByDate' | 'ignoredBySeniority' | 'ignoredByMissingEntryLevel' | 'ignoredByLocation'
  >,
): number {
  return summaries.reduce((total, summary) => total + summary[field], 0);
}

function formatTermSource(term: string): string {
  return `${SOURCE}:${term}`;
}

function buildSearchUrl(term: string): string {
  const url = new URL(API_BASE_URL);
  url.searchParams.set('jobName', term);
  url.searchParams.set('limit', String(SEARCH_LIMIT));
  url.searchParams.set('offset', '0');

  return url.toString();
}

function mapGupyJob(apiJob: GupyApiJob): CollectedJob {
  const description = stripHtml(apiJob.description);
  const location = normalizeLocation(apiJob);

  return {
    externalId: String(apiJob.id),
    title: apiJob.name,
    company: apiJob.careerPageName,
    location,
    modality: normalizeModality(apiJob),
    level: detectGupyLevel(apiJob),
    stacks: normalizeStacks(apiJob),
    salaryRange: null,
    shortDescription: summarizeText(description, 80),
    rawText: truncateWords(description, 300),
    url: apiJob.jobUrl,
    source: SOURCE,
    collectedAt: new Date(),
  };
}

function detectGupyLevel(apiJob: GupyApiJob): string | null {
  if (apiJob.type === 'vacancy_type_internship') {
    return 'Estágio';
  }

  const text = compactJoin([apiJob.name, apiJob.description, apiJob.type], ' ');

  return detectEntryLevel(text);
}

function normalizeStacks(apiJob: GupyApiJob): string | null {
  if (apiJob.skills && apiJob.skills.length > 0) {
    return apiJob.skills.join(', ');
  }

  return extractStacksFromText(compactJoin([apiJob.name, apiJob.description], ' '));
}

function normalizeLocation(apiJob: GupyApiJob): string | null {
  if (apiJob.isRemoteWork || apiJob.workplaceType === 'remote') {
    return apiJob.country ? `Remoto - ${apiJob.country}` : 'Remoto';
  }

  return compactJoin([apiJob.city, normalizeState(apiJob.state), apiJob.country], ' - ') || null;
}

function normalizeModality(apiJob: GupyApiJob): string | null {
  if (apiJob.isRemoteWork || apiJob.workplaceType === 'remote') {
    return 'Remoto';
  }

  if (apiJob.workplaceType === 'hybrid') {
    return 'Hibrido';
  }

  if (apiJob.workplaceType === 'on-site') {
    return 'Presencial';
  }

  return apiJob.workplaceType;
}

function normalizeState(state?: string | null): string | null {
  if (!state?.trim()) {
    return null;
  }

  return normalizeSearchText(state) === 'minas gerais' ? 'MG' : state;
}

function isRecentJob(publishedDate?: string | null): boolean {
  if (!publishedDate) {
    return true;
  }

  const publishedAt = new Date(publishedDate);

  if (Number.isNaN(publishedAt.getTime())) {
    return true;
  }

  const maxAgeMs = MAX_JOB_AGE_DAYS * 24 * 60 * 60 * 1000;

  return Date.now() - publishedAt.getTime() <= maxAgeMs;
}

function isAllowedLocation(apiJob: GupyApiJob): boolean {
  if (apiJob.isRemoteWork || apiJob.workplaceType === 'remote') {
    return true;
  }

  const locationText = normalizeSearchText(compactJoin([apiJob.city, apiJob.state, apiJob.country], ' '));

  if (locationText.includes('minas gerais')) {
    return true;
  }

  return MINAS_GERAIS_CITIES.some((city) => locationText.includes(city));
}
