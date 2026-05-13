import cron, { ScheduledTask } from 'node-cron';
import { logger } from '../lib/logger';
import { publishPendingJobs } from './publishPendingJobs';
import { getSchedulerDailyUsage } from './schedulerOperations';
import { getSchedulerSettings } from './schedulerSettings';

const runningTasks: ScheduledTask[] = [];

export async function startScheduledPublisher(): Promise<void> {
  await reloadScheduledPublisher();
}

export async function reloadScheduledPublisher(): Promise<void> {
  stopScheduledPublisher();

  const settings = await getSchedulerSettings();

  if (!settings.enabled) {
    logger.info('Agendamento de envio desativado.', { settingsId: settings.id });
    return;
  }

  if (settings.sendTimes.length === 0) {
    logger.info('Agendamento de envio ativado sem horarios configurados.', { timezone: settings.timezone });
    return;
  }

  for (const sendTime of settings.sendTimes) {
    const expression = cronExpressionFromTime(sendTime);
    const task = cron.schedule(
      expression,
      async () => {
        await runScheduledPublish(sendTime);
      },
      {
        timezone: settings.timezone,
        name: `publish-pending-jobs-${sendTime}`,
        noOverlap: true,
      },
    );

    runningTasks.push(task);
    logger.info('Horario de envio agendado.', {
      sendTime,
      timezone: settings.timezone,
      expression,
    });
  }
}

export function stopScheduledPublisher(): void {
  while (runningTasks.length > 0) {
    const task = runningTasks.pop();
    task?.destroy();
  }
}

async function runScheduledPublish(sendTime: string): Promise<void> {
  const settings = await getSchedulerSettings();

  if (!settings.enabled) {
    logger.info('Execucao agendada ignorada porque o agendamento esta desativado.', { sendTime });
    return;
  }

  if (!settings.sendTimes.includes(sendTime)) {
    logger.info('Execucao agendada ignorada porque o horario nao esta mais configurado.', {
      sendTime,
      configuredSendTimes: settings.sendTimes,
    });
    return;
  }

  try {
    logger.info('Publicacao agendada iniciada.', {
      sendTime,
      dailyLimit: settings.dailyLimit,
      timezone: settings.timezone,
    });

    const usage = await getSchedulerDailyUsage(settings);

    if (usage.remainingToday <= 0) {
      logger.info('Limite diario de publicacao agendada ja atingido.', {
        sendTime,
        sentToday: usage.sentToday,
        dailyLimit: settings.dailyLimit,
      });
      return;
    }

    const result = await publishPendingJobs({ limit: usage.remainingToday });

    logger.info('Publicacao agendada finalizada.', {
      sendTime,
      sentTodayBeforeRun: usage.sentToday,
      remainingLimit: usage.remainingToday,
      ...result,
    });
  } catch (error) {
    logger.error('Erro na publicacao agendada.', error, { sendTime });
  }
}

function cronExpressionFromTime(sendTime: string): string {
  const [hour, minute] = sendTime.split(':');
  return `${Number(minute)} ${Number(hour)} * * *`;
}
