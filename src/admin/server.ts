import 'dotenv/config';
import express from 'express';
import { JobPost, JobStatus } from '@prisma/client';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import { publishPendingJobs } from '../services/publishPendingJobs';

const app = express();
const port = Number(process.env.ADMIN_PORT ?? 3000);
const statuses = Object.values(JobStatus);

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
  const error = validateJob(form);

  if (error) {
    response.status(400).send(renderJobForm({ title: 'Nova vaga', action: '/admin/jobs', form, error }));
    return;
  }

  const job = await prisma.jobPost.create({ data: form });
  logger.info('Vaga criada no admin.', {
    jobId: job.id,
    title: job.title,
    status: job.status,
    useAi: job.useAi,
  });

  response.redirect(`/admin/jobs/${job.id}`);
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

  response.send(renderJobDetails(job));
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
  const error = validateJob(form);

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
    response.status(400).send(renderJobDetails(job, error));
    return;
  }

  await prisma.jobPost.update({
    where: { id: job.id },
    data: { status: JobStatus.PENDING },
  });
  logger.info('Vaga marcada como PENDING no admin.', {
    jobId: job.id,
    title: job.title,
  });

  response.redirect('/admin/jobs');
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

function validateJob(form: JobFormData): string | null {
  if (!form.title && !form.rawText) {
    return 'Informe pelo menos o titulo ou o texto bruto da vaga.';
  }

  if (form.status === JobStatus.PENDING) {
    return validatePending(form);
  }

  return null;
}

function validatePending(job: Pick<JobPost, 'readyText' | 'useAi' | 'url'>): string | null {
  if (job.readyText || job.useAi || job.url) {
    return null;
  }

  return 'Para marcar como PENDING, informe readyText, habilite useAi ou preencha a URL.';
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
          <td><a href="/admin/jobs/${escapeHtml(job.id)}">${escapeHtml(job.title ?? 'Sem titulo')}</a></td>
          <td>${escapeHtml(job.company ?? '-')}</td>
          <td><span class="status">${escapeHtml(job.status)}</span></td>
          <td>${escapeHtml(job.source ?? '-')}</td>
          <td>${formatDate(job.createdAt)}</td>
          <td>${job.sentAt ? formatDate(job.sentAt) : '-'}</td>
          <td class="actions">
            <a class="button secondary" href="/admin/jobs/${escapeHtml(job.id)}/edit">Editar</a>
            ${renderPostButton(`/admin/jobs/${escapeHtml(job.id)}/pending`, 'Marcar PENDING')}
            ${renderPostButton(`/admin/jobs/${escapeHtml(job.id)}/archive`, 'Arquivar')}
          </td>
        </tr>
      `,
    )
    .join('');

  const content = `
    <div class="toolbar">
      <h1>Vagas</h1>
      <div class="actions">
        <form method="post" action="/admin/jobs/publish-pending">
          <button type="submit">Enviar vagas pendentes</button>
        </form>
        <a class="button" href="/admin/jobs/new">Nova vaga</a>
      </div>
    </div>
    ${message ? `<p class="notice">${escapeHtml(message)}</p>` : ''}
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
  `;

  return renderLayout('Vagas', content);
}

function renderJobDetails(job: JobPost, error?: string): string {
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
    ['Status', job.status],
    ['Criada em', formatDate(job.createdAt)],
    ['Atualizada em', formatDate(job.updatedAt)],
    ['Enviada em', job.sentAt ? formatDate(job.sentAt) : null],
  ];

  const details = fields
    .map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value ?? '-')}</dd>`)
    .join('');

  const content = `
    <div class="toolbar">
      <h1>${escapeHtml(job.title ?? 'Vaga sem titulo')}</h1>
      <div class="actions">
        <a class="button secondary" href="/admin/jobs">Voltar</a>
        <a class="button" href="/admin/jobs/${escapeHtml(job.id)}/edit">Editar</a>
      </div>
    </div>
    ${error ? `<p class="error">${escapeHtml(error)}</p>` : ''}
    <section>
      <dl>${details}</dl>
    </section>
    ${renderLongText('Sobre a vaga', job.shortDescription)}
    ${renderLongText('Texto bruto', job.rawText)}
    ${renderLongText('Texto pronto', job.readyText)}
    ${renderLongText('Texto gerado por IA', job.aiGeneratedText)}
    <div class="actions">
      ${renderPostButton(`/admin/jobs/${escapeHtml(job.id)}/pending`, 'Marcar PENDING')}
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
  const content = `
    <div class="toolbar">
      <h1>${escapeHtml(options.title)}</h1>
      <a class="button secondary" href="/admin/jobs">Voltar</a>
    </div>
    ${options.error ? `<p class="error">${escapeHtml(options.error)}</p>` : ''}
    <form method="post" action="${escapeHtml(options.action)}" class="job-form">
      ${renderInput('title', 'Titulo', form.title)}
      ${renderInput('company', 'Empresa', form.company)}
      ${renderInput('location', 'Localizacao', form.location)}
      ${renderInput('modality', 'Modalidade', form.modality)}
      ${renderInput('level', 'Nivel', form.level)}
      ${renderInput('stacks', 'Stacks', form.stacks)}
      ${renderInput('salaryRange', 'Faixa salarial', form.salaryRange)}
      ${renderTextarea('shortDescription', 'Sobre a vaga', form.shortDescription, 4)}
      ${renderInput('url', 'URL', form.url)}
      ${renderInput('source', 'Fonte', form.source)}
      ${renderTextarea('rawText', 'Texto bruto', form.rawText)}
      ${renderTextarea('readyText', 'Texto pronto', form.readyText)}
      <label class="checkbox">
        <input type="checkbox" name="useAi" ${form.useAi ? 'checked' : ''}>
        Usar IA
      </label>
      <label>
        Status
        <select name="status">
          ${statuses
            .map(
              (status) =>
                `<option value="${escapeHtml(status)}" ${status === form.status ? 'selected' : ''}>${escapeHtml(status)}</option>`,
            )
            .join('')}
        </select>
      </label>
      <button type="submit">Salvar</button>
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
    status: job?.status ?? JobStatus.DRAFT,
  };
}

