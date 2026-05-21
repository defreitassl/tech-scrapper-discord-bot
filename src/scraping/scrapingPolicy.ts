import type { ScrapingSourceConfig } from './types';

export function isScrapingAllowed(config: ScrapingSourceConfig): boolean {
  return explainScrapingDecision(config).allowed;
}

export function explainScrapingDecision(config: ScrapingSourceConfig): {
  allowed: boolean;
  reason: string;
} {
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

  if (config.hasKnownBotProtection) {
    return {
      allowed: false,
      reason: 'Fonte bloqueada porque exigiria burlar protecao anti-bot ou bloqueio tecnico.',
    };
  }

  if (config.termsExplicitlyIncompatible) {
    return {
      allowed: false,
      reason: 'Fonte bloqueada porque os termos registrados sao explicitamente incompativeis.',
    };
  }

  if (config.strategy === 'browser') {
    return {
      allowed: true,
      reason: 'Browser permitido apenas para pagina publica sem login, captcha ou bloqueio conhecido.',
    };
  }

  return {
    allowed: true,
    reason: `Fonte permitida por usar estrategia publica ${config.strategy}.`,
  };
}
