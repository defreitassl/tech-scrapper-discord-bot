export type BrowserScrapingConfig = {
  sourceName: string;
  url: string;
  isPublicPage: boolean;
  requiresLogin?: boolean;
  hasCaptcha?: boolean;
  requiresBypass?: boolean;
  usesCredentials?: boolean;
  usesCustomCookies?: boolean;
  usesProxy?: boolean;
  usesIpRotation?: boolean;
  headless?: boolean;
  timeoutMs?: number;
  userAgent?: string;
};

export type BrowserExtractedJob = {
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

export type BrowserScrapingStats = {
  pagesVisited: number;
  linksFound: number;
  jobsExtracted: number;
  startedAt: Date;
  finishedAt: Date;
};

export type BrowserScrapingResult = {
  source: string;
  jobs: BrowserExtractedJob[];
  stats: BrowserScrapingStats;
  errors?: string[];
};

export type BrowserPolicyDecision = {
  allowed: boolean;
  reason: string;
};
