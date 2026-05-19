import cron, { ScheduledTask } from 'node-cron';
import { logger } from '../lib/logger';
import { realJobProviders } from '../providers/providerRegistry';
import { runJobProviders, ProviderRunnerSummary } from '../providers/providerRunner';

const COLLECTOR_TIME = '08:00';
const COLLECTOR_TIMEZONE = 'America/Sao_Paulo';
const COLLECTOR_CRON_EXPRESSION = '0 8 * * *';

let scheduledCollectorTask: ScheduledTask | null = null;
let isCollecting = false;

export type JobCollectionTrigger = 'manual' | 'scheduled';

export type JobCollectionRunResult = {
  skipped: boolean;
  summary: ProviderRunnerSummary | null;
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
    providers: realJobProviders.map((provider) => provider.name),
  });
}

export function stopScheduledCollector(): void {
  scheduledCollectorTask?.destroy();
  scheduledCollectorTask = null;
}

export async function runRealJobCollection(trigger: JobCollectionTrigger): Promise<JobCollectionRunResult> {
  if (isCollecting) {
    logger.info('Coleta de providers ignorada porque outra coleta ja esta em execucao.', { trigger });

    return {
      skipped: true,
      summary: null,
    };
  }

  isCollecting = true;

  try {
    logger.info('Coleta de providers reais iniciada.', {
      trigger,
      providers: realJobProviders.map((provider) => provider.name),
    });

    const summary = await runJobProviders(realJobProviders);

    logger.info('Coleta de providers reais finalizada.', {
      trigger,
      providersExecuted: summary.providersExecuted,
      totalIssuesRead: summary.totalIssuesRead,
      createdJobs: summary.createdJobs,
      ignoredDuplicates: summary.ignoredDuplicates,
      possibleDuplicates: summary.possibleDuplicates,
      ignoredByDate: summary.ignoredByDate,
      ignoredBySeniority: summary.ignoredBySeniority,
      ignoredByMissingEntryLevel: summary.ignoredByMissingEntryLevel,
      ignoredByLocation: summary.ignoredByLocation,
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
