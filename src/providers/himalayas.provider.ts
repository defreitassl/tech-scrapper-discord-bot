import { logger } from '../lib/logger';
import { isRecentDate, parseDateOrNow } from './providerDateUtils';
import { isRemoteLocationAllowed, normalizeExternalProviderLocation } from './providerLocationUtils';
import { detectEntryLevel, hasDisallowedSeniority } from './providerSeniorityUtils';
import { formatSalaryRange } from './providerSalaryUtils';
import { createProviderSummary } from './providerSummaryUtils';
import {
  compactJoin,
  extractStacksFromText,
  stripHtml,
  summarizeText,
  truncateWords,
} from './providerTextUtils';
import type { CollectedJob, JobSourceProvider, ProviderCollectError, ProviderCollectResult } from './types';

const PROVIDER_NAME = 'himalayas';
const MAX_JOB_AGE_DAYS = 30;
const SEARCH_QUERIES = ['react', 'frontend', 'backend', 'node', 'python', 'software', 'developer', 'intern', 'junior'];

type HimalayasJob = {
  guid?: string | null;
  id?: string | number | null;
  slug?: string | null;
  title?: string | null;
  excerpt?: string | null;
  companyName?: string | null;
  employmentType?: string | null;
  seniority?: string | null;
  locationRestrictions?: string | string[] | null;
  timezoneRestriction?: string | null;
  category?: string | null;
  description?: string | null;
  pubDate?: string | null;
  applicationLink?: string | null;
  url?: string | null;
  minSalary?: string | number | null;
  maxSalary?: string | number | null;
  currency?: string | null;
};

type HimalayasResponse = HimalayasJob[] | { jobs?: HimalayasJob[]; data?: HimalayasJob[] };

export const himalayasProvider: JobSourceProvider = {
  name: PROVIDER_NAME,
  async collect(): Promise<ProviderCollectResult> {
    const jobs: CollectedJob[] = [];
    const errors: ProviderCollectError[] = [];
    const summary = createProviderSummary(PROVIDER_NAME);
    const seenExternalIds = new Set<string>();

    for (const query of SEARCH_QUERIES) {
      let apiJobs: HimalayasJob[];

      try {
        apiJobs = await fetchHimalayasJobs(query);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro desconhecido ao coletar Himalayas.';

        summary.errors += 1;
        errors.push({ provider: `${PROVIDER_NAME}:${query}`, message });
        logger.error('Erro ao coletar Himalayas. Continuando nas demais buscas.', error, { query });
        continue;
      }

      summary.totalIssuesRead += apiJobs.length;

      for (const apiJob of apiJobs) {
        const externalId = getExternalId(apiJob);

        if (externalId && seenExternalIds.has(externalId)) {
          continue;
        }

        if (externalId) {
          seenExternalIds.add(externalId);
        }

        if (!isRecentDate(apiJob.pubDate, MAX_JOB_AGE_DAYS)) {
          summary.ignoredByDate += 1;
          continue;
        }

        const cleanDescription = stripHtml(apiJob.description);
        const searchableText = compactJoin([
          apiJob.title,
          apiJob.seniority,
          apiJob.employmentType,
          apiJob.category,
          apiJob.excerpt,
          cleanDescription,
        ]);

        if (hasDisallowedSeniority(searchableText)) {
          summary.ignoredBySeniority += 1;
          continue;
        }

        const level = detectLevel(apiJob, searchableText);

        if (!level) {
          summary.ignoredByMissingEntryLevel += 1;
          continue;
        }

        const locationRestriction = normalizeExternalProviderLocation(
          apiJob.locationRestrictions,
          apiJob.timezoneRestriction,
        );

        if (!isRemoteLocationAllowed(locationRestriction)) {
          summary.ignoredByLocation += 1;
          continue;
        }

        const location = normalizeExternalProviderLocation(locationRestriction, 'Remoto');

        jobs.push({
          externalId: externalId ?? undefined,
          title: apiJob.title ?? null,
          company: apiJob.companyName ?? null,
          location: location ?? 'Remoto',
          modality: 'Remoto',
          level,
          stacks: extractStacksFromText(compactJoin([apiJob.category, apiJob.title, cleanDescription])),
          salaryRange: formatSalaryRange(apiJob.minSalary, apiJob.maxSalary, apiJob.currency),
          shortDescription: summarizeText(apiJob.excerpt ?? cleanDescription, 80),
          rawText: truncateWords(cleanDescription, 300),
          url: getJobUrl(apiJob),
          source: PROVIDER_NAME,
          collectedAt: parseDateOrNow(apiJob.pubDate),
        });
      }
    }

    return {
      jobs,
      totalIssuesRead: summary.totalIssuesRead,
      ignoredByDate: summary.ignoredByDate,
      ignoredBySeniority: summary.ignoredBySeniority,
      ignoredByMissingEntryLevel: summary.ignoredByMissingEntryLevel,
      ignoredByLocation: summary.ignoredByLocation,
      errors,
      repositorySummaries: [summary],
    };
  },
};

async function fetchHimalayasJobs(query: string): Promise<HimalayasJob[]> {
  const url = new URL('https://himalayas.app/jobs/api/search');
  url.searchParams.set('q', query);
  url.searchParams.set('seniority', 'Entry-level');
  url.searchParams.set('sort', 'recent');
  url.searchParams.set('page', '1');
  url.searchParams.set('limit', '20');

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'tech-scrapper-discord-bot',
    },
  });

  if (response.status === 429) {
    throw new Error('Himalayas API retornou 429 rate limit.');
  }

  if (!response.ok) {
    throw new Error(`Himalayas API retornou status ${response.status}.`);
  }

  const payload = (await response.json()) as HimalayasResponse;

  if (Array.isArray(payload)) {
    return payload;
  }

  return payload.jobs ?? payload.data ?? [];
}

function detectLevel(job: HimalayasJob, searchableText: string): string | null {
  const employmentType = job.employmentType?.trim().toLowerCase();

  if (employmentType === 'intern' || employmentType === 'internship') {
    return 'Estágio';
  }

  if (job.seniority?.toLowerCase().includes('entry')) {
    return 'Júnior';
  }

  return detectEntryLevel(searchableText);
}

function getExternalId(job: HimalayasJob): string | null {
  const value = job.guid ?? job.id ?? job.slug;

  return value === null || value === undefined ? null : String(value);
}

function getJobUrl(job: HimalayasJob): string | null {
  if (job.applicationLink?.trim()) {
    return job.applicationLink;
  }

  if (job.url?.trim()) {
    return job.url;
  }

  if (job.slug?.trim()) {
    return `https://himalayas.app/jobs/${job.slug}`;
  }

  return null;
}
