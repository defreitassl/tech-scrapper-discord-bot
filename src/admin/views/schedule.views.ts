import { JobPost, SchedulerSettings } from '@prisma/client';
import { SchedulerDailyUsage } from '../../services/schedulerOperations';
import {
  AVAILABLE_SEND_TIMES,
  DAILY_LIMIT_OPTIONS,
  DEFAULT_SCHEDULER_TIMEZONE,
} from '../../services/schedulerSettings';
import { ScheduleFormData, scheduleFormFromSettings } from '../helpers/forms';
import { escapeHtml, formatDate } from '../helpers/formatters';
import {
  renderFormSection,
  renderSchedulerStateBadge,
  renderStatusBadge,
} from './components';
import { renderLayout } from './layout';

export function renderScheduleSettingsForm(options: {
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
