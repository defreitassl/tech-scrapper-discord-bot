import { CollectionSchedulerSettings } from '@prisma/client';
import {
  AVAILABLE_COLLECTION_TIMES,
  COLLECTION_WEEKDAYS,
  DEFAULT_COLLECTION_SCHEDULER_TIMEZONE,
} from '../../services/collectionSchedulerSettings';
import { CollectionScheduleFormData, collectionScheduleFormFromSettings } from '../helpers/forms';
import { escapeHtml } from '../helpers/formatters';
import type { AdminNotice } from '../helpers/notifications';
import { renderFormSection, renderNotification, renderSchedulerStateBadge } from './components';
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
        <div class="detail-item"><dt>Providers</dt><dd>Somente providers automaticos. ATS publicos continuam apenas no botao manual.</dd></div>
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
