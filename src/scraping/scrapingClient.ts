const DEFAULT_TIMEOUT_MS = 15_000;
const USER_AGENT = 'tech-scrapper-discord-bot/0.1 (+public job source research; no login; no bypass)';

export async function fetchPublicHtml(url: string): Promise<string> {
  const response = await fetchPublic(url, {
    Accept: 'text/html,application/xhtml+xml',
  });

  return response.text();
}

export async function fetchPublicJson<T = unknown>(url: string): Promise<T> {
  const response = await fetchPublic(url, {
    Accept: 'application/json',
  });

  return (await response.json()) as T;
}

async function fetchPublic(url: string, headers: Record<string, string>): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        ...headers,
        'User-Agent': USER_AGENT,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Fonte publica retornou status ${response.status}.`);
    }

    return response;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Timeout ao consultar fonte publica apos ${DEFAULT_TIMEOUT_MS}ms.`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
