import type { Locator, Page } from 'playwright';

const DEFAULT_GOTO_TIMEOUT_MS = 20_000;

export async function safeGoto(page: Page, url: string, timeoutMs = DEFAULT_GOTO_TIMEOUT_MS): Promise<void> {
  const response = await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: timeoutMs,
  });

  if (!response) {
    throw new Error('Pagina publica nao retornou resposta navegavel.');
  }

  if (!response.ok()) {
    throw new Error(`Pagina publica retornou status ${response.status()}.`);
  }
}

export async function waitForAnySelector(
  page: Page,
  selectors: string[],
  timeoutMs = DEFAULT_GOTO_TIMEOUT_MS,
): Promise<string | null> {
  for (const selector of selectors) {
    try {
      await page.locator(selector).first().waitFor({ state: 'attached', timeout: timeoutMs });
      return selector;
    } catch {
      continue;
    }
  }

  return null;
}

export async function extractTextFromLocator(locator: Locator): Promise<string | null> {
  const text = await locator.textContent();

  return normalizePageText(text);
}

export async function extractLinksFromPage(page: Page): Promise<string[]> {
  const links = await page.locator('a[href]').evaluateAll((elements) =>
    elements
      .map((element) => element.getAttribute('href'))
      .filter((href): href is string => Boolean(href?.trim())),
  );

  const uniqueLinks = new Set<string>();

  for (const href of links) {
    if (href.startsWith('#') || href.toLowerCase().startsWith('javascript:')) {
      continue;
    }

    try {
      uniqueLinks.add(new URL(href, page.url()).toString());
    } catch {
      uniqueLinks.add(href);
    }
  }

  return [...uniqueLinks];
}

export function normalizePageText(text?: string | null): string | null {
  const normalized = text?.replace(/\s+/g, ' ').trim();

  return normalized || null;
}
