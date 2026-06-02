import type { Response } from 'express';
import { CollectionSchedulerSettings, JobPost, JobStatus } from '@prisma/client';
import type { SchedulerSettings } from '@prisma/client';
import type { AutomatedJobCollectionSummary } from '../providers/providerRunner';
import {
  DEFAULT_COLLECTION_SCHEDULER_TIMEZONE,
  getDefaultCollectionSchedulerSettings,
  normalizeCollectionSchedulerSettings,
} from '../services/collectionSchedulerSettings';
import {
  AVAILABLE_SEND_TIMES,
  DEFAULT_SCHEDULER_TIMEZONE,
  normalizeSchedulerSettings,
} from '../services/schedulerSettings';

export type JobFormData = {
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

export type ScheduleFormData = {
  enabled: boolean;
  dailyLimit: number;
  timezone: string;
  sendTimes: string[];
};

export type CollectionScheduleFormData = {
  enabled: boolean;
  frequency: string;
  weekdays: string[];
  collectTime: string;
  timezone: string;
};

export type NoticeType = 'success' | 'error' | 'warning' | 'info' | 'loading';

export type AdminNotice = {
  message: string;
  type: NoticeType;
};

type JobApprovalData = Pick<
  JobPost,
  'title' | 'company' | 'location' | 'shortDescription' | 'rawText' | 'readyText' | 'aiGeneratedText' | 'useAi' | 'url'
>;

const noticeTypes: NoticeType[] = ['success', 'error', 'warning', 'info', 'loading'];

export const statuses = Object.values(JobStatus);

export const statusLabels: Record<JobStatus, string> = {
  [JobStatus.PENDING]: 'Pronta para envio',
  [JobStatus.SENT]: 'Enviada',
  [JobStatus.ERROR]: 'Erro',
};

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function getStatusLabel(status: JobStatus): string {
  return statusLabels[status];
}

export function getNoticeFromQuery(query: {
  message?: unknown;
  error?: unknown;
  noticeType?: unknown;
}): AdminNotice | undefined {
  if (typeof query.error === 'string') {
    return {
      message: query.error,
      type: 'error',
    };
  }

  if (typeof query.message !== 'string') {
    return undefined;
  }

  return {
    message: query.message,
    type: parseNoticeType(query.noticeType),
  };
}

export function redirectWithNotice(
  response: Response,
  path: string,
  message: string,
  type: NoticeType = 'success',
): void {
  const url = new URL(path, 'http://admin.local');

  url.searchParams.set('message', message);
  url.searchParams.set('noticeType', type);

  response.redirect(`${url.pathname}${url.search}`);
}

export function buildCompactCollectionNotice(summary: AutomatedJobCollectionSummary): string {
  const rejected =
    summary.rejectedByDomain +
    summary.rejectedByQuality +
    summary.rejectedByPriority;
  const errors = Math.max(summary.repositoryErrors, summary.errors.length);

  return `Coleta concluida: ${summary.approvedAsPending} vagas aprovadas para fila, ${rejected} recusadas, ${summary.rejectedDuplicates} duplicatas, ${errors} erros.`;
}

export function renderNotification(notice?: AdminNotice): string {
  if (!notice) {
    return '';
  }

  const labels: Record<AdminNotice['type'], string> = {
    success: 'Sucesso',
    error: 'Erro',
    warning: 'Atencao',
    info: 'Informacao',
    loading: 'Processando',
  };
  const autoHideMs: Record<AdminNotice['type'], number> = {
    success: 4000,
    info: 4000,
    warning: 6000,
    error: 10000,
    loading: 0,
  };

  return `
    <div class="notification-stack" aria-live="polite" aria-atomic="true">
      <div class="notification notification-${notice.type}" data-notification data-autohide-ms="${autoHideMs[notice.type]}">
        <div class="notification-content">
          <span class="notification-label">${escapeHtml(labels[notice.type])}</span>
          <p>${escapeHtml(notice.message)}</p>
        </div>
        <button type="button" class="notification-close" aria-label="Fechar notificacao" data-notification-close>&times;</button>
      </div>
    </div>
  `;
}

export function renderPostButton(
  action: string,
  label: string,
  variant = 'secondary',
  loadingLabel?: string,
  confirmMessage?: string,
): string {
  const loadingAttribute = loadingLabel ? ` data-loading-label="${escapeHtml(loadingLabel)}"` : '';
  const confirmAttribute = confirmMessage ? ` onsubmit="return confirm('${escapeHtml(confirmMessage)}')"` : '';

  return `
    <form method="post" action="${action}"${confirmAttribute}>
      <button type="submit" class="${escapeHtml(variant)}"${loadingAttribute}>${escapeHtml(label)}</button>
    </form>
  `;
}

export function renderStatusBadge(status: JobStatus): string {
  return `<span class="status-badge status-${escapeHtml(status.toLowerCase())}">${escapeHtml(getStatusLabel(status))}</span>`;
}

export function renderSchedulerStateBadge(enabled: boolean): string {
  const label = enabled ? 'Ativo' : 'Inativo';
  const className = enabled ? 'scheduler-active' : 'scheduler-inactive';

  return `<span class="status-badge ${className}">${label}</span>`;
}

export function renderInput(name: string, label: string, value: string | null, help?: string): string {
  return `
    <label>
      <span>${escapeHtml(label)}</span>
      <input type="text" name="${escapeHtml(name)}" value="${escapeHtml(value ?? '')}">
      ${help ? `<small>${escapeHtml(help)}</small>` : ''}
    </label>
  `;
}

export function renderTextarea(name: string, label: string, value: string | null, rows = 7, help?: string): string {
  return `
    <label class="wide">
      <span>${escapeHtml(label)}</span>
      <textarea name="${escapeHtml(name)}" rows="${rows}">${escapeHtml(value ?? '')}</textarea>
      ${help ? `<small>${escapeHtml(help)}</small>` : ''}
    </label>
  `;
}

export function renderFormSection(title: string, description: string, content: string): string {
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

export function parseJobForm(body: unknown): JobFormData {
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

export function parseScheduleSettingsForm(body: unknown): ScheduleFormData {
  return {
    enabled: fieldValue(body, 'enabled') === 'on',
    dailyLimit: Number(fieldValue(body, 'dailyLimit')),
    timezone: DEFAULT_SCHEDULER_TIMEZONE,
    sendTimes: fieldValues(body, 'sendTimes'),
  };
}

export function parseCollectionScheduleSettingsForm(body: unknown): CollectionScheduleFormData {
  return {
    enabled: fieldValue(body, 'enabled') === 'on',
    frequency: fieldValue(body, 'frequency'),
    weekdays: fieldValues(body, 'weekdays'),
    collectTime: fieldValue(body, 'collectTime'),
    timezone: DEFAULT_COLLECTION_SCHEDULER_TIMEZONE,
  };
}

export function optionalText(body: unknown, field: string): string | null {
  const value = fieldValue(body, field).trim();
  return value.length > 0 ? value : null;
}

export function fieldValue(body: unknown, field: string): string {
  if (!body || typeof body !== 'object') {
    return '';
  }

  const value = (body as Record<string, unknown>)[field];

  if (typeof value !== 'string') {
    return '';
  }

  return value;
}

export function fieldValues(body: unknown, field: string): string[] {
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

export function parseStatus(value: string): JobStatus {
  if (statuses.includes(value as JobStatus)) {
    return value as JobStatus;
  }

  return JobStatus.PENDING;
}

export function scheduleFormFromSettings(settings?: SchedulerSettings): ScheduleFormData {
  const normalizedSettings = settings ? normalizeSchedulerSettings(settings) : null;

  return {
    enabled: normalizedSettings?.enabled ?? false,
    dailyLimit: normalizedSettings?.dailyLimit ?? 5,
    timezone: normalizedSettings?.timezone ?? DEFAULT_SCHEDULER_TIMEZONE,
    sendTimes: normalizedSettings?.sendTimes ?? AVAILABLE_SEND_TIMES.slice(0, 5),
  };
}

export function collectionScheduleFormFromSettings(
  settings?: CollectionSchedulerSettings,
): CollectionScheduleFormData {
  const defaults = getDefaultCollectionSchedulerSettings();
  const normalizedSettings = settings ? normalizeCollectionSchedulerSettings(settings) : null;

  return {
    enabled: normalizedSettings?.enabled ?? defaults.enabled,
    frequency: normalizedSettings?.frequency ?? defaults.frequency,
    weekdays: normalizedSettings?.weekdays ?? defaults.weekdays,
    collectTime: normalizedSettings?.collectTime ?? defaults.collectTime,
    timezone: normalizedSettings?.timezone ?? defaults.timezone,
  };
}

export function formFromJob(job?: JobPost): JobFormData {
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

export function validateJob(form: JobFormData, existingAiGeneratedText: string | null = null): string | null {
  if (!form.title && !form.rawText) {
    return 'Informe pelo menos o titulo ou o texto bruto da vaga.';
  }

  if (form.status === JobStatus.PENDING) {
    return validatePending({ ...form, aiGeneratedText: existingAiGeneratedText });
  }

  return null;
}

export function validatePending(job: JobApprovalData): string | null {
  if (job.readyText || job.aiGeneratedText || hasTemplateData(job)) {
    return null;
  }

  return 'Para deixar pronta para envio, informe dados da vaga, texto pronto, mensagem de IA existente ou URL.';
}

export function hasTemplateData(
  job: Pick<JobApprovalData, 'title' | 'company' | 'location' | 'shortDescription' | 'rawText' | 'url'>,
): boolean {
  return Boolean(job.title || job.company || job.location || job.shortDescription || job.rawText || job.url);
}

function parseNoticeType(value: unknown): NoticeType {
  if (typeof value === 'string' && noticeTypes.includes(value as NoticeType)) {
    return value as NoticeType;
  }

  return 'success';
}
