import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import helmet from 'helmet';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import { startScheduledCollector, stopScheduledCollector } from '../services/scheduledCollector';
import { startScheduledPublisher, stopScheduledPublisher } from '../services/scheduledPublisher';
import { createCollectionScheduleRouter } from './routes/collectionSchedule.routes';
import { createEventsRouter } from './routes/events.routes';
import { createJobsRouter } from './routes/jobs.routes';
import { createScheduleRouter } from './routes/schedule.routes';

const app = express();
const port = Number(process.env.PORT ?? process.env.ADMIN_PORT ?? 3000);
const adminAuth = getAdminAuthConfig();

app.disable('x-powered-by');
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        scriptSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  }),
);
app.use(express.urlencoded({ extended: false, limit: '200kb' }));
app.use((request, response, next) => {
  const startedAt = Date.now();

  response.on('finish', () => {
    logger.info('Requisicao HTTP finalizada.', {
      method: request.method,
      path: request.path,
      statusCode: response.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });

  next();
});

app.get('/healthz', (_request, response) => {
  response.status(200).json({ status: 'ok' });
});

app.get('/', (_request, response) => {
  response.redirect('/admin/jobs');
});

app.use('/admin', requireAdminAuth(adminAuth));
app.use(createEventsRouter());
app.use(createScheduleRouter());
app.use(createCollectionScheduleRouter());
app.use(createJobsRouter());

const server = app.listen(port, () => {
  logger.info('Painel admin iniciado.', { url: `http://localhost:${port}/admin/jobs` });
  startScheduledCollector().catch((error) => {
    logger.error('Erro ao iniciar agendamento de coleta.', error);
  });
  startScheduledPublisher().catch((error) => {
    logger.error('Erro ao iniciar agendamento de envio.', error);
  });
});

let isShuttingDown = false;

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

type AdminAuthConfig =
  | {
      enabled: true;
      username: string;
      password: string;
    }
  | {
      enabled: false;
    };

function getAdminAuthConfig(): AdminAuthConfig {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  const isProduction = process.env.NODE_ENV === 'production';

  if (username && password) {
    return {
      enabled: true,
      username,
      password,
    };
  }

  if (isProduction) {
    logger.error('Configuracao critica ausente: ADMIN_USERNAME e ADMIN_PASSWORD sao obrigatorios em producao.');
    process.exit(1);
  }

  logger.warn('Autenticacao do painel admin desativada fora de producao por falta de ADMIN_USERNAME/ADMIN_PASSWORD.');

  return {
    enabled: false,
  };
}

function requireAdminAuth(config: AdminAuthConfig): express.RequestHandler {
  return (request, response, next) => {
    if (!config.enabled) {
      next();
      return;
    }

    const credentials = parseBasicAuthHeader(request.header('authorization'));

    if (
      credentials &&
      isValidCredential(credentials.username, config.username) &&
      isValidCredential(credentials.password, config.password)
    ) {
      next();
      return;
    }

    response.setHeader('WWW-Authenticate', 'Basic realm="Admin", charset="UTF-8"');
    response.status(401).send('Autenticacao obrigatoria.');
  };
}

function parseBasicAuthHeader(header: string | undefined): { username: string; password: string } | null {
  if (!header?.startsWith('Basic ')) {
    return null;
  }

  const encodedCredentials = header.slice('Basic '.length).trim();
  const decodedCredentials = Buffer.from(encodedCredentials, 'base64').toString('utf8');
  const separatorIndex = decodedCredentials.indexOf(':');

  if (separatorIndex === -1) {
    return null;
  }

  return {
    username: decodedCredentials.slice(0, separatorIndex),
    password: decodedCredentials.slice(separatorIndex + 1),
  };
}

function isValidCredential(received: string, expected: string): boolean {
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);

  if (receivedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
}

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  logger.info('Encerramento gracioso iniciado.', { signal });

  try {
    stopScheduledCollector();
    stopScheduledPublisher();

    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    await prisma.$disconnect();
    logger.info('Encerramento gracioso concluido.', { signal });
    process.exit(0);
  } catch (error) {
    logger.error('Erro durante encerramento gracioso.', error, { signal });
    process.exit(1);
  }
}
