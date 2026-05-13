import { JobPost } from '@prisma/client';
import { prisma } from '../lib/prisma';

type DuplicateJobSummary = Pick<JobPost, 'id' | 'title' | 'company' | 'url'>;

export type JobDuplicateInput = {
  title?: string | null;
  company?: string | null;
  url?: string | null;
};

export type JobDuplicateCheckResult = {
  duplicateByUrl: DuplicateJobSummary | null;
  possibleDuplicateByTitleAndCompany: DuplicateJobSummary | null;
};

export function normalizeJobUrl(url?: string | null): string | null {
  const trimmedUrl = url?.trim();

  if (!trimmedUrl) {
    return null;
  }

  let normalizedUrl = trimmedUrl;

  while (normalizedUrl.endsWith('/') && !normalizedUrl.endsWith('://')) {
    normalizedUrl = normalizedUrl.slice(0, -1);
  }

  return normalizedUrl;
}

export function normalizeTextForComparison(value?: string | null): string | null {
  const normalizedValue = value?.trim().replace(/\s+/g, ' ').toLowerCase();

  return normalizedValue ? normalizedValue : null;
}

export async function findDuplicateByUrl(url?: string | null): Promise<DuplicateJobSummary | null> {
  const normalizedUrl = normalizeJobUrl(url);

  if (!normalizedUrl) {
    return null;
  }

  const jobsWithUrl = await prisma.jobPost.findMany({
    where: {
      url: {
        not: null,
      },
    },
    select: {
      id: true,
      title: true,
      company: true,
      url: true,
    },
  });

  return jobsWithUrl.find((job) => normalizeJobUrl(job.url) === normalizedUrl) ?? null;
}

export async function findPossibleDuplicateByTitleAndCompany(
  title?: string | null,
  company?: string | null,
): Promise<DuplicateJobSummary | null> {
  const normalizedTitle = normalizeTextForComparison(title);
  const normalizedCompany = normalizeTextForComparison(company);

  if (!normalizedTitle || !normalizedCompany) {
    return null;
  }

  const jobsWithTitleAndCompany = await prisma.jobPost.findMany({
    where: {
      title: {
        not: null,
      },
      company: {
        not: null,
      },
    },
    select: {
      id: true,
      title: true,
      company: true,
      url: true,
    },
  });

  return (
    jobsWithTitleAndCompany.find(
      (job) =>
        normalizeTextForComparison(job.title) === normalizedTitle &&
        normalizeTextForComparison(job.company) === normalizedCompany,
    ) ?? null
  );
}

export async function checkJobDuplicate(input: JobDuplicateInput): Promise<JobDuplicateCheckResult> {
  const duplicateByUrl = await findDuplicateByUrl(input.url);

  if (duplicateByUrl) {
    return {
      duplicateByUrl,
      possibleDuplicateByTitleAndCompany: null,
    };
  }

  return {
    duplicateByUrl: null,
    possibleDuplicateByTitleAndCompany: await findPossibleDuplicateByTitleAndCompany(input.title, input.company),
  };
}
