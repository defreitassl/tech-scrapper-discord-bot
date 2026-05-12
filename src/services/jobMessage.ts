import { JobPost } from '@prisma/client';

export function buildJobMessage(job: JobPost): string {
  const readyText = job.readyText?.trim();

  if (readyText) {
    return readyText;
  }

  const aiGeneratedText = job.aiGeneratedText?.trim();

  if (aiGeneratedText) {
    return aiGeneratedText;
  }

  return buildDefaultJobMessage(job);
}

export function buildDefaultJobMessage(job: JobPost): string {
  const lines = [
    '🚀 Fala, PDevs! Nova oportunidade passando no radar do Projeto Desenvolve.',
    '',
    formatField('💼 Vaga', job.title),
    formatField('🏢 Empresa', job.company),
    formatField('📍 Local', job.location),
    formatField('🎯 Nível', job.level),
    formatField('🧭 Modalidade', job.modality),
    '',
    formatLink(job.url),
    '',
    '💡 Dica PD: revise seu LinkedIn, GitHub e currículo antes de se candidatar.',
  ];

  return lines.filter((line, index, allLines) => shouldKeepLine(line, index, allLines)).join('\n');
}

function formatField(label: string, value: string | null): string | null {
  if (!value?.trim()) {
    return null;
  }

  return `${label}: ${value.trim()}`;
}

function formatLink(url: string | null): string | null {
  if (!url?.trim()) {
    return null;
  }

  return `🔗 Link para candidatura:\n${url.trim()}`;
}

function shouldKeepLine(line: string | null, index: number, allLines: Array<string | null>): line is string {
  if (line !== '') {
    return line !== null;
  }

  const previous = allLines[index - 1];
  const next = allLines[index + 1];

  return Boolean(previous && next);
}
