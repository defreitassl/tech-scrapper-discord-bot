# Handoff para Codex

## Resumo curto

O `tech-scrapper-discord-bot` e um bot/painel para cadastrar, organizar e publicar vagas de tecnologia para iniciantes no Discord da Projeto Desenvolve.

Apesar do nome mencionar scraper, o projeto nao faz scraping HTML real de plataformas nesta etapa. O estado atual e um painel admin manual com publicacao controlada para Discord, um provider real via API publica do GitHub, providers externos via APIs JSON publicas, providers manuais para ATS publicos via JSON e uma base Playwright isolada para validar paginas publicas dinamicas no futuro.

Existe uma base de providers em `src/providers/`, com provider GitHub para issues publicas de repositorios de vagas, providers externos para Himalayas, Jobicy, RemoteOK e Remotive, provider Remotar por JSON publico, providers ATS para Greenhouse, Lever e Ashby, e providers experimentais manuais para Gupy e Programathor. O provider mock/teste foi removido do fluxo atual.

Tambem existe uma camada inicial em `src/scraping/` para preparar futuras fontes publicas mais dificeis. Ela ainda nao esta conectada ao `providerRunner` para scraping real e nao altera fluxo do admin. A intencao e isolar tipos, politica de permissao, helpers HTML, cliente publico simples e utilitarios Playwright antes de qualquer scraper real.

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
- Vagas coletadas por providers nao entram mais como `DRAFT`. Boas vagas geram IA e entram direto como `PENDING`; ruins, duplicadas ou com falha de IA nao sao persistidas.
- A coleta manual do painel usa um unico botao `Coletar vagas`, que chama `POST /admin/jobs/collect-all`, roda `manualCollectableJobProviders` e respeita o lock de coleta.
- A etapa de coleta automatica diaria usa o mesmo pipeline automatizado e nao envia ao Discord.
- O filtro de dominio fica em `src/services/jobDomainClassifier.ts` e classifica vagas como `TECH`, `POSSIBLY_TECH` ou `NON_TECH`.
- O filtro de qualidade rejeita `NON_TECH` antes do banco. Exemplos: Direito Societario, Marketing de Performance e Afiliados/Parcerias. Suporte Tecnico, QA, Dados e Desenvolvimento devem continuar aceitos.
- Vagas coletadas que passam pelo filtro de qualidade recebem prioridade antes da decisao de aprovacao. A prioridade favorece estagio remoto em tecnologia, estagio em Minas Gerais/BH/regiao, trainee remoto e junior remoto. `LOW` e recusada; `MEDIUM` exige estagio, trainee, remoto ou `priorityScore >= 75`.
- Se uma vaga `NON_TECH` chegar na prioridade por algum caminho inesperado, `evaluateJobPriority` aplica `-100` e força `LOW`.
- A prioridade e persistida no banco em `JobPost` aprovado: `priority` usa enum `JobPriority` (`HIGH`, `MEDIUM`, `LOW`), `priorityScore` guarda a pontuacao e `priorityReasons` guarda os motivos como JSON string.
- `src/services/autoApproveJobs.ts` virou rotina legada para processar `DRAFT` antigo. O fluxo principal usa `runAutomatedJobCollection()` em `src/providers/providerRunner.ts`.
- A quantidade criada usa o limite diario do scheduler: `dailyLimit - SENT hoje - PENDING atuais`. Se o resultado for zero, nada e criado.
- A coleta nao envia Discord; o envio continua restrito ao scheduler de vagas `PENDING` e as acoes manuais.
- O diagnostico de prioridade roda com `npm run diagnose:priority` depois de `npm run build`. Ele executa `dist/scripts/diagnoseJobPriority.js`, le vagas `DRAFT` legadas recentes, imprime totais por prioridade, top/bottom por score e distribuicoes por source/level/modality. Nao altera banco, nao chama Gemini e nao envia ao Discord.
- O diagnostico de dominio roda com `npm run diagnose:domain` depois de `npm run build`. Ele nao acessa banco nem rede e valida exemplos tech/non-tech.
- Vagas `DRAFT` legadas podem ser preparadas manualmente com `Preparar rascunho legado`, que chama Gemini, salva `aiGeneratedText`, marca `useAi = true` e muda para `PENDING` somente em caso de sucesso.
- A listagem mostra o botao `Processar rascunhos legados` apenas quando existem vagas `DRAFT`.
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
- O filtro de qualidade de providers fica em `src/services/jobQualityFilter.ts`; ele e deterministico, nao usa IA e rejeita coletas antes do banco quando faltam dados essenciais, falta canal claro de candidatura (URL ou e-mail no texto), ha senioridade/experiencia alta ou a vaga e `NON_TECH`.
- A prioridade de providers fica em `src/services/jobPriority.ts`; ela e deterministica, nao usa IA, roda depois da qualidade e antes da deduplicacao/escrita, ordena `HIGH` > `MEDIUM` > `LOW` preservando ordem original dentro do mesmo nivel, persiste `priority`, `priorityScore` e `priorityReasons`, e nao bloqueia vagas `LOW`.
- A listagem possui a acao unica `Coletar vagas`, que chama `POST /admin/jobs/collect-all` e executa `manualCollectableJobProviders` pelo lock de `runRealJobCollection`.
- As rotas antigas de coleta por provider e a rota mock `POST /admin/jobs/collect` foram removidas do router. Nao exibir botoes separados de GitHub, fontes externas, ATS, Gupy, Programathor, Remotar ou teste/mock.
- A listagem `/admin/jobs` e organizada por secoes visuais: `Prontas para envio` mostra `PENDING` com acao principal `Enviar agora`; `Historico recente` mostra `SENT` e `ERROR` recentes; `Arquivadas` mostra `ARCHIVED`; `Rascunhos legados` aparece apenas se houver `DRAFT` antigo. O botao global de legado move rascunhos elegiveis para `PENDING`, mas nao publica.
- Os detalhes exibem `Preparar rascunho legado` para vagas `DRAFT` e `Regenerar IA e manter na fila` para `PENDING`.

