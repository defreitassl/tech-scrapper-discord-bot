import { logger } from '../lib/logger';
import { isOlderThanHours, isRecentDate, parseDateOrNow } from './providerDateUtils';
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

const PROVIDER_NAME = 'jobicy';
const MAX_JOB_AGE_DAYS = 30;
const MIN_PUBLICATION_DELAY_HOURS = 6;
const SEARCH_TAGS = ['developer', 'junior', 'intern', 'react', 'node', 'python'];

type JobicyJob = {
  id?: string | number | null;
  url?: string | null;
  jobTitle?: string | null;
  companyName?: string | null;
  jobGeo?: string | null;
  jobType?: string | null;
  jobLevel?: string | null;
  jobExcerpt?: string | null;
  jobDescription?: string | null;
  pubDate?: string | null;
  annualSalaryMin?: string | number | null;
  annualSalaryMax?: string | number | null;
  salaryCurrency?: string | null;
  jobIndustry?: string | string[] | null;
};

type JobicyResponse = { jobs?: JobicyJob[] } | JobicyJob[];

export const jobicyProvider: JobSourceProvider = {
  name: PROVIDER_NAME,
  async collect(): Promise<ProviderCollectResult> {
    const jobs: CollectedJob[] = [];
    const errors: ProviderCollectError[] = [];
    const summary = createProviderSummary(PROVIDER_NAME);
    const seenExternalIds = new Set<string>();

    for (const tag of SEARCH_TAGS) {
      let apiJobs: JobicyJob[];

      try {
        apiJobs = await fetchJobicyJobs(tag);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro desconhecido ao coletar Jobicy.';

        summary.errors += 1;
        errors.push({ provider: `${PROVIDER_NAME}:${tag}`, message });
        logger.error('Erro ao coletar Jobicy. Continuando nas demais buscas.', error, { tag });
        continue;
      }

      summary.totalIssuesRead += apiJobs.length;

      for (const apiJob of apiJobs) {
        const externalId = apiJob.id === null || apiJob.id === undefined ? null : String(apiJob.id);

        if (externalId && seenExternalIds.has(externalId)) {
          continue;
        }

        if (externalId) {
          seenExternalIds.add(externalId);
        }

        if (!isRecentDate(apiJob.pubDate, MAX_JOB_AGE_DAYS) || !isOlderThanHours(apiJob.pubDate, MIN_PUBLICATION_DELAY_HOURS)) {
          summary.ignoredByDate += 1;
          continue;
        }

        const cleanDescription = stripHtml(apiJob.jobDescription);
        const searchableText = compactJoin([
          apiJob.jobTitle,
          apiJob.jobLevel,
          apiJob.jobType,
          apiJob.jobGeo,
          apiJob.jobExcerpt,
          cleanDescription,
        ]);

        if (hasDisallowedSeniority(searchableText)) {
          summary.ignoredBySeniority += 1;
          continue;
        }

        const level = detectLevel(apiJob.jobLevel, searchableText);

        if (!level) {
          summary.ignoredByMissingEntryLevel += 1;
          continue;
        }

        const locationRestriction = normalizeExternalProviderLocation(apiJob.jobGeo);

        if (!isRemoteLocationAllowed(locationRestriction)) {
          summary.ignoredByLocation += 1;
          continue;
        }

        const location = normalizeExternalProviderLocation(locationRestriction, 'Remoto');

        jobs.push({
          externalId: externalId ?? undefined,
          title: apiJob.jobTitle ?? null,
          company: apiJob.companyName ?? null,
          location: location ?? 'Remoto',
          modality: 'Remoto',
          level,
          stacks: extractStacksFromText(compactJoin([normalizeIndustry(apiJob.jobIndustry), apiJob.jobTitle, cleanDescription])),
          salaryRange: formatSalaryRange(apiJob.annualSalaryMin, apiJob.annualSalaryMax, apiJob.salaryCurrency),
          shortDescription: summarizeText(apiJob.jobExcerpt ?? cleanDescription, 80),
          rawText: truncateWords(cleanDescription, 300),
          url: apiJob.url ?? null,
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

async function fetchJobicyJobs(tag: string): Promise<JobicyJob[]> {
  const url = new URL('https://jobicy.com/api/v2/remote-jobs');
  url.searchParams.set('count', '50');
  url.searchParams.set('tag', tag);

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'tech-scrapper-discord-bot',
    },
  });

  if (!response.ok) {
    throw new Error(`Jobicy API retornou status ${response.status}.`);
  }

  const payload = (await response.json()) as JobicyResponse;

  return Array.isArray(payload) ? payload : payload.jobs ?? [];
}

function detectLevel(jobLevel: string | null | undefined, searchableText: string): string | null {
  const detectedLevel = detectEntryLevel(jobLevel ?? '');

  return detectedLevel ?? detectEntryLevel(searchableText);
}

function normalizeIndustry(value: string | string[] | null | undefined): string | null {
  if (Array.isArray(value)) {
    return value.join(' ');
  }

  return value ?? null;
}
