import { explainScrapingDecision } from '../scraping/scrapingPolicy';
import type { ScrapingSourceConfig } from '../scraping/types';
import type { CompanyTarget } from './companyTargets';
import { isRecentDate, parseDateOrNow } from './providerDateUtils';
import { normalizeSearchText, stripHtml } from './providerTextUtils';

export const ATS_MAX_JOB_AGE_DAYS = 30;

const MINAS_GERAIS_TERMS = [
  'MG',
  'Minas Gerais',
  'Belo Horizonte',
  'BH',
  'Contagem',
  'Betim',
  'Nova Lima',
  'Uberlandia',
  'Juiz de Fora',
  'Montes Claros',
  'Uberaba',
  'Governador Valadares',
  'Ipatinga',
  'Sete Lagoas',
  'Divinopolis',
  'Santa Luzia',
  'Ibirite',
  'Pocos de Caldas',
  'Pouso Alegre',
  'Varginha',
];

const BRAZIL_COMPATIBLE_REMOTE_TERMS = [
  'anywhere',
  'worldwide',
  'global',
  'work from anywhere',
  'brazil',
  'brasil',
  'latam',
  'latin america',
  'latin-america',
  'americas',
  'south america',
  'south-america',
  'gmt-3',
  'utc-3',
  'utc -3',
];

const INCOMPATIBLE_REMOTE_TERMS = [
  'united states',
  'us only',
  'usa only',
  'canada',
  'canada only',
  'uk only',
  'united kingdom',
  'europe',
  'europe only',
  'european union',
  'eu only',
  'australia',
  'new zealand',
  'india',
  'philippines',
  'germany',
  'france',
  'spain',
  'portugal',
  'italy',
  'romania',
  'switzerland',
  'sweden',
  'ireland',
  'estonia',
  'poland',
  'netherlands',
  'belgium',
  'austria',
  'denmark',
  'norway',
  'finland',
  'czech republic',
];

export type AtsLocationDecision = {
  accepted: boolean;
  modality: string | null;
  location: string | null;
};

export function createAtsSource(target: CompanyTarget): string {
  return `${target.ats}:${target.slug}`;
}

export function assertPublicApiAllowed(name: string, url: string): void {
  const decision = explainScrapingDecision({
    name,
    url,
    strategy: 'api',
    requiresLogin: false,
    hasCaptcha: false,
    hasKnownBotProtection: false,
  } satisfies ScrapingSourceConfig);

  if (!decision.allowed) {
    throw new Error(decision.reason);
  }
}

export function cleanAtsText(value?: string | null): string | null {
  const firstPass = stripHtml(value);

  return stripHtml(firstPass) ?? firstPass;
}

export function isRecentAtsDate(value?: string | number | null): boolean {
  const dateText = normalizeAtsDate(value);

  return isRecentDate(dateText, ATS_MAX_JOB_AGE_DAYS);
}

export function parseAtsDateOrNow(value?: string | number | null): Date {
  return parseDateOrNow(normalizeAtsDate(value));
}

export function normalizeAtsDate(value?: string | number | null): string | null {
  if (typeof value === 'number') {
    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  return value?.trim() || null;
}

export function evaluateAtsLocation(...values: Array<string | null | undefined>): AtsLocationDecision {
  const location = values.map((value) => value?.trim()).filter(Boolean).join(', ') || null;
  const text = normalizeSearchText(location ?? '');
  const modality = detectAtsModality(text);

  if (modality === 'Remoto') {
    return {
      accepted: isRemoteAtsLocationAllowed(text),
      modality,
      location: location ?? 'Remoto',
    };
  }

  if (modality === 'Híbrido' || modality === 'Presencial') {
    return {
      accepted: isMinasGeraisLocation(text),
      modality,
      location,
    };
  }

  return {
    accepted: isMinasGeraisLocation(text),
    modality,
    location,
  };
}

function detectAtsModality(normalizedText: string): string | null {
  if (containsTerm(normalizedText, 'remote') || containsTerm(normalizedText, 'remoto')) {
    return 'Remoto';
  }

  if (containsTerm(normalizedText, 'hybrid') || containsTerm(normalizedText, 'hibrido')) {
    return 'Híbrido';
  }

  if (containsTerm(normalizedText, 'onsite') || containsTerm(normalizedText, 'on-site')) {
    return 'Presencial';
  }

  if (containsTerm(normalizedText, 'presencial')) {
    return 'Presencial';
  }

  return null;
}

function isRemoteAtsLocationAllowed(normalizedText: string): boolean {
  if (!normalizedText || normalizedText === 'remote' || normalizedText === 'remoto') {
    return true;
  }

  if (BRAZIL_COMPATIBLE_REMOTE_TERMS.some((term) => containsTerm(normalizedText, normalizeSearchText(term)))) {
    return true;
  }

  return !INCOMPATIBLE_REMOTE_TERMS.some((term) => containsTerm(normalizedText, normalizeSearchText(term)));
}

function isMinasGeraisLocation(normalizedText: string): boolean {
  return MINAS_GERAIS_TERMS.some((term) => containsTerm(normalizedText, normalizeSearchText(term)));
}

function containsTerm(normalizedText: string, normalizedTerm: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${escapeRegex(normalizedTerm)}([^a-z0-9]|$)`).test(normalizedText);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
