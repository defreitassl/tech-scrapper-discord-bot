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
  'MongoDB',
  'Docker',
  'Kubernetes',
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
  'Ruby',
  'Rails',
  'Go',
  'Golang',
  'HTML',
  'CSS',
  'SQL',
  'QA',
  'DevOps',
  'Cloud',
];

export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function stripHtml(value?: string | null): string | null {
  if (!value?.trim()) {
    return null;
  }

  const withoutTags = value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  return decodeHtmlEntities(withoutTags).replace(/\s+/g, ' ').trim() || null;
}

export function truncateWords(value?: string | null, maxWords = 120): string | null {
  const text = value?.trim();

  if (!text) {
    return null;
  }

  const words = text.split(/\s+/).filter(Boolean);

  return words.slice(0, maxWords).join(' ') || null;
}

export function summarizeText(value?: string | null, maxWords = 80): string | null {
  const text = stripHtml(value) ?? value?.replace(/\s+/g, ' ').trim();

  if (!text) {
    return null;
  }

  const sentences = text.match(/[^.!?]+[.!?]?/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [];
  const selectedSentences: string[] = [];

  for (const sentence of sentences) {
    const candidate = [...selectedSentences, sentence].join(' ');

    if (candidate.split(/\s+/).length > maxWords) {
      break;
    }

    selectedSentences.push(sentence);

    if (selectedSentences.length >= 4) {
      break;
    }
  }

  return truncateWords(selectedSentences.length > 0 ? selectedSentences.join(' ') : text, maxWords);
}

export function extractStacksFromText(value?: string | null): string | null {
  const text = stripHtml(value) ?? value;

  if (!text) {
    return null;
  }

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

    if (stack === 'Go' && foundStacks.includes('Golang')) {
      continue;
    }

    foundStacks.push(stack);
  }

  return foundStacks.length > 0 ? foundStacks.join(', ') : null;
}

export function compactJoin(values: unknown[], separator = ' '): string {
  return values.map(normalizeJoinValue).filter((value): value is string => Boolean(value?.trim())).join(separator);
}

function normalizeJoinValue(value: unknown): string | null {
  if (typeof value === 'string') {
    return value.trim() || null;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return null;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&rsquo;/gi, "'")
    .replace(/&lsquo;/gi, "'")
    .replace(/&rdquo;/gi, '"')
    .replace(/&ldquo;/gi, '"')
    .replace(/&hellip;/gi, '...');
}

function stackRegex(stack: string): RegExp {
  const patterns: Record<string, string> = {
    'React Native': '\\breact\\s+native\\b',
    'Node.js': '\\bnode\\.?js\\b',
    'CI/CD': '\\bci\\s*/\\s*cd\\b',
    'Golang': '\\bgolang\\b',
  };

  return new RegExp(patterns[stack] ?? `\\b${escapeRegex(stack)}\\b`, 'i');
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
