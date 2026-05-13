import 'dotenv/config';
import express from 'express';
import { JobPost, JobStatus, SchedulerSettings } from '@prisma/client';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import { generateJobMessage } from '../services/aiMessageGenerator';
import { buildDefaultJobMessage } from '../services/jobMessage';
import { isUsableGeneratedMessage, publishPendingJobs, publishSingleJob } from '../services/publishPendingJobs';
import { reloadScheduledPublisher, startScheduledPublisher } from '../services/scheduledPublisher';
import {
  SchedulerDailyUsage,
  getSchedulerDailyUsage,
  getUpcomingPendingJobs,
} from '../services/schedulerOperations';
import {
  AVAILABLE_SEND_TIMES,
  DAILY_LIMIT_OPTIONS,
  DEFAULT_SCHEDULER_TIMEZONE,
  getSchedulerSettings,
  normalizeSchedulerSettings,
  updateSchedulerSettings,
  validateSchedulerSettingsInput,
} from '../services/schedulerSettings';

const app = express();
const port = Number(process.env.ADMIN_PORT ?? 3000);
const statuses = Object.values(JobStatus);
const statusLabels: Record<JobStatus, string> = {
  [JobStatus.DRAFT]: 'Rascunho',
  [JobStatus.PENDING]: 'Pronta para envio',
  [JobStatus.SENT]: 'Enviada',
  [JobStatus.ERROR]: 'Erro',
  [JobStatus.ARCHIVED]: 'Arquivada',
};

type JobFormData = {
  title: string | null;
  company: string | null;
  location: string | null;
  modality: string | null;
  level: string | null;
  stacks: string | null;
  salaryRange: string | null;
  shortDescription: string | null;
  url: string | null;
  source: string | null;
  rawText: string | null;
  readyText: string | null;
  useAi: boolean;
  status: JobStatus;
};

type JobApprovalData = Pick<
  JobPost,
  'title' | 'company' | 'location' | 'shortDescription' | 'rawText' | 'readyText' | 'aiGeneratedText' | 'useAi' | 'url'
>;

type ScheduleFormData = {
  enabled: boolean;
  dailyLimit: number;
  timezone: string;
  sendTimes: string[];
};

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

app.get('/admin/settings/schedule', async (request, response) => {
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
      notice: getQueryMessage(request.query.message),
    }),
  );
});

