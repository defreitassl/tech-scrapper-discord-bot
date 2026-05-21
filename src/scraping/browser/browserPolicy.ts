import type { BrowserPolicyDecision, BrowserScrapingConfig } from './types';

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^::1$/,
];

export function validateBrowserScrapingConfig(config: BrowserScrapingConfig): BrowserPolicyDecision {
  const urlDecision = validatePublicUrl(config.url);

  if (!urlDecision.allowed) {
    return urlDecision;
  }

  if (!config.isPublicPage) {
    return {
      allowed: false,
      reason: 'Fonte bloqueada porque nao foi marcada como pagina publica.',
    };
  }

  if (config.requiresLogin) {
    return {
      allowed: false,
      reason: 'Fonte bloqueada porque exige login ou autenticacao.',
    };
  }

  if (config.hasCaptcha) {
    return {
      allowed: false,
      reason: 'Fonte bloqueada porque possui captcha.',
    };
  }

  if (config.requiresBypass) {
    return {
      allowed: false,
      reason: 'Fonte bloqueada porque exigiria bypass de bloqueio tecnico.',
    };
  }

  if (config.usesCredentials) {
    return {
      allowed: false,
      reason: 'Fonte bloqueada porque tentaria usar credenciais.',
    };
  }

  if (config.usesCustomCookies) {
    return {
      allowed: false,
      reason: 'Fonte bloqueada porque tentaria usar cookies customizados.',
    };
  }

  if (config.usesProxy) {
    return {
      allowed: false,
      reason: 'Fonte bloqueada porque tentaria usar proxy.',
    };
  }

  if (config.usesIpRotation) {
    return {
      allowed: false,
      reason: 'Fonte bloqueada porque tentaria usar rotacao de IP.',
    };
  }

  return {
    allowed: true,
    reason: 'Browser permitido para pagina publica sem login, captcha, credenciais, proxy ou bypass.',
  };
}

export function assertBrowserScrapingAllowed(config: BrowserScrapingConfig): void {
  const decision = validateBrowserScrapingConfig(config);

  if (!decision.allowed) {
    throw new Error(decision.reason);
  }
}

function validatePublicUrl(rawUrl: string): BrowserPolicyDecision {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    return {
      allowed: false,
      reason: 'Fonte bloqueada porque a URL e invalida.',
    };
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return {
      allowed: false,
      reason: 'Fonte bloqueada porque a URL nao usa HTTP publico.',
    };
  }

  if (PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(url.hostname))) {
    return {
      allowed: false,
      reason: 'Fonte bloqueada porque a URL aponta para host local ou privado.',
    };
  }

  return {
    allowed: true,
    reason: 'URL publica permitida.',
  };
}
