import type { AutomatedJobCollectionSummary } from '../../providers/providerRunner';

export function buildCompactCollectionNotice(summary: AutomatedJobCollectionSummary): string {
  const rejected =
    summary.rejectedByDomain +
    summary.rejectedByQuality +
    summary.rejectedByPriority;
  const errors = Math.max(summary.repositoryErrors, summary.errors.length);

  return `Coleta concluida: ${summary.approvedAsPending} vagas aprovadas para fila, ${rejected} recusadas, ${summary.rejectedDuplicates} duplicatas, ${errors} erros.`;
}