app.post('/admin/settings/schedule', async (request, response) => {
  const form = parseScheduleSettingsForm(request.body);
  const error = validateSchedulerSettingsInput(form);

  if (error) {
    const settings = await getSchedulerSettings();
    const [dailyUsage, pendingJobs] = await Promise.all([
      getSchedulerDailyUsage(settings),
      getUpcomingPendingJobs(5),
    ]);

    response.status(400).send(renderScheduleSettingsForm({ form, dailyUsage, pendingJobs, error }));
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

  response.redirect(
    `/admin/settings/schedule?message=${encodeURIComponent('Configuracoes de envio agendado salvas.')}`,
  );
});

app.get('/admin/jobs', async (request, response) => {
  const jobs = await prisma.jobPost.findMany({
    orderBy: { createdAt: 'desc' },
  });

  response.send(renderJobsList(jobs, getQueryMessage(request.query.message)));
});

app.get('/admin/jobs/new', (_request, response) => {
  response.send(renderJobForm({ title: 'Nova vaga', action: '/admin/jobs' }));
});

app.post('/admin/jobs', async (request, response) => {
  const form = parseJobForm(request.body);
  const createData = {
    ...form,
    status: JobStatus.PENDING,
  };
  const error = validateJob(createData);

  if (error) {
    response.status(400).send(renderJobForm({ title: 'Nova vaga', action: '/admin/jobs', form: createData, error }));
    return;
  }

  const job = await prisma.jobPost.create({ data: createData });
  logger.info('Vaga criada no admin.', {
    jobId: job.id,
    title: job.title,
    status: job.status,
    useAi: job.useAi,
  });

  if (!job.readyText?.trim() && job.useAi) {
    try {
      const generatedMessage = await generateJobMessage(job);

      await prisma.jobPost.update({
        where: { id: job.id },
        data: { aiGeneratedText: generatedMessage },
      });

      logger.info('Mensagem gerada automaticamente com IA no cadastro da vaga.', {
        jobId: job.id,
        messageLength: generatedMessage.length,
      });

      response.redirect(
        `/admin/jobs/${job.id}?message=${encodeURIComponent('Vaga salva como pronta para envio. A mensagem com IA foi gerada automaticamente.')}`,
      );
      return;
    } catch (error) {
      logger.error('Erro ao gerar mensagem automaticamente no cadastro. Vaga mantida como PENDING.', error, {
        jobId: job.id,
        title: job.title,
      });

      response.redirect(
        `/admin/jobs/${job.id}?message=${encodeURIComponent('Vaga salva como pronta para envio, mas nao foi possivel gerar a mensagem com IA agora. O preview usa o template padrao e voce pode regenerar depois.')}`,
      );
      return;
    }
  }

  const message = job.readyText?.trim()
    ? 'Vaga salva como pronta para envio. Como ha texto pronto, a IA nao foi chamada automaticamente.'
    : 'Vaga salva como pronta para envio. A IA nao foi chamada porque a opcao de usar IA esta desmarcada.';

  response.redirect(`/admin/jobs/${job.id}?message=${encodeURIComponent(message)}`);
});

app.post('/admin/jobs/publish-pending', async (_request, response) => {
  try {
    logger.info('Publicacao manual de vagas pendentes iniciada pelo admin.');
    const result = await publishPendingJobs();
    const message = `Publicacao concluida. Encontradas: ${result.total}. Enviadas: ${result.sent}. Erros: ${result.failed}.`;

    response.redirect(`/admin/jobs?message=${encodeURIComponent(message)}`);
  } catch (error) {
    logger.error('Erro ao publicar vagas pendentes pelo admin.', error);
    response.redirect(`/admin/jobs?message=${encodeURIComponent('Erro ao publicar vagas pendentes.')}`);
  }
});

app.get('/admin/jobs/:id', async (request, response) => {
  const job = await findJobOrRenderNotFound(request.params.id, response);

  if (!job) {
    return;
  }

  response.send(
    renderJobDetails(job, {
      notice: getQueryMessage(request.query.message),
      error: getQueryMessage(request.query.error),
    }),
  );
});

app.get('/admin/jobs/:id/edit', async (request, response) => {
  const job = await findJobOrRenderNotFound(request.params.id, response);

  if (!job) {
    return;
  }

  response.send(renderJobForm({ title: 'Editar vaga', action: `/admin/jobs/${job.id}`, job }));
});

app.post('/admin/jobs/:id', async (request, response) => {
  const job = await findJobOrRenderNotFound(request.params.id, response);

  if (!job) {
    return;
  }

  const form = parseJobForm(request.body);
  const error = validateJob(form, job.aiGeneratedText);

  if (error) {
    response.status(400).send(
      renderJobForm({
        title: 'Editar vaga',
        action: `/admin/jobs/${job.id}`,
        job,
        form,
        error,
      }),
    );
    return;
  }

  await prisma.jobPost.update({
    where: { id: job.id },
    data: form,
  });
  logger.info('Vaga atualizada no admin.', {
    jobId: job.id,
    title: form.title,
    status: form.status,
    useAi: form.useAi,
  });

  response.redirect(`/admin/jobs/${job.id}`);
});

app.post('/admin/jobs/:id/pending', async (request, response) => {
  const job = await findJobOrRenderNotFound(request.params.id, response);

  if (!job) {
    return;
  }

  const error = validatePending(job);

  if (error) {
    response.status(400).send(renderJobDetails(job, { error }));
    return;
  }

  await prisma.jobPost.update({
    where: { id: job.id },
    data: { status: JobStatus.PENDING },
  });
  logger.info('Vaga aprovada para envio no admin.', {
    jobId: job.id,
    title: job.title,
  });

  response.redirect(`/admin/jobs/${job.id}?message=${encodeURIComponent('Vaga marcada como pronta para envio.')}`);
});

app.post('/admin/jobs/:id/generate-ai-message', async (request, response) => {
  const job = await findJobOrRenderNotFound(request.params.id, response);

  if (!job) {
    return;
  }

  try {
    logger.info('Geracao manual de mensagem com IA iniciada pelo admin.', {
      jobId: job.id,
      title: job.title,
    });
    const generatedMessage = await generateJobMessage(job);

    await prisma.jobPost.update({
      where: { id: job.id },
      data: { aiGeneratedText: generatedMessage },
    });

    logger.info('Mensagem gerada manualmente com IA e salva.', {
      jobId: job.id,
      messageLength: generatedMessage.length,
    });

    response.redirect(`/admin/jobs/${job.id}?message=${encodeURIComponent('Mensagem com IA gerada e salva.')}`);
  } catch (error) {
    logger.error('Erro ao gerar mensagem com IA pelo admin.', error, {
      jobId: job.id,
      title: job.title,
    });
    response.redirect(
      `/admin/jobs/${job.id}?error=${encodeURIComponent('Nao foi possivel gerar a mensagem com IA. Verifique os dados da vaga e tente novamente.')}`,
    );
  }
});

app.post('/admin/jobs/:id/publish', async (request, response) => {
  const job = await findJobOrRenderNotFound(request.params.id, response);

  if (!job) {
    return;
  }

  const result = await publishSingleJob(job);
  const queryKey = result.status === 'failed' ? 'error' : 'message';

  response.redirect(`/admin/jobs/${job.id}?${queryKey}=${encodeURIComponent(result.message)}`);
});

app.post('/admin/jobs/:id/archive', async (request, response) => {
  const job = await findJobOrRenderNotFound(request.params.id, response);

  if (!job) {
    return;
  }

  await prisma.jobPost.update({
    where: { id: job.id },
    data: { status: JobStatus.ARCHIVED },
  });
  logger.info('Vaga arquivada no admin.', {
    jobId: job.id,
    title: job.title,
  });

  response.redirect('/admin/jobs');
});

app.listen(port, () => {
  logger.info('Painel admin iniciado.', { url: `http://localhost:${port}/admin/jobs` });
  startScheduledPublisher().catch((error) => {
    logger.error('Erro ao iniciar agendamento de envio.', error);
  });
});

function parseJobForm(body: unknown): JobFormData {
  return {
    title: optionalText(body, 'title'),
    company: optionalText(body, 'company'),
    location: optionalText(body, 'location'),
    modality: optionalText(body, 'modality'),
    level: optionalText(body, 'level'),
    stacks: optionalText(body, 'stacks'),
    salaryRange: optionalText(body, 'salaryRange'),
    shortDescription: optionalText(body, 'shortDescription'),
    url: optionalText(body, 'url'),
    source: optionalText(body, 'source'),
    rawText: optionalText(body, 'rawText'),
    readyText: optionalText(body, 'readyText'),
    useAi: fieldValue(body, 'useAi') === 'on',
    status: parseStatus(fieldValue(body, 'status')),
  };
}

function parseScheduleSettingsForm(body: unknown): ScheduleFormData {
  return {
    enabled: fieldValue(body, 'enabled') === 'on',
    dailyLimit: Number(fieldValue(body, 'dailyLimit')),
    timezone: DEFAULT_SCHEDULER_TIMEZONE,
    sendTimes: fieldValues(body, 'sendTimes'),
  };
}

function validateJob(form: JobFormData, existingAiGeneratedText: string | null = null): string | null {
  if (!form.title && !form.rawText) {
    return 'Informe pelo menos o titulo ou o texto bruto da vaga.';
  }

  if (form.status === JobStatus.PENDING) {
    return validatePending({ ...form, aiGeneratedText: existingAiGeneratedText });
  }

  return null;
}

function validatePending(job: JobApprovalData): string | null {
  if (job.readyText || job.aiGeneratedText || hasTemplateData(job)) {
    return null;
  }

  return 'Para deixar pronta para envio, informe dados da vaga, texto pronto, mensagem gerada por IA ou URL.';
}

function hasTemplateData(
  job: Pick<JobApprovalData, 'title' | 'company' | 'location' | 'shortDescription' | 'rawText' | 'url'>,
): boolean {
  return Boolean(job.title || job.company || job.location || job.shortDescription || job.rawText || job.url);
}

async function findJobOrRenderNotFound(id: string, response: express.Response): Promise<JobPost | null> {
  const job = await prisma.jobPost.findUnique({ where: { id } });

  if (!job) {
    response.status(404).send(renderLayout('Vaga nao encontrada', '<p>Vaga nao encontrada.</p>'));
    return null;
  }

  return job;
}

function optionalText(body: unknown, field: string): string | null {
  const value = fieldValue(body, field).trim();
  return value.length > 0 ? value : null;
}

function fieldValue(body: unknown, field: string): string {
  if (!body || typeof body !== 'object') {
    return '';
  }

  const value = (body as Record<string, unknown>)[field];

  if (typeof value !== 'string') {
    return '';
  }

  return value;
}

function fieldValues(body: unknown, field: string): string[] {
  if (!body || typeof body !== 'object') {
    return [];
  }

  const value = (body as Record<string, unknown>)[field];

  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }

  if (typeof value === 'string') {
    return [value];
  }

  return [];
}

