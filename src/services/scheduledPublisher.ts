import cron, { ScheduledTask } from 'node-cron';
import { logger } from '../lib/logger';
import { publishPendingJobs } from './publishPendingJobs';
import { getSchedulerDailyUsage } from './schedulerOperations';
import { countSendTimeSlots, getSchedulerSettings, normalizeSchedulerSettings } from './schedulerSettings';

const runningTasks: ScheduledTask[] = [];

export async function startScheduledPublisher(): Promise<void> {
  await reloadScheduledPublisher();
}

export async function reloadScheduledPublisher(): Promise<void> {
  stopScheduledPublisher();

  const settings = normalizeSchedulerSettings(await getSchedulerSettings());

  if (!settings.enabled) {
    logger.info('Agendamento de envio desativado.', { settingsId: settings.id });
    return;
  }

  if (settings.sendTimes.length === 0) {
    logger.info('Agendamento de envio ativado sem horarios configurados.', { timezone: settings.timezone });
    return;
  }

  const sendTimeSlots = countSendTimeSlots(settings.sendTimes);

  for (const [sendTime, slotCount] of sendTimeSlots) {
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
      slotCount,
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
  const settings = normalizeSchedulerSettings(await getSchedulerSettings());

  if (!settings.enabled) {
    logger.info('Execucao agendada ignorada porque o agendamento esta desativado.', { sendTime });
    return;
  }

  const slotCount = countSendTimeSlots(settings.sendTimes).get(sendTime) ?? 0;

  if (slotCount === 0) {
    logger.info('Execucao agendada ignorada porque o horario nao esta mais configurado.', {
      sendTime,
      configuredSendTimes: settings.sendTimes,
    });
    return;
  }

  try {
    logger.info('Publicacao agendada iniciada.', {
      sendTime,
      slotCount,
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

    const publishLimit = Math.min(slotCount, usage.remainingToday);
    const result = await publishPendingJobs({ limit: publishLimit });

    logger.info('Publicacao agendada finalizada.', {
      sendTime,
      slotCount,
      sentTodayBeforeRun: usage.sentToday,
      remainingLimit: usage.remainingToday,
      publishLimit,
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
