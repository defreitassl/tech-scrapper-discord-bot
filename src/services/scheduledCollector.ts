import cron, { ScheduledTask } from 'node-cron';
import { logger } from '../lib/logger';
import { automaticJobProviders } from '../providers/providerRegistry';
import { runAutomatedJobCollection, AutomatedJobCollectionSummary } from '../providers/providerRunner';
import type { JobSourceProvider } from '../providers/types';
import {
  getCollectionSchedulerSettings,
  normalizeCollectionSchedulerSettings,
} from './collectionSchedulerSettings';

const WEEKDAY_TO_CRON_DAY: Record<string, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

let scheduledCollectorTasks: ScheduledTask[] = [];
let isCollecting = false;

export type JobCollectionTrigger = 'manual' | 'scheduled';

export type JobCollectionRunResult = {
  skipped: boolean;
  summary: AutomatedJobCollectionSummary | null;
};

export async function startScheduledCollector(): Promise<void> {
  await reloadScheduledCollector();
}

export async function reloadScheduledCollector(): Promise<void> {
  stopScheduledCollector();

  const settings = normalizeCollectionSchedulerSettings(await getCollectionSchedulerSettings());
  const expressions = settings.weekdays.map((weekday) => cronExpressionFromTimeAndWeekday(settings.collectTime, weekday));

  logger.info('Configuracao de coleta automatica carregada.', {
    enabled: settings.enabled,
    frequency: settings.frequency,
    weekdays: settings.weekdays,
    collectTime: settings.collectTime,
    timezone: settings.timezone,
    expressions,
    providers: automaticJobProviders.map((provider) => provider.name),
  });

  if (!settings.enabled) {
    logger.info('Agendamento de coleta desativado.', { settingsId: settings.id });
    return;
  }

  for (const [index, weekday] of settings.weekdays.entries()) {
    const expression = expressions[index];
    const task = cron.schedule(
      expression,
      async () => {
        await runScheduledCollection(settings.collectTime, weekday);
      },
      {
        timezone: settings.timezone,
        name: `collect-real-job-providers-${weekday.toLowerCase()}-${settings.collectTime}`,
        noOverlap: true,
      },
    );

    scheduledCollectorTasks.push(task);
    logger.info('Horario de coleta agendado.', {
      weekday,
      collectTime: settings.collectTime,
      timezone: settings.timezone,
      expression,
      providers: automaticJobProviders.map((provider) => provider.name),
    });
  }
}

export function stopScheduledCollector(): void {
  while (scheduledCollectorTasks.length > 0) {
    const task = scheduledCollectorTasks.pop();
    task?.destroy();
  }
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
      queueTarget: summary.queueTarget,
      slotsToCreate: summary.slotsToCreate,
      repositoryErrors: summary.repositoryErrors,
      errors: summary.errors.length,
    });

    if (trigger === 'scheduled') {
      const rejectedTotal =
        summary.rejectedByDomain +
        summary.rejectedByQuality +
        summary.rejectedDuplicates +
        summary.rejectedByPriority;

      logger.info('Resumo da coleta agendada.', {
        approvedAsPending: summary.approvedAsPending,
        rejectedTotal,
        rejectedByDomain: summary.rejectedByDomain,
        rejectedByQuality: summary.rejectedByQuality,
        rejectedDuplicates: summary.rejectedDuplicates,
        rejectedByPriority: summary.rejectedByPriority,
        repositoryErrors: summary.repositoryErrors,
        errors: summary.errors.length,
      });
    }

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

async function runScheduledCollection(collectTime: string, weekday: string): Promise<void> {
  const settings = normalizeCollectionSchedulerSettings(await getCollectionSchedulerSettings());

  if (!settings.enabled) {
    logger.info('Execucao de coleta agendada ignorada porque o agendamento esta desativado.', {
      collectTime,
      weekday,
    });
    return;
  }

  if (settings.collectTime !== collectTime || !settings.weekdays.includes(weekday)) {
    logger.info('Execucao de coleta agendada ignorada porque o horario nao esta mais configurado.', {
      collectTime,
      weekday,
      configuredCollectTime: settings.collectTime,
      configuredWeekdays: settings.weekdays,
    });
    return;
  }

  logger.info('Coleta agendada iniciada.', {
    collectTime,
    weekday,
    frequency: settings.frequency,
    timezone: settings.timezone,
    providers: automaticJobProviders.map((provider) => provider.name),
  });

  await runRealJobCollection('scheduled', automaticJobProviders);
}

function cronExpressionFromTimeAndWeekday(collectTime: string, weekday: string): string {
  const [hour, minute] = collectTime.split(':');
  const cronDay = WEEKDAY_TO_CRON_DAY[weekday] ?? 1;

  return `${Number(minute)} ${Number(hour)} * * ${cronDay}`;
}
