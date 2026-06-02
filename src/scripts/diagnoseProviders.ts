import { gupyProvider } from '../providers/gupy.provider';
import { normalizeCollectedJob } from '../providers/normalizeCollectedJob';
import { programathorProvider } from '../providers/programathor.provider';
import { remotarProvider } from '../providers/remotar.provider';
import { solidesProvider } from '../providers/solides.provider';
import type { CollectedJob, JobSourceProvider, ProviderCollectResult, ProviderRepositorySummary } from '../providers/types';
import { evaluateJobForQueue } from '../services/jobPolicy';
import type { JobPriorityLevel } from '../services/jobPriority';

type QualityRejectSummary = {
  title: string | null;
  source: string;
  url: string | null;
  reasons: string[];
};

type LinkCheckResult = {
  url: string;
  ok: boolean;
  status?: number;
  error?: string;
};

type ProviderDiagnostic = {
  provider: string;
  analyzed: number;
  returnedByProvider: number;
  acceptedByJobPolicy: number;
  rejectedByJobPolicy: number;
  priorityCounts: Record<JobPriorityLevel, number>;
  providerDiscardReasons: Record<string, number>;
  jobPolicyRejects: Record<string, number>;
  repositorySummaries: ProviderRepositorySummary[];
  topSources: Array<{ source: string; term?: string; returnedByProvider: number; analyzed: number }>;
  fieldCompleteness: {
    url: number;
    shortDescription: number;
    usefulRawText: number;
    stacks: number;
    location: number;
  };
  linkChecks: LinkCheckResult[];
  samples: Array<{
    title: string | null;
    company: string | null;
    level: string | null;
    modality: string | null;
    location: string | null;
    source: string;
    url: string | null;
    accepted: boolean;
    rejectionReason?: string;
    domain: string;
    priority: JobPriorityLevel;
    priorityScore: number;
    reasons: string[];
    qualityScore?: number;
    qualityReasons?: string[];
  }>;
  qualityRejectSamples: QualityRejectSummary[];
  errors: ProviderCollectResult['errors'];
};

const PROVIDERS = [gupyProvider, programathorProvider, remotarProvider, solidesProvider];
const LINK_CHECK_LIMIT_PER_PROVIDER = 5;

async function main(): Promise<void> {
  const diagnostics: ProviderDiagnostic[] = [];

  for (const provider of PROVIDERS) {
    diagnostics.push(await diagnoseProvider(provider));
  }

  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), diagnostics }, null, 2));
}

async function diagnoseProvider(provider: JobSourceProvider): Promise<ProviderDiagnostic> {
  const collectResult = await provider.collect();
  const jobs = Array.isArray(collectResult) ? collectResult : collectResult.jobs;
  const repositorySummaries = Array.isArray(collectResult) ? [] : collectResult.repositorySummaries ?? [];
  const analyzed = Array.isArray(collectResult)
    ? jobs.length
    : collectResult.totalIssuesRead ?? sumRepositoryMetric(repositorySummaries, 'totalIssuesRead');
  const returnedByProvider = sumRepositoryMetric(repositorySummaries, 'returnedByProvider') || jobs.length;
  const providerDiscardReasons = buildProviderDiscardReasons(collectResult, repositorySummaries);
  const jobPolicyRejects: Record<string, number> = {};
  const priorityCounts: Record<JobPriorityLevel, number> = {
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
  };
  const fieldCompleteness = {
    url: 0,
    shortDescription: 0,
    usefulRawText: 0,
    stacks: 0,
    location: 0,
  };
  const samples: ProviderDiagnostic['samples'] = [];
  const qualityRejectSamples: QualityRejectSummary[] = [];
  let acceptedByJobPolicy = 0;
  let rejectedByJobPolicy = 0;

  for (const job of jobs) {
    const normalizedJob = normalizeCollectedJob(job, provider.name);
    const decision = evaluateJobForQueue(normalizedJob);

    priorityCounts[decision.priority] += 1;

    if (normalizedJob.url) {
      fieldCompleteness.url += 1;
    }
    if (normalizedJob.shortDescription) {
      fieldCompleteness.shortDescription += 1;
    }
    if (isUsefulText(normalizedJob.rawText)) {
      fieldCompleteness.usefulRawText += 1;
    }
    if (normalizedJob.stacks) {
      fieldCompleteness.stacks += 1;
    }
    if (normalizedJob.location) {
      fieldCompleteness.location += 1;
    }

    if (decision.accepted) {
      acceptedByJobPolicy += 1;
    } else {
      rejectedByJobPolicy += 1;
      const rejectionReason = decision.rejectionReason ?? 'unknown';
      jobPolicyRejects[rejectionReason] = (jobPolicyRejects[rejectionReason] ?? 0) + 1;

      for (const reason of decision.qualityReasons ?? []) {
        jobPolicyRejects[reason] = (jobPolicyRejects[reason] ?? 0) + 1;
      }
      qualityRejectSamples.push({
        title: normalizedJob.title,
        source: normalizedJob.source,
        url: normalizedJob.url,
        reasons: decision.qualityReasons?.length ? decision.qualityReasons : [rejectionReason],
      });
    }

    samples.push({
      title: normalizedJob.title,
      company: normalizedJob.company,
      level: normalizedJob.level,
      modality: normalizedJob.modality,
      location: normalizedJob.location,
      source: normalizedJob.source,
      url: normalizedJob.url,
      accepted: decision.accepted,
      rejectionReason: decision.rejectionReason,
      domain: decision.domain,
      priority: decision.priority,
      priorityScore: decision.priorityScore,
      reasons: decision.reasons,
      qualityScore: decision.qualityScore,
      qualityReasons: decision.qualityReasons,
    });
  }

  return {
    provider: provider.name,
    analyzed,
    returnedByProvider,
    acceptedByJobPolicy,
    rejectedByJobPolicy,
    priorityCounts,
    providerDiscardReasons,
    jobPolicyRejects,
    repositorySummaries,
    topSources: buildTopSources(repositorySummaries),
    fieldCompleteness,
    linkChecks: await checkLinks(jobs),
    samples: samples.slice(0, 8),
    qualityRejectSamples: qualityRejectSamples.slice(0, 8),
    errors: Array.isArray(collectResult) ? [] : collectResult.errors ?? [],
  };
}

