export type ScrapingStrategy = 'api' | 'rss' | 'html' | 'browser';

export type ScrapingSourceConfig = {
  name: string;
  url: string;
  strategy: ScrapingStrategy;
  requiresLogin?: boolean;
  hasCaptcha?: boolean;
  hasKnownBotProtection?: boolean;
  termsExplicitlyIncompatible?: boolean;
  notes?: string;
};

export type ScrapedJob = {
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

export type ScrapingResult = {
  source: string;
  jobs: ScrapedJob[];
  errors?: string[];
  metadata?: Record<string, string | number | boolean | null>;
};
