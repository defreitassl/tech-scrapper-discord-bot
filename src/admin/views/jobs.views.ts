import { JobPost, JobPriority, JobStatus } from '@prisma/client';
import { JobFormData, formFromJob } from '../helpers/forms';
import { escapeHtml, formatDate } from '../helpers/formatters';
import type { AdminNotice } from '../helpers/notifications';
import { getStatusLabel, statuses } from '../helpers/status';
import { buildDefaultJobMessage } from '../../services/jobMessage';
import { isUsableGeneratedMessage } from '../../services/publishPendingJobs';
import {
  renderFormSection,
  renderInput,
  renderNotification,
  renderPostButton,
  renderStatusBadge,
  renderTextarea,
} from './components';
import { renderLayout } from './layout';

export type JobsByStatus = {
  draft: JobPost[];
  pending: JobPost[];
  history: JobPost[];
  archived: JobPost[];
};

type JobsSectionOptions = {
  title: string;
  description: string;
  jobs: JobPost[];
  emptyMessage: string;
  flow: 'review' | 'pending' | 'history' | 'archived';
  visibleLimit?: number;
};

export function renderJobsList(jobsByStatus: JobsByStatus, notice?: AdminNotice): string {
  const totalJobs =
    jobsByStatus.draft.length + jobsByStatus.pending.length + jobsByStatus.history.length + jobsByStatus.archived.length;

  const content = `
    <div class="page-heading">
      <div>
        <p class="eyebrow">Painel admin</p>
        <h1>Vagas</h1>
        <p class="subtitle">Gerencie vagas, revise textos e envie oportunidades para o Discord.</p>
      </div>
      <div class="actions">
        <form method="post" action="/admin/jobs/publish-pending">
          <button type="submit" class="primary-action" data-loading-label="Enviando...">Enviar vagas pendentes</button>
        </form>
        ${
          jobsByStatus.draft.length > 0
            ? `<form method="post" action="/admin/jobs/auto-approve">
                <button type="submit" class="secondary" data-loading-label="Processando...">Processar rascunhos legados</button>
              </form>`
            : ''
        }
        <form method="post" action="/admin/jobs/collect-all">
          <button type="submit" class="secondary" data-loading-label="Coletando...">Coletar vagas</button>
        </form>
        <a class="button" href="/admin/jobs/new">Nova vaga</a>
      </div>
    </div>
    <p class="collection-note">Coletas aprovam vagas elegiveis para a fila PENDING sem chamar Gemini. A mensagem e gerada somente no envio; se a IA falhar, o template deterministico e usado.</p>
    ${renderNotification(notice)}
    <div class="jobs-sections" aria-label="Lista de vagas por fluxo">
      ${renderJobsSection({
        title: 'Prontas para envio',
        description: 'Essas vagas aguardam envio. Quando nao ha texto pronto ou IA salva, a mensagem sera gerada no envio.',
        jobs: jobsByStatus.pending,
        emptyMessage: 'Nenhuma vaga pronta para envio agora.',
        flow: 'pending',
      })}
      ${renderJobsSection({
        title: 'Historico recente',
        description: 'Ultimas vagas enviadas ou com erro de envio.',
        jobs: jobsByStatus.history,
        emptyMessage: 'Nenhuma vaga enviada ou com erro ainda.',
        flow: 'history',
        visibleLimit: 30,
      })}
      ${renderJobsSection({
        title: 'Arquivadas',
        description: 'Vagas removidas do fluxo de revisao e envio.',
        jobs: jobsByStatus.archived,
        emptyMessage: 'Nenhuma vaga arquivada.',
        flow: 'archived',
        visibleLimit: 10,
      })}
      ${
        jobsByStatus.draft.length > 0
          ? renderJobsSection({
              title: 'Rascunhos legados',
              description: 'Vagas DRAFT antigas, fora do fluxo principal automatizado.',
              jobs: jobsByStatus.draft,
              emptyMessage: 'Nenhum rascunho legado.',
              flow: 'review',
              visibleLimit: 10,
            })
          : ''
      }
    </div>
    <p class="jobs-total">${totalJobs} vaga${totalJobs === 1 ? '' : 's'} cadastrada${totalJobs === 1 ? '' : 's'} no total.</p>
  `;

  return renderLayout('Vagas', content);
}

