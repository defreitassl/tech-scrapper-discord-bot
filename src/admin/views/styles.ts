export const adminStyles = `
          :root {
            color-scheme: light;
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            color: #172033;
            background: #eef3f8;
            --bg: #eef3f8;
            --surface: #ffffff;
            --surface-soft: #f8fafc;
            --border: #dbe4ee;
            --border-strong: #b8c7d9;
            --text-muted: #64748b;
            --text-soft: #8291a5;
            --brand: #0f766e;
            --brand-dark: #115e59;
            --brand-soft: #ccfbf1;
            --danger: #b91c1c;
            --shadow: 0 20px 45px rgba(15, 23, 42, 0.08);
          }

          body {
            margin: 0;
            min-height: 100vh;
            background:
              radial-gradient(circle at top left, rgba(20, 184, 166, 0.14), transparent 32rem),
              linear-gradient(180deg, #f8fbfd 0%, var(--bg) 52%, #e8eef5 100%);
          }

          main {
            max-width: 1180px;
            margin: 0 auto;
            padding: 32px 20px 48px;
          }

          h1 {
            margin: 0;
            font-size: clamp(28px, 4vw, 40px);
            line-height: 1.08;
            letter-spacing: 0;
            color: #0f172a;
          }

          h2 {
            margin: 0;
            font-size: 18px;
            line-height: 1.3;
            color: #172033;
          }

          h3 {
            margin: 0;
            font-size: 15px;
            line-height: 1.3;
            color: #172033;
          }

          a {
            color: var(--brand);
            font-weight: 650;
            text-decoration-thickness: 1px;
            text-underline-offset: 3px;
          }

          table {
            width: 100%;
            min-width: 920px;
            border-collapse: collapse;
            background: var(--surface);
          }

          th,
          td {
            padding: 16px;
            border-bottom: 1px solid var(--border);
            text-align: left;
            vertical-align: middle;
          }

          th {
            font-size: 12px;
            color: #526176;
            background: #f5f8fb;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            white-space: nowrap;
          }

          tbody tr:hover {
            background: #fbfdff;
          }

          input,
          textarea,
          select {
            box-sizing: border-box;
            width: 100%;
            margin-top: 6px;
            padding: 11px 12px;
            border: 1px solid var(--border-strong);
            border-radius: 6px;
            font: inherit;
            color: #172033;
            background: #ffffff;
            outline: none;
            transition: border-color 0.15s ease, box-shadow 0.15s ease;
          }

          input:focus,
          textarea:focus,
          select:focus {
            border-color: var(--brand);
            box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.14);
          }

          textarea {
            resize: vertical;
            line-height: 1.55;
          }

          button,
          .button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: 38px;
            padding: 9px 14px;
            border: 1px solid var(--brand);
            border-radius: 6px;
            font: inherit;
            font-weight: 700;
            color: #ffffff;
            background: var(--brand);
            text-decoration: none;
            cursor: pointer;
            white-space: nowrap;
            transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
          }

          button:hover,
          .button:hover {
            background: var(--brand-dark);
            border-color: var(--brand-dark);
            box-shadow: 0 8px 18px rgba(15, 118, 110, 0.18);
          }

          button.secondary,
          .button.secondary {
            color: #334155;
            border-color: var(--border-strong);
            background: #ffffff;
          }

          button.secondary:hover,
          .button.secondary:hover {
            color: #172033;
            border-color: #94a3b8;
            background: #f8fafc;
            box-shadow: none;
          }

          button:disabled,
          button.is-loading {
            cursor: wait;
            opacity: 0.72;
            transform: none;
            box-shadow: none;
          }

          .primary-action {
            background: #f59e0b;
            border-color: #d97706;
            color: #231704;
          }

          .primary-action:hover {
            background: #d97706;
            border-color: #b45309;
            color: #ffffff;
          }

          dl {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
            margin: 18px 0 0;
          }

          dt {
            margin: 0 0 4px;
            font-size: 12px;
            font-weight: 750;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.04em;
          }

          dd {
            margin: 0;
            color: #172033;
            overflow-wrap: anywhere;
          }

          pre {
            white-space: pre-wrap;
            margin: 14px 0 0;
            padding: 16px;
            overflow: auto;
            border: 1px solid var(--border);
            border-radius: 6px;
            color: #27364a;
            background: #f8fafc;
            line-height: 1.55;
            font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
            font-size: 13px;
          }

          .topbar {
            border-bottom: 1px solid rgba(148, 163, 184, 0.26);
            background: rgba(255, 255, 255, 0.82);
            backdrop-filter: blur(16px);
          }

          .topbar-inner {
            display: flex;
            align-items: center;
            justify-content: space-between;
            max-width: 1180px;
            margin: 0 auto;
            padding: 14px 20px;
          }

          .brand {
            display: flex;
            align-items: center;
            gap: 10px;
            color: #0f172a;
            font-weight: 800;
          }

          .brand-mark {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 34px;
            height: 34px;
            border-radius: 8px;
            color: #ffffff;
            background: linear-gradient(135deg, #0f766e, #2563eb);
            box-shadow: 0 10px 22px rgba(37, 99, 235, 0.18);
          }

          .topbar a {
            color: var(--text-muted);
            font-size: 14px;
            text-decoration: none;
          }

          .topbar nav {
            display: flex;
            align-items: center;
            gap: 14px;
          }

          .page-heading {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            margin-bottom: 24px;
          }

          .actions {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
          }

          .actions form {
            margin: 0;
          }

          .eyebrow {
            margin: 0 0 8px;
            color: var(--brand);
            font-size: 12px;
            font-weight: 800;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          .subtitle {
            max-width: 680px;
            margin: 10px 0 0;
            color: var(--text-muted);
            line-height: 1.55;
          }

          .collection-note {
            margin: -12px 0 18px;
            color: var(--text-muted);
            font-size: 13px;
            line-height: 1.45;
          }

          .card {
            padding: 22px;
            border: 1px solid var(--border);
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.94);
            box-shadow: var(--shadow);
          }

          .table-card {
            padding: 0;
            overflow: hidden;
          }

          .jobs-sections {
            display: grid;
            gap: 18px;
          }

          .jobs-section {
            box-shadow: 0 14px 32px rgba(15, 23, 42, 0.07);
          }

          .jobs-section-heading p {
            margin: 6px 0 0;
            color: var(--text-muted);
            font-size: 13px;
            line-height: 1.45;
          }

          .count-pill {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 32px;
            padding: 4px 10px;
            border: 1px solid var(--border);
            border-radius: 999px;
            color: #334155;
            background: var(--surface-soft);
          }

          .section-limit-note,
          .jobs-total {
            margin: 0;
            color: var(--text-muted);
            font-size: 13px;
            line-height: 1.45;
          }

          .section-limit-note {
            padding: 12px 20px;
            border-top: 1px solid var(--border);
            background: var(--surface-soft);
          }

          .jobs-total {
            margin-top: 14px;
          }

          .settings-summary,
          .schedule-queue {
            margin-bottom: 18px;
          }

          .section-heading {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 18px 20px;
            border-bottom: 1px solid var(--border);
          }

          .section-heading span {
            color: var(--text-muted);
            font-size: 13px;
            font-weight: 650;
          }

          .table-wrap {
            overflow-x: auto;
          }

          .review-queue {
            display: grid;
            gap: 12px;
            padding: 16px;
            background: #f8fafc;
          }

          .review-card {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 18px;
            padding: 18px;
            border: 1px solid var(--border);
            border-radius: 8px;
            background: #ffffff;
          }

          .review-card-main {
            min-width: 0;
          }

          .review-card-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 14px;
          }

          .review-title {
            font-size: 17px;
            line-height: 1.3;
          }

          .review-company {
            margin: 5px 0 0;
            color: #334155;
            font-weight: 650;
          }

          .source-pill {
            display: inline-flex;
            align-items: center;
            max-width: 220px;
            padding: 5px 9px;
            border: 1px solid #bae6fd;
            border-radius: 999px;
            color: #075985;
            background: #f0f9ff;
            font-size: 12px;
            font-weight: 800;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .review-meta-grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 8px;
            margin: 14px 0 0;
          }

          .review-meta-item {
            min-width: 0;
            padding: 10px;
            border: 1px solid var(--border);
            border-radius: 8px;
            background: var(--surface-soft);
          }

          .review-meta-item dd {
            font-size: 13px;
          }

          .review-stack-row {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            margin-top: 12px;
          }

          .review-label {
            flex: 0 0 auto;
            color: var(--text-muted);
            font-size: 12px;
            font-weight: 800;
            letter-spacing: 0.04em;
            text-transform: uppercase;
          }

          .review-stacks {
            color: #172033;
            line-height: 1.45;
          }

          .review-stacks.muted {
            color: var(--text-soft);
            font-style: italic;
          }

          .review-description {
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            margin: 12px 0 0;
            overflow: hidden;
            color: #475569;
            line-height: 1.5;
          }

          .review-original-link,
          .review-original-text {
            display: inline-block;
            margin-top: 12px;
            font-size: 13px;
          }

          .review-original-text {
            color: var(--text-soft);
            overflow-wrap: anywhere;
          }

          .review-actions {
            display: flex;
            flex-direction: column;
            align-items: stretch;
            gap: 8px;
            min-width: 136px;
          }

          .review-actions form,
          .review-actions button,
          .review-actions .button {
            width: 100%;
          }

          .review-empty {
            margin: 0;
          }

          .job-title {
            display: inline-block;
            color: #0f172a;
            font-weight: 800;
          }

          .job-meta {
            display: block;
            margin-top: 4px;
            color: var(--text-muted);
            font-size: 13px;
          }

          .date-cell {
            color: #475569;
            font-size: 13px;
            white-space: nowrap;
          }

          .job-form {
            display: grid;
            gap: 18px;
          }

          .form-section {
            padding: 22px;
            border: 1px solid var(--border);
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.94);
            box-shadow: var(--shadow);
          }

          .form-section-header {
            margin-bottom: 18px;
            padding-bottom: 16px;
            border-bottom: 1px solid var(--border);
          }

          .form-section-header p {
            margin: 6px 0 0;
            color: var(--text-muted);
            line-height: 1.5;
          }

          .form-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 16px;
          }

          .form-grid .wide,
          .form-actions {
            grid-column: 1 / -1;
          }

          label span,
          label {
            color: #26364b;
            font-weight: 700;
          }

          small {
            display: block;
            margin-top: 6px;
            color: var(--text-muted);
            font-size: 12px;
            font-weight: 500;
            line-height: 1.45;
          }

          .checkbox {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            padding: 14px;
            border: 1px solid var(--border);
            border-radius: 8px;
            background: var(--surface-soft);
          }

          .checkbox input {
            flex: 0 0 auto;
            width: auto;
            margin: 4px 0 0;
          }

          .checkbox strong {
            display: block;
            color: #172033;
          }

          .form-actions {
            display: flex;
            justify-content: flex-end;
          }

          .detail-item {
            padding: 14px;
            border: 1px solid var(--border);
            border-radius: 8px;
            background: var(--surface-soft);
          }

          .timezone-info {
            margin: 0;
          }

          .schedule-slots {
            padding: 14px;
            border: 1px solid var(--border);
            border-radius: 8px;
            background: var(--surface-soft);
          }

          .schedule-slots-header {
            margin-bottom: 12px;
          }

          .schedule-slots-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
          }

          .slot-summary {
            margin: 0;
            padding-left: 18px;
          }

          .slot-summary li + li {
            margin-top: 4px;
          }

          .text-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 18px;
            margin-top: 18px;
          }

          .preview-card {
            margin-top: 18px;
            border-color: rgba(15, 118, 110, 0.28);
            background: linear-gradient(180deg, #ffffff 0%, #f3fbfa 100%);
          }

          .preview-card .section-heading p {
            margin: 6px 0 0;
            color: var(--text-muted);
            font-size: 13px;
            line-height: 1.45;
          }

          .message-preview {
            border-color: rgba(15, 118, 110, 0.22);
            background: #ffffff;
          }

          .text-card {
            min-width: 0;
          }

          .empty-text p {
            margin: 14px 0 0;
            color: var(--text-muted);
          }

          .footer-actions {
            margin-top: 18px;
          }

          .status-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: 24px;
            padding: 3px 9px;
            border-radius: 6px;
            border: 1px solid transparent;
            font-size: 12px;
            font-weight: 800;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            white-space: nowrap;
          }

          .status-draft {
            color: #475569;
            border-color: #cbd5e1;
            background: #f1f5f9;
          }

          .status-pending {
            color: #92400e;
            border-color: #fed7aa;
            background: #fffbeb;
          }

          .status-sent {
            color: #166534;
            border-color: #bbf7d0;
            background: #f0fdf4;
          }

          .status-error {
            color: #991b1b;
            border-color: #fecaca;
            background: #fef2f2;
          }

          .status-archived {
            color: #e2e8f0;
            border-color: #334155;
            background: #334155;
          }

          .scheduler-active {
            color: #166534;
            border-color: #bbf7d0;
            background: #f0fdf4;
          }

          .scheduler-inactive {
            color: #475569;
            border-color: #cbd5e1;
            background: #f1f5f9;
          }

          .notification-stack {
            position: fixed;
            z-index: 20;
            top: 76px;
            right: 20px;
            display: grid;
            gap: 10px;
            width: min(420px, calc(100vw - 40px));
            pointer-events: none;
          }

          .notification {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 14px;
            padding: 14px 14px 14px 16px;
            border: 1px solid var(--border);
            border-left-width: 4px;
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.97);
            box-shadow: 0 18px 42px rgba(15, 23, 42, 0.14);
            pointer-events: auto;
            transition: opacity 0.18s ease, transform 0.18s ease;
          }

          .notification-hiding {
            opacity: 0;
            transform: translateY(-6px);
          }

          .notification-content {
            min-width: 0;
          }

          .notification-label {
            display: block;
            margin-bottom: 3px;
            font-size: 11px;
            font-weight: 850;
            letter-spacing: 0.06em;
            text-transform: uppercase;
          }

          .notification p {
            margin: 0;
            color: #26364b;
            line-height: 1.45;
          }

          .notification-close {
            flex: 0 0 auto;
            min-height: 28px;
            width: 28px;
            padding: 0;
            border: 1px solid transparent;
            border-radius: 6px;
            color: #475569;
            background: transparent;
            font-size: 18px;
            line-height: 1;
            box-shadow: none;
          }

          .notification-close:hover {
            color: #172033;
            border-color: var(--border);
            background: #f8fafc;
            box-shadow: none;
          }

          .notification-success {
            border-left-color: #16a34a;
          }

          .notification-success .notification-label {
            color: #166534;
          }

          .notification-error {
            border-left-color: #dc2626;
          }

          .notification-error .notification-label {
            color: #991b1b;
          }

          .notification-warning {
            border-left-color: #f59e0b;
          }

          .notification-warning .notification-label {
            color: #92400e;
          }

          .notification-info {
            border-left-color: #2563eb;
          }

          .notification-info .notification-label {
            color: #1d4ed8;
          }

          .notification-loading {
            border-left-color: #64748b;
          }

          .notification-loading .notification-label {
            color: #475569;
          }

          .error,
          .notice {
            padding: 14px 16px;
            border-radius: 8px;
            font-weight: 650;
          }

          .error {
            border: 1px solid #fecaca;
            color: var(--danger);
            background: #fef2f2;
          }

          .notice {
            border: 1px solid #bbf7d0;
            color: #166534;
            background: #f0fdf4;
          }

          .empty {
            padding: 34px 16px;
            color: var(--text-muted);
            text-align: center;
          }

          @media (max-width: 760px) {
            main {
              padding: 22px 14px 36px;
            }

            .topbar-inner {
              padding: 12px 14px;
            }

            .notification-stack {
              top: 68px;
              right: 14px;
              width: calc(100vw - 28px);
            }

            .page-heading,
            .form-grid,
            .schedule-slots-grid,
            .text-grid,
            dl {
              display: block;
            }

            .page-heading .actions {
              margin-top: 16px;
            }

            .actions,
            .actions form,
            .actions button,
            .actions .button,
            .form-actions button {
              width: 100%;
            }

            .form-section,
            .card {
              padding: 16px;
            }

            .table-card {
              padding: 0;
            }

            .jobs-sections {
              gap: 14px;
            }

            .review-card,
            .review-card-header {
              display: flex;
              flex-direction: column;
            }

            .review-meta-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }

            .review-actions {
              width: 100%;
            }

            .form-grid label,
            .form-grid .checkbox,
            .schedule-slots-grid label,
            .text-card,
            .detail-item {
              margin-top: 14px;
            }

            .section-heading {
              align-items: flex-start;
              flex-direction: column;
              padding: 16px;
            }
          }
`;
