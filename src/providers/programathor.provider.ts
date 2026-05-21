import { logger } from '../lib/logger';
import { fetchPublicHtml } from '../scraping/scrapingClient';
import { isRecentDate } from './providerDateUtils';
import { detectEntryLevel, hasDisallowedSeniority } from './providerSeniorityUtils';
import {
  compactJoin,
  extractStacksFromText,
  normalizeSearchText,
  stripHtml,
  summarizeText,
  truncateWords,
} from './providerTextUtils';
import type { CollectedJob, JobSourceProvider, ProviderCollectResult, ProviderRepositorySummary } from './types';

const SOURCE = 'programathor';
const BASE_URL = 'https://programathor.com.br';
const MAX_JOBS_PER_RUN = 20;
const MAX_JOB_AGE_DAYS = 30;

const SEARCH_SOURCES = [
  {
    term: 'estagio tecnologia',
    path: '/jobs?contract_type=Est%C3%A1gio',
  },
  {
    term: 'desenvolvedor junior',
    path: '/jobs?expertise=J%C3%BAnior',
  },
  {
    term: 'junior tecnologia',
    path: '/jobs?expertise=J%C3%BAnior',
  },
  {
    term: 'front-end junior',
    path: '/jobs-front-end?expertise=J%C3%BAnior',
  },
  {
    term: 'backend junior',
    path: '/jobs?expertise=J%C3%BAnior',
  },
  {
    term: 'suporte tecnico',
    path: '/jobs?expertise=J%C3%BAnior',
  },
  {
    term: 'qa junior',
    path: '/jobs-quality-assurance?expertise=J%C3%BAnior',
  },
  {
    term: 'dados junior',
    path: '/jobs-data-science?expertise=J%C3%BAnior',
  },
  {
    term: 'remoto junior',
    path: '/jobs?expertise=J%C3%BAnior&remoto=true',
  },
];

const MINAS_GERAIS_TERMS = [
  'minas gerais',
  'mg',
  'belo horizonte',
  'bh',
  'contagem',
  'betim',
  'nova lima',
  'uberlandia',
  'uberaba',
  'juiz de fora',
  'montes claros',
  'ipatinga',
  'divinopolis',
  'sete lagoas',
  'pouso alegre',
  'governador valadares',
];

type ProgramathorListJob = {
  externalId: string;
  title: string | null;
  company: string | null;
  location: string | null;
  modality: string | null;
  level: string | null;
  salaryRange: string | null;
  contractType: string | null;
  stacks: string | null;
  url: string;
  rawText: string;
  expired: boolean;
};

type ProgramathorDetail = {
  description: string | null;
  company: string | null;
  location: string | null;
  publishedDate: string | null;
};