function renderJobsSection(options: JobsSectionOptions): string {
  const visibleJobs = options.visibleLimit ? options.jobs.slice(0, options.visibleLimit) : options.jobs;
  const limited = visibleJobs.length < options.jobs.length;
  const countLabel = limited ? `${visibleJobs.length} de ${options.jobs.length}` : `${options.jobs.length}`;
  const jobsContent =
    options.flow === 'review'
      ? renderReviewQueue(visibleJobs, options.emptyMessage)
      : renderJobsTable(visibleJobs, options.flow, options.emptyMessage);

  return `
    <section class="card table-card jobs-section">
      <div class="section-heading jobs-section-heading">
        <div>
          <h2>${escapeHtml(options.title)}</h2>
          <p>${escapeHtml(options.description)}</p>
        </div>
        <span class="count-pill">${escapeHtml(countLabel)}</span>
      </div>
      ${jobsContent}
      ${limited ? `<p class="section-limit-note">Mostrando as ${visibleJobs.length} mais recentes desta secao.</p>` : ''}
    </section>
  `;
}

function renderReviewQueue(jobs: JobPost[], emptyMessage: string): string {
  if (jobs.length === 0) {
    return `<p class="empty review-empty">${escapeHtml(emptyMessage)}</p>`;
  }

  return `
    <div class="review-queue" aria-label="Rascunhos legados">
      ${jobs.map(renderReviewCard).join('')}
    </div>
  `;
}

function renderReviewCard(job: JobPost): string {
  const jobId = escapeHtml(job.id);
  const source = job.source?.trim() || 'Fonte nao informada';
  const url = job.url?.trim();
  const priorityReasons = parsePriorityReasons(job.priorityReasons);

  return `
    <article class="review-card">
      <div class="review-card-main">
        <div class="review-card-header">
          <div>
            <a class="job-title review-title" href="/admin/jobs/${jobId}">${escapeHtml(job.title ?? 'Sem titulo')}</a>
            <p class="review-company">${escapeHtml(job.company ?? 'Empresa nao informada')}</p>
          </div>
          <div class="review-badges">
            ${renderPriorityBadge(job.priority)}
            <span class="source-pill">${escapeHtml(source)}</span>
          </div>
        </div>
        <dl class="review-meta-grid">
          ${renderReviewMetaItem('Localizacao', job.location)}
          ${renderReviewMetaItem('Modalidade', job.modality)}
          ${renderReviewMetaItem('Nivel', job.level)}
          ${renderReviewMetaItem('Criada em', formatDate(job.createdAt))}
        </dl>
        <div class="review-stack-row">
          <span class="review-label">Stacks</span>
          <span class="${job.stacks?.trim() ? 'review-stacks' : 'review-stacks muted'}">${escapeHtml(job.stacks?.trim() || 'Stacks nao informadas')}</span>
        </div>
        ${renderReviewPriorityDetails(job.priorityScore, priorityReasons)}
        ${
          job.shortDescription?.trim()
            ? `<p class="review-description">${escapeHtml(job.shortDescription.trim())}</p>`
            : ''
        }
        ${renderOriginalJobLink(url)}
      </div>
      <div class="review-actions">
        ${renderPostButton(`/admin/jobs/${jobId}/prepare`, 'Preparar legado', 'primary-action', 'Preparando...')}
        <a class="button secondary" href="/admin/jobs/${jobId}">Ver detalhes</a>
        ${renderPostButton(`/admin/jobs/${jobId}/archive`, 'Arquivar', 'secondary', 'Salvando...')}
      </div>
    </article>
  `;
}

function renderOriginalJobLink(url?: string): string {
  if (!url) {
    return '';
  }

  if (!isSafeExternalUrl(url)) {
    return `<p class="review-original-text">Link original informado: ${escapeHtml(url)}</p>`;
  }

  return `<a class="review-original-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Abrir vaga original</a>`;
}

function isSafeExternalUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function renderReviewMetaItem(label: string, value: string | null): string {
  return `
    <div class="review-meta-item">
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(value?.trim() || '-')}</dd>
    </div>
  `;
}

function renderJobsTable(jobs: JobPost[], flow: JobsSectionOptions['flow'], emptyMessage: string): string {
  const rows = jobs.map((job) => renderJobRow(job, flow)).join('');

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Titulo</th>
            <th>Empresa</th>
            <th>Status</th>
            <th>Mensagem</th>
            <th>Fonte</th>
            <th>Criada em</th>
            <th>Enviada em</th>
            <th>Acoes</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="8" class="empty">${escapeHtml(emptyMessage)}</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

function renderJobRow(job: JobPost, flow: JobsSectionOptions['flow']): string {
  return `
    <tr>
      <td>
        <a class="job-title" href="/admin/jobs/${escapeHtml(job.id)}">${escapeHtml(job.title ?? 'Sem titulo')}</a>
        <span class="job-meta">${escapeHtml(job.location ?? 'Localizacao nao informada')}</span>
      </td>
      <td>${escapeHtml(job.company ?? '-')}</td>
      <td>${renderStatusBadge(job.status)}</td>
      <td>${renderMessageState(job)}</td>
      <td>${escapeHtml(job.source ?? '-')}</td>
      <td><span class="date-cell">${formatDate(job.createdAt)}</span></td>
      <td><span class="date-cell">${job.sentAt ? formatDate(job.sentAt) : '-'}</span></td>
      <td class="actions">${renderJobRowActions(job, flow)}</td>
    </tr>
  `;
}

function renderJobRowActions(job: JobPost, flow: JobsSectionOptions['flow']): string {
  const jobId = escapeHtml(job.id);
  const editAction = `<a class="button secondary" href="/admin/jobs/${jobId}/edit">Editar</a>`;

  if (flow === 'review') {
    return [
      renderPostButton(`/admin/jobs/${jobId}/prepare`, 'Preparar legado', 'primary-action', 'Preparando...'),
      editAction,
      renderPostButton(`/admin/jobs/${jobId}/archive`, 'Arquivar', 'secondary', 'Salvando...'),
    ].join('');
  }

  if (flow === 'pending') {
    return [
      renderPostButton(`/admin/jobs/${jobId}/publish`, 'Enviar agora', 'primary-action', 'Enviando...'),
      editAction,
      renderPostButton(`/admin/jobs/${jobId}/archive`, 'Arquivar', 'secondary', 'Salvando...'),
    ].join('');
  }

  if (flow === 'history') {
    return [editAction, renderPostButton(`/admin/jobs/${jobId}/archive`, 'Arquivar', 'secondary', 'Salvando...')].join('');
  }

  return editAction;
}

export function renderJobDetails(job: JobPost, feedback: { notice?: AdminNotice } = {}): string {
  const fields: Array<[string, string | null, string?]> = [
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
    ['Prioridade', job.priority, 'priority'],
    ['Score de prioridade', job.priorityScore === null ? null : String(job.priorityScore)],
    ['Motivos da prioridade', formatPriorityReasons(job.priorityReasons)],
    ['Criada em', formatDate(job.createdAt)],
    ['Atualizada em', formatDate(job.updatedAt)],
    ['Enviada em', job.sentAt ? formatDate(job.sentAt) : null],
  ];

  const details = fields
    .map(([label, value, kind]) => {
      const renderedValue =
        label === 'Status'
          ? renderStatusBadge(job.status)
          : kind === 'priority'
            ? renderPriorityBadge(job.priority)
            : escapeHtml(value ?? '-');
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
    ${renderNotification(feedback.notice)}
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
      ${job.status === JobStatus.DRAFT ? renderPostButton(`/admin/jobs/${escapeHtml(job.id)}/prepare`, 'Colocar legado na fila', 'primary-action', 'Preparando...') : ''}
      ${job.status === JobStatus.PENDING ? renderPostButton(`/admin/jobs/${escapeHtml(job.id)}/prepare`, 'Manter IA no envio', 'secondary', 'Preparando...') : ''}
      ${renderPostButton(`/admin/jobs/${escapeHtml(job.id)}/publish`, 'Enviar esta vaga agora', 'primary-action', 'Enviando...')}
      ${renderPostButton(`/admin/jobs/${escapeHtml(job.id)}/pending`, 'Aprovar para envio', 'secondary', 'Salvando...')}
      ${renderPostButton(`/admin/jobs/${escapeHtml(job.id)}/archive`, 'Arquivar', 'secondary', 'Salvando...')}
    </div>
  `;

  return renderLayout('Detalhes da vaga', content);
}

export function renderJobForm(options: {
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
    ${renderNotification(options.error ? { message: options.error, type: 'error' } : undefined)}
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
          ? 'Cole o texto original. A mensagem com IA sera gerada somente no envio, exceto quando houver texto pronto.'
          : 'Cole o texto original ou informe um texto pronto para publicacao.',
        [
          renderTextarea('rawText', 'Texto bruto', form.rawText, 8, 'Texto capturado da fonte original.'),
          renderTextarea('readyText', 'Texto pronto', form.readyText, 8, 'Mensagem final que pode ser enviada sem IA.'),
          `<label class="checkbox wide">
            <input type="checkbox" name="useAi" ${form.useAi ? 'checked' : ''}>
            <span>
              <strong>Usar IA para preparar o texto</strong>
              <small>${isNewJob ? 'Quando marcado, a mensagem sera gerada no envio se nao houver texto pronto.' : 'Quando marcado, o sistema pode gerar uma versao melhor formatada no envio.'}</small>
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
        <button type="submit" data-loading-label="Salvando...">${isNewJob ? 'Salvar e preparar para envio' : 'Salvar'}</button>
      </div>
    </form>
  `;

  return renderLayout(options.title, content);
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

function renderPriorityBadge(priority: JobPriority | null): string {
  if (!priority) {
    return '<span class="priority-badge priority-none">Sem prioridade</span>';
  }

  return `<span class="priority-badge priority-${priority.toLowerCase()}">${escapeHtml(priority)}</span>`;
}

function renderMessageState(job: JobPost): string {
  if (job.readyText?.trim()) {
    return '<span class="source-pill">Texto pronto</span>';
  }

  if (job.aiGeneratedText?.trim() && isUsableGeneratedMessage(job.aiGeneratedText.trim())) {
    return '<span class="source-pill">Mensagem pronta</span>';
  }

  if (job.useAi) {
    return '<span class="source-pill">Gerar no envio</span>';
  }

  return '<span class="source-pill">Template fallback</span>';
}

function renderReviewPriorityDetails(priorityScore: number | null, reasons: string[]): string {
  if (priorityScore === null && reasons.length === 0) {
    return '';
  }

  const score = priorityScore === null ? '' : `<span class="priority-score">Score ${priorityScore}</span>`;
  const reasonsText = reasons.length > 0 ? reasons.slice(0, 3).join(', ') : 'Motivos nao registrados';

  return `
    <div class="review-priority-details">
      ${score}
      <span class="priority-reasons">${escapeHtml(reasonsText)}</span>
    </div>
  `;
}

function formatPriorityReasons(value: string | null): string | null {
  const reasons = parsePriorityReasons(value);

  return reasons.length > 0 ? reasons.join(', ') : null;
}

function parsePriorityReasons(value: string | null): string[] {
  if (!value?.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);

    if (Array.isArray(parsed)) {
      return parsed.filter((reason): reason is string => typeof reason === 'string' && reason.trim().length > 0);
    }
  } catch {
    return [value];
  }

  return [];
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
    ? 'O texto gerado por IA salvo nao e considerado valido; o preview usa o fallback deterministico.'
    : job.useAi
      ? 'Nenhum texto pronto ou texto de IA valido foi encontrado. A IA sera chamada no envio; este preview mostra o fallback.'
      : 'Nenhum texto pronto ou texto de IA valido foi encontrado; o preview usa o fallback deterministico.';

  return {
    message: buildDefaultJobMessage(job),
    source: 'Template padrao',
    description,
  };
}
