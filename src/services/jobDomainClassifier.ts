import type { CollectedJob, NormalizedCollectedJob } from '../providers/types';

export type JobDomain = 'TECH' | 'POSSIBLY_TECH' | 'NON_TECH';

export type JobDomainClassification = {
  domain: JobDomain;
  techMatches: string[];
  nonTechMatches: string[];
};

type JobDomainClassifierInput = Partial<CollectedJob | NormalizedCollectedJob> & {
  categoryNames?: string[];
  tagNames?: string[];
};

const STRONG_TECH_TERMS = [
  'desenvolvimento',
  'desenvolvedor',
  'developer',
  'software',
  'programacao',
  'programador',
  'engenharia de software',
  'frontend',
  'front end',
  'front-end',
  'backend',
  'back end',
  'back-end',
  'fullstack',
  'full stack',
  'qa',
  'quality assurance',
  'testes de software',
  'dados',
  'data analytics',
  'data science',
  'bi',
  'sql',
  'suporte tecnico',
  'suporte de ti',
  'help desk',
  'infraestrutura',
  'redes',
  'cloud',
  'devops',
  'seguranca da informacao',
  'cybersecurity',
  'react',
  'node',
  'java',
  'python',
  'javascript',
  'typescript',
  'php',
  'docker',
  'aws',
  'azure',
  'gcp',
  'ux/ui',
  'product design',
];

const POSSIBLE_TECH_TERMS = ['tecnologia', 'tech', 'ti', 'sistemas', 'produto digital', 'analytics'];

const NON_TECH_TERMS = [
  'direito',
  'juridico',
  'societario',
  'bancario juridico',
  'advogado',
  'advocacia',
  'marketing',
  'performance marketing',
  'social media',
  'conteudo',
  'copywriter',
  'comercial',
  'vendas',
  'sdr',
  'bdr',
  'administracao',
  'administrativo',
  'financeiro',
  'contabilidade',
  'recursos humanos',
  'rh',
  'departamento pessoal',
  'parcerias',
  'afiliados',
  'agencia',
  'agencias',
  'atendimento comercial',
  'logistica',
  'engenharia civil',
  'arquitetura',
  'design grafico',
  'medicina',
  'enfermagem',
  'psicologia',
];

export function classifyJobDomain(job: JobDomainClassifierInput): JobDomainClassification {
  const titleAndStructuredText = normalizeSearchText(
    [
      job.title,
      job.level,
      job.stacks,
      ...(job.categoryNames ?? []),
      ...(job.tagNames ?? []),
    ]
      .filter(Boolean)
      .join(' '),
  );
  const fullText = normalizeSearchText(
    [
      titleAndStructuredText,
      job.company,
      job.location,
      job.modality,
      job.shortDescription,
      job.rawText,
      job.source,
    ]
      .filter(Boolean)
      .join(' '),
  );

  const techMatches = uniqueMatches(fullText, STRONG_TECH_TERMS);
  const possibleTechMatches = uniqueMatches(fullText, POSSIBLE_TECH_TERMS);
  const nonTechMatches = uniqueMatches(fullText, NON_TECH_TERMS);
  const structuredNonTechMatches = uniqueMatches(titleAndStructuredText, NON_TECH_TERMS);

  if ((structuredNonTechMatches.length > 0 || nonTechMatches.length > 0) && techMatches.length === 0) {
    return {
      domain: 'NON_TECH',
      techMatches,
      nonTechMatches,
    };
  }

  if (techMatches.length > 0) {
    return {
      domain: 'TECH',
      techMatches,
      nonTechMatches,
    };
  }

  if (possibleTechMatches.length > 0) {
    return {
      domain: 'POSSIBLY_TECH',
      techMatches: possibleTechMatches,
      nonTechMatches,
    };
  }

  return {
    domain: 'NON_TECH',
    techMatches: [],
    nonTechMatches: ['missing_tech_signal'],
  };
}

function uniqueMatches(normalizedText: string, terms: string[]): string[] {
  const matches = terms.filter((term) => containsSearchTerm(normalizedText, normalizeSearchText(term)));

  return Array.from(new Set(matches));
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function containsSearchTerm(normalizedText: string, normalizedTerm: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${escapeRegex(normalizedTerm)}([^a-z0-9]|$)`).test(normalizedText);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
