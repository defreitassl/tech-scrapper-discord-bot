import { CollectionSchedulerSettings, JobPost, SchedulerSettings } from '@prisma/client';
import {
  AVAILABLE_COLLECTION_TIMES,
  COLLECTION_WEEKDAYS,
  DEFAULT_COLLECTION_SCHEDULER_TIMEZONE,
} from '../../services/collectionSchedulerSettings';
import { SchedulerDailyUsage } from '../../services/schedulerOperations';
import {
  AVAILABLE_SEND_TIMES,
  DAILY_LIMIT_OPTIONS,
  DEFAULT_SCHEDULER_TIMEZONE,
} from '../../services/schedulerSettings';
import {
  type AdminNotice,
  type CollectionScheduleFormData,
  type ScheduleFormData,
  collectionScheduleFormFromSettings,
  escapeHtml,
  formatDate,
  renderFormSection,
  renderNotification,
  renderSchedulerStateBadge,
  renderStatusBadge,
  scheduleFormFromSettings,
} from '../helpers';
import { renderLayout } from './layout';

const FREQUENCY_OPTIONS = [
  { value: 'WEEKLY_ONCE', label: '1x por semana' },
  { value: 'WEEKLY_TWICE', label: '2x por semana' },
] as const;

const WEEKDAY_LABELS: Record<string, string> = {
  MONDAY: 'Segunda-feira',
  TUESDAY: 'Terca-feira',
  WEDNESDAY: 'Quarta-feira',
  THURSDAY: 'Quinta-feira',
  FRIDAY: 'Sexta-feira',
  SATURDAY: 'Sabado',
  SUNDAY: 'Domingo',
};

const WEEKDAY_CRON_DAYS: Record<string, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

export function renderScheduleSettingsForm(options: {
  settings?: SchedulerSettings;
  form?: ScheduleFormData;
  dailyUsage?: SchedulerDailyUsage;
  pendingJobs?: JobPost[];
  notice?: AdminNotice;
}): string {
  const form = options.form ?? scheduleFormFromSettings(options.settings);
  const sendTimes = sendTimesForDailyLimit(form.sendTimes, form.dailyLimit);
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
    ${renderNotification(options.notice)}
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
        <div class="detail-item"><dt>Slots configurados</dt><dd>${renderSendTimeSlotsSummary(sendTimes)}</dd></div>
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
          renderSendTimeSlotSelects(sendTimes),
        ].join(''),
      )}
      <div class="form-actions">
        <button type="submit" data-loading-label="Salvando...">Salvar configuracoes</button>
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

