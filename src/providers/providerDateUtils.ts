export function getDateDaysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);

  return date;
}

export function isRecentDate(value?: unknown, maxAgeDays = 30, referenceDate = getDateDaysAgo(maxAgeDays)): boolean {
  const text = normalizeDateInput(value);

  if (!text) {
    return false;
  }

  const date = new Date(text);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return date >= referenceDate;
}

export function parseDateOrNow(value?: string | null): Date {
  const text = normalizeDateInput(value);

  if (!text) {
    return new Date();
  }

  const date = new Date(text);

  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export function isOlderThanHours(value: string | null | undefined, hours: number): boolean {
  const text = normalizeDateInput(value);

  if (!text) {
    return true;
  }

  const date = new Date(text);

  if (Number.isNaN(date.getTime())) {
    return true;
  }

  return Date.now() - date.getTime() >= hours * 60 * 60 * 1000;
}

function normalizeDateInput(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (typeof value === 'string') {
    return value.trim() || null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}
