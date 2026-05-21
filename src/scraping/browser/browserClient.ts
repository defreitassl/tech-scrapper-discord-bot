import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { assertBrowserScrapingAllowed } from './browserPolicy';
import { safeGoto } from './pageUtils';
import type { BrowserScrapingConfig } from './types';

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_USER_AGENT = 'tech-scrapper-discord-bot/0.1 (+public browser scraping; no login; no bypass)';

export type ManagedBrowserContext = {
  browser: Browser;
  context: BrowserContext;
};

export async function createBrowserContext(config: BrowserScrapingConfig): Promise<ManagedBrowserContext> {
  assertBrowserScrapingAllowed(config);

  const browser = await chromium.launch({
    headless: config.headless ?? true,
    timeout: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });

  const context = await browser.newContext({
    userAgent: config.userAgent ?? DEFAULT_USER_AGENT,
    ignoreHTTPSErrors: false,
  });

  context.setDefaultTimeout(config.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  context.setDefaultNavigationTimeout(config.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  return { browser, context };
}

export async function openPublicPage(
  url: string,
  options: {
    context: BrowserContext;
    timeoutMs?: number;
  },
): Promise<Page> {
  assertBrowserScrapingAllowed({
    sourceName: 'browser-open-public-page',
    url,
    isPublicPage: true,
  });

  const page = await options.context.newPage();
  await safeGoto(page, url, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  return page;
}

export async function closeBrowserContext(managedContext: ManagedBrowserContext): Promise<void> {
  await managedContext.context.close();
  await managedContext.browser.close();
}

export async function withBrowserPage<T>(
  config: BrowserScrapingConfig,
  callback: (page: Page) => Promise<T>,
): Promise<T> {
  const managedContext = await createBrowserContext(config);

  try {
    const page = await openPublicPage(config.url, {
      context: managedContext.context,
      timeoutMs: config.timeoutMs,
    });

    return await callback(page);
  } finally {
    await closeBrowserContext(managedContext);
  }
}
