import 'dotenv/config';
import { JobPost, JobPriority, JobStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';

const DEFAULT_LIMIT = 100;
const REPORT_LIMIT = 10;

type PriorityCounts = Record<JobPriority, number> & {
  none: number;
};

async function main(): Promise<void> {
  const limit = readLimit();
  const jobs = await prisma.jobPost.findMany({
    where: { status: JobStatus.DRAFT },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  const scoredJobs = jobs.filter((job) => job.priorityScore !== null);

  console.log(`Diagnostico de prioridade de vagas DRAFT recentes`);
  console.log(`Limite analisado: ${limit}`);
  console.log(`Total de vagas analisadas: ${jobs.length}`);
  printPriorityCounts(jobs);
  printDistribution('Distribuicao por source', buildDistribution(jobs, (job) => job.source));
  printDistribution('Distribuicao por level', buildDistribution(jobs, (job) => job.level));
  printDistribution('Distribuicao por modality', buildDistribution(jobs, (job) => job.modality));
  printJobList('Top 10 vagas por score', [...scoredJobs].sort(compareScoreDesc).slice(0, REPORT_LIMIT));
  printJobList('Bottom 10 vagas por score', [...scoredJobs].sort(compareScoreAsc).slice(0, REPORT_LIMIT));

  if (jobs.length > scoredJobs.length) {
    console.log(`\nVagas sem score: ${jobs.length - scoredJobs.length}`);
  }
}

function readLimit(): number {
  const rawLimit = process.env.PRIORITY_DIAG_LIMIT;
  const parsedLimit = rawLimit ? Number.parseInt(rawLimit, 10) : DEFAULT_LIMIT;

  return Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_LIMIT;
}

function printPriorityCounts(jobs: JobPost[]): void {
  const counts: PriorityCounts = {
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    none: 0,
  };

  for (const job of jobs) {
    if (job.priority) {
      counts[job.priority] += 1;
    } else {
      counts.none += 1;
    }
  }

  console.log('\nResumo por prioridade');
  console.log(`HIGH: ${counts.HIGH}`);
  console.log(`MEDIUM: ${counts.MEDIUM}`);
  console.log(`LOW: ${counts.LOW}`);
  console.log(`Sem prioridade: ${counts.none}`);
}

function buildDistribution(jobs: JobPost[], readValue: (job: JobPost) => string | null): Map<string, number> {
  const distribution = new Map<string, number>();

  for (const job of jobs) {
    const key = normalizeDistributionValue(readValue(job));
    distribution.set(key, (distribution.get(key) ?? 0) + 1);
  }

  return distribution;
}

function normalizeDistributionValue(value: string | null): string {
  const normalizedValue = value?.trim();

  return normalizedValue || 'Nao informado';
}

function printDistribution(title: string, distribution: Map<string, number>): void {
  console.log(`\n${title}`);

  for (const [key, count] of [...distribution.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
    console.log(`- ${key}: ${count}`);
  }
}

function printJobList(title: string, jobs: JobPost[]): void {
  console.log(`\n${title}`);

  if (jobs.length === 0) {
    console.log('Nenhuma vaga com score encontrada.');
    return;
  }

  for (const [index, job] of jobs.entries()) {
    console.log(`\n${index + 1}. ${job.title ?? 'Sem titulo'}`);
    console.log(`   Empresa: ${job.company ?? '-'}`);
    console.log(`   Source: ${job.source ?? '-'}`);
    console.log(`   Level: ${job.level ?? '-'}`);
    console.log(`   Modality: ${job.modality ?? '-'}`);
    console.log(`   Location: ${job.location ?? '-'}`);
    console.log(`   Priority: ${job.priority ?? '-'}`);
    console.log(`   Score: ${job.priorityScore ?? '-'}`);
    console.log(`   Reasons: ${formatReasons(job.priorityReasons)}`);
    console.log(`   URL: ${job.url ?? '-'}`);
  }
}

function compareScoreDesc(a: JobPost, b: JobPost): number {
  return (b.priorityScore ?? Number.NEGATIVE_INFINITY) - (a.priorityScore ?? Number.NEGATIVE_INFINITY);
}

function compareScoreAsc(a: JobPost, b: JobPost): number {
  return (a.priorityScore ?? Number.POSITIVE_INFINITY) - (b.priorityScore ?? Number.POSITIVE_INFINITY);
}

function formatReasons(value: string | null): string {
  if (!value?.trim()) {
    return '-';
  }

  try {
    const parsed = JSON.parse(value);

    if (Array.isArray(parsed)) {
      return parsed.filter((reason) => typeof reason === 'string' && reason.trim()).join(', ') || '-';
    }
  } catch {
    return value;
  }

  return value;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
