import { escapeHtml } from '../helpers/formatters';
import { adminStyles } from './styles';

export function renderLayout(title: string, content: string): string {
  return `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${escapeHtml(title)} - discord-jobs-bot</title>
        <style>
${adminStyles}
        </style>
      </head>
      <body>
        <header class="topbar">
          <div class="topbar-inner">
            <div class="brand">
              <span class="brand-mark">PD</span>
              <span>Projeto Desenvolve Jobs</span>
            </div>
            <nav>
              <a href="/admin/jobs">Vagas</a>
              <a href="/admin/settings/schedule">Configuracoes de envio</a>
            </nav>
          </div>
        </header>
        <main>${content}</main>
      </body>
    </html>
  `;
}