function buildProviderDiscardReasons(
  collectResult: CollectedJob[] | ProviderCollectResult,
  repositorySummaries: ProviderRepositorySummary[],
): Record<string, number> {
  if (Array.isArray(collectResult)) {
    return {};
  }

  return {
    ignoredByDate: collectResult.ignoredByDate ?? sumRepositoryMetric(repositorySummaries, 'ignoredByDate'),
    ignoredBySeniority: collectResult.ignoredBySeniority ?? sumRepositoryMetric(repositorySummaries, 'ignoredBySeniority'),
    ignoredByMissingEntryLevel:
      collectResult.ignoredByMissingEntryLevel ?? sumRepositoryMetric(repositorySummaries, 'ignoredByMissingEntryLevel'),
    ignoredByLocation: collectResult.ignoredByLocation ?? sumRepositoryMetric(repositorySummaries, 'ignoredByLocation'),
    ignoredByQuality: collectResult.ignoredByQuality ?? sumRepositoryMetric(repositorySummaries, 'ignoredByQuality'),
    errors: collectResult.errors?.length ?? sumRepositoryMetric(repositorySummaries, 'errors'),
  };
}

function buildTopSources(
  repositorySummaries: ProviderRepositorySummary[],
): Array<{ source: string; term?: string; returnedByProvider: number; analyzed: number }> {
  return [...repositorySummaries]
    .sort((a, b) => {
      const returnedDifference = (b.returnedByProvider ?? 0) - (a.returnedByProvider ?? 0);

      if (returnedDifference !== 0) {
        return returnedDifference;
      }

      return b.totalIssuesRead - a.totalIssuesRead;
    })
    .slice(0, 5)
    .map((summary) => ({
      source: summary.source,
      term: summary.term,
      returnedByProvider: summary.returnedByProvider ?? 0,
      analyzed: summary.totalIssuesRead,
    }));
}

async function checkLinks(jobs: CollectedJob[]): Promise<LinkCheckResult[]> {
  const urls = Array.from(new Set(jobs.map((job) => job.url).filter((url): url is string => Boolean(url)))).slice(
    0,
    LINK_CHECK_LIMIT_PER_PROVIDER,
  );
  const results: LinkCheckResult[] = [];

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(10000),
      });

      results.push({
        url,
        ok: response.ok,
        status: response.status,
      });
    } catch (error) {
      results.push({
        url,
        ok: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido ao checar link.',
      });
    }
  }

  return results;
}

function sumRepositoryMetric(
  summaries: ProviderRepositorySummary[],
  field: keyof Pick<
    ProviderRepositorySummary,
    | 'totalIssuesRead'
    | 'returnedByProvider'
    | 'ignoredByDate'
    | 'ignoredBySeniority'
    | 'ignoredByMissingEntryLevel'
    | 'ignoredByLocation'
    | 'ignoredByQuality'
    | 'errors'
  >,
): number {
  return summaries.reduce((total, summary) => total + (summary[field] ?? 0), 0);
}

function isUsefulText(value?: string | null): boolean {
  return Boolean(value?.trim() && value.trim().split(/\s+/).length >= 12);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