function parseStatus(value: string): JobStatus {
  if (statuses.includes(value as JobStatus)) {
    return value as JobStatus;
  }

  return JobStatus.DRAFT;
}

function getQueryMessage(message: unknown): string | undefined {
  return typeof message === 'string' ? message : undefined;
}

function renderJobsList(jobs: JobPost[], message?: string): string {
  const rows = jobs
    .map(
      (job) => `
        <tr>
          <td>
            <a class="job-title" href="/admin/jobs/${escapeHtml(job.id)}">${escapeHtml(job.title ?? 'Sem titulo')}</a>
            <span class="job-meta">${escapeHtml(job.location ?? 'Localizacao nao informada')}</span>
          </td>
          <td>${escapeHtml(job.company ?? '-')}</td>
          <td>${renderStatusBadge(job.status)}</td>
          <td>${escapeHtml(job.source ?? '-')}</td>
          <td><span class="date-cell">${formatDate(job.createdAt)}</span></td>
          <td><span class="date-cell">${job.sentAt ? formatDate(job.sentAt) : '-'}</span></td>
          <td class="actions">
            <a class="button secondary" href="/admin/jobs/${escapeHtml(job.id)}/edit">Editar</a>
            ${renderPostButton(`/admin/jobs/${escapeHtml(job.id)}/pending`, 'Aprovar para envio')}
            ${renderPostButton(`/admin/jobs/${escapeHtml(job.id)}/archive`, 'Arquivar')}
          </td>
        </tr>
      `,
    )
    .join('');

  const content = `
    <div class="page-heading">
      <div>
        <p class="eyebrow">Painel admin</p>
        <h1>Vagas</h1>
        <p class="subtitle">Gerencie vagas, revise textos e envie oportunidades para o Discord.</p>
      </div>
      <div class="actions">
        <form method="post" action="/admin/jobs/publish-pending">
          <button type="submit" class="primary-action">Enviar vagas pendentes</button>
        </form>
        <a class="button" href="/admin/jobs/new">Nova vaga</a>
      </div>
    </div>
    ${message ? `<p class="notice">${escapeHtml(message)}</p>` : ''}
    <section class="card table-card">
      <div class="section-heading">
        <h2>Lista de vagas</h2>
        <span>${jobs.length} cadastrada${jobs.length === 1 ? '' : 's'}</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Titulo</th>
              <th>Empresa</th>
              <th>Status</th>
              <th>Fonte</th>
              <th>Criada em</th>
              <th>Enviada em</th>
              <th>Acoes</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="7" class="empty">Nenhuma vaga cadastrada.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
  `;

  return renderLayout('Vagas', content);
}

function renderScheduleSettingsForm(options: {
  settings?: SchedulerSettings;
  form?: ScheduleFormData;
  dailyUsage?: SchedulerDailyUsage;
  pendingJobs?: JobPost[];
  notice?: string;
  error?: string;
}): string {
  const form = options.form ?? scheduleFormFromSettings(options.settings);
  const sentToday = options.dailyUsage?.sentToday ?? 0;
  const remainingToday = options.dailyUsage?.remainingToday ?? Math.max(form.dailyLimit - sentToday, 0);
  const content = `
    <div class="page-heading">
      <div>
        <p class="eyebrow">Configuracoes</p>
        <h1>Envio agendado</h1>
        <p class="subtitle">Defina o envio automatico e acompanhe o limite diario, os horarios configurados e a fila de vagas prontas.</p>
      </div>
      <div class="actions">
        <a class="button secondary" href="/admin/jobs">Voltar para vagas</a>
      </div>
    </div>
    ${options.notice ? `<p class="notice">${escapeHtml(options.notice)}</p>` : ''}
    ${options.error ? `<p class="error">${escapeHtml(options.error)}</p>` : ''}
    <section class="card settings-summary">
      <div class="section-heading">
        <h2>Resumo operacional</h2>
        ${renderSchedulerStateBadge(form.enabled)}
      </div>
      <dl>
        <div class="detail-item"><dt>Agendamento</dt><dd>${form.enabled ? 'Ativo' : 'Inativo'}</dd></div>
        <div class="detail-item"><dt>Limite diario</dt><dd>${escapeHtml(String(form.dailyLimit))}</dd></div>
        <div class="detail-item"><dt>Enviadas hoje</dt><dd>${escapeHtml(String(sentToday))}</dd></div>
        <div class="detail-item"><dt>Restante hoje</dt><dd>${escapeHtml(String(remainingToday))}</dd></div>
        <div class="detail-item"><dt>Timezone do sistema</dt><dd>${escapeHtml(form.timezone)}</dd></div>
        <div class="detail-item"><dt>Slots configurados</dt><dd>${renderSendTimeSlotsSummary(form.sendTimes)}</dd></div>
        <div class="detail-item"><dt>Processo</dt><dd>O painel admin precisa estar rodando para o agendamento funcionar.</dd></div>
        <div class="detail-item"><dt>Escopo do limite</dt><dd>O limite diario vale apenas para o envio agendado. O envio manual continua disponivel e nao e bloqueado por esse limite.</dd></div>
      </dl>
    </section>
    ${renderPendingJobsQueue(options.pendingJobs ?? [])}
    <form method="post" action="/admin/settings/schedule" class="job-form settings-form">
      ${renderFormSection(
        'Regras de envio',
        'Escolha quantas vagas serao enviadas por dia e um horario para cada vaga. Cada horario envia 1 vaga da fila; horarios repetidos enviam mais de uma vaga no mesmo horario.',
        [
          `<label class="checkbox wide">
            <input type="checkbox" name="enabled" ${form.enabled ? 'checked' : ''}>
            <span>
              <strong>Ativar envio agendado</strong>
              <small>Quando desativado, nenhum horario automatico publica vagas.</small>
            </span>
          </label>`,
          renderDailyLimitSelect(form.dailyLimit),
          `<div class="detail-item timezone-info wide">
            <dt>Timezone</dt>
            <dd>${escapeHtml(DEFAULT_SCHEDULER_TIMEZONE)}</dd>
            <small>Definido automaticamente pelo sistema.</small>
          </div>`,
          renderSendTimeSlotSelects(form.sendTimes),
        ].join(''),
      )}
      <div class="form-actions">
        <button type="submit">Salvar configuracoes</button>
      </div>
    </form>
    ${renderScheduleSettingsScript()}
  `;

  return renderLayout('Envio agendado', content);
}