export const programathorProvider: JobSourceProvider = {
  name: SOURCE,
  async collect(): Promise<ProviderCollectResult> {
    const jobs: CollectedJob[] = [];
    const seenUrls = new Set<string>();
    const errors: ProviderCollectResult['errors'] = [];
    const sourceSummaries = SEARCH_SOURCES.map((source) => createSourceSummary(source.term));

    for (const source of SEARCH_SOURCES) {
      if (jobs.length >= MAX_JOBS_PER_RUN) {
        break;
      }

      const summary = sourceSummaries.find((item) => item.term === source.term);

      if (!summary) {
        continue;
      }

      try {
        const html = await fetchPublicHtml(resolveUrl(source.path));
        const listJobs = extractListJobs(html);

        for (const listJob of listJobs) {
          summary.totalIssuesRead += 1;

          if (jobs.length >= MAX_JOBS_PER_RUN) {
            break;
          }

          if (seenUrls.has(listJob.url)) {
            continue;
          }

          seenUrls.add(listJob.url);

          if (listJob.expired) {
            summary.ignoredByDate += 1;
            continue;
          }

          const listText = compactJoin([listJob.title, listJob.rawText], ' ');

          if (hasDisallowedSeniority(listText)) {
            summary.ignoredBySeniority += 1;
            continue;
          }

          const level = listJob.level ?? detectEntryLevel(listText);

          if (!level) {
            summary.ignoredByMissingEntryLevel += 1;
            continue;
          }

          if (!isAllowedLocation(listJob.location, listJob.modality)) {
            summary.ignoredByLocation += 1;
            continue;
          }

          const detail = await fetchJobDetail(listJob.url, summary);

          if (detail?.publishedDate && !isRecentDate(detail.publishedDate, MAX_JOB_AGE_DAYS)) {
            summary.ignoredByDate += 1;
            continue;
          }

          const detailText = compactJoin([detail?.description, listJob.rawText], ' ');

          if (detailText && hasDisallowedSeniority(detailText)) {
            summary.ignoredBySeniority += 1;
            continue;
          }

          const rawText = stripHtml(detail?.description) ?? listJob.rawText;

          jobs.push({
            externalId: listJob.externalId,
            title: listJob.title,
            company: detail?.company ?? listJob.company,
            location: detail?.location ?? listJob.location,
            modality: listJob.modality,
            level,
            stacks: listJob.stacks ?? extractStacksFromText(rawText),
            salaryRange: listJob.salaryRange,
            shortDescription: summarizeText(rawText, 80),
            rawText: truncateWords(rawText, 300),
            url: listJob.url,
            source: summary.source,
            collectedAt: new Date(),
          });
          summary.returnedByProvider = (summary.returnedByProvider ?? 0) + 1;
        }
      } catch (error) {
        summary.errors += 1;
        errors.push({
          provider: SOURCE,
          message:
            error instanceof Error
              ? `Termo "${source.term}": ${error.message}`
              : `Erro desconhecido ao consultar termo "${source.term}".`,
        });
      }

      logger.info('Resumo da coleta Programathor por termo.', {
        term: source.term,
        totalRead: summary.totalIssuesRead,
        returnedByProvider: summary.returnedByProvider ?? 0,
        ignoredByDate: summary.ignoredByDate,
        ignoredBySeniority: summary.ignoredBySeniority,
        ignoredByMissingEntryLevel: summary.ignoredByMissingEntryLevel,
        ignoredByLocation: summary.ignoredByLocation,
        errors: summary.errors,
      });
    }

    const activeSourceSummaries = sourceSummaries.filter(
      (summary) =>
        summary.totalIssuesRead > 0 ||
        (summary.returnedByProvider ?? 0) > 0 ||
        summary.ignoredByDate > 0 ||
        summary.ignoredBySeniority > 0 ||
        summary.ignoredByMissingEntryLevel > 0 ||
        summary.ignoredByLocation > 0 ||
        summary.errors > 0,
    );

    return {
      jobs,
      totalIssuesRead: sumSourceSummaries(activeSourceSummaries, 'totalIssuesRead'),
      ignoredByDate: sumSourceSummaries(activeSourceSummaries, 'ignoredByDate'),
      ignoredBySeniority: sumSourceSummaries(activeSourceSummaries, 'ignoredBySeniority'),
      ignoredByMissingEntryLevel: sumSourceSummaries(activeSourceSummaries, 'ignoredByMissingEntryLevel'),
      ignoredByLocation: sumSourceSummaries(activeSourceSummaries, 'ignoredByLocation'),
      errors,
      repositorySummaries: activeSourceSummaries,
    };
  },
};

