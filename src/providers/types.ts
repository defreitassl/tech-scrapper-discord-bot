export type CollectedJob = {
  externalId?: string;
  title: string | null;
  company: string | null;
  location: string | null;
  modality: string | null;
  level: string | null;
  stacks: string | null;
  salaryRange: string | null;
  shortDescription: string | null;
  rawText: string | null;
  url: string | null;
  source: string;
  collectedAt: Date;
};

export interface JobSourceProvider {
  name: string;
  collect(): Promise<CollectedJob[] | ProviderCollectResult>;
}

export type ProviderCollectResult = {
  jobs: CollectedJob[];
  totalIssuesRead?: number;
  ignoredByDate?: number;
  ignoredBySeniority?: number;
  ignoredByMissingEntryLevel?: number;
  ignoredByLocation?: number;
  ignoredByQuality?: number;
  errors?: ProviderCollectError[];
  repositorySummaries?: ProviderRepositorySummary[];
};

export type ProviderCollectError = {
  provider: string;
  message: string;
};

export type ProviderRepositorySummary = {
  source: string;
  totalIssuesRead: number;
  ignoredByDate: number;
  ignoredBySeniority: number;
  ignoredByMissingEntryLevel: number;
  ignoredByLocation: number;
  ignoredByQuality: number;
  ignoredDuplicates: number;
  possibleDuplicates: number;
  created: number;
  errors: number;
};

export type NormalizedCollectedJob = {
  title: string | null;
  company: string | null;
  location: string | null;
  modality: string | null;
  level: string | null;
  stacks: string | null;
  salaryRange: string | null;
  shortDescription: string | null;
  rawText: string | null;
  url: string | null;
  source: string;
};
