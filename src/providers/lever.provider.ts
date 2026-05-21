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

const PROVIDER_NAME = 'lever';

type LeverJob = {
  id?: string | null;
  text?: string | null;
  hostedUrl?: string | null;
  applyUrl?: string | null;
  createdAt?: number | null;
  description?: string | null;
  descriptionPlain?: string | null;
  additional?: string | null;
  additionalPlain?: string | null;
  workplaceType?: string | null;
  country?: string | null;
  categories?: {
    commitment?: string | null;
    department?: string | null;
    location?: string | null;
    team?: string | null;
    allLocations?: string[] | null;
  } | null;
  lists?: Array<{ text?: string | null; content?: string | null }> | null;
};

export const leverProvider: JobSourceProvider = {
  name: PROVIDER_NAME,
  async collect(): Promise<ProviderCollectResult> {
    const jobs: CollectedJob[] = [];
    const errors: ProviderCollectError[] = [];
    const summaries = getCompanyTargetsByAts(PROVIDER_NAME).map((target) => ({
      target,
      summary: createProviderSummary(createAtsSource(target)),
    }));

    for (const { target, summary } of summaries) {
      const endpoint = `https://api.lever.co/v0/postings/${target.slug}?mode=json`;
      let apiJobs: LeverJob[];

      try {
        assertPublicApiAllowed(summary.source, endpoint);
        apiJobs = await fetchLeverJobs(endpoint);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro desconhecido ao coletar Lever.';

        summary.errors += 1;
        errors.push({ provider: summary.source, message });
        logger.error('Erro ao coletar Lever. Continuando nos demais alvos.', error, {
          target: target.slug,
        });
        continue;
      }

      summary.totalIssuesRead += apiJobs.length;

      for (const apiJob of apiJobs) {
        if (!isRecentAtsDate(apiJob.createdAt ?? null)) {
          summary.ignoredByDate += 1;
          continue;
        }

        const cleanDescription = cleanLeverDescription(apiJob);
        const searchableText = compactJoin([
          apiJob.text,
          apiJob.categories?.commitment,
          apiJob.categories?.department,
          apiJob.categories?.team,
          apiJob.categories?.location,
          apiJob.workplaceType,
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

        const locationDecision = evaluateAtsLocation(
          apiJob.text,
          apiJob.workplaceType,
          apiJob.categories?.location,
          apiJob.country,
          ...(apiJob.categories?.allLocations ?? []),
        );

        if (!locationDecision.accepted) {
          summary.ignoredByLocation += 1;
          continue;
        }

        const url = apiJob.hostedUrl ?? apiJob.applyUrl ?? target.careersUrl ?? null;

        jobs.push({
          externalId: apiJob.id ? `${target.slug}:${apiJob.id}` : undefined,
          title: apiJob.text ?? null,
          company: target.companyName,
          location: locationDecision.location,
          modality: locationDecision.modality,
          level,
          stacks: extractStacksFromText(compactJoin([apiJob.text, apiJob.categories?.team, cleanDescription])),
          salaryRange: null,
          shortDescription: summarizeText(cleanDescription, 80),
          rawText: truncateWords(cleanDescription, 300),
          url,
          source: summary.source,
          collectedAt: parseAtsDateOrNow(apiJob.createdAt ?? null),
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

async function fetchLeverJobs(endpoint: string): Promise<LeverJob[]> {
  const payload = await fetchPublicJson<LeverJob[] | { ok?: false; error?: string }>(endpoint);

  return Array.isArray(payload) ? payload : [];
}

function cleanLeverDescription(job: LeverJob): string | null {
  const listText = (job.lists ?? []).map((item) => compactJoin([item.text, cleanAtsText(item.content)]));

  return compactJoin(
    [
      cleanAtsText(job.descriptionPlain ?? job.description),
      cleanAtsText(job.additionalPlain ?? job.additional),
      ...listText,
    ],
    ' ',
  ) || null;
}

function sumMetric(
  summaries: Array<{ summary: ReturnType<typeof createProviderSummary> }>,
  metric: 'totalIssuesRead' | 'ignoredByDate' | 'ignoredBySeniority' | 'ignoredByMissingEntryLevel' | 'ignoredByLocation',
): number {
  return summaries.reduce((total, { summary }) => total + summary[metric], 0);
}
