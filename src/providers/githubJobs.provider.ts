import { logger } from '../lib/logger';
import type {
  CollectedJob,
  JobSourceProvider,
  ProviderCollectError,
  ProviderCollectResult,
  ProviderRepositorySummary,
  ProviderRepositorySummaryNumericMetric,
} from './types';

const GITHUB_API_VERSION = '2022-11-28';
const MAX_ISSUE_AGE_DAYS = 30;

const GITHUB_JOB_REPOSITORIES = [
  { owner: 'frontendbr', repo: 'vagas' },
  { owner: 'backend-br', repo: 'vagas' },
  { owner: 'react-brasil', repo: 'vagas' },
  { owner: 'qa-brasil', repo: 'vagas' },
  { owner: 'nodejsdevbr', repo: 'vagas' },
  { owner: 'dotnetdevbr', repo: 'vagas' },
  { owner: 'soujava', repo: 'vagas-java' },
  { owner: 'DevOps-Brasil', repo: 'Vagas' },
  { owner: 'programadores-br', repo: 'geral' },
  { owner: 'datascience-br', repo: 'vagas' },
  { owner: 'brasil-php', repo: 'vagas' },
  { owner: 'androiddevbr', repo: 'vagas' },
  { owner: 'CocoaHeadsBrasil', repo: 'vagas' },
  { owner: 'remotejobsbr', repo: 'design-ux-vagas' },
];

const ENTRY_LEVEL_LABEL_TERMS = ['junior', 'jr', 'estagio', 'estagiario', 'trainee'];
const DISALLOWED_SENIORITY_LABEL_TERMS = [
  'pleno',
  'senior',
  'especialista',
  'tech lead',
  'lead',
  'staff',
  'principal',
];
const DESCRIPTION_SECTION_TITLES = ['descrição da vaga', 'sobre a vaga', 'nossa empresa', 'responsabilidades'];
const COMPANY_SECTION_TITLES = ['nossa empresa'];
const STACK_TERMS = [
  'React Native',
  'Node.js',
  'JavaScript',
  'TypeScript',
  'PostgreSQL',
  'CI/CD',
  'Angular',
  'React',
  'Node',
  'MySQL',
  'Docker',
  'Git',
  'AWS',
  'Azure',
  'GCP',
  'Java',
  'Spring',
  'Python',
  'Django',
  'Flask',
  'PHP',
  'Laravel',
  'HTML',
  'CSS',
  'SQL',
];
const MINAS_GERAIS_TERMS = [
  'MG',
  'Minas Gerais',
  'Belo Horizonte',
  'BH',
  'Contagem',
  'Betim',
  'Nova Lima',
  'Uberlândia',
  'Uberlandia',
  'Juiz de Fora',
  'Montes Claros',
  'Uberaba',
  'Governador Valadares',
  'Ipatinga',
  'Sete Lagoas',
  'Divinópolis',
  'Divinopolis',
  'Santa Luzia',
  'Ibirité',
  'Ibirite',
  'Poços de Caldas',
  'Pocos de Caldas',
  'Pouso Alegre',
  'Varginha',
];

type GitHubIssueLabel = string | { name?: string | null };

type GitHubIssue = {
  number: number;
  title?: string | null;
  body?: string | null;
  html_url?: string | null;
  created_at?: string | null;
  labels?: GitHubIssueLabel[];
  pull_request?: unknown;
};

type ParsedGitHubIssueTitle = {
  title: string;
  company: string | null;
  location: string | null;
};

type LocationFilterInput = {
  title: string;
  labels: string[];
  body: string;
  location: string | null;
  modality: string | null;
};

