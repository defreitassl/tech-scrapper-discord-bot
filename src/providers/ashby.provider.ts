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

const PROVIDER_NAME = 'ashby';

type AshbyJob = {
  id?: string | null;
  title?: string | null;
  department?: string | null;
  team?: string | null;
  employmentType?: string | null;
  location?: string | null;
  secondaryLocations?: Array<{ location?: string | null }> | null;
  publishedAt?: string | null;
  isListed?: boolean | null;
  isRemote?: boolean | null;
  workplaceType?: string | null;
  jobUrl?: string | null;
  applyUrl?: string | null;
  descriptionHtml?: string | null;
  descriptionPlain?: string | null;
};

type AshbyResponse = {
  jobs?: AshbyJob[];
};

export const ashbyProvider: JobSourceProvider = {
  name: PROVIDER_NAME,
  async collect(): Promise<ProviderCollectResult> {
    const jobs: CollectedJob[] = [];
    const errors: ProviderCollectError[] = [];
    const summaries = getCompanyTargetsByAts(PROVIDER_NAME).map((target) => ({
      target,
      summary: createProviderSummary(createAtsSource(target)),
    }));

    for (const { target, summary } of summaries) {
      const endpoint = `https://api.ashbyhq.com/posting-api/job-board/${target.slug}`;
      let apiJobs: AshbyJob[];

      try {
        assertPublicApiAllowed(summary.source, endpoint);
        apiJobs = await fetchAshbyJobs(endpoint);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro desconhecido ao coletar Ashby.';

        summary.errors += 1;
        errors.push({ provider: summary.source, message });
        logger.error('Erro ao coletar Ashby. Continuando nos demais alvos.', error, {
          target: target.slug,
        });
        continue;
      }

      summary.totalIssuesRead += apiJobs.length;

      for (const apiJob of apiJobs) {
        if (apiJob.isListed === false) {
          summary.ignoredByQuality += 1;
          continue;
        }

        if (!isRecentAtsDate(apiJob.publishedAt)) {
          summary.ignoredByDate += 1;
          continue;
        }

        const cleanDescription = cleanAtsText(apiJob.descriptionPlain ?? apiJob.descriptionHtml);
        const searchableText = compactJoin([
          apiJob.title,
          apiJob.department,
          apiJob.team,
          apiJob.employmentType,
          apiJob.location,
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
          apiJob.title,
          apiJob.isRemote ? 'Remote' : null,
          apiJob.workplaceType,
          apiJob.location,
          ...(apiJob.secondaryLocations ?? []).map((location) => location.location ?? null),
        );

        if (!locationDecision.accepted) {
          summary.ignoredByLocation += 1;
          continue;
        }

        jobs.push({
          externalId: apiJob.id ? `${target.slug}:${apiJob.id}` : undefined,
          title: apiJob.title ?? null,
          company: target.companyName,
          location: locationDecision.location,
          modality: locationDecision.modality,
          level,
          stacks: extractStacksFromText(compactJoin([apiJob.title, apiJob.department, apiJob.team, cleanDescription])),
          salaryRange: null,
          shortDescription: summarizeText(cleanDescription, 80),
          rawText: truncateWords(cleanDescription, 300),
          url: apiJob.jobUrl ?? apiJob.applyUrl ?? target.careersUrl ?? null,
          source: summary.source,
          collectedAt: parseAtsDateOrNow(apiJob.publishedAt),
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
      ignoredByQuality: sumMetric(summaries, 'ignoredByQuality'),
      errors,
      repositorySummaries: summaries.map(({ summary }) => summary),
    };
  },
};

async function fetchAshbyJobs(endpoint: string): Promise<AshbyJob[]> {
  const payload = await fetchPublicJson<AshbyResponse>(endpoint);

  return payload.jobs ?? [];
}

function sumMetric(
  summaries: Array<{ summary: ReturnType<typeof createProviderSummary> }>,
  metric:
    | 'totalIssuesRead'
    | 'ignoredByDate'
    | 'ignoredBySeniority'
    | 'ignoredByMissingEntryLevel'
    | 'ignoredByLocation'
    | 'ignoredByQuality',
): number {
  return summaries.reduce((total, { summary }) => total + summary[metric], 0);
}