## Providers de coleta

- O contrato fica em `src/providers/types.ts`.
- A normalizacao fica em `src/providers/normalizeCollectedJob.ts`.
- Providers ativos ficam em `src/providers/providerRegistry.ts`.
- `providerRegistry.ts` separa `automaticJobProviders`, `manualCollectableJobProviders`, `externalJobProviders` e `atsJobProviders`. A coleta automatica usa `automaticJobProviders`; a coleta manual usa `manualCollectableJobProviders`.
- O provider GitHub e `src/providers/githubJobs.provider.ts`.
- Os providers externos sao `src/providers/himalayas.provider.ts`, `src/providers/jobicy.provider.ts`, `src/providers/remoteOk.provider.ts` e `src/providers/remotive.provider.ts`.
- Os providers ATS sao `src/providers/greenhouse.provider.ts`, `src/providers/lever.provider.ts` e `src/providers/ashby.provider.ts`.
- O provider experimental Gupy e `src/providers/gupy.provider.ts`, documentado em `docs/gupy-scraping-research.md`.
- O provider experimental Programathor e `src/providers/programathor.provider.ts`, documentado em `docs/programathor-scraping-research.md`.
- O provider Remotar e `src/providers/remotar.provider.ts`, documentado em `docs/remotar-scraping-research.md`. Ele roda automaticamente e tambem pela coleta manual unificada.
- A lista controlada de empresas-alvo ATS fica em `src/providers/companyTargets.ts`. A lista inicial e GitLab no Greenhouse (`gitlab`), Kepler Communications no Lever (`kepler`) e Ashby no Ashby (`ashby`).
- Helpers compartilhados para providers externos ficam em `providerTextUtils.ts`, `providerDateUtils.ts`, `providerSeniorityUtils.ts`, `providerLocationUtils.ts`, `providerSalaryUtils.ts` e `providerSummaryUtils.ts`.
- Helpers especificos da primeira leva ATS ficam em `src/providers/atsProviderUtils.ts` e tratam politica publica `api`, limpeza leve de HTML retornado nos JSONs, datas recentes e filtro conservador de localizacao.
- A camada preparatoria para scraping fica em `src/scraping/`: `types.ts`, `scrapingPolicy.ts`, `htmlUtils.ts`, `scrapingClient.ts` e a subpasta `browser/` para Playwright. Use-a para avaliar e buscar fontes publicas permitidas antes de criar providers novos.
- A base Playwright inclui `src/scraping/browser/types.ts`, `browserPolicy.ts`, `browserClient.ts` e `pageUtils.ts`. Ela bloqueia login, captcha, bypass, credenciais, cookies customizados, proxy e rotacao de IP, e deve ser usada somente para paginas publicas dinamicas quando API/RSS/HTML simples nao bastarem.
- `src/providers/playwrightSmokeTest.provider.ts` e um provider experimental para validar a infraestrutura Playwright em pagina publica simples. Ele nao esta registrado em `providerRegistry.ts`, nao entra em `automaticJobProviders`, nao roda automaticamente, nao cria vagas, nao chama IA e nao envia ao Discord.
- O runner central fica em `src/providers/providerRunner.ts`.
- O runner automatizado percorre os providers ativos, normaliza vagas, aplica dominio e `evaluateCollectedJobQuality`, calcula `evaluateJobPriority`, ordena candidatas, reaproveita `checkJobDuplicate`, respeita o limite diario, gera Gemini e cria aprovadas como `PENDING`.
- Vagas rejeitadas por qualidade incrementam `ignoredByQuality` e geram log `Vaga coletada ignorada por filtro de qualidade` com `reasons` e `score`.
- Vagas aceitas por qualidade geram log `Prioridade calculada para vaga coletada` com `priority`, `score` e `reasons`. O runner contabiliza prioridades criadas em `highPriority`, `mediumPriority` e `lowPriority` e salva esses dados no `JobPost`.
- Possiveis duplicatas por titulo + empresa bloqueiam criacao automatizada.
- O runner tambem aceita resultado de provider com metadados, como `ignoredByLocation`, para exibir resumo operacional sem criar registros.
- O runner tambem propaga erros internos retornados por providers, como falhas de repositorio no GitHub provider.
- O diagnostico GitHub inclui `totalIssuesRead`, `ignoredByDate`, `ignoredBySeniority`, `ignoredByMissingEntryLevel`, `ignoredByLocation`, `ignoredByQuality`, `ignoredDuplicates`, `possibleDuplicates`, `created` e `repositoryErrors`.
- O toast da coleta manual unificada e compacto: `Coleta concluida: X aprovadas para envio, Y recusadas, Z duplicatas, W erros.` Detalhes por fonte sao logados no terminal; nao ha tela de logs nem persistencia em banco.
- `providerRegistry.ts` registra `automaticJobProviders` e `manualCollectableJobProviders`. A coleta automatica roda GitHub, Himalayas, Jobicy, RemoteOK, Remotive, Remotar, Gupy e Programathor. A coleta manual roda esses automaticos mais ATS publicos.
- O provider GitHub usa issues abertas de `frontendbr/vagas`, `backend-br/vagas`, `react-brasil/vagas`, `qa-brasil/vagas`, `nodejsdevbr/vagas`, `dotnetdevbr/vagas`, `soujava/vagas-java`, `DevOps-Brasil/Vagas`, `programadores-br/geral`, `datascience-br/vagas`, `brasil-php/vagas`, `androiddevbr/vagas`, `CocoaHeadsBrasil/vagas` e `remotejobsbr/design-ux-vagas` pela API oficial do GitHub.
- Se um repositorio GitHub falhar, o provider loga o erro, adiciona erro ao resumo e continua nos demais repositorios.
- O provider GitHub usa `state=open`, `per_page=100` e `since` com data ISO de 30 dias atras, mas tambem filtra `created_at` manualmente porque `since` pode considerar atualizacao.
- Ele coleta apenas issues criadas nos ultimos 30 dias com labels de `junior`, `júnior`, `jr`, `estagio`, `estágio`, `estagiario`, `estagiário` ou `trainee`, incluindo labels compostas como `estágio remoto`; `trainee` e tratado como nivel de entrada.
- Ele ignora pull requests e labels de `pleno`, `senior`, `sênior`, `especialista`, `tech lead`, `lead`, `staff` e `principal`.
- Ele aceita vagas remotas de qualquer lugar, mas vagas hibridas/presenciais apenas quando localizacao ou corpo indicam Minas Gerais. Se a modalidade nao for clara, so aceita quando parecer Minas Gerais.
- Issues GitHub ignoradas pelo filtro geografico entram no resumo como `ignoredByLocation`.
- O provider GitHub tenta preencher `shortDescription` a partir de secoes do corpo da issue e `stacks` a partir de termos tecnicos conhecidos, sem chamar IA.
- `GITHUB_TOKEN` e opcional; quando configurado, aumenta o rate limit e e enviado como `Authorization: Bearer`.
- Nao ha scraping HTML real de fontes protegidas, Cheerio, LinkedIn ou Solides nesta etapa. Gupy usa endpoint publico observado, Programathor usa HTML publico simples e Remotar usa JSON publico observado; os tres rodam em baixo volume na coleta automatica. Playwright foi usado no reconhecimento e tambem esta instalado como infraestrutura isolada e smoke test nao registrado.
- A politica de scraping bloqueia fontes que exigem login, captcha, bypass anti-bot, credenciais pessoais, simulacao de usuario autenticado ou termos explicitamente incompativeis. Browser scraping so pode ser considerado como ultimo caso para pagina publica sem esses bloqueios.
- Himalayas usa `https://himalayas.app/jobs/api/search`; Jobicy usa `https://jobicy.com/api/v2/remote-jobs`; RemoteOK usa `https://remoteok.com/api`; Remotive usa `https://remotive.com/api/remote-jobs`.
- Os providers externos filtram vagas dos ultimos 30 dias, exigem sinal claro de nivel iniciante, rejeitam senioridade alta/intermediaria e aceitam apenas vagas remotas globais ou compativeis com Brasil/LATAM/Americas.
- O provider Gupy consulta poucas buscas publicas, exige sinal de entrada, rejeita senioridade intermediaria/alta, aceita remoto de qualquer lugar, aceita hibrido/presencial apenas em Minas Gerais/Belo Horizonte/regiao, limita a 20 vagas por execucao e passa pelo runner automatizado.
- O diagnostico Gupy e por termo de busca. Cada termo retorna um `repositorySummary` com `source` no formato `gupy:<termo>`, `term`, `totalIssuesRead`, `returnedByProvider`, descartes por data/senioridade/falta de nivel/localizacao e erros. O runner completa qualidade, duplicidade e criacao nesse mesmo summary.
- O provider Programathor usa HTML publico simples, porque nao foi encontrado endpoint JSON publico de vagas. Ele consulta poucas rotas publicas, como `/jobs?expertise=J%C3%BAnior`, `/jobs?contract_type=Est%C3%A1gio`, `/jobs-front-end?expertise=J%C3%BAnior`, `/jobs-quality-assurance?expertise=J%C3%BAnior`, `/jobs-data-science?expertise=J%C3%BAnior` e remoto junior. Ele nao usa Playwright operacional, login, cookies, credenciais, proxy, rotacao de IP, captcha ou bypass.
- O provider Programathor filtra cards `Vencida`, `datePosted` acima de 30 dias quando disponivel no JSON-LD da pagina de detalhe, senioridade acima de entrada e localizacao fora da regra: remoto de qualquer lugar; hibrido/presencial apenas Minas Gerais/Belo Horizonte/regiao. O limite e de 20 vagas retornadas por execucao e a criacao passa pelo runner automatizado.
- O diagnostico Programathor e por termo/fonte. Cada termo retorna `repositorySummary` com `source` no formato `programathor:<termo>`, `term`, `totalIssuesRead`, `returnedByProvider`, descartes por data/senioridade/falta de nivel/localizacao e erros. O runner completa qualidade, duplicidade e criacao.
- O provider Remotar usa JSON publico observado em `https://api.remotar.com.br/jobs`, porque o reconhecimento com Playwright MCP mostrou que a UI publica usa esse endpoint para busca, tags e categorias. Ele consulta poucos termos publicos, como desenvolvedor junior, estagio desenvolvimento, estagio dados, junior software, front-end junior, backend junior, suporte tecnico, qa junior, dados junior e remoto junior. Ele nao usa Playwright operacional, login, cookies, credenciais, proxy, rotacao de IP, captcha ou bypass.
- O provider Remotar filtra `createdAt` acima de 30 dias, senioridade acima de entrada, falta de sinal de nivel, ruido fora de tecnologia e localizacao fora da regra: remoto sem restricao explicita incompatível com Brasil/LATAM/Americas; hibrido/presencial apenas Minas Gerais/Belo Horizonte/regiao. Ele exige categoria tech ou classificacao `TECH`; sinais de Direito, Marketing, Comercial, Administrativo, RH, Afiliados, Parcerias e areas similares sem sinal tech forte incrementam `ignoredByQuality`. O limite e de 20 vagas retornadas por execucao e a criacao passa pelo runner automatizado.
- O diagnostico Remotar e por termo/fonte. Cada termo retorna `repositorySummary` com `source` no formato `remotar:<termo>`, `term`, `totalIssuesRead`, `returnedByProvider`, descartes por data/senioridade/falta de nivel/localizacao/qualidade e erros. O runner completa duplicidade e criacao.
- A revisao operacional dos providers experimentais fica em `docs/experimental-providers-operational-review.md`. Em 2026-05-25, Remotar foi promovida por melhor volume e aderencia; depois, Gupy e Programathor tambem entraram na coleta automatica de baixo volume.
- O script local `src/scripts/diagnoseExperimentalProviders.ts` executa Gupy, Programathor e Remotar diretamente, aplica normalizacao, qualidade e prioridade em memoria, checa poucos links e imprime JSON no terminal. Ele nao consulta Prisma, nao salva no banco, nao chama Gemini e nao publica no Discord. Use apos `npm run build` com `node dist/scripts/diagnoseExperimentalProviders.js`.
- O script local `src/scripts/diagnoseJobDomainClassifier.ts` valida o classificador de dominio sem banco nem rede. Use `npm run build` e `npm run diagnose:domain`.
- O script local `src/scripts/diagnoseJobPriority.ts` consulta Prisma em modo leitura para calibrar a pontuacao persistida usada pelo pipeline e por rascunhos legados. Use `npm run build` e `npm run diagnose:priority`; opcionalmente ajuste `PRIORITY_DIAG_LIMIT`.
- O toast da coleta Gupy usa resumo compacto: novas, analisadas, descartes por localizacao/nivel/qualidade, duplicatas, erros e ate quatro termos que retornaram vagas pelo provider.
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