function renderPendingJobsQueue(jobs: JobPost[]): string {
  const rows = jobs
    .map(
      (job) => `
        <tr>
          <td>
            <a class="job-title" href="/admin/jobs/${escapeHtml(job.id)}">${escapeHtml(job.title ?? 'Sem titulo')}</a>
          </td>
          <td>${escapeHtml(job.company ?? '-')}</td>
          <td>${renderStatusBadge(job.status)}</td>
          <td><span class="date-cell">${formatDate(job.createdAt)}</span></td>
          <td><a class="button secondary" href="/admin/jobs/${escapeHtml(job.id)}">Detalhes</a></td>
        </tr>
      `,
    )
    .join('');

  return `
    <section class="card table-card schedule-queue">
      <div class="section-heading">
        <h2>Fila de envio</h2>
        <span>Proximas vagas prontas</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Titulo</th>
              <th>Empresa</th>
              <th>Status</th>
              <th>Criada em</th>
              <th>Acoes</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="5" class="empty">Nenhuma vaga pronta para envio no momento.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderDailyLimitSelect(dailyLimit: number): string {
  return `
    <label>
      <span>Vagas por dia</span>
      <select name="dailyLimit" id="dailyLimitSelect">
        ${DAILY_LIMIT_OPTIONS.map(
          (option) =>
            `<option value="${option}" ${option === dailyLimit ? 'selected' : ''}>${option}</option>`,
        ).join('')}
      </select>
      <small>Escolha quantas vagas serao enviadas por dia pelo agendamento.</small>
    </label>
  `;
}

function renderSendTimeSlotSelects(sendTimes: string[]): string {
  return `
    <div class="wide schedule-slots">
      <div class="schedule-slots-header">
        <h3>Horarios de envio</h3>
        <small>Escolha um horario para cada vaga. Cada horario envia 1 vaga da fila.</small>
      </div>
      <div id="sendTimeSlots" class="schedule-slots-grid">
        ${sendTimes.map((sendTime, index) => renderSendTimeSlotSelect(index, sendTime)).join('')}
      </div>
      <small>Horarios repetidos enviam mais de uma vaga no mesmo horario.</small>
    </div>
  `;
}

function renderSendTimeSlotSelect(index: number, selectedSendTime: string): string {
  return `
    <label>
      <span>Vaga ${index + 1}</span>
      <select name="sendTimes">
        ${AVAILABLE_SEND_TIMES.map(
          (sendTime) =>
            `<option value="${escapeHtml(sendTime)}" ${sendTime === selectedSendTime ? 'selected' : ''}>${escapeHtml(sendTime)}</option>`,
        ).join('')}
      </select>
    </label>
  `;
}

function renderSendTimeSlotsSummary(sendTimes: string[]): string {
  return `
    <ol class="slot-summary">
      ${sendTimes
        .map((sendTime, index) => `<li>Vaga ${index + 1}: ${escapeHtml(sendTime)}</li>`)
        .join('')}
    </ol>
  `;
}

function renderScheduleSettingsScript(): string {
  return `
    <script>
      (() => {
        const availableSendTimes = ${JSON.stringify(AVAILABLE_SEND_TIMES)};
        const dailyLimitSelect = document.getElementById('dailyLimitSelect');
        const slotsContainer = document.getElementById('sendTimeSlots');

        if (!dailyLimitSelect || !slotsContainer) {
          return;
        }

        const buildSlot = (index, selectedValue) => {
          const label = document.createElement('label');
          const title = document.createElement('span');
          const select = document.createElement('select');

          title.textContent = 'Vaga ' + (index + 1);
          select.name = 'sendTimes';

          for (const sendTime of availableSendTimes) {
            const option = document.createElement('option');
            option.value = sendTime;
            option.textContent = sendTime;
            option.selected = sendTime === selectedValue;
            select.appendChild(option);
          }

          label.appendChild(title);
          label.appendChild(select);

          return label;
        };

        dailyLimitSelect.addEventListener('change', () => {
          const currentValues = Array.from(slotsContainer.querySelectorAll('select')).map((select) => select.value);
          const dailyLimit = Number(dailyLimitSelect.value);

          slotsContainer.replaceChildren();

          for (let index = 0; index < dailyLimit; index += 1) {
            slotsContainer.appendChild(buildSlot(index, currentValues[index] ?? availableSendTimes[index % availableSendTimes.length]));
          }
        });
      })();
    </script>
  `;
}

function scheduleFormFromSettings(settings?: SchedulerSettings): ScheduleFormData {
  const normalizedSettings = settings ? normalizeSchedulerSettings(settings) : null;

  return {
    enabled: normalizedSettings?.enabled ?? false,
    dailyLimit: normalizedSettings?.dailyLimit ?? 5,
    timezone: normalizedSettings?.timezone ?? DEFAULT_SCHEDULER_TIMEZONE,
    sendTimes: normalizedSettings?.sendTimes ?? AVAILABLE_SEND_TIMES.slice(0, 5),
  };
}

function renderJobDetails(job: JobPost, feedback: { notice?: string; error?: string } = {}): string {
  const fields: Array<[string, string | null]> = [
    ['Titulo', job.title],
    ['Empresa', job.company],
    ['Localizacao', job.location],
    ['Modalidade', job.modality],
    ['Nivel', job.level],
    ['Stacks', job.stacks],
    ['Faixa salarial', job.salaryRange],
    ['URL', job.url],
    ['Fonte', job.source],
    ['Usar IA', job.useAi ? 'Sim' : 'Nao'],
    ['Status', getStatusLabel(job.status)],
    ['Criada em', formatDate(job.createdAt)],
    ['Atualizada em', formatDate(job.updatedAt)],
    ['Enviada em', job.sentAt ? formatDate(job.sentAt) : null],
  ];

  const details = fields
    .map(([label, value]) => {
      const renderedValue = label === 'Status' ? renderStatusBadge(job.status) : escapeHtml(value ?? '-');
      return `<div class="detail-item"><dt>${escapeHtml(label)}</dt><dd>${renderedValue}</dd></div>`;
    })
    .join('');

  const content = `
    <div class="page-heading">
      <div>
        <p class="eyebrow">Detalhes da vaga</p>
        <h1>${escapeHtml(job.title ?? 'Vaga sem titulo')}</h1>
        <p class="subtitle">${escapeHtml(job.company ?? 'Empresa nao informada')}</p>
      </div>
      <div class="actions">
        <a class="button secondary" href="/admin/jobs">Voltar</a>
        <a class="button" href="/admin/jobs/${escapeHtml(job.id)}/edit">Editar</a>
      </div>
    </div>
    ${feedback.notice ? `<p class="notice">${escapeHtml(feedback.notice)}</p>` : ''}
    ${feedback.error ? `<p class="error">${escapeHtml(feedback.error)}</p>` : ''}
    <section class="card">
      <div class="section-heading">
        <h2>Resumo</h2>
        ${renderStatusBadge(job.status)}
      </div>
      <dl>${details}</dl>
    </section>
    ${renderMessagePreview(job)}
    <div class="text-grid">
      ${renderLongText('Sobre a vaga', job.shortDescription)}
      ${renderLongText('Texto bruto', job.rawText)}
      ${renderLongText('Texto pronto', job.readyText)}
      ${renderLongText('Texto gerado por IA', job.aiGeneratedText)}
    </div>
    <div class="actions footer-actions">
      ${renderPostButton(`/admin/jobs/${escapeHtml(job.id)}/publish`, 'Enviar esta vaga agora', 'primary-action')}
      ${renderPostButton(`/admin/jobs/${escapeHtml(job.id)}/generate-ai-message`, 'Regenerar mensagem com IA')}
      ${renderPostButton(`/admin/jobs/${escapeHtml(job.id)}/pending`, 'Aprovar para envio')}
      ${renderPostButton(`/admin/jobs/${escapeHtml(job.id)}/archive`, 'Arquivar')}
    </div>
  `;

  return renderLayout('Detalhes da vaga', content);
}

function renderJobForm(options: {
  title: string;
  action: string;
  job?: JobPost;
  form?: JobFormData;
  error?: string;
}): string {
  const form = options.form ?? formFromJob(options.job);
  const isNewJob = !options.job;
  const content = `
    <div class="page-heading">
      <div>
        <p class="eyebrow">Cadastro de vaga</p>
        <h1>${escapeHtml(options.title)}</h1>
        <p class="subtitle">${isNewJob ? 'Preencha os dados principais. Vagas novas entram prontas para envio e ficam na fila do agendamento.' : 'Atualize os dados principais e escolha como a vaga sera preparada para envio.'}</p>
      </div>
      <div class="actions">
        <a class="button secondary" href="/admin/jobs">Voltar</a>
      </div>
    </div>
    ${options.error ? `<p class="error">${escapeHtml(options.error)}</p>` : ''}
    <form method="post" action="${escapeHtml(options.action)}" class="job-form">
      ${renderFormSection(
        'Informacoes principais',
        'Dados usados para identificar a vaga na listagem e no envio.',
        [
          renderInput('title', 'Titulo', form.title, 'Ex.: Desenvolvedor Front-end Junior'),
          renderInput('company', 'Empresa', form.company, 'Nome da empresa ou consultoria'),
          renderInput('location', 'Localizacao', form.location, 'Cidade, estado ou remoto'),
          renderInput('source', 'Fonte', form.source, 'Origem da vaga'),
          renderInput('url', 'URL', form.url, 'Link publico da oportunidade'),
        ].join(''),
      )}
      ${renderFormSection(
        'Detalhes da vaga',
        'Contexto que ajuda os alunos a avaliarem aderencia.',
        [
          renderInput('modality', 'Modalidade', form.modality, 'Remoto, hibrido ou presencial'),
          renderInput('level', 'Nivel', form.level, 'Estagio, junior, pleno...'),
          renderInput('stacks', 'Stacks', form.stacks, 'Tecnologias separadas por virgula'),
          renderInput('salaryRange', 'Faixa salarial', form.salaryRange, 'Opcional'),
          renderTextarea('shortDescription', 'Sobre a vaga', form.shortDescription, 4, 'Resumo curto com requisitos e responsabilidades.'),
        ].join(''),
      )}
      ${renderFormSection(
        'Textos e IA',
        isNewJob
          ? 'Cole o texto original. Ao salvar, o sistema tenta gerar a mensagem com IA automaticamente, exceto quando houver texto pronto.'
          : 'Cole o texto original ou informe um texto pronto para publicacao.',
        [
          renderTextarea('rawText', 'Texto bruto', form.rawText, 8, 'Texto capturado da fonte original.'),
          renderTextarea('readyText', 'Texto pronto', form.readyText, 8, 'Mensagem final que pode ser enviada sem IA.'),
          `<label class="checkbox wide">
            <input type="checkbox" name="useAi" ${form.useAi ? 'checked' : ''}>
            <span>
              <strong>Usar IA para preparar o texto</strong>
              <small>${isNewJob ? 'Quando marcado, a mensagem sera gerada automaticamente ao salvar se nao houver texto pronto.' : 'Quando marcado, o sistema pode gerar uma versao melhor formatada antes do envio.'}</small>
            </span>
          </label>`,
        ].join(''),
      )}
      ${renderFormSection(
        'Status',
        isNewJob
          ? 'Novas vagas manuais ficam como Pronta para envio e podem ser enviadas agora ou pelo agendamento.'
          : 'Controle o ciclo da vaga sem alterar as regras de publicacao.',
        `<label>
          <span>Status</span>
          <select name="status">
            ${statuses
              .map(
                (status) =>
                  `<option value="${escapeHtml(status)}" ${status === form.status ? 'selected' : ''}>${escapeHtml(getStatusLabel(status))}</option>`,
              )
              .join('')}
          </select>
          <small>Aprovacao manual segue disponivel para vagas antigas ou rascunhos.</small>
        </label>`,
      )}
      <div class="form-actions">
        <button type="submit">${isNewJob ? 'Salvar e preparar para envio' : 'Salvar'}</button>
      </div>
    </form>
  `;

  return renderLayout(options.title, content);
}

function formFromJob(job?: JobPost): JobFormData {
  return {
    title: job?.title ?? null,
    company: job?.company ?? null,
    location: job?.location ?? null,
    modality: job?.modality ?? null,
    level: job?.level ?? null,
    stacks: job?.stacks ?? null,
    salaryRange: job?.salaryRange ?? null,
    shortDescription: job?.shortDescription ?? null,
    url: job?.url ?? null,
    source: job?.source ?? null,
    rawText: job?.rawText ?? null,
    readyText: job?.readyText ?? null,
    useAi: job?.useAi ?? true,
    status: job?.status ?? JobStatus.PENDING,
  };
}

function renderInput(name: string, label: string, value: string | null, help?: string): string {
  return `
    <label>
      <span>${escapeHtml(label)}</span>
      <input type="text" name="${escapeHtml(name)}" value="${escapeHtml(value ?? '')}">
      ${help ? `<small>${escapeHtml(help)}</small>` : ''}
    </label>
  `;
}

function renderTextarea(name: string, label: string, value: string | null, rows = 7, help?: string): string {
  return `
    <label class="wide">
      <span>${escapeHtml(label)}</span>
      <textarea name="${escapeHtml(name)}" rows="${rows}">${escapeHtml(value ?? '')}</textarea>
      ${help ? `<small>${escapeHtml(help)}</small>` : ''}
    </label>
  `;
}

function renderFormSection(title: string, description: string, content: string): string {
  return `
    <section class="form-section">
      <div class="form-section-header">
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(description)}</p>
      </div>
      <div class="form-grid">${content}</div>
    </section>
  `;
}

function renderLongText(title: string, value: string | null): string {
  if (!value) {
    return `
      <section class="card text-card empty-text">
        <h2>${escapeHtml(title)}</h2>
        <p>Nenhum conteudo informado.</p>
      </section>
    `;
  }

  return `
    <section class="card text-card">
      <h2>${escapeHtml(title)}</h2>
      <pre>${escapeHtml(value)}</pre>
    </section>
  `;
}

function renderMessagePreview(job: JobPost): string {
  const preview = resolvePreviewMessage(job);

  return `
    <section class="card preview-card">
      <div class="section-heading">
        <div>
          <h2>Preview da mensagem</h2>
          <p>${escapeHtml(preview.description)}</p>
        </div>
        <span>${escapeHtml(preview.source)}</span>
      </div>
      <pre class="message-preview">${escapeHtml(preview.message)}</pre>
    </section>
  `;
}

function resolvePreviewMessage(job: JobPost): { message: string; source: string; description: string } {
  const readyText = job.readyText?.trim();

  if (readyText) {
    return {
      message: readyText,
      source: 'Texto pronto',
      description: 'Esta e a mensagem que sera enviada, pois readyText tem prioridade.',
    };
  }

  const aiGeneratedText = job.aiGeneratedText?.trim();

  if (aiGeneratedText && isUsableGeneratedMessage(aiGeneratedText)) {
    return {
      message: aiGeneratedText,
      source: 'Texto gerado por IA',
      description: 'Esta e a mensagem salva em aiGeneratedText e considerada valida.',
    };
  }

  const description = aiGeneratedText
    ? 'O texto gerado por IA salvo nao e considerado valido; o preview usa o template padrao.'
    : 'Nenhum texto pronto ou texto de IA valido foi encontrado; o preview usa o template padrao.';

  return {
    message: buildDefaultJobMessage(job),
    source: 'Template padrao',
    description,
  };
}

function renderPostButton(action: string, label: string, variant = 'secondary'): string {
  return `
    <form method="post" action="${action}">
      <button type="submit" class="${escapeHtml(variant)}">${escapeHtml(label)}</button>
    </form>
  `;
}

function renderStatusBadge(status: JobStatus): string {
  return `<span class="status-badge status-${escapeHtml(status.toLowerCase())}">${escapeHtml(getStatusLabel(status))}</span>`;
}

function renderSchedulerStateBadge(enabled: boolean): string {
  const label = enabled ? 'Ativo' : 'Inativo';
  const className = enabled ? 'scheduler-active' : 'scheduler-inactive';

  return `<span class="status-badge ${className}">${label}</span>`;
}

function getStatusLabel(status: JobStatus): string {
  return statusLabels[status];
}

function renderLayout(title: string, content: string): string {
  return `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${escapeHtml(title)} - discord-jobs-bot</title>
        <style>
          :root {
            color-scheme: light;
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            color: #172033;
            background: #eef3f8;
            --bg: #eef3f8;
            --surface: #ffffff;
            --surface-soft: #f8fafc;
            --border: #dbe4ee;
            --border-strong: #b8c7d9;
            --text-muted: #64748b;
            --text-soft: #8291a5;
            --brand: #0f766e;
            --brand-dark: #115e59;
            --brand-soft: #ccfbf1;
            --danger: #b91c1c;
            --shadow: 0 20px 45px rgba(15, 23, 42, 0.08);
          }

          body {
            margin: 0;
            min-height: 100vh;
            background:
              radial-gradient(circle at top left, rgba(20, 184, 166, 0.14), transparent 32rem),
              linear-gradient(180deg, #f8fbfd 0%, var(--bg) 52%, #e8eef5 100%);
          }

          main {
            max-width: 1180px;
            margin: 0 auto;
            padding: 32px 20px 48px;
          }

          h1 {
            margin: 0;
            font-size: clamp(28px, 4vw, 40px);
            line-height: 1.08;
            letter-spacing: 0;
            color: #0f172a;
          }

          h2 {
            margin: 0;
            font-size: 18px;
            line-height: 1.3;
            color: #172033;
          }

          h3 {
            margin: 0;
            font-size: 15px;
            line-height: 1.3;
            color: #172033;
          }

          a {
            color: var(--brand);
            font-weight: 650;
            text-decoration-thickness: 1px;
            text-underline-offset: 3px;
          }

          table {
            width: 100%;
            min-width: 920px;
            border-collapse: collapse;
            background: var(--surface);
          }

          th,
          td {
            padding: 16px;
            border-bottom: 1px solid var(--border);
            text-align: left;
            vertical-align: middle;
          }

          th {
            font-size: 12px;
            color: #526176;
            background: #f5f8fb;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            white-space: nowrap;
          }

          tbody tr:hover {
            background: #fbfdff;
          }

          input,
          textarea,
          select {
            box-sizing: border-box;
            width: 100%;
            margin-top: 6px;
            padding: 11px 12px;
            border: 1px solid var(--border-strong);
            border-radius: 6px;
            font: inherit;
            color: #172033;
            background: #ffffff;
            outline: none;
            transition: border-color 0.15s ease, box-shadow 0.15s ease;
          }

          input:focus,
          textarea:focus,
          select:focus {
            border-color: var(--brand);
            box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.14);
          }

          textarea {
            resize: vertical;
            line-height: 1.55;
          }

          button,
          .button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: 38px;
            padding: 9px 14px;
            border: 1px solid var(--brand);
            border-radius: 6px;
            font: inherit;
            font-weight: 700;
            color: #ffffff;
            background: var(--brand);
            text-decoration: none;
            cursor: pointer;
            white-space: nowrap;
            transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
          }

          button:hover,
          .button:hover {
            background: var(--brand-dark);
            border-color: var(--brand-dark);
            box-shadow: 0 8px 18px rgba(15, 118, 110, 0.18);
          }

          button.secondary,
          .button.secondary {
            color: #334155;
            border-color: var(--border-strong);
            background: #ffffff;
          }

          button.secondary:hover,
          .button.secondary:hover {
            color: #172033;
            border-color: #94a3b8;
            background: #f8fafc;
            box-shadow: none;
          }

          .primary-action {
            background: #f59e0b;
            border-color: #d97706;
            color: #231704;
          }

          .primary-action:hover {
            background: #d97706;
            border-color: #b45309;
            color: #ffffff;
          }

          dl {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
            margin: 18px 0 0;
          }

          dt {
            margin: 0 0 4px;
            font-size: 12px;
            font-weight: 750;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.04em;
          }

          dd {
            margin: 0;
            color: #172033;
            overflow-wrap: anywhere;
          }

          pre {
            white-space: pre-wrap;
            margin: 14px 0 0;
            padding: 16px;
            overflow: auto;
            border: 1px solid var(--border);
            border-radius: 6px;
            color: #27364a;
            background: #f8fafc;
            line-height: 1.55;
            font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
            font-size: 13px;
          }

          .topbar {
            border-bottom: 1px solid rgba(148, 163, 184, 0.26);
            background: rgba(255, 255, 255, 0.82);
            backdrop-filter: blur(16px);
          }

          .topbar-inner {
            display: flex;
            align-items: center;
            justify-content: space-between;
            max-width: 1180px;
            margin: 0 auto;
            padding: 14px 20px;
          }

          .brand {
            display: flex;
            align-items: center;
            gap: 10px;
            color: #0f172a;
            font-weight: 800;
          }

          .brand-mark {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 34px;
            height: 34px;
            border-radius: 8px;
            color: #ffffff;
            background: linear-gradient(135deg, #0f766e, #2563eb);
            box-shadow: 0 10px 22px rgba(37, 99, 235, 0.18);
          }

          .topbar a {
            color: var(--text-muted);
            font-size: 14px;
            text-decoration: none;
          }

          .topbar nav {
            display: flex;
            align-items: center;
            gap: 14px;
          }

          .page-heading {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            margin-bottom: 24px;
          }

          .actions {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
          }

          .actions form {
            margin: 0;
          }

          .eyebrow {
            margin: 0 0 8px;
            color: var(--brand);
            font-size: 12px;
            font-weight: 800;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          .subtitle {
            max-width: 680px;
            margin: 10px 0 0;
            color: var(--text-muted);
            line-height: 1.55;
          }

          .card {
            padding: 22px;
            border: 1px solid var(--border);
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.94);
            box-shadow: var(--shadow);
          }

          .table-card {
            padding: 0;
            overflow: hidden;
          }

          .settings-summary,
          .schedule-queue {
            margin-bottom: 18px;
          }

          .section-heading {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 18px 20px;
            border-bottom: 1px solid var(--border);
          }

          .section-heading span {
            color: var(--text-muted);
            font-size: 13px;
            font-weight: 650;
          }

          .table-wrap {
            overflow-x: auto;
          }

          .job-title {
            display: inline-block;
            color: #0f172a;
            font-weight: 800;
          }

          .job-meta {
            display: block;
            margin-top: 4px;
            color: var(--text-muted);
            font-size: 13px;
          }

          .date-cell {
            color: #475569;
            font-size: 13px;
            white-space: nowrap;
          }

          .job-form {
            display: grid;
            gap: 18px;
          }

          .form-section {
            padding: 22px;
            border: 1px solid var(--border);
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.94);
            box-shadow: var(--shadow);
          }

          .form-section-header {
            margin-bottom: 18px;
            padding-bottom: 16px;
            border-bottom: 1px solid var(--border);
          }

          .form-section-header p {
            margin: 6px 0 0;
            color: var(--text-muted);
            line-height: 1.5;
          }

          .form-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 16px;
          }

          .form-grid .wide,
          .form-actions {
            grid-column: 1 / -1;
          }

          label span,
          label {
            color: #26364b;
            font-weight: 700;
          }

          small {
            display: block;
            margin-top: 6px;
            color: var(--text-muted);
            font-size: 12px;
            font-weight: 500;
            line-height: 1.45;
          }

          .checkbox {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            padding: 14px;
            border: 1px solid var(--border);
            border-radius: 8px;
            background: var(--surface-soft);
          }

          .checkbox input {
            flex: 0 0 auto;
            width: auto;
            margin: 4px 0 0;
          }

          .checkbox strong {
            display: block;
            color: #172033;
          }

          .form-actions {
            display: flex;
            justify-content: flex-end;
          }

          .detail-item {
            padding: 14px;
            border: 1px solid var(--border);
            border-radius: 8px;
            background: var(--surface-soft);
          }

          .timezone-info {
            margin: 0;
          }

          .schedule-slots {
            padding: 14px;
            border: 1px solid var(--border);
            border-radius: 8px;
            background: var(--surface-soft);
          }

          .schedule-slots-header {
            margin-bottom: 12px;
          }

          .schedule-slots-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
          }

          .slot-summary {
            margin: 0;
            padding-left: 18px;
          }

          .slot-summary li + li {
            margin-top: 4px;
          }

          .text-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 18px;
            margin-top: 18px;
          }

          .preview-card {
            margin-top: 18px;
            border-color: rgba(15, 118, 110, 0.28);
            background: linear-gradient(180deg, #ffffff 0%, #f3fbfa 100%);
          }

          .preview-card .section-heading p {
            margin: 6px 0 0;
            color: var(--text-muted);
            font-size: 13px;
            line-height: 1.45;
          }

          .message-preview {
            border-color: rgba(15, 118, 110, 0.22);
            background: #ffffff;
          }

          .text-card {
            min-width: 0;
          }

          .empty-text p {
            margin: 14px 0 0;
            color: var(--text-muted);
          }

          .footer-actions {
            margin-top: 18px;
          }

          .status-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: 24px;
            padding: 3px 9px;
            border-radius: 6px;
            border: 1px solid transparent;
            font-size: 12px;
            font-weight: 800;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            white-space: nowrap;
          }

          .status-draft {
            color: #475569;
            border-color: #cbd5e1;
            background: #f1f5f9;
          }

          .status-pending {
            color: #92400e;
            border-color: #fed7aa;
            background: #fffbeb;
          }

          .status-sent {
            color: #166534;
            border-color: #bbf7d0;
            background: #f0fdf4;
          }

          .status-error {
            color: #991b1b;
            border-color: #fecaca;
            background: #fef2f2;
          }

          .status-archived {
            color: #e2e8f0;
            border-color: #334155;
            background: #334155;
          }

          .scheduler-active {
            color: #166534;
            border-color: #bbf7d0;
            background: #f0fdf4;
          }

          .scheduler-inactive {
            color: #475569;
            border-color: #cbd5e1;
            background: #f1f5f9;
          }

          .error,
          .notice {
            padding: 14px 16px;
            border-radius: 8px;
            font-weight: 650;
          }

          .error {
            border: 1px solid #fecaca;
            color: var(--danger);
            background: #fef2f2;
          }

          .notice {
            border: 1px solid #bbf7d0;
            color: #166534;
            background: #f0fdf4;
          }

          .empty {
            padding: 34px 16px;
            color: var(--text-muted);
            text-align: center;
          }

          @media (max-width: 760px) {
            main {
              padding: 22px 14px 36px;
            }

            .topbar-inner {
              padding: 12px 14px;
            }

            .page-heading,
            .form-grid,
            .schedule-slots-grid,
            .text-grid,
            dl {
              display: block;
            }

            .page-heading .actions {
              margin-top: 16px;
            }

            .actions,
            .actions form,
            .actions button,
            .actions .button,
            .form-actions button {
              width: 100%;
            }

            .form-section,
            .card {
              padding: 16px;
            }

            .table-card {
              padding: 0;
            }

            .form-grid label,
            .form-grid .checkbox,
            .schedule-slots-grid label,
            .text-card,
            .detail-item {
              margin-top: 14px;
            }

            .section-heading {
              align-items: flex-start;
              flex-direction: column;
              padding: 16px;
            }
          }
        </style>
      </head>
      <body>
        <header class="topbar">
          <div class="topbar-inner">
            <div class="brand">
              <span class="brand-mark">PD</span>
              <span>Projeto Desenvolve Jobs</span>
            </div>
            <nav>
              <a href="/admin/jobs">Vagas</a>
              <a href="/admin/settings/schedule">Configuracoes de envio</a>
            </nav>
          </div>
        </header>
        <main>${content}</main>
      </body>
    </html>
  `;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
