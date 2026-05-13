# Handoff para Codex

## Resumo curto

O `tech-scrapper-discord-bot` e um bot/painel para cadastrar, organizar e publicar vagas de tecnologia para iniciantes no Discord da Projeto Desenvolve.

Apesar do nome mencionar scraper, o projeto ainda nao implementa scraping. O estado atual e um painel admin manual com publicacao controlada para Discord.

## Stack

- Node.js + TypeScript.
- Express.
- Prisma + PostgreSQL.
- Discord.js.
- Google AI Studio/Gemini.

## Regras de negocio atuais

- Vagas sao armazenadas como `JobPost`.
- O painel permite criar, listar, ver detalhes, editar, gerar mensagem com IA, aprovar para envio e arquivar.
- A interface chama `DRAFT` de `Rascunho`, `PENDING` de `Pronta para envio`, `SENT` de `Enviada`, `ERROR` de `Erro` e `ARCHIVED` de `Arquivada`. O enum do banco nao muda.
- Novas vagas manuais entram como `PENDING` por padrao e `useAi` vem marcado por padrao no formulario.
- No cadastro manual, antes de criar a vaga, `src/services/jobDeduplication.ts` verifica duplicata forte por URL normalizada. Se encontrar, nao cria nova vaga, nao chama IA e redireciona para a vaga existente com toast de aviso.
- Se nao houver URL duplicada, mas existir vaga com mesmo titulo e empresa normalizados, o cadastro continua normalmente e o painel mostra aviso de possivel duplicata.
- No cadastro manual, quando nao ha `readyText` e `useAi` esta ativo, o painel tenta gerar `aiGeneratedText` automaticamente. Falha de IA nao bloqueia o cadastro.
- Para aprovar para envio, a vaga precisa ter dados suficientes para template, `readyText`, `aiGeneratedText` valido ou URL preenchida.
- A pagina de detalhes mostra preview da mensagem sem chamar IA automaticamente.
- A acao manual `Regenerar mensagem com IA` chama Gemini, salva em `aiGeneratedText` e nao envia a vaga ao Discord.
- A pagina de detalhes tem `Enviar esta vaga agora`, que reutiliza a mesma resolucao de mensagem do envio em lote, marca sucesso como `SENT` com `sentAt` e falha como `ERROR`.
- O envio individual nao reenvia vagas `SENT` e nao publica vagas `ARCHIVED`.
- O envio manual busca ate 5 vagas `PENDING` por vez.
- O envio agendado e configurado em `/admin/settings/schedule` e salvo em `SchedulerSettings`, nao em `.env`.
- A tela `/admin/settings/schedule` mostra resumo operacional do agendamento: ativo/inativo, limite diario, enviadas hoje, restante do dia, timezone do sistema, slots configurados e proximas vagas `PENDING`.
- O timezone nao e editavel no painel; o backend sempre usa e persiste `America/Sao_Paulo`.
- O admin escolhe de 1 a 10 vagas por dia e um horario para cada vaga. Cada horario representa 1 slot; horarios duplicados enviam mais de uma vaga no mesmo horario.
- O scheduler roda junto com `npm run admin`, agrupa horarios repetidos, registra um cron por horario unico e so envia vagas `PENDING`.
- Em cada horario, o scheduler envia ate o menor valor entre slots daquele horario e limite restante do dia.
- O limite diario do scheduler considera vagas `SENT` com `sentAt` no dia atual do timezone configurado. O envio manual continua existindo e nao e bloqueado por esse limite.
- As consultas operacionais do agendamento ficam em `src/services/schedulerOperations.ts`; reutilize esse servico para evitar duplicar calculo de dia por timezone ou limite restante.
- Ordem de resolucao da mensagem:
  1. `readyText`.
  2. `aiGeneratedText` valido.
  3. IA, se `useAi` estiver habilitado.
  4. Template padrao.
- Vaga enviada com sucesso vira `SENT` e recebe `sentAt`.
- Falha no envio marca a vaga como `ERROR`.
- Vagas arquivadas usam status `ARCHIVED`.

## Organizacao do painel admin

- `src/admin/server.ts` e apenas o ponto de entrada: configura Express, registra routers, redireciona `/` para `/admin/jobs`, inicia o servidor e inicia o `scheduledPublisher`.
- Rotas de vagas ficam em `src/admin/routes/jobs.routes.ts`; rotas de envio agendado ficam em `src/admin/routes/schedule.routes.ts`.
- Views server-rendered ficam em `src/admin/views/`: `jobs.views.ts`, `schedule.views.ts`, `layout.ts`, `components.ts` e `styles.ts`.
- Helpers puros ficam em `src/admin/helpers/`: `forms.ts`, `validators.ts`, `status.ts`, `formatters.ts` e `notifications.ts`.
- Views e helpers nao devem acessar Prisma diretamente. Rotas podem chamar Prisma e services.
- Feedback operacional do painel usa notificacoes temporarias renderizadas no HTML via query params `message` e `noticeType`. Nao existe tela de logs nem persistencia em banco para essas notificacoes.
- A deduplicacao fica em `src/services/jobDeduplication.ts` para reuso futuro por providers. Nao ha unique constraint nem migration nesta etapa.

## Proximos passos recomendados

- Manter o painel simples e server-rendered em Express ate haver necessidade real de frontend separado.
- Implementar providers apenas depois de definir contrato e estrategia.
- Comecar por uma fonte simples e publica.
- Salvar coletas automaticas como `DRAFT`.
- Reutilizar `jobDeduplication` nos providers antes de criar vagas automaticamente.
- Adicionar autenticacao simples antes de expor o painel fora de ambiente local/confiavel.
- Se mexer no agendamento, preserve o reaproveitamento de `publishPendingJobs` e evite duplicar a logica de envio.

## Decisoes importantes ja tomadas

- Nao adicionar React, Tailwind ou frontend separado nesta fase.
- Nao publicar automaticamente vagas coletadas sem revisao.
- Nao depender exclusivamente de scraping.
- Preferir APIs, RSS, listas publicas e HTML simples antes de Playwright.
- Evitar login, captcha, paywalls e circunvencao de bloqueios.
- Manter mensagens de Discord curtas, formatadas e uteis para alunos iniciantes.
- Usar IA como apoio, nao como dependencia obrigatoria.
- Configurar horarios e limite diario de envio pelo banco/painel, nao por `.env`.