function renderInput(name: keyof JobFormData, label: string, value: string | null): string {
  return `
    <label>
      ${escapeHtml(label)}
      <input type="text" name="${escapeHtml(name)}" value="${escapeHtml(value ?? '')}">
    </label>
  `;
}

function renderTextarea(name: keyof JobFormData, label: string, value: string | null, rows = 7): string {
  return `
    <label class="wide">
      ${escapeHtml(label)}
      <textarea name="${escapeHtml(name)}" rows="${rows}">${escapeHtml(value ?? '')}</textarea>
    </label>
  `;
}

function renderLongText(title: string, value: string | null): string {
  if (!value) {
    return '';
  }

  return `
    <section>
      <h2>${escapeHtml(title)}</h2>
      <pre>${escapeHtml(value)}</pre>
    </section>
  `;
}

function renderPostButton(action: string, label: string): string {
  return `
    <form method="post" action="${action}">
      <button type="submit" class="secondary">${escapeHtml(label)}</button>
    </form>
  `;
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
            font-family: Arial, sans-serif;
            color: #1f2937;
            background: #f8fafc;
          }

          body {
            margin: 0;
          }

          main {
            max-width: 1120px;
            margin: 0 auto;
            padding: 32px 20px;
          }

          h1 {
            margin: 0 0 20px;
            font-size: 28px;
          }

          h2 {
            margin-top: 28px;
            font-size: 18px;
          }

          a {
            color: #0f766e;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            background: #ffffff;
          }

          th,
          td {
            padding: 12px;
            border-bottom: 1px solid #e5e7eb;
            text-align: left;
            vertical-align: top;
          }

          th {
            font-size: 13px;
            color: #475569;
            background: #f1f5f9;
          }

          input,
          textarea,
          select {
            box-sizing: border-box;
            width: 100%;
            margin-top: 6px;
            padding: 10px;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            font: inherit;
            background: #ffffff;
          }

          textarea {
            resize: vertical;
          }

          button,
          .button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: 38px;
            padding: 8px 12px;
            border: 1px solid #0f766e;
            border-radius: 6px;
            font: inherit;
            color: #ffffff;
            background: #0f766e;
            text-decoration: none;
            cursor: pointer;
          }

          button.secondary,
          .button.secondary {
            color: #334155;
            border-color: #cbd5e1;
            background: #ffffff;
          }

          dl {
            display: grid;
            grid-template-columns: 180px 1fr;
            gap: 10px 16px;
            padding: 20px;
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
          }

          dt {
            font-weight: 700;
          }

          dd {
            margin: 0;
          }

          pre {
            white-space: pre-wrap;
            padding: 16px;
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
          }

          .toolbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            margin-bottom: 18px;
          }

          .actions {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
          }

          .actions form {
            margin: 0;
          }

          .job-form {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 16px;
            padding: 20px;
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
          }

          .job-form .wide,
          .job-form button {
            grid-column: 1 / -1;
          }

          .checkbox {
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .checkbox input {
            width: auto;
            margin: 0;
          }

          .status {
            font-weight: 700;
          }

          .error {
            padding: 12px;
            border: 1px solid #fecaca;
            border-radius: 6px;
            color: #991b1b;
            background: #fef2f2;
          }

          .notice {
            padding: 12px;
            border: 1px solid #bbf7d0;
            border-radius: 6px;
            color: #166534;
            background: #f0fdf4;
          }

          .empty {
            color: #64748b;
            text-align: center;
          }

          @media (max-width: 760px) {
            main {
              padding: 20px 12px;
            }

            table {
              display: block;
              overflow-x: auto;
            }

            .toolbar,
            .job-form,
            dl {
              display: block;
            }

            .job-form label,
            .job-form button {
              margin-top: 14px;
            }

            dt {
              margin-top: 12px;
            }
          }
        </style>
      </head>
      <body>
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
