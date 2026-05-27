import { JobPost } from '@prisma/client';

const MAX_ABOUT_BULLETS = 5;
const MAX_ABOUT_BULLET_LENGTH = 150;

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
    formatField('💼 **Vaga**', job.title),
    formatField('🏢 **Empresa**', job.company),
    formatField('📍 **Local**', job.location),
    formatField('🧭 **Modalidade**', job.modality),
    formatField('🎯 **Nível**', job.level),
    formatField('🛠️ **Stacks**', job.stacks),
    formatField('💰 **Faixa salarial**', job.salaryRange),
    '',
    formatBlock('📝 **Sobre a vaga:**', formatShortDescription(job.shortDescription)),
    '',
    formatLink(job.url),
    '',
    '💡 Dica PD: revise seu LinkedIn, GitHub e currículo antes de se candidatar.',
  ];

  return lines.filter((line, index, allLines) => shouldKeepLine(line, index, allLines)).join('\n');
}

export function buildFallbackJobMessage(job: JobPost): string {
  return buildDefaultJobMessage(job);
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

  return `🔗 **Candidatura:**\n${url.trim()}`;
}

function formatBlock(label: string, value: string | null): string | null {
  if (!value?.trim()) {
    return null;
  }

  return `${label}\n${value.trim()}`;
}

function formatShortDescription(value: string | null): string | null {
  if (!value?.trim()) {
    return null;
  }

  const bullets = extractDescriptionBullets(value);

  if (bullets.length === 0) {
    return null;
  }

  return bullets.map((bullet) => `• ${bullet}`).join('\n');
}

function extractDescriptionBullets(value: string): string[] {
  return value
    .split(/\n+|(?<=[.!?])\s+/)
    .map(cleanDescriptionLine)
    .filter(isUsefulDescriptionLine)
    .map(formatDescriptionLine)
    .filter(isUniqueLine)
    .slice(0, MAX_ABOUT_BULLETS)
    .map((line) => truncateSentence(line, MAX_ABOUT_BULLET_LENGTH));
}

function cleanDescriptionLine(value: string): string {
  return value
    .replace(/^[-*•]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isUsefulDescriptionLine(value: string): boolean {
  if (value.length < 18) {
    return false;
  }

  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const ignoredStarts = [
    'tipo de vaga',
    'tipo de contrato',
    'area profissional',
    'horarios',
  ];

  const ignoredSnippets = ['excelente oportunidade', 'deseja aprender', 'iniciar sua carreira'];

  return !ignoredStarts.some((start) => normalized.startsWith(start)) && !ignoredSnippets.some((snippet) => normalized.includes(snippet));
}

function formatDescriptionLine(value: string): string {
  const line = value.trim();

  const requirementsMatch = line.match(/necess[aá]rio ter (.+)$/i);

  if (requirementsMatch?.[1]) {
    return `Requisitos: ${requirementsMatch[1].replace(/[.]$/, '')}.`;
  }

  const educationMatch = line.match(/(?:É|E) preciso estar cursando (.+)$/i);

  if (educationMatch?.[1]) {
    return `Formacao: cursando ${educationMatch[1].replace(/[.]$/, '')}.`;
  }

  if (/home office/i.test(line) && /treinamento/i.test(line)) {
    const stipendMatch = line.match(/bolsa de\s+([^ ]+(?:\s*a\s*[^ ]+)?)/i);
    const stipendText = stipendMatch?.[1] ? ` e bolsa de ${stipendMatch[1]}` : '';

    return `Home office, com treinamento gratuito${stipendText} durante o treinamento.`;
  }

  if (/curso\/treinamento gratuito/i.test(line)) {
    const stipendMatch = line.match(/bolsa de\s+([^ ]+(?:\s*a\s*[^ ]+)?)/i);
    const stipendText = stipendMatch?.[1] ? ` e bolsa de ${stipendMatch[1]}` : '';

    return `Curso/treinamento gratuito com despesas pagas pela empresa${stipendText}.`;
  }

  if (/home office/i.test(line)) {
    return 'Modelo de trabalho: home office.';
  }

  if (/aprovados.*treinamento.*contratados/i.test(line)) {
    return 'Aprovados no treinamento seguem para contratacao como estagiarios.';
  }

  if (/^n[uú]mero de vagas:/i.test(line)) {
    return line.replace(/^n[uú]mero de vagas:/i, 'Vagas:').trim();
  }

  if (/^local do trabalho:/i.test(line)) {
    return line.replace(/^local do trabalho:/i, 'Local de trabalho:').trim();
  }

  if (/^treinamento:/i.test(line)) {
    return line.replace(/^treinamento:/i, 'Horario do treinamento:').trim();
  }

  if (/^est[aá]gio:/i.test(line)) {
    return line.replace(/^est[aá]gio:/i, 'Carga do estagio:').trim();
  }

  return line;
}

function isUniqueLine(value: string, index: number, allLines: string[]): boolean {
  const normalized = normalizeForComparison(value);

  return allLines.findIndex((line) => normalizeForComparison(line) === normalized) === index;
}

function normalizeForComparison(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[.!?]+$/g, '')
    .trim()
    .toLowerCase();
}

function truncateSentence(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  const truncated = value.slice(0, maxLength - 3);
  const lastSpace = truncated.lastIndexOf(' ');

  return `${truncated.slice(0, lastSpace > 80 ? lastSpace : truncated.length).trim()}...`;
}

function shouldKeepLine(line: string | null, index: number, allLines: Array<string | null>): line is string {
  if (line !== '') {
    return line !== null;
  }

  const previous = allLines[index - 1];
  const next = allLines[index + 1];

  return Boolean(previous && next);
}
