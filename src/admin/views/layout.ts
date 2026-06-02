import { escapeHtml } from '../helpers';
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
              <a href="/admin/settings/collection">Coleta automatica</a>
              <a href="/admin/settings/schedule">Configuracao de envio</a>
            </nav>
          </div>
        </header>
        <main>${content}</main>
        ${renderLiveEventsPanel()}
        ${renderAdminScripts()}
      </body>
    </html>
  `;
}

function renderLiveEventsPanel(): string {
  return `
    <section class="live-events" aria-live="polite" aria-label="Atividades recentes" data-live-events hidden>
      <div class="live-events-header">
        <div>
          <span>Atividades</span>
          <strong>Coletas e envios</strong>
        </div>
        <button type="button" class="notification-close" aria-label="Limpar atividades" data-live-events-clear>&times;</button>
      </div>
      <ol data-live-events-list></ol>
    </section>
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

        const liveEvents = document.querySelector('[data-live-events]');
        const liveEventsList = document.querySelector('[data-live-events-list]');
        const liveEventsClear = document.querySelector('[data-live-events-clear]');
        const eventLabels = {
          collection: 'Coleta',
          publish: 'Envio',
          system: 'Sistema',
        };
        const statusLabels = {
          started: 'Iniciado',
          progress: 'Atualizacao',
          success: 'Concluido',
          warning: 'Atencao',
          error: 'Erro',
          skipped: 'Ignorado',
        };

        const showLiveEvent = (event) => {
          if (!liveEvents || !liveEventsList || !event?.message) {
            return;
          }

          liveEvents.hidden = false;

          const item = document.createElement('li');
          item.className = 'live-event live-event-' + (event.status || 'progress');

          const meta = document.createElement('span');
          meta.className = 'live-event-meta';
          meta.textContent = (eventLabels[event.type] || 'Evento') + ' - ' + (statusLabels[event.status] || 'Atualizacao');

          const title = document.createElement('strong');
          title.textContent = event.title || 'Atualizacao';

          const message = document.createElement('p');
          message.textContent = event.message;

          const time = document.createElement('time');
          time.dateTime = event.createdAt || new Date().toISOString();
          time.textContent = new Intl.DateTimeFormat('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }).format(event.createdAt ? new Date(event.createdAt) : new Date());

          item.appendChild(meta);
          item.appendChild(title);
          item.appendChild(message);
          item.appendChild(time);
          liveEventsList.prepend(item);

          while (liveEventsList.children.length > 8) {
            liveEventsList.lastElementChild?.remove();
          }
        };

        liveEventsClear?.addEventListener('click', () => {
          liveEventsList?.replaceChildren();
          if (liveEvents) {
            liveEvents.hidden = true;
          }
        });

        if ('EventSource' in window) {
          const events = new EventSource('/admin/events');

          events.onmessage = (message) => {
            try {
              showLiveEvent(JSON.parse(message.data));
            } catch {
              // Ignora mensagens incompletas de conexao.
            }
          };
        }
      })();
    </script>
  `;
}