export const githubJobsProvider: JobSourceProvider = {
  name: 'github-jobs',
  async collect(): Promise<ProviderCollectResult> {
    const collectedJobs: CollectedJob[] = [];
    const errors: ProviderCollectError[] = [];
    const repositorySummaries: ProviderRepositorySummary[] = [];
    const since = getDateDaysAgo(MAX_ISSUE_AGE_DAYS);
    const token = process.env.GITHUB_TOKEN?.trim();

    if (!token) {
      logger.warn('GITHUB_TOKEN nao configurado. A coleta GitHub usara rate limit menor sem autenticacao.');
    }

    for (const repository of GITHUB_JOB_REPOSITORIES) {
      const source = `${repository.owner}/${repository.repo}`;
      const repositorySummary = createRepositorySummary(source);
      repositorySummaries.push(repositorySummary);
      let issues: GitHubIssue[];

      try {
        issues = await fetchRepositoryIssues(repository.owner, repository.repo, since, token);
        repositorySummary.totalIssuesRead = issues.length;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro desconhecido ao coletar repositorio GitHub.';

        repositorySummary.errors += 1;
        errors.push({
          provider: `github-jobs:${source}`,
          message,
        });
        logger.error('Erro ao coletar issues de repositorio GitHub. Continuando nos demais repositorios.', error, {
          repository: source,
        });
        continue;
      }

      for (const issue of issues) {
        if (!isCollectableIssue(issue, since)) {
          if (issue.created_at && !isIssueRecent(issue.created_at, MAX_ISSUE_AGE_DAYS, since)) {
            repositorySummary.ignoredByDate += 1;
          }
          continue;
        }

        const labels = getIssueLabelNames(issue.labels);

        if (isDisallowedSeniority(labels)) {
          repositorySummary.ignoredBySeniority += 1;
          continue;
        }

        if (!isEntryLevelIssue(labels)) {
          repositorySummary.ignoredByMissingEntryLevel += 1;
          continue;
        }

        const level = extractLevel(labels);

        if (!level) {
          repositorySummary.ignoredByMissingEntryLevel += 1;
          continue;
        }

        const issueTitle = issue.title ?? '';
        const body = issue.body ?? '';
        const parsedTitle = parseGitHubIssueTitle(issueTitle);
        const modality = extractModality(issueTitle, labels, body);

        if (
          !shouldAcceptByLocation({
            title: issueTitle,
            labels,
            body,
            location: parsedTitle.location,
            modality,
          })
        ) {
          repositorySummary.ignoredByLocation += 1;
          continue;
        }

        collectedJobs.push({
          externalId: `${source}#${issue.number}`,
          title: parsedTitle.title,
          company: parsedTitle.company ?? extractCompanyFromBody(body),
          location: parsedTitle.location,
          modality,
          level,
          stacks: extractStacksFromBody(body),
          salaryRange: null,
          shortDescription: extractShortDescriptionFromBody(body),
          rawText: truncateWords(cleanMarkdownText(body) || body, 300),
          url: issue.html_url ?? null,
          source,
          collectedAt: new Date(),
        });
      }
    }

    return {
      jobs: collectedJobs,
      totalIssuesRead: sumRepositoryMetric(repositorySummaries, 'totalIssuesRead'),
      ignoredByDate: sumRepositoryMetric(repositorySummaries, 'ignoredByDate'),
      ignoredBySeniority: sumRepositoryMetric(repositorySummaries, 'ignoredBySeniority'),
      ignoredByMissingEntryLevel: sumRepositoryMetric(repositorySummaries, 'ignoredByMissingEntryLevel'),
      ignoredByLocation: sumRepositoryMetric(repositorySummaries, 'ignoredByLocation'),
      ignoredByQuality: sumRepositoryMetric(repositorySummaries, 'ignoredByQuality'),
      errors,
      repositorySummaries,
    };
  },
};

function createRepositorySummary(source: string): ProviderRepositorySummary {
  return {
    source,
    totalIssuesRead: 0,
    ignoredByDate: 0,
    ignoredBySeniority: 0,
    ignoredByMissingEntryLevel: 0,
    ignoredByLocation: 0,
    ignoredByQuality: 0,
    ignoredDuplicates: 0,
    possibleDuplicates: 0,
    created: 0,
    errors: 0,
  };
}

function sumRepositoryMetric(
  summaries: ProviderRepositorySummary[],
  metric: ProviderRepositorySummaryNumericMetric,
): number {
  return summaries.reduce((total, summary) => total + (summary[metric] ?? 0), 0);
}

async function fetchRepositoryIssues(
  owner: string,
  repo: string,
  since: Date,
  token?: string,
): Promise<GitHubIssue[]> {
  const url = new URL(`https://api.github.com/repos/${owner}/${repo}/issues`);
  url.searchParams.set('state', 'open');
  url.searchParams.set('per_page', '100');
  url.searchParams.set('since', since.toISOString());

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'tech-scrapper-discord-bot',
    'X-GitHub-Api-Version': GITHUB_API_VERSION,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`GitHub API retornou status ${response.status} para ${owner}/${repo}.`);
  }

  return (await response.json()) as GitHubIssue[];
}

function isCollectableIssue(issue: GitHubIssue, since: Date): boolean {
  if (issue.pull_request) {
    return false;
  }

  if (!issue.created_at) {
    return false;
  }

  return isIssueRecent(issue.created_at, MAX_ISSUE_AGE_DAYS, since);
}

function getIssueLabelNames(labels?: GitHubIssueLabel[]): string[] {
  return (labels ?? [])
    .map((label) => (typeof label === 'string' ? label : label.name))
    .filter((label): label is string => Boolean(label?.trim()));
}

