import type { ProviderRunnerSummary } from '../../providers/providerRunner';
import type { ProviderRepositorySummary } from '../../providers/types';

type ProviderBreakdownOptions = {
  maxSources?: number;
  onlySourcesWithCreatedJobs?: boolean;
};

export function buildProviderBreakdown(
  summary: ProviderRunnerSummary,
  options: ProviderBreakdownOptions = {},
): string {
  const sources = getBreakdownSources(summary, options);

  if (sources.length === 0) {
    return '';
  }

  return sources.map(formatSourceSummary).join('; ');
}

export function buildProviderCollectionNotice(prefix: string, summary: ProviderRunnerSummary): string {
  const breakdown = buildProviderBreakdown(summary);
  const createdLabel =
    summary.createdJobs === 0
      ? 'Nenhuma vaga nova'
      : `${summary.createdJobs} ${summary.createdJobs === 1 ? 'nova' : 'novas'}`;
  const errorLabel = `${summary.repositoryErrors} ${summary.repositoryErrors === 1 ? 'erro' : 'erros'}`;
  const details = [`${createdLabel}`, `${summary.ignoredByQuality} por qualidade`, errorLabel];

  if (breakdown) {
    details.push(`Por fonte: ${breakdown}`);
  }

  return `${prefix} concluida: ${details.join(', ')}.`;
}

export function buildGithubCollectionNotice(summary: ProviderRunnerSummary): string {
  const ignoredByLevel = summary.ignoredBySeniority + summary.ignoredByMissingEntryLevel;
  const sourceBreakdown = buildProviderBreakdown(summary, {
    maxSources: 3,
    onlySourcesWithCreatedJobs: true,
  });
  const baseMessage = `Coleta GitHub: ${summary.totalIssuesRead} issues analisadas, ${summary.createdJobs} novas, ${summary.ignoredDuplicates} duplicatas, ${summary.possibleDuplicates} possíveis, ${summary.ignoredByDate} antigas, ${summary.ignoredByLocation} fora de localização, ${ignoredByLevel} fora do nível, ${summary.ignoredByQuality} por qualidade, ${summary.repositoryErrors} ${summary.repositoryErrors === 1 ? 'erro' : 'erros'}.`;

  if (!sourceBreakdown) {
    return baseMessage;
  }

  return `${baseMessage} Top fontes: ${sourceBreakdown}.`;
}

export function buildGupyCollectionNotice(summary: ProviderRunnerSummary): string {
  const ignoredByLevel = summary.ignoredBySeniority + summary.ignoredByMissingEntryLevel;

  return `Coleta Gupy: ${summary.totalIssuesRead} vagas analisadas, ${summary.createdJobs} novas, ${summary.ignoredByLocation} fora de localização, ${ignoredByLevel} fora do nível, ${summary.ignoredByQuality} por qualidade, ${summary.ignoredDuplicates} duplicatas, ${summary.repositoryErrors} ${summary.repositoryErrors === 1 ? 'erro' : 'erros'}.`;
}

function getBreakdownSources(
  summary: ProviderRunnerSummary,
  options: ProviderBreakdownOptions,
): ProviderRepositorySummary[] {
  let sources = summary.repositorySummaries;

  if (options.onlySourcesWithCreatedJobs) {
    sources = sources.filter((source) => source.created > 0);
  }

  if (options.maxSources) {
    sources = [...sources]
      .sort((a, b) => {
        if (b.created !== a.created) {
          return b.created - a.created;
        }

        return a.source.localeCompare(b.source);
      })
      .slice(0, options.maxSources);
  }

  return sources;
}

function formatSourceSummary(summary: ProviderRepositorySummary): string {
  const created = summary.created === 0 ? '0' : `${summary.created} ${summary.created === 1 ? 'nova' : 'novas'}`;
  const errors = summary.errors > 0 ? `, ${summary.errors} ${summary.errors === 1 ? 'erro' : 'erros'}` : '';

  return `${summary.source}: ${created}${errors}`;
}
