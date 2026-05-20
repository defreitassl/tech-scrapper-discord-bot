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
import type { CollectedJob, JobSourceProvider, ProviderCollectResult } from './types';

const PROVIDER_NAME = 'remoteok';
const MAX_JOB_AGE_DAYS = 30;

type RemoteOkJob = {
  id?: string | number | null;
  slug?: string | null;
  date?: string | null;
  company?: string | null;
  position?: string | null;
  tags?: string[] | null;
  description?: string | null;
  url?: string | null;
  location?: string | null;
  legal?: unknown;
};

export const remoteOkProvider: JobSourceProvider = {
  name: PROVIDER_NAME,
  async collect(): Promise<ProviderCollectResult> {
    const jobs: CollectedJob[] = [];
    const summary = createProviderSummary(PROVIDER_NAME);

    let apiJobs: RemoteOkJob[];

    try {
      apiJobs = await fetchRemoteOkJobs();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido ao coletar RemoteOK.';

      summary.errors += 1;
      logger.error('Erro ao coletar RemoteOK.', error);

      return {
        jobs,
        errors: [{ provider: PROVIDER_NAME, message }],
        repositorySummaries: [summary],
      };
    }

    summary.totalIssuesRead = apiJobs.length;

    for (const apiJob of apiJobs) {
      if (!isRecentDate(apiJob.date, MAX_JOB_AGE_DAYS)) {
        summary.ignoredByDate += 1;
        continue;
      }

      const cleanDescription = stripHtml(apiJob.description);
      const tagsText = (apiJob.tags ?? []).join(' ');
      const searchableText = compactJoin([apiJob.position, apiJob.company, tagsText, cleanDescription]);

      if (hasDisallowedSeniority(searchableText)) {
        summary.ignoredBySeniority += 1;
        continue;
      }

      const level = detectEntryLevel(searchableText);

      if (!level) {
        summary.ignoredByMissingEntryLevel += 1;
        continue;
      }

      const locationRestriction = normalizeExternalProviderLocation(apiJob.location, extractLocationFromTags(apiJob.tags));

      if (!isRemoteLocationAllowed(locationRestriction)) {
        summary.ignoredByLocation += 1;
        continue;
      }

      const location = normalizeExternalProviderLocation(locationRestriction, 'Remoto');

      const url = getRemoteOkUrl(apiJob);

      if (!url) {
        summary.ignoredByQuality += 1;
        continue;
      }

      jobs.push({
        externalId: apiJob.id === null || apiJob.id === undefined ? undefined : String(apiJob.id),
        title: apiJob.position ?? null,
        company: apiJob.company ?? null,
        location: location ?? 'Remoto',
        modality: 'Remoto',
        level,
        stacks: extractStacksFromText(compactJoin([tagsText, cleanDescription])),
        salaryRange: null,
        shortDescription: summarizeText(cleanDescription, 80),
        rawText: truncateWords(cleanDescription, 300),
        url,
        source: PROVIDER_NAME,
        collectedAt: parseDateOrNow(apiJob.date),
      });
    }

    return {
      jobs,
      totalIssuesRead: summary.totalIssuesRead,
      ignoredByDate: summary.ignoredByDate,
      ignoredBySeniority: summary.ignoredBySeniority,
      ignoredByMissingEntryLevel: summary.ignoredByMissingEntryLevel,
      ignoredByLocation: summary.ignoredByLocation,
      ignoredByQuality: summary.ignoredByQuality,
      repositorySummaries: [summary],
    };
  },
};

async function fetchRemoteOkJobs(): Promise<RemoteOkJob[]> {
  const response = await fetch('https://remoteok.com/api', {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'tech-scrapper-discord-bot',
    },
  });

  if (!response.ok) {
    throw new Error(`RemoteOK API retornou status ${response.status}.`);
  }

  const payload = (await response.json()) as RemoteOkJob[];

  if (!Array.isArray(payload)) {
    return [];
  }

  return payload.filter((item) => !item.legal && (item.position || item.id));
}

function extractLocationFromTags(tags?: string[] | null): string | null {
  const locationTags = (tags ?? []).filter((tag) => /remote|worldwide|anywhere|latam|america|brazil|brasil/i.test(tag));

  return locationTags.length > 0 ? locationTags.join(', ') : null;
}

function getRemoteOkUrl(job: RemoteOkJob): string | null {
  if (job.url?.trim()) {
    return job.url.startsWith('http') ? job.url : `https://remoteok.com${job.url}`;
  }

  if (job.id && job.slug?.trim()) {
    return `https://remoteok.com/remote-jobs/${job.id}-${job.slug}`;
  }

  return null;
}
