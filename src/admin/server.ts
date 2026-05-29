import 'dotenv/config';
import express from 'express';
import { logger } from '../lib/logger';
import { startScheduledCollector } from '../services/scheduledCollector';
import { startScheduledPublisher } from '../services/scheduledPublisher';
import { createCollectionScheduleRouter } from './routes/collectionSchedule.routes';
import { createJobsRouter } from './routes/jobs.routes';
import { createScheduleRouter } from './routes/schedule.routes';

const app = express();
const port = Number(process.env.ADMIN_PORT ?? 3000);

app.use(express.urlencoded({ extended: false }));
app.use((request, response, next) => {
  const startedAt = Date.now();

  response.on('finish', () => {
    logger.info('Requisicao admin finalizada.', {
      method: request.method,
      path: request.path,
      statusCode: response.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });

  next();
});

app.get('/', (_request, response) => {
  response.redirect('/admin/jobs');
});

app.use(createScheduleRouter());
app.use(createCollectionScheduleRouter());
app.use(createJobsRouter());

app.listen(port, () => {
  logger.info('Painel admin iniciado.', { url: `http://localhost:${port}/admin/jobs` });
  startScheduledCollector().catch((error) => {
    logger.error('Erro ao iniciar agendamento de coleta.', error);
  });
  startScheduledPublisher().catch((error) => {
    logger.error('Erro ao iniciar agendamento de envio.', error);
  });
});
