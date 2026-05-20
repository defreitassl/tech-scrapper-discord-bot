export function formatSalaryRange(
  minSalary?: string | number | null,
  maxSalary?: string | number | null,
  currency?: string | null,
): string | null {
  const min = normalizeSalaryValue(minSalary);
  const max = normalizeSalaryValue(maxSalary);
  const normalizedCurrency = currency?.trim().toUpperCase();

  if (!min && !max) {
    return null;
  }

  const prefix = normalizedCurrency ? `${normalizedCurrency} ` : '';

  if (min && max) {
    return `${prefix}${min} - ${prefix}${max}`;
  }

  if (min) {
    return `A partir de ${prefix}${min}`;
  }

  return `Até ${prefix}${max}`;
}

function normalizeSalaryValue(value?: string | number | null): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? String(value) : null;
  }

  const trimmedValue = value.trim();

  return trimmedValue && trimmedValue !== '0' ? trimmedValue : null;
}
