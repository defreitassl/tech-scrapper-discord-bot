import { JobStatus } from '@prisma/client';
import { escapeHtml } from '../helpers/formatters';
import type { AdminNotice } from '../helpers/notifications';
import { getStatusLabel } from '../helpers/status';

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

export function renderPostButton(action: string, label: string, variant = 'secondary', loadingLabel?: string): string {
  const loadingAttribute = loadingLabel ? ` data-loading-label="${escapeHtml(loadingLabel)}"` : '';

  return `
    <form method="post" action="${action}">
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
