import cron, { ScheduledTask } from 'node-cron';
import { logger } from '../lib/logger';
import { automaticJobProviders } from '../providers/providerRegistry';
import { runAutomatedJobCollection, AutomatedJobCollectionSummary } from '../providers/providerRunner';
import type { JobSourceProvider } from '../providers/types';

const COLLECTOR_TIME = '08:00';
const COLLECTOR_TIMEZONE = 'America/Sao_Paulo';
const COLLECTOR_CRON_EXPRESSION = '0 8 * * *';

let scheduledCollectorTask: ScheduledTask | null = null;
let isCollecting = false;

export type JobCollectionTrigger = 'manual' | 'scheduled';

export type JobCollectionRunResult = {
  skipped: boolean;
  summary: AutomatedJobCollectionSummary | null;
};

export function startScheduledCollector(): void {
  stopScheduledCollector();

  scheduledCollectorTask = cron.schedule(
    COLLECTOR_CRON_EXPRESSION,
    async () => {
      await runRealJobCollection('scheduled');
    },
    {
      timezone: COLLECTOR_TIMEZONE,
      name: 'collect-real-job-providers',
      noOverlap: true,
    },
  );

  logger.info('Coleta automatica de providers agendada.', {
    collectTime: COLLECTOR_TIME,
    timezone: COLLECTOR_TIMEZONE,
    expression: COLLECTOR_CRON_EXPRESSION,
    providers: automaticJobProviders.map((provider) => provider.name),
  });
}

export function stopScheduledCollector(): void {
  scheduledCollectorTask?.destroy();
  scheduledCollectorTask = null;
}

export async function runRealJobCollection(
  trigger: JobCollectionTrigger,
  providers: JobSourceProvider[] = automaticJobProviders,
): Promise<JobCollectionRunResult> {
  const providerNames = providers.map((provider) => provider.name);

  if (isCollecting) {
    logger.info('Coleta de providers ignorada porque outra coleta ja esta em execucao.', {
      trigger,
      providers: providerNames,
    });

    return {
      skipped: true,
      summary: null,
    };
  }

  isCollecting = true;

  try {
    logger.info('Coleta de providers reais iniciada.', {
      trigger,
      providers: providerNames,
    });

    const summary = await runAutomatedJobCollection(providers);

    logger.info('Coleta automatizada de providers finalizada.', {
      trigger,
      providers: providerNames,
      providersExecuted: summary.providersExecuted,
      analyzed: summary.analyzed,
      rejectedByDomain: summary.rejectedByDomain,
      rejectedByQuality: summary.rejectedByQuality,
      rejectedDuplicates: summary.rejectedDuplicates,
      rejectedByPriority: summary.rejectedByPriority,
      selectedForApproval: summary.selectedForApproval,
      approvedAsPending: summary.approvedAsPending,
      failedAiGeneration: summary.failedAiGeneration,
      requestedLimit: summary.requestedLimit,
      repositoryErrors: summary.repositoryErrors,
      errors: summary.errors.length,
    });

    return {
      skipped: false,
      summary,
    };
  } catch (error) {
    logger.error('Erro na coleta de providers reais.', error, { trigger });

    return {
      skipped: false,
      summary: null,
    };
  } finally {
    isCollecting = false;
  }
}
