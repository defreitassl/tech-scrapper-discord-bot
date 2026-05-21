# Handoff para Codex

## Resumo curto

O `tech-scrapper-discord-bot` e um bot/painel para cadastrar, organizar e publicar vagas de tecnologia para iniciantes no Discord da Projeto Desenvolve.

Apesar do nome mencionar scraper, o projeto nao faz scraping HTML nesta etapa. O estado atual e um painel admin manual com publicacao controlada para Discord, um provider real via API publica do GitHub, providers externos via APIs JSON publicas e providers manuais para ATS publicos via JSON.

Existe uma base de providers em `src/providers/`, com provider mock/de teste, provider GitHub para issues publicas de repositorios de vagas, providers externos para Himalayas, Jobicy, RemoteOK e Remotive, e providers ATS para Greenhouse, Lever e Ashby.

Tambem existe uma camada inicial em `src/scraping/` para preparar futuras fontes publicas mais dificeis. Ela ainda nao esta conectada ao `providerRunner`, nao cria provider novo, nao usa Cheerio/Playwright e nao altera fluxo do admin. A intencao e isolar tipos, politica de permissao, helpers HTML e cliente publico simples antes de qualquer scraper real.

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
- Vagas coletadas por providers entram sempre como `DRAFT`, com `useAi = false`, sem chamar Gemini/IA e sem publicar no Discord.
- A coleta automatica diaria tambem segue essa regra: apenas cria `DRAFT`, sem IA, sem `PENDING` e sem Discord.
- Vagas coletadas revisadas podem ser preparadas manualmente com `Preparar e colocar na fila`, que chama Gemini, salva `aiGeneratedText`, marca `useAi = true` e muda para `PENDING` somente em caso de sucesso.
- Se a preparacao com IA falhar, a vaga nao entra na fila. Vagas `SENT` ou `ARCHIVED` nao sao preparadas.
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
- O servidor admin tambem inicia `scheduledCollector`, que agenda a coleta automatica diaria de providers reais.
- Rotas de vagas ficam em `src/admin/routes/jobs.routes.ts`; rotas de envio agendado ficam em `src/admin/routes/schedule.routes.ts`.
- Views server-rendered ficam em `src/admin/views/`: `jobs.views.ts`, `schedule.views.ts`, `layout.ts`, `components.ts` e `styles.ts`.
- Helpers puros ficam em `src/admin/helpers/`: `forms.ts`, `validators.ts`, `status.ts`, `formatters.ts` e `notifications.ts`.
- Views e helpers nao devem acessar Prisma diretamente. Rotas podem chamar Prisma e services.
- Feedback operacional do painel usa notificacoes temporarias renderizadas no HTML via query params `message` e `noticeType`. Nao existe tela de logs nem persistencia em banco para essas notificacoes.
- O resumo visual de coletas fica em `src/admin/helpers/providerSummary.ts`. Ele monta toasts compactos por fonte/provider usando `repositorySummaries`, exibindo vagas criadas e erros quando existirem. Detalhes completos de filtros, duplicatas e rejeicoes continuam no terminal.
- A deduplicacao fica em `src/services/jobDeduplication.ts` para reuso futuro por providers. Nao ha unique constraint nem migration nesta etapa.
- O filtro de qualidade de providers fica em `src/services/jobQualityFilter.ts`; ele e deterministico, nao usa IA e rejeita coletas antes do banco quando faltam dados essenciais, falta canal claro de candidatura (URL ou e-mail no texto), ha senioridade/experiencia alta ou a vaga parece fora de tecnologia.
- A listagem de vagas possui a acao `Coletar vagas de teste`, que chama `POST /admin/jobs/collect` e executa `runJobProviders([mockJobsProvider])`.
- A listagem tambem possui a acao `Coletar vagas do GitHub`, que chama `POST /admin/jobs/collect-github` e executa apenas `githubJobsProvider` pelo lock de `runRealJobCollection`.
- A listagem possui a acao `Coletar fontes externas`, que chama `POST /admin/jobs/collect-external` e executa `externalJobProviders` pelo mesmo lock.
- A listagem possui a acao `Coletar ATS publicos`, que chama `POST /admin/jobs/collect-ats` e executa `atsJobProviders` pelo mesmo lock. Esta coleta e manual nesta etapa.
- A listagem `/admin/jobs` e organizada por secoes visuais: `Para revisar` funciona como fila de curadoria de vagas `DRAFT`, principalmente coletadas por providers. Essa secao usa cards com titulo, empresa, fonte, localizacao, modalidade, nivel, stacks, resumo curto, link original quando existir e data de criacao/coleta; as acoes principais sao `Preparar`, `Ver detalhes` e `Arquivar`. `Prontas para envio` mostra `PENDING` com acao principal `Enviar agora`; `Historico recente` mostra `SENT` e `ERROR` recentes; `Arquivadas` mostra `ARCHIVED` no final com limite visual simples. Isso nao altera rotas nem regras de negocio.
- Os detalhes exibem `Preparar e colocar na fila` para vagas `DRAFT` ou `PENDING`.

## Providers de coleta