function normalizeLabel(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function isEntryLevelIssue(labels: string[]): boolean {
  return labels.some((label) => {
    const normalizedLabel = normalizeLabel(label);

    return ENTRY_LEVEL_LABEL_TERMS.some((term) => containsSearchTerm(normalizedLabel, term));
  });
}

function isDisallowedSeniority(labels: string[]): boolean {
  return labels.some((label) => {
    const normalizedLabel = normalizeLabel(label);

    return DISALLOWED_SENIORITY_LABEL_TERMS.some((term) => containsSearchTerm(normalizedLabel, term));
  });
}

function isIssueRecent(createdAt: string, maxAgeDays: number, referenceDate = getDateDaysAgo(maxAgeDays)): boolean {
  const createdDate = new Date(createdAt);

  if (Number.isNaN(createdDate.getTime())) {
    return false;
  }

  return createdDate >= referenceDate;
}

function parseGitHubIssueTitle(title: string): ParsedGitHubIssueTitle {
  const trimmedTitle = title.trim();
  const bracketMatch = trimmedTitle.match(/^\s*\[([^\]]+)\]\s*(.*)$/);
  const location = bracketMatch?.[1]?.trim() || null;
  const titleWithoutLocation = bracketMatch?.[2]?.trim() || trimmedTitle;
  const separator = findCompanySeparator(titleWithoutLocation);

  if (!separator) {
    return {
      title: titleWithoutLocation || trimmedTitle,
      company: null,
      location,
    };
  }

  const parsedTitle = titleWithoutLocation.slice(0, separator.index).trim();
  const company = titleWithoutLocation.slice(separator.endIndex).trim();

  return {
    title: parsedTitle || trimmedTitle,
    company: company || null,
    location,
  };
}

function findCompanySeparator(value: string): { index: number; endIndex: number } | null {
  const separatorRegex = /\s+(?:na empresa|na|no|para)\s+/gi;
  let match: RegExpExecArray | null;
  let lastMatch: RegExpExecArray | null = null;

  while ((match = separatorRegex.exec(value)) !== null) {
    lastMatch = match;
  }

  if (!lastMatch) {
    return null;
  }

  return {
    index: lastMatch.index,
    endIndex: lastMatch.index + lastMatch[0].length,
  };
}

function isRemoteJob(title: string, labels: string[], body: string): boolean {
  const normalizedText = normalizeLabel([title, ...labels, body].join(' '));

  return normalizedText.includes('remoto') || normalizedText.includes('remote');
}

function isHybridJob(title: string, labels: string[], body: string): boolean {
  const normalizedText = normalizeLabel([title, ...labels, body].join(' '));

  return normalizedText.includes('hibrido') || normalizedText.includes('hybrid');
}

function isPresentialJob(title: string, labels: string[], body: string): boolean {
  return normalizeLabel([title, ...labels, body].join(' ')).includes('presencial');
}

function isMinasGeraisLocation(location: string | null, body: string): boolean {
  const text = normalizeLabel([location ?? '', body].join(' '));

  return MINAS_GERAIS_TERMS.some((term) => containsSearchTerm(text, normalizeLabel(term)));
}

function shouldAcceptByLocation(input: LocationFilterInput): boolean {
  if (input.modality === 'Remoto' || isRemoteJob(input.title, input.labels, input.body)) {
    return true;
  }

  const isMinasGerais = isMinasGeraisLocation(input.location, input.body);

  if (
    input.modality === 'Híbrido' ||
    input.modality === 'Presencial' ||
    isHybridJob(input.title, input.labels, input.body) ||
    isPresentialJob(input.title, input.labels, input.body)
  ) {
    return isMinasGerais;
  }

  return isMinasGerais;
}

function extractModality(title: string, labels: string[], body: string): string | null {
  if (isRemoteJob(title, labels, body)) {
    return 'Remoto';
  }

  if (isHybridJob(title, labels, body)) {
    return 'Híbrido';
  }

  if (isPresentialJob(title, labels, body)) {
    return 'Presencial';
  }

  return null;
}

function extractLevel(labels: string[]): string | null {
  const normalizedLabels = labels.map(normalizeLabel);

  if (normalizedLabels.some((label) => containsSearchTerm(label, 'estagio') || containsSearchTerm(label, 'estagiario'))) {
    return 'Estágio';
  }

  if (normalizedLabels.some((label) => containsSearchTerm(label, 'trainee'))) {
    return 'Trainee';
  }

  if (normalizedLabels.some((label) => containsSearchTerm(label, 'junior') || containsSearchTerm(label, 'jr'))) {
    return 'Júnior';
  }

  return null;
}

