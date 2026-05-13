import type { CollectedJob, NormalizedCollectedJob } from './types';

export function normalizeCollectedJob(job: CollectedJob, fallbackSource?: string): NormalizedCollectedJob {
  const source = cleanText(job.source) ?? cleanText(fallbackSource);

  if (!source) {
    throw new Error('Collected job must include a source.');
  }

  return {
    title: cleanText(job.title),
    company: cleanText(job.company),
    location: cleanText(job.location),
    modality: cleanText(job.modality),
    level: cleanText(job.level),
    stacks: cleanText(job.stacks),
    salaryRange: cleanText(job.salaryRange),
    shortDescription: cleanText(job.shortDescription),
    rawText: normalizeRawText(job.rawText),
    url: cleanText(job.url),
    source,
  };
}

function cleanText(value?: string | null): string | null {
  const normalizedValue = value?.trim().replace(/\s+/g, ' ');

  return normalizedValue ? normalizedValue : null;
}

function normalizeRawText(value?: string | null): string | null {
  if (!value?.trim()) {
    return null;
  }

  return value;
}
