import { stripHtml as stripProviderHtml } from '../providers/providerTextUtils';

export function normalizeWhitespace(value?: string | null): string | null {
  const normalized = value?.replace(/\s+/g, ' ').trim();

  return normalized || null;
}

export function stripHtml(value?: string | null): string | null {
  return stripProviderHtml(value);
}

export function extractText(value?: string | null): string | null {
  return normalizeWhitespace(stripHtml(value) ?? value);
}

export function extractLinks(html?: string | null, baseUrl?: string): string[] {
  if (!html?.trim()) {
    return [];
  }

  const links = new Set<string>();
  const hrefPattern = /<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1/gi;
  let match: RegExpExecArray | null;

  while ((match = hrefPattern.exec(html)) !== null) {
    const href = match[2]?.trim();

    if (!href || href.startsWith('#') || href.toLowerCase().startsWith('javascript:')) {
      continue;
    }

    links.add(resolveLink(href, baseUrl));
  }

  return [...links];
}

function resolveLink(href: string, baseUrl?: string): string {
  if (!baseUrl) {
    return href;
  }

  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
}