- O contrato fica em `src/providers/types.ts`.
- A normalizacao fica em `src/providers/normalizeCollectedJob.ts`.
- Providers ativos ficam em `src/providers/providerRegistry.ts`.
- `providerRegistry.ts` separa `testJobProviders` de `realJobProviders`. O mock fica apenas nos providers de teste; a coleta automatica usa somente providers reais.
- O provider mock e `src/providers/mockJobs.provider.ts`.
- O provider GitHub e `src/providers/githubJobs.provider.ts`.
- Os providers externos sao `src/providers/himalayas.provider.ts`, `src/providers/jobicy.provider.ts`, `src/providers/remoteOk.provider.ts` e `src/providers/remotive.provider.ts`.
- Os providers ATS sao `src/providers/greenhouse.provider.ts`, `src/providers/lever.provider.ts` e `src/providers/ashby.provider.ts`.
- A lista controlada de empresas-alvo ATS fica em `src/providers/companyTargets.ts`. A lista inicial e GitLab no Greenhouse (`gitlab`), Kepler Communications no Lever (`kepler`) e Ashby no Ashby (`ashby`).
- Helpers compartilhados para providers externos ficam em `providerTextUtils.ts`, `providerDateUtils.ts`, `providerSeniorityUtils.ts`, `providerLocationUtils.ts`, `providerSalaryUtils.ts` e `providerSummaryUtils.ts`.
- Helpers especificos da primeira leva ATS ficam em `src/providers/atsProviderUtils.ts` e tratam politica publica `api`, limpeza leve de HTML retornado nos JSONs, datas recentes e filtro conservador de localizacao.
- A camada preparatoria para scraping fica em `src/scraping/`: `types.ts`, `scrapingPolicy.ts`, `htmlUtils.ts` e `scrapingClient.ts`. Use-a para avaliar e buscar fontes publicas permitidas antes de criar providers novos.
- O runner central fica em `src/providers/providerRunner.ts`.
- O runner percorre os providers ativos, normaliza vagas, aplica `evaluateCollectedJobQuality`, reaproveita `checkJobDuplicate`, ignora duplicatas fortes por URL e cria as demais como `DRAFT`.
- Vagas rejeitadas por qualidade incrementam `ignoredByQuality` e geram log `Vaga coletada ignorada por filtro de qualidade` com `reasons` e `score`.
- Possiveis duplicatas por titulo + empresa sao contabilizadas, mas nao bloqueiam criacao.
- O runner tambem aceita resultado de provider com metadados, como `ignoredByLocation`, para exibir resumo operacional sem criar registros.
- O runner tambem propaga erros internos retornados por providers, como falhas de repositorio no GitHub provider.
- O diagnostico GitHub inclui `totalIssuesRead`, `ignoredByDate`, `ignoredBySeniority`, `ignoredByMissingEntryLevel`, `ignoredByLocation`, `ignoredByQuality`, `ignoredDuplicates`, `possibleDuplicates`, `created` e `repositoryErrors`.
- O toast da coleta GitHub mostra um resumo compacto e temporario. Quando houver vagas criadas, ele pode incluir ate tres fontes com mais vagas novas. Detalhes por repositorio sao logados no terminal em eventos `Resumo da coleta GitHub por repositorio`; nao ha tela de logs nem persistencia em banco.
- `providerRegistry.ts` registra `mockJobsProvider`, `githubJobsProvider`, `externalJobProviders`, `atsJobProviders` e `realJobProviders`. A coleta automatica roda apenas `realJobProviders`; a coleta externa manual roda Himalayas, Jobicy, RemoteOK e Remotive; a coleta ATS manual roda Greenhouse, Lever e Ashby.
- O provider GitHub usa issues abertas de `frontendbr/vagas`, `backend-br/vagas`, `react-brasil/vagas`, `qa-brasil/vagas`, `nodejsdevbr/vagas`, `dotnetdevbr/vagas`, `soujava/vagas-java`, `DevOps-Brasil/Vagas`, `programadores-br/geral`, `datascience-br/vagas`, `brasil-php/vagas`, `androiddevbr/vagas`, `CocoaHeadsBrasil/vagas` e `remotejobsbr/design-ux-vagas` pela API oficial do GitHub.
- Se um repositorio GitHub falhar, o provider loga o erro, adiciona erro ao resumo e continua nos demais repositorios.
- O provider GitHub usa `state=open`, `per_page=100` e `since` com data ISO de 30 dias atras, mas tambem filtra `created_at` manualmente porque `since` pode considerar atualizacao.
- Ele coleta apenas issues criadas nos ultimos 30 dias com labels de `junior`, `júnior`, `jr`, `estagio`, `estágio`, `estagiario`, `estagiário` ou `trainee`, incluindo labels compostas como `estágio remoto`; `trainee` e tratado como nivel de entrada.
- Ele ignora pull requests e labels de `pleno`, `senior`, `sênior`, `especialista`, `tech lead`, `lead`, `staff` e `principal`.
- Ele aceita vagas remotas de qualquer lugar, mas vagas hibridas/presenciais apenas quando localizacao ou corpo indicam Minas Gerais. Se a modalidade nao for clara, so aceita quando parecer Minas Gerais.
- Issues GitHub ignoradas pelo filtro geografico entram no resumo como `ignoredByLocation`.
- O provider GitHub tenta preencher `shortDescription` a partir de secoes do corpo da issue e `stacks` a partir de termos tecnicos conhecidos, sem chamar IA.
- `GITHUB_TOKEN` e opcional; quando configurado, aumenta o rate limit e e enviado como `Authorization: Bearer`.
- Nao ha scraping HTML real, Cheerio, Playwright, LinkedIn, Gupy, Solides ou fontes protegidas nesta etapa.
- A politica de scraping bloqueia fontes que exigem login, captcha, bypass anti-bot, credenciais pessoais, simulacao de usuario autenticado ou termos explicitamente incompativeis. Browser scraping so pode ser considerado como ultimo caso para pagina publica sem esses bloqueios.
- Himalayas usa `https://himalayas.app/jobs/api/search`; Jobicy usa `https://jobicy.com/api/v2/remote-jobs`; RemoteOK usa `https://remoteok.com/api`; Remotive usa `https://remotive.com/api/remote-jobs`.
- Os providers externos filtram vagas dos ultimos 30 dias, exigem sinal claro de nivel iniciante, rejeitam senioridade alta/intermediaria e aceitam apenas vagas remotas globais ou compativeis com Brasil/LATAM/Americas.
- O toast da coleta externa manual mostra totais compactos e um resumo por provider, por exemplo `Himalayas: 1 nova; Jobicy: 0; RemoteOK: 0; Remotive: 1`, sem criar tela, tabela ou persistencia de logs.
- Jobicy, RemoteOK e Remotive exigem atribuicao/linkback; preserve a URL original e o `source` ao revisar/publicar vagas coletadas.