function createSourceSummary(term: string): ProviderRepositorySummary {
  return {
    source: formatTermSource(term),
    term,
    totalIssuesRead: 0,
    returnedByProvider: 0,
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

function sumSourceSummaries(
  summaries: ProviderRepositorySummary[],
  field: keyof Pick<
    ProviderRepositorySummary,
    'totalIssuesRead' | 'ignoredByDate' | 'ignoredBySeniority' | 'ignoredByMissingEntryLevel' | 'ignoredByLocation'
  >,
): number {
  return summaries.reduce((total, summary) => total + summary[field], 0);
}

function formatTermSource(term: string): string {
  return `${SOURCE}:${term}`;
}

function extractListJobs(html: string): ProgramathorListJob[] {
  const blocks = [...html.matchAll(/<a\b[^>]*href=["']\/jobs\/\d+[^"']*["'][^>]*>[\s\S]*?<\/a>/gi)].map(
    (match) => match[0],
  );

  return blocks.map(parseListJob).filter((job): job is ProgramathorListJob => Boolean(job));
}

function parseListJob(block: string): ProgramathorListJob | null {
  const href = matchFirst(block, /<a\b[^>]*href=["'](\/jobs\/\d+[^"']*)["']/i);

  if (!href) {
    return null;
  }

  const title = cleanTitle(extractText(matchFirst(block, /<h3[^>]*>([\s\S]*?)<\/h3>/i)));
  const metaSpans = [...block.matchAll(/<span><i class=['"]([^'"]+)['"]><\/i>([\s\S]*?)<\/span>/gi)].map((match) => ({
    icon: match[1],
    text: extractText(match[2]),
  }));
  const stacks = [...block.matchAll(/<span class=['"]tag-list background-gray['"]>([\s\S]*?)<\/span>/gi)]
    .map((match) => extractText(match[1]))
    .filter((value): value is string => Boolean(value))
    .join(', ');
  const url = resolveUrl(href);

  return {
    externalId: href.match(/\/jobs\/(\d+)/)?.[1] ?? url,
    title,
    company: findMeta(metaSpans, 'briefcase'),
    location: findMeta(metaSpans, 'map-marker'),
    modality: normalizeModality(findMeta(metaSpans, 'map-marker')),
    level: detectEntryLevel(findMeta(metaSpans, 'chart-bar') ?? compactJoin([title, block], ' ')),
    salaryRange: findMeta(metaSpans, 'money'),
    contractType: findMeta(metaSpans, 'file-alt'),
    stacks: stacks || null,
    url,
    rawText: extractText(block) ?? '',
    expired: normalizeSearchText(extractText(block) ?? '').includes('vencida'),
  };
}

async function fetchJobDetail(url: string, summary: ProviderRepositorySummary): Promise<ProgramathorDetail | null> {
  try {
    const html = await fetchPublicHtml(url);
    const description = extractJsonLdField(html, 'description', 'identifier') ?? extractDetailBody(html);
    const company = extractHiringOrganizationName(html) ?? extractText(matchFirst(html, /<h2[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>\s*<\/h2>/i));
    const location = extractAddressLocality(html) ?? extractText(matchFirst(html, /Localiza(?:ç|c)(?:ã|a)o:\s*<\/a>([\s\S]*?)<\/p>/i));

    return {
      description,
      company,
      location: location ? normalizeDetailLocation(location) : null,
      publishedDate: extractJsonLdSimpleField(html, 'datePosted'),
    };
  } catch (error) {
    summary.errors += 1;
    logger.warn('Erro ao consultar detalhe publico do Programathor.', {
      url,
      error: error instanceof Error ? error.message : 'Erro desconhecido.',
    });
    return null;
  }
}

function extractDetailBody(html: string): string | null {
  return stripHtml(matchFirst(html, /<div class="line-height-2-4">([\s\S]*?)<div class="hidden-xs hidden-sm text-center">/i));
}

function extractJsonLdField(html: string, field: string, nextField: string): string | null {
  const pattern = new RegExp(`"${field}"\\s*:\\s*"([\\s\\S]*?)"\\s*,\\s*"${nextField}"`, 'i');

  return decodeJsonString(matchFirst(html, pattern));
}

function extractJsonLdSimpleField(html: string, field: string): string | null {
  return decodeJsonString(matchFirst(html, new RegExp(`"${field}"\\s*:\\s*"([^"]*)"`, 'i')));
}

function extractHiringOrganizationName(html: string): string | null {
  const organization = matchFirst(html, /"hiringOrganization"\s*:\s*\{([\s\S]*?)\}\s*,/i);

  return organization ? extractJsonLdSimpleField(organization, 'name') : null;
}

function extractAddressLocality(html: string): string | null {
  const address = matchFirst(html, /"address"\s*:\s*\{([\s\S]*?)\}\s*\}/i);

  return address ? extractJsonLdSimpleField(address, 'addressLocality') : null;
}

function isAllowedLocation(location?: string | null, modality?: string | null): boolean {
  const text = normalizeSearchText(compactJoin([location, modality], ' '));

  if (text.includes('remoto')) {
    return true;
  }

  return MINAS_GERAIS_TERMS.some((term) => text.includes(normalizeSearchText(term)));
}

function normalizeModality(location?: string | null): string | null {
  const text = normalizeSearchText(location ?? '');

  if (text.includes('remoto')) {
    return 'Remoto';
  }

  if (text.includes('hibrido')) {
    return 'Hibrido';
  }

  if (text.includes('presencial')) {
    return 'Presencial';
  }

  return null;
}

function normalizeDetailLocation(location: string): string | null {
  const normalized = location.replace(/\s+/g, ' ').trim();

  return normalized || null;
}

function findMeta(metaSpans: Array<{ icon: string; text: string | null }>, icon: string): string | null {
  return metaSpans.find((item) => item.icon.includes(icon))?.text ?? null;
}

function cleanTitle(title?: string | null): string | null {
  return (
    title
      ?.replace(/\bNOVA\b/gi, '')
      .replace(/\bVencida\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim() || null
  );
}

function extractText(value?: string | null): string | null {
  return stripHtml(value)?.replace(/\s+/g, ' ').trim() || null;
}

function decodeJsonString(value?: string | null): string | null {
  if (!value?.trim()) {
    return null;
  }

  return value
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\n')
    .replace(/\\\//g, '/')
    .trim();
}

function matchFirst(value: string, pattern: RegExp): string | null {
  return value.match(pattern)?.[1]?.trim() || null;
}

function resolveUrl(path: string): string {
  return new URL(path, BASE_URL).toString();
}
