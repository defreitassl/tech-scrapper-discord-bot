export function getDateDaysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);

  return date;
}

export function isRecentDate(value?: string | null, maxAgeDays = 30, referenceDate = getDateDaysAgo(maxAgeDays)): boolean {
  if (!value?.trim()) {
    return false;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return date >= referenceDate;
}

export function parseDateOrNow(value?: string | null): Date {
  if (!value?.trim()) {
    return new Date();
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export function isOlderThanHours(value: string | null | undefined, hours: number): boolean {
  if (!value?.trim()) {
    return true;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return true;
  }

  return Date.now() - date.getTime() >= hours * 60 * 60 * 1000;
}
