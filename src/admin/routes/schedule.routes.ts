import express from 'express';
import { logger } from '../../lib/logger';
import { getSchedulerDailyUsage, getUpcomingPendingJobs } from '../../services/schedulerOperations';
import {
  getSchedulerSettings,
  updateSchedulerSettings,
  validateSchedulerSettingsInput,
} from '../../services/schedulerSettings';
import { reloadScheduledPublisher } from '../../services/scheduledPublisher';
import { parseScheduleSettingsForm } from '../helpers/forms';
import { getNoticeFromQuery, redirectWithNotice } from '../helpers/notifications';
import { renderScheduleSettingsForm } from '../views/schedule.views';

export function createScheduleRouter(): express.Router {
  const router = express.Router();

  router.get('/admin/settings/schedule', async (request, response) => {
    const settings = await getSchedulerSettings();
    const [dailyUsage, pendingJobs] = await Promise.all([
      getSchedulerDailyUsage(settings),
      getUpcomingPendingJobs(5),
    ]);

    response.send(
      renderScheduleSettingsForm({
        settings,
        dailyUsage,
        pendingJobs,
        notice: getNoticeFromQuery(request.query),
      }),
    );
  });

  router.post('/admin/settings/schedule', async (request, response) => {
    const form = parseScheduleSettingsForm(request.body);
    const error = validateSchedulerSettingsInput(form);

    if (error) {
      const settings = await getSchedulerSettings();
      const [dailyUsage, pendingJobs] = await Promise.all([
        getSchedulerDailyUsage(settings),
        getUpcomingPendingJobs(5),
      ]);

      response.status(400).send(
        renderScheduleSettingsForm({
          form,
          dailyUsage,
          pendingJobs,
          notice: { message: error, type: 'error' },
        }),
      );
      return;
    }

    await updateSchedulerSettings(form);
    await reloadScheduledPublisher();

    logger.info('Configuracao de agendamento atualizada pelo admin.', {
      enabled: form.enabled,
      dailyLimit: form.dailyLimit,
      timezone: form.timezone,
      sendTimes: form.sendTimes,
    });

    redirectWithNotice(response, '/admin/settings/schedule', 'Configuracoes de envio agendado salvas.');
  });

  return router;
}
