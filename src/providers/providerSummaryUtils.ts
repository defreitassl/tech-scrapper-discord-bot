import type { ProviderRepositorySummary } from './types';

export function createProviderSummary(source: string): ProviderRepositorySummary {
  return {
    source,
    totalIssuesRead: 0,
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

export function sumProviderMetric(
  summaries: ProviderRepositorySummary[],
  metric: keyof Omit<ProviderRepositorySummary, 'source'>,
): number {
  return summaries.reduce((total, summary) => total + summary[metric], 0);
}
