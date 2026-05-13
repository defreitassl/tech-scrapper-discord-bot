import { JobStatus } from '@prisma/client';
import { escapeHtml } from '../helpers/formatters';
import { getStatusLabel } from '../helpers/status';

export function renderPostButton(action: string, label: string, variant = 'secondary'): string {
  return `
    <form method="post" action="${action}">
      <button type="submit" class="${escapeHtml(variant)}">${escapeHtml(label)}</button>
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
