import { logger } from '../lib/logger';
import { isRecentDate, parseDateOrNow } from './providerDateUtils';
import { isRemoteLocationAllowed, normalizeExternalProviderLocation } from './providerLocationUtils';
import { detectEntryLevel, hasDisallowedSeniority } from './providerSeniorityUtils';
import { createProviderSummary } from './providerSummaryUtils';
import {
  compactJoin,
  extractStacksFromText,
  stripHtml,
  summarizeText,
  truncateWords,
} from './providerTextUtils';
import type { CollectedJob, JobSourceProvider, ProviderCollectError, ProviderCollectResult } from './types';

const PROVIDER_NAME = 'remotive';
const MAX_JOB_AGE_DAYS = 30;
const SEARCH_TERMS = ['junior', 'intern', 'frontend', 'backend'];

type RemotiveJob = {
  id?: string | number | null;
  url?: string | null;
  title?: string | null;
  company_name?: string | null;
  job_type?: string | null;
  publication_date?: string | null;
  candidate_required_location?: string | null;
  salary?: string | null;
  description?: string | null;
  category?: string | null;
};

type RemotiveResponse = {
  jobs?: RemotiveJob[];
};

export const remotiveProvider: JobSourceProvider = {
  name: PROVIDER_NAME,
  async collect(): Promise<ProviderCollectResult> {
    const jobs: CollectedJob[] = [];
    const errors: ProviderCollectError[] = [];
    const summary = createProviderSummary(PROVIDER_NAME);
    const seenExternalIds = new Set<string>();

    for (const search of SEARCH_TERMS) {
      let apiJobs: RemotiveJob[];

      try {
        apiJobs = await fetchRemotiveJobs(search);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro desconhecido ao coletar Remotive.';

        summary.errors += 1;
        errors.push({ provider: `${PROVIDER_NAME}:${search}`, message });
        logger.error('Erro ao coletar Remotive. Continuando nas demais buscas.', error, { search });
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

        if (!isRecentDate(apiJob.publication_date, MAX_JOB_AGE_DAYS)) {
          summary.ignoredByDate += 1;
          continue;
        }

        const cleanDescription = stripHtml(apiJob.description);
        const searchableText = compactJoin([
          apiJob.title,
          apiJob.job_type,
          apiJob.category,
          apiJob.candidate_required_location,
          cleanDescription,
        ]);

        if (hasDisallowedSeniority(searchableText)) {
          summary.ignoredBySeniority += 1;
          continue;
        }

        const level = detectEntryLevel(searchableText);

        if (!level) {
          summary.ignoredByMissingEntryLevel += 1;
          continue;
        }

        const locationRestriction = normalizeExternalProviderLocation(apiJob.candidate_required_location);

        if (!isRemoteLocationAllowed(locationRestriction)) {
          summary.ignoredByLocation += 1;
          continue;
        }

        const location = normalizeExternalProviderLocation(locationRestriction, 'Remoto');

        jobs.push({
          externalId: externalId ?? undefined,
          title: apiJob.title ?? null,
          company: apiJob.company_name ?? null,
          location: location ?? 'Remoto',
          modality: 'Remoto',
          level,
          stacks: extractStacksFromText(compactJoin([apiJob.category, apiJob.title, cleanDescription])),
          salaryRange: apiJob.salary ?? null,
          shortDescription: summarizeText(cleanDescription, 80),
          rawText: truncateWords(cleanDescription, 300),
          url: apiJob.url ?? null,
          source: PROVIDER_NAME,
          collectedAt: parseDateOrNow(apiJob.publication_date),
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

async function fetchRemotiveJobs(search: string): Promise<RemotiveJob[]> {
  const url = new URL('https://remotive.com/api/remote-jobs');
  url.searchParams.set('category', 'software-dev');
  url.searchParams.set('limit', '50');
  url.searchParams.set('search', search);

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'tech-scrapper-discord-bot',
    },
  });

  if (!response.ok) {
    throw new Error(`Remotive API retornou status ${response.status}.`);
  }

  const payload = (await response.json()) as RemotiveResponse;

  return payload.jobs ?? [];
}
