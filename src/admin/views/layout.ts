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
        ${renderAdminScripts()}
      </body>
    </html>
  `;
}

function renderAdminScripts(): string {
  return `
    <script>
      (() => {
        const hideNotification = (notification) => {
          notification.classList.add('notification-hiding');
          window.setTimeout(() => notification.remove(), 180);
        };

        document.querySelectorAll('[data-notification]').forEach((notification) => {
          const closeButton = notification.querySelector('[data-notification-close]');
          const autoHideMs = Number(notification.getAttribute('data-autohide-ms') ?? '0');

          closeButton?.addEventListener('click', () => hideNotification(notification));

          if (autoHideMs > 0) {
            window.setTimeout(() => hideNotification(notification), autoHideMs);
          }
        });

        document.querySelectorAll('form').forEach((form) => {
          form.addEventListener('submit', (event) => {
            const submitter = event.submitter;

            if (!(submitter instanceof HTMLButtonElement)) {
              return;
            }

            const loadingLabel = submitter.getAttribute('data-loading-label');

            if (loadingLabel) {
              submitter.textContent = loadingLabel;
            }

            submitter.disabled = true;
            submitter.classList.add('is-loading');
          });
        });
      })();
    </script>
  `;
}
