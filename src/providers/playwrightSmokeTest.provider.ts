import { withBrowserPage } from '../scraping/browser/browserClient';
import { extractLinksFromPage, normalizePageText } from '../scraping/browser/pageUtils';
import type { BrowserScrapingConfig } from '../scraping/browser/types';
import type { JobSourceProvider, ProviderCollectResult } from './types';

const DEFAULT_SMOKE_TEST_URL = 'https://example.com/';

export const playwrightSmokeTestProvider: JobSourceProvider = {
  name: 'playwright-smoke-test',
  async collect(): Promise<ProviderCollectResult> {
    const startedAt = new Date();
    const config: BrowserScrapingConfig = {
      sourceName: 'playwright-smoke-test',
      url: process.env.PLAYWRIGHT_SMOKE_TEST_URL ?? DEFAULT_SMOKE_TEST_URL,
      isPublicPage: true,
      headless: true,
      timeoutMs: 20_000,
    };

    try {
      const result = await withBrowserPage(config, async (page) => {
        const title = normalizePageText(await page.title());
        const bodyText = normalizePageText(await page.locator('body').textContent());
        const links = await extractLinksFromPage(page);

        return {
          title,
          bodyText,
          links,
        };
      });

      const finishedAt = new Date();

      return {
        jobs: [],
        repositorySummaries: [
          {
            source: `${config.sourceName}:${result.title ?? config.url}`,
            totalIssuesRead: 1,
            ignoredByDate: 0,
            ignoredBySeniority: 0,
            ignoredByMissingEntryLevel: 0,
            ignoredByLocation: 0,
            ignoredByQuality: 0,
            ignoredDuplicates: 0,
            possibleDuplicates: 0,
            created: 0,
            errors: 0,
          },
        ],
        errors: result.bodyText
          ? undefined
          : [
              {
                provider: config.sourceName,
                message: `Pagina publica abriu, mas nao retornou texto util. Links encontrados: ${result.links.length}. Finalizado em ${finishedAt.toISOString()}.`,
              },
            ],
      };
    } catch (error) {
      return {
        jobs: [],
        errors: [
          {
            provider: config.sourceName,
            message: error instanceof Error ? error.message : 'Erro desconhecido no smoke test Playwright.',
          },
        ],
      };
    }
  },
};