function sendTimesForDailyLimit(sendTimes: string[], dailyLimit: number): string[] {
  const selectedSendTimes = sendTimes.slice(0, dailyLimit);

  while (selectedSendTimes.length < dailyLimit) {
    selectedSendTimes.push(AVAILABLE_SEND_TIMES[selectedSendTimes.length % AVAILABLE_SEND_TIMES.length]);
  }

  return selectedSendTimes;
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

export function renderCollectionScheduleSettingsForm(options: {
  settings?: CollectionSchedulerSettings;
  form?: CollectionScheduleFormData;
  notice?: AdminNotice;
}): string {
  const form = options.form ?? collectionScheduleFormFromSettings(options.settings);
  const cronExpressions = form.weekdays.map((weekday) => cronExpressionFromTimeAndWeekday(form.collectTime, weekday));
  const content = `
    <div class="page-heading">
      <div>
        <p class="eyebrow">Configuracoes</p>
        <h1>Coleta automatica</h1>
        <p class="subtitle">Defina quando o painel deve coletar vagas automaticamente. A coleta monta a fila PENDING sem Gemini; o envio continua separado.</p>
      </div>
      <div class="actions">
        <a class="button secondary" href="/admin/jobs">Voltar para vagas</a>
        <a class="button secondary" href="/admin/settings/schedule">Configuracao de envio</a>
      </div>
    </div>
    ${renderNotification(options.notice)}
    <section class="card settings-summary">
      <div class="section-heading">
        <h2>Resumo operacional</h2>
        ${renderSchedulerStateBadge(form.enabled)}
      </div>
      <dl>
        <div class="detail-item"><dt>Agendamento</dt><dd>${form.enabled ? 'Ativo' : 'Inativo'}</dd></div>
        <div class="detail-item"><dt>Frequencia</dt><dd>${escapeHtml(getFrequencyLabel(form.frequency))}</dd></div>
        <div class="detail-item"><dt>Dias</dt><dd>${escapeHtml(formatWeekdays(form.weekdays))}</dd></div>
        <div class="detail-item"><dt>Horario</dt><dd>${escapeHtml(form.collectTime)}</dd></div>
        <div class="detail-item"><dt>Timezone do sistema</dt><dd>${escapeHtml(form.timezone)}</dd></div>
        <div class="detail-item"><dt>Crons</dt><dd>${renderCronSummary(cronExpressions)}</dd></div>
        <div class="detail-item"><dt>Providers</dt><dd>Coleta automatica e botao manual usam os providers do MVP.</dd></div>
        <div class="detail-item"><dt>Separacao</dt><dd>A coleta cria PENDING sem Gemini; o envio agendado publica PENDING no Discord depois.</dd></div>
      </dl>
    </section>
    <form method="post" action="/admin/settings/collection" class="job-form settings-form">
      ${renderFormSection(
        'Regras de coleta',
        'Escolha se a coleta automatica fica ativa, a frequencia semanal, os dias e o horario.',
        [
          `<label class="checkbox wide">
            <input type="checkbox" name="enabled" ${form.enabled ? 'checked' : ''}>
            <span>
              <strong>Ativar coleta automatica</strong>
              <small>Quando desativada, nenhum horario automatico coleta vagas.</small>
            </span>
          </label>`,
          renderFrequencySelect(form.frequency),
          renderCollectionTimeSelect(form.collectTime),
          `<div class="detail-item timezone-info">
            <dt>Timezone</dt>
            <dd>${escapeHtml(DEFAULT_COLLECTION_SCHEDULER_TIMEZONE)}</dd>
            <small>Definido automaticamente pelo sistema.</small>
          </div>`,
          renderWeekdayCheckboxes(form.weekdays),
        ].join(''),
      )}
      <div class="form-actions">
        <button type="submit" data-loading-label="Salvando...">Salvar configuracoes</button>
      </div>
    </form>
    ${renderCollectionScheduleScript()}
  `;

  return renderLayout('Coleta automatica', content);
}

function renderFrequencySelect(frequency: string): string {
  return `
    <label>
      <span>Frequencia</span>
      <select name="frequency" id="collectionFrequencySelect">
        ${FREQUENCY_OPTIONS.map(
          (option) =>
            `<option value="${escapeHtml(option.value)}" ${option.value === frequency ? 'selected' : ''}>${escapeHtml(option.label)}</option>`,
        ).join('')}
      </select>
      <small>Use 1 ou 2 coletas por semana para manter baixa frequencia.</small>
    </label>
  `;
}

function renderCollectionTimeSelect(collectTime: string): string {
  return `
    <label>
      <span>Horario da coleta</span>
      <select name="collectTime">
        ${AVAILABLE_COLLECTION_TIMES.map(
          (time) =>
            `<option value="${escapeHtml(time)}" ${time === collectTime ? 'selected' : ''}>${escapeHtml(time)}</option>`,
        ).join('')}
      </select>
      <small>Horarios fixos evitam erro de digitacao.</small>
    </label>
  `;
}

function renderWeekdayCheckboxes(selectedWeekdays: string[]): string {
  return `
    <div class="wide weekday-options">
      <div class="schedule-slots-header">
        <h3>Dias da semana</h3>
        <small>Escolha exatamente 1 dia para 1x por semana ou 2 dias diferentes para 2x por semana.</small>
      </div>
      <div class="weekday-options-grid">
        ${COLLECTION_WEEKDAYS.map(
          (weekday) => `
            <label class="checkbox compact-checkbox">
              <input type="checkbox" name="weekdays" value="${escapeHtml(weekday)}" ${selectedWeekdays.includes(weekday) ? 'checked' : ''}>
              <span>${escapeHtml(WEEKDAY_LABELS[weekday])}</span>
            </label>
          `,
        ).join('')}
      </div>
    </div>
  `;
}

function getFrequencyLabel(frequency: string): string {
  return FREQUENCY_OPTIONS.find((option) => option.value === frequency)?.label ?? frequency;
}

function formatWeekdays(weekdays: string[]): string {
  return weekdays.map((weekday) => WEEKDAY_LABELS[weekday] ?? weekday).join(', ') || '-';
}

function renderCronSummary(expressions: string[]): string {
  if (expressions.length === 0) {
    return '-';
  }

  return `<ol class="slot-summary">${expressions.map((expression) => `<li>${escapeHtml(expression)}</li>`).join('')}</ol>`;
}

function cronExpressionFromTimeAndWeekday(collectTime: string, weekday: string): string {
  const [hour, minute] = collectTime.split(':');
  const cronDay = WEEKDAY_CRON_DAYS[weekday] ?? 1;

  return `${Number(minute)} ${Number(hour)} * * ${cronDay}`;
}

function renderCollectionScheduleScript(): string {
  return `
    <script>
      (() => {
        const frequencySelect = document.getElementById('collectionFrequencySelect');
        const weekdayCheckboxes = Array.from(document.querySelectorAll('input[name="weekdays"]'));

        if (!frequencySelect || weekdayCheckboxes.length === 0) {
          return;
        }

        const maxSelected = () => frequencySelect.value === 'WEEKLY_TWICE' ? 2 : 1;

        const enforceWeekdayLimit = (changedCheckbox) => {
          const checked = weekdayCheckboxes.filter((checkbox) => checkbox.checked);
          const limit = maxSelected();

          if (checked.length <= limit) {
            return;
          }

          for (const checkbox of checked) {
            if (checkbox !== changedCheckbox) {
              checkbox.checked = false;
              return;
            }
          }
        };

        frequencySelect.addEventListener('change', () => {
          const checked = weekdayCheckboxes.filter((checkbox) => checkbox.checked);
          const limit = maxSelected();

          checked.slice(limit).forEach((checkbox) => {
            checkbox.checked = false;
          });
        });

        weekdayCheckboxes.forEach((checkbox) => {
          checkbox.addEventListener('change', () => enforceWeekdayLimit(checkbox));
        });
      })();
    </script>
  `;
}
