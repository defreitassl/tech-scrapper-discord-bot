import express from 'express';
import { logger } from '../../lib/logger';
import {
  getCollectionSchedulerSettings,
  updateCollectionSchedulerSettings,
  validateCollectionSchedulerSettings,
} from '../../services/collectionSchedulerSettings';
import { reloadScheduledCollector } from '../../services/scheduledCollector';
import { parseCollectionScheduleSettingsForm } from '../helpers/forms';
import { getNoticeFromQuery, redirectWithNotice } from '../helpers/notifications';
import { renderCollectionScheduleSettingsForm } from '../views/collectionSchedule.views';

export function createCollectionScheduleRouter(): express.Router {
  const router = express.Router();

  router.get('/admin/settings/collection', async (request, response) => {
    const settings = await getCollectionSchedulerSettings();

    response.send(
      renderCollectionScheduleSettingsForm({
        settings,
        notice: getNoticeFromQuery(request.query),
      }),
    );
  });

  router.post('/admin/settings/collection', async (request, response) => {
    const form = parseCollectionScheduleSettingsForm(request.body);
    const error = validateCollectionSchedulerSettings(form);

    if (error) {
      response.status(400).send(
        renderCollectionScheduleSettingsForm({
          form,
          notice: { message: error, type: 'error' },
        }),
      );
      return;
    }

    await updateCollectionSchedulerSettings(form);
    await reloadScheduledCollector();

    logger.info('Configuracao de coleta automatica atualizada pelo admin.', {
      enabled: form.enabled,
      frequency: form.frequency,
      weekdays: form.weekdays,
      collectTime: form.collectTime,
      timezone: form.timezone,
    });

    redirectWithNotice(response, '/admin/settings/collection', 'Configuracoes de coleta automatica salvas.');
  });

  return router;
}