## Providers ATS publicos

Os providers ATS usam somente endpoints JSON publicos e empresas-alvo cadastradas em `companyTargets.ts`:

- Greenhouse: `https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true`;
- Lever: `https://api.lever.co/v0/postings/{slug}?mode=json`;
- Ashby: `https://api.ashbyhq.com/posting-api/job-board/{slug}`.

Eles nao usam Playwright, Cheerio, login, cookies, credenciais pessoais, proxy, captcha, Cloudflare bypass ou qualquer bypass anti-bot. Tambem nao chamam Gemini, nao salvam direto no banco, nao mudam schema Prisma e nao publicam vagas.

Regras dos providers ATS:

- se um alvo falhar, registrar erro e continuar nos demais alvos;
- aceitar apenas vagas com data publicada/criada nos ultimos 30 dias quando a data existe;
- exigir sinal claro de entrada (`junior`, `jr`, `entry-level`, `intern`, `internship`, `estagio` ou `trainee`);
- rejeitar senioridade intermediaria/alta (`pleno`, `mid-level`, `senior`, `lead`, `staff`, `principal`, `manager`, `director`, `executive`, `head of`);
- aceitar remoto global/Brasil/LATAM/Americas ou sem restricao incompatível;
- aceitar hibrido/presencial somente em Minas Gerais;
- retornar `ProviderCollectResult` com `repositorySummaries` por alvo, para o runner completar qualidade, duplicidade e criacao.

A coleta ATS fica manual em `/admin/jobs/collect-ats`. Ela usa o mesmo lock de `runRealJobCollection`, cria apenas `DRAFT` via runner, com `useAi = false`, e nao entra na coleta automatica diaria por enquanto.

## Coleta automatica

- `src/services/scheduledCollector.ts` agenda a coleta automatica diaria as 08:00 em `America/Sao_Paulo`.
- Ela roda junto com `npm run admin`; se o painel admin nao estiver rodando, a coleta automatica nao executa.
- Usa `node-cron` e chama `runJobProviders(realJobProviders)`.
- Nao executa `mockJobsProvider` automaticamente.
- Nao executa `atsJobProviders` automaticamente nesta etapa.
- Usa lock simples em memoria (`isCollecting`) compartilhado com as rotas manuais GitHub e fontes externas por meio de `runRealJobCollection`.
- Se uma coleta ja estiver rodando, a nova tentativa e ignorada com log.
- Falhas sao logadas e nao derrubam o processo.
- Esse agendamento e separado do envio agendado de vagas `PENDING`.

## Proximos passos recomendados

- Manter o painel simples e server-rendered em Express ate haver necessidade real de frontend separado.
- Evoluir providers a partir da base mock atual.
- Comecar provider real por uma fonte simples e publica.
- Para fontes maiores, consultar `docs/scraping-engine-design.md` e `docs/scraping-platforms-research.md` antes de implementar. Priorize Greenhouse, Lever, Ashby, paginas publicas de carreiras e sites proprios simples quando houver API/RSS/endpoint JSON publico.
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
- Manter scraping dificil isolado da camada de providers e do painel admin ate haver fonte concreta e permitida.
- Manter mensagens de Discord curtas, formatadas e uteis para alunos iniciantes.
- Usar IA como apoio, nao como dependencia obrigatoria.
- Configurar horarios e limite diario de envio pelo banco/painel, nao por `.env`.
