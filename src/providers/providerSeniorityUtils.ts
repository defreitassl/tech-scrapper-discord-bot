import { normalizeSearchText } from './providerTextUtils';

const ENTRY_LEVEL_TERMS = [
  'junior',
  'jr',
  'entry level',
  'entry-level',
  'entrylevel',
  'intern',
  'internship',
  'estagio',
  'estagiario',
  'trainee',
];

const DISALLOWED_SENIORITY_TERMS = [
  'pleno',
  'mid level',
  'mid-level',
  'midlevel',
  'senior',
  'sr',
  'lead',
  'tech lead',
  'staff',
  'principal',
  'manager',
  'coordinator',
  'coordenador',
  'coordenadora',
  'gerente',
  'director',
  'executive',
  'head of',
  'especialista',
];

export function hasDisallowedSeniority(value: string): boolean {
  const text = normalizeSearchText(value);

  return DISALLOWED_SENIORITY_TERMS.some((term) => containsSearchTerm(text, normalizeSearchText(term)));
}

export function detectEntryLevel(value: string): string | null {
  const text = normalizeSearchText(value);

  if (containsSearchTerm(text, 'estagio') || containsSearchTerm(text, 'estagiario')) {
    return 'Estágio';
  }

  if (containsSearchTerm(text, 'intern') || containsSearchTerm(text, 'internship')) {
    return 'Estágio';
  }

  if (containsSearchTerm(text, 'trainee')) {
    return 'Trainee';
  }

  if (
    containsSearchTerm(text, 'junior') ||
    containsSearchTerm(text, 'jr') ||
    containsSearchTerm(text, 'entry level') ||
    containsSearchTerm(text, 'entry-level') ||
    containsSearchTerm(text, 'entrylevel')
  ) {
    return 'Júnior';
  }

  return null;
}

export function containsEntryLevelSignal(value: string): boolean {
  const text = normalizeSearchText(value);

  return ENTRY_LEVEL_TERMS.some((term) => containsSearchTerm(text, normalizeSearchText(term)));
}

function containsSearchTerm(normalizedText: string, normalizedTerm: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${escapeRegex(normalizedTerm)}([^a-z0-9]|$)`).test(normalizedText);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