function truncateWords(text: string, maxWords: number): string | null {
  const words = text.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return null;
  }

  return words.slice(0, maxWords).join(' ');
}

function extractShortDescriptionFromBody(body: string): string | null {
  const sectionText = extractFirstSectionText(body, DESCRIPTION_SECTION_TITLES);

  return summarizeDescription(sectionText ?? body);
}

function extractStacksFromBody(body: string): string | null {
  const text = cleanMarkdownText(body);
  const foundStacks: string[] = [];

  for (const stack of STACK_TERMS) {
    if (!stackRegex(stack).test(text)) {
      continue;
    }

    if (stack === 'React' && foundStacks.includes('React Native')) {
      continue;
    }

    if (stack === 'Node' && foundStacks.includes('Node.js')) {
      continue;
    }

    foundStacks.push(stack);
  }

  return foundStacks.length > 0 ? foundStacks.join(', ') : null;
}

function extractCompanyFromBody(body: string): string | null {
  const companyByField = extractCompanyField(body);

  if (companyByField) {
    return companyByField;
  }

  const companySection = extractFirstSectionText(body, COMPANY_SECTION_TITLES);

  if (!companySection) {
    return null;
  }

  const firstLine = cleanMarkdownText(companySection).split(/[.\n]/)[0]?.trim();

  if (!firstLine || firstLine.split(/\s+/).length > 8 || /\b(somos|atuamos|buscamos|temos)\b/i.test(firstLine)) {
    return null;
  }

  return firstLine.replace(/[:.,;]+$/, '') || null;
}

function extractCompanyField(body: string): string | null {
  const fieldRegex = /^\s*(?:[-*]\s*)?(?:empresa|company|nome da empresa)\s*:\s*(.+)$/gim;
  const match = fieldRegex.exec(body);

  if (!match?.[1]) {
    return null;
  }

  const value = cleanMarkdownText(match[1]).replace(/[:.,;]+$/, '');

  if (!value || value.split(/\s+/).length > 8) {
    return null;
  }

  return value;
}

function extractFirstSectionText(body: string, sectionTitles: string[]): string | null {
  const lines = body.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const currentLine = normalizeSectionLine(lines[index]);

    if (!sectionTitles.some((title) => currentLine.includes(normalizeLabel(title)))) {
      continue;
    }

    const collectedLines: string[] = [];

    for (let nextIndex = index + 1; nextIndex < lines.length; nextIndex += 1) {
      const nextLine = lines[nextIndex];

      if (isSectionBoundary(nextLine)) {
        break;
      }

      collectedLines.push(nextLine);
    }

    const sectionText = cleanMarkdownText(collectedLines.join('\n'));

    if (sectionText) {
      return sectionText;
    }
  }

  return null;
}

function summarizeDescription(text: string): string | null {
  const cleanedText = cleanMarkdownText(text);

  if (!cleanedText) {
    return null;
  }

  const sentences = cleanedText.match(/[^.!?]+[.!?]?/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [];
  const selectedSentences: string[] = [];

  for (const sentence of sentences) {
    if (selectedSentences.length >= 4) {
      break;
    }

    const candidate = [...selectedSentences, sentence].join(' ');

    if (candidate.split(/\s+/).length > 80) {
      break;
    }

    selectedSentences.push(sentence);
  }

  const summary = selectedSentences.length > 0 ? selectedSentences.join(' ') : cleanedText;

  return truncateWords(summary, 80);
}

function cleanMarkdownText(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/[*_~>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSectionLine(line: string): string {
  return normalizeLabel(line.replace(/^#+\s*/, '').replace(/[*_:>-]/g, ' '));
}

function isSectionBoundary(line: string): boolean {
  const normalizedLine = normalizeSectionLine(line);

  return /^#{1,6}\s+/.test(line) || DESCRIPTION_SECTION_TITLES.some((title) => normalizedLine.includes(normalizeLabel(title)));
}

function containsSearchTerm(normalizedText: string, normalizedTerm: string): boolean {
  if (normalizedTerm === 'mg' || normalizedTerm === 'bh') {
    return new RegExp(`(^|[^a-z0-9])${escapeRegex(normalizedTerm)}([^a-z0-9]|$)`).test(normalizedText);
  }

  return normalizedText.includes(normalizedTerm);
}

function stackRegex(stack: string): RegExp {
  const patterns: Record<string, string> = {
    'React Native': '\\breact\\s+native\\b',
    'Node.js': '\\bnode\\.?js\\b',
    'CI/CD': '\\bci\\s*/\\s*cd\\b',
  };

  return new RegExp(patterns[stack] ?? `\\b${escapeRegex(stack)}\\b`, 'i');
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getDateDaysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);

  return date;
}
