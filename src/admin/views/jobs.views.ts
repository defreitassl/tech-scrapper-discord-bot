import { JobPost } from '@prisma/client';
import { JobFormData, formFromJob } from '../helpers/forms';
import { escapeHtml, formatDate } from '../helpers/formatters';
import { getStatusLabel, statuses } from '../helpers/status';
import { buildDefaultJobMessage } from '../../services/jobMessage';
import { isUsableGeneratedMessage } from '../../services/publishPendingJobs';
import {
  renderFormSection,
  renderInput,
  renderPostButton,
  renderStatusBadge,
  renderTextarea,
} from './components';
import { renderLayout } from './layout';

export function renderJobsList(jobs: JobPost[], message?: string): string {
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

export function renderJobDetails(job: JobPost, feedback: { notice?: string; error?: string } = {}): string {
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