A coleta ATS fica manual dentro de `/admin/jobs/collect-all`. Ela usa o mesmo lock de `runRealJobCollection`, aprova elegiveis como `PENDING` via runner automatizado, e nao entra na coleta automatica diaria por enquanto.

## Coleta automatica

- `src/services/scheduledCollector.ts` agenda a coleta automatica diaria as 08:00 em `America/Sao_Paulo`.
- Ela roda junto com `npm run admin`; se o painel admin nao estiver rodando, a coleta automatica nao executa.
- Usa `node-cron` e chama `runAutomatedJobCollection(automaticJobProviders)`.
- Nao executa `atsJobProviders` automaticamente nesta etapa.
- Executa Gupy e Programathor automaticamente junto com GitHub, externas e Remotar.
- Usa lock simples em memoria (`isCollecting`) compartilhado com a coleta manual unificada por meio de `runRealJobCollection`.
- Se uma coleta ja estiver rodando, a nova tentativa e ignorada com log.
- Falhas sao logadas e nao derrubam o processo.
- Esse agendamento e separado do envio agendado de vagas `PENDING`.
- `runRealJobCollection('scheduled')` ja cria as vagas aprovadas como `PENDING`; nao ha etapa separada de autoaprovacao no fluxo principal.

## Proximos passos recomendados

- Manter o painel simples e server-rendered em Express ate haver necessidade real de frontend separado.
- Evoluir providers a partir do contrato atual e de fontes publicas simples.
- Comecar provider real por uma fonte simples e publica.
- Para fontes maiores, consultar `docs/scraping-engine-design.md` e `docs/scraping-platforms-research.md` antes de implementar. Priorize Greenhouse, Lever, Ashby, paginas publicas de carreiras e sites proprios simples quando houver API/RSS/endpoint JSON publico.
- Manter `DRAFT` apenas como legado; novas coletas devem aprovar como `PENDING` ou recusar sem persistir.
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
