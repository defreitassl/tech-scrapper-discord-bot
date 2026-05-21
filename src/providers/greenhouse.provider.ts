import { logger } from '../lib/logger';
import { fetchPublicJson } from '../scraping/scrapingClient';
import {
  assertPublicApiAllowed,
  cleanAtsText,
  createAtsSource,
  evaluateAtsLocation,
  isRecentAtsDate,
  parseAtsDateOrNow,
} from './atsProviderUtils';
import { getCompanyTargetsByAts } from './companyTargets';
import { detectEntryLevel, hasDisallowedSeniority } from './providerSeniorityUtils';
import { createProviderSummary } from './providerSummaryUtils';
import { compactJoin, extractStacksFromText, summarizeText, truncateWords } from './providerTextUtils';
import type { CollectedJob, JobSourceProvider, ProviderCollectError, ProviderCollectResult } from './types';

const PROVIDER_NAME = 'greenhouse';

type GreenhouseJob = {
  id?: string | number | null;
  absolute_url?: string | null;
  title?: string | null;
  company_name?: string | null;
  location?: { name?: string | null } | null;
  content?: string | null;
  first_published?: string | null;
  updated_at?: string | null;
};

type GreenhouseResponse = {
  jobs?: GreenhouseJob[];
};

export const greenhouseProvider: JobSourceProvider = {
  name: PROVIDER_NAME,
  async collect(): Promise<ProviderCollectResult> {
    const jobs: CollectedJob[] = [];
    const errors: ProviderCollectError[] = [];
    const summaries = getCompanyTargetsByAts(PROVIDER_NAME).map((target) => ({
      target,
      summary: createProviderSummary(createAtsSource(target)),
    }));

    for (const { target, summary } of summaries) {
      const endpoint = `https://boards-api.greenhouse.io/v1/boards/${target.slug}/jobs?content=true`;
      let apiJobs: GreenhouseJob[];

      try {
        assertPublicApiAllowed(summary.source, endpoint);
        apiJobs = await fetchGreenhouseJobs(endpoint);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro desconhecido ao coletar Greenhouse.';

        summary.errors += 1;
        errors.push({ provider: summary.source, message });
        logger.error('Erro ao coletar Greenhouse. Continuando nos demais alvos.', error, {
          target: target.slug,
        });
        continue;
      }

      summary.totalIssuesRead += apiJobs.length;

      for (const apiJob of apiJobs) {
        const publishedAt = apiJob.first_published ?? null;

        if (!isRecentAtsDate(publishedAt)) {
          summary.ignoredByDate += 1;
          continue;
        }

        const cleanDescription = cleanAtsText(apiJob.content);
        const searchableText = compactJoin([apiJob.title, apiJob.location?.name, cleanDescription]);

        if (hasDisallowedSeniority(searchableText)) {
          summary.ignoredBySeniority += 1;
          continue;
        }

        const level = detectEntryLevel(searchableText);

        if (!level) {
          summary.ignoredByMissingEntryLevel += 1;
          continue;
        }

        const locationDecision = evaluateAtsLocation(apiJob.title, apiJob.location?.name);

        if (!locationDecision.accepted) {
          summary.ignoredByLocation += 1;
          continue;
        }

        jobs.push({
          externalId: apiJob.id === null || apiJob.id === undefined ? undefined : `${target.slug}:${apiJob.id}`,
          title: apiJob.title ?? null,
          company: apiJob.company_name ?? target.companyName,
          location: locationDecision.location,
          modality: locationDecision.modality,
          level,
          stacks: extractStacksFromText(compactJoin([apiJob.title, cleanDescription])),
          salaryRange: null,
          shortDescription: summarizeText(cleanDescription, 80),
          rawText: truncateWords(cleanDescription, 300),
          url: apiJob.absolute_url ?? target.careersUrl ?? null,
          source: summary.source,
          collectedAt: parseAtsDateOrNow(publishedAt),
        });
      }
    }

    return {
      jobs,
      totalIssuesRead: sumMetric(summaries, 'totalIssuesRead'),
      ignoredByDate: sumMetric(summaries, 'ignoredByDate'),
      ignoredBySeniority: sumMetric(summaries, 'ignoredBySeniority'),
      ignoredByMissingEntryLevel: sumMetric(summaries, 'ignoredByMissingEntryLevel'),
      ignoredByLocation: sumMetric(summaries, 'ignoredByLocation'),
      errors,
      repositorySummaries: summaries.map(({ summary }) => summary),
    };
  },
};

async function fetchGreenhouseJobs(endpoint: string): Promise<GreenhouseJob[]> {
  const payload = await fetchPublicJson<GreenhouseResponse>(endpoint);

  return payload.jobs ?? [];
}

function sumMetric(
  summaries: Array<{ summary: ReturnType<typeof createProviderSummary> }>,
  metric: 'totalIssuesRead' | 'ignoredByDate' | 'ignoredBySeniority' | 'ignoredByMissingEntryLevel' | 'ignoredByLocation',
): number {
  return summaries.reduce((total, { summary }) => total + summary[metric], 0);
}
