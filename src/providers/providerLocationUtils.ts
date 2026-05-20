import { normalizeSearchText } from './providerTextUtils';

const GLOBAL_REMOTE_TERMS = [
  'anywhere',
  'worldwide',
  'global',
  'remote',
  'remoto',
  'work from anywhere',
  'wfa',
];

const BRAZIL_COMPATIBLE_TERMS = [
  'brazil',
  'brasil',
  'latam',
  'latin america',
  'latin-america',
  'americas',
  'america',
  'south america',
  'south-america',
  'gmt-3',
  'utc-3',
  'utc -3',
];

const INCOMPATIBLE_REGION_TERMS = [
  'united states only',
  'us only',
  'usa only',
  'canada only',
  'uk only',
  'europe only',
  'eu only',
  'european union',
  'australia only',
  'new zealand only',
  'india only',
  'philippines only',
  'germany only',
  'france only',
  'spain only',
  'portugal only',
];

export function normalizeExternalProviderLocation(...values: Array<string | string[] | null | undefined>): string | null {
  const parts = values.flatMap((value) => {
    if (Array.isArray(value)) {
      return value;
    }

    return value ? [value] : [];
  });

  const location = parts.map((part) => part.trim()).filter(Boolean).join(', ');

  return location || null;
}

export function isRemoteLocationAllowed(locationText?: string | null): boolean {
  if (!locationText?.trim()) {
    return true;
  }

  const text = normalizeSearchText(locationText);

  if (INCOMPATIBLE_REGION_TERMS.some((term) => text.includes(normalizeSearchText(term)))) {
    return false;
  }

  return [...GLOBAL_REMOTE_TERMS, ...BRAZIL_COMPATIBLE_TERMS].some((term) => text.includes(normalizeSearchText(term)));
}
