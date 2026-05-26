# Roadmap

## V1 atual

- Bot conectado ao Discord.
- Painel admin em Express.
- Cadastro, listagem, detalhe e edicao de vagas.
- Controle de status.
- Envio manual de vagas `PENDING`.
- Envio agendado de vagas `PENDING` configurado pelo painel.
- PostgreSQL + Prisma.
- Mensagens com `readyText`, `aiGeneratedText`, IA ou template padrao.
- Geracao de mensagem com Google AI Studio/Gemini.
- Primeiro provider real via API oficial do GitHub, coletando issues abertas e recentes de repositorios brasileiros de vagas e aprovando elegiveis como `PENDING`.
- Providers externos por APIs publicas JSON: Himalayas, Jobicy, RemoteOK e Remotive.
- Providers Remotar, Gupy e Programathor incluidos na coleta automatica diaria por fontes publicas validadas.
- Coleta manual unificada pelo botao `Coletar vagas`, executando providers reais, experimentais e ATS publicos sem mock/teste.
- Filtro de dominio tech/non-tech rejeitando vagas fora de tecnologia antes de salvar.
- Prioridade de vagas coletadas persistida em `JobPost` e exibida no painel para apoiar revisao humana.
- Acao manual para processar rascunhos legados com IA e coloca-los na fila como `PENDING`.
- Coleta automatica diaria dos providers automaticos as 08:00, criando direto `PENDING` para vagas aprovadas e recusando as demais sem persistir.

## V1.1 documentacao + providers

- Criar documentacao inicial do projeto.
- Definir contrato de providers.
- Definir estrategia de fontes.
- Definir guidelines de scraping.
- Implementar a base inicial de providers e validar o runner com fontes controladas.
- Normalizar vagas coletadas e reaproveitar deduplicacao antes de criar registros.

## V1.2 primeiro provider real

- Implementado provider GitHub com fonte simples e publica baseada em issues.
- Aprova vagas coletadas como `PENDING`.
- Registra `source` e `url`.
- Evita publicacao automatica no Discord durante a coleta.
- Reutiliza normalizacao e deduplicacao basica.
- Filtra apenas issues abertas, criadas nos ultimos 30 dias, com labels de junior/estagio/trainee e sem labels de pleno/senior ou similares.
- Aplica filtro deterministico de qualidade antes de salvar vagas aprovadas.
- Isola falhas por repositorio para continuar a coleta nas demais fontes.
- Chama Gemini apenas para candidatas selecionadas pelo limite diario.

## V1.3 agendamento de coletas/providers

- Implementada execucao agendada diaria dos providers reais as 08:00 em `America/Sao_Paulo`.
- Controla logs e erros por fonte.
- Mantem limite conservador de frequencia: uma execucao por dia.
- Continua exigindo scheduler ou acao manual para publicacao no Discord.
- Executa GitHub, APIs externas, Remotar, Gupy e Programathor; ATS publicos seguem manuais.

Observacao: o envio agendado de vagas `PENDING` ja existe e e configurado no painel. O agendamento de coleta/providers e separado e nao publica vagas.

## V1.4 providers externos por API

- Implementados providers Himalayas, Jobicy, RemoteOK e Remotive usando APIs publicas JSON.
- Adicionados providers externos por APIs publicas JSON, hoje acionados tambem pelo botao unico `Coletar vagas`.
- Registrados como providers reais para coleta automatica diaria.
- Mantidas regras de seguranca da etapa de coleta: vagas recusadas nao sao persistidas e a coleta nao envia ao Discord.
- Adicionados filtros conservadores de data, senioridade e localidade remota.
- Preservada URL original para atribuicao/linkback de Jobicy, RemoteOK e Remotive.

## V1.4.1 Remotar na coleta automatica

- Promovida Remotar para `realJobProviders` apos revisao operacional em 2026-05-25.
- Remotar passou a ser acionada manualmente pelo botao unico `Coletar vagas`.
- Gupy e Programathor passaram a entrar na coleta automatica.
- Coleta automatica cria apenas vagas aprovadas como `PENDING`, com Gemini, sem envio ao Discord.

## V1.4.2 Prioridade persistida para revisao

- Adicionados `priority`, `priorityScore` e `priorityReasons` ao `JobPost`.
- `providerRunner` salva a prioridade calculada por `evaluateJobPriority`.
- Painel mostra badge, score e motivos nos detalhes e nos rascunhos legados, quando existirem.
- A lista principal passou a focar em `PENDING`, historico, arquivadas e `DRAFT` apenas como legado.
- Prioridade nao publica no Discord; ela alimenta a aprovacao automatizada dentro da coleta.

## V1.4.3 Autoaprovacao V1 legada

- Criado `src/services/autoApproveJobs.ts`.
- A rotina foi mantida para rascunhos `DRAFT` legados.
- O fluxo principal agora calcula quantas vagas precisa criar durante a coleta usando o limite diario do scheduler, vagas `SENT` hoje e vagas ja `PENDING`.
- A regra considera apenas vagas elegiveis, nunca aprova `LOW`, exige URL e descricao util.
- `HIGH` pode ser autoaprovada; `MEDIUM` so entra se for estagio, trainee, remota ou tiver `priorityScore >= 75`.
- Para cada vaga selecionada, gera `aiGeneratedText` com Gemini, marca `useAi = true` e cria como `PENDING`.
- Se a IA falhar, a vaga nao e persistida.
- O envio continua sendo responsabilidade do scheduler de publicacao ou das acoes manuais; a coleta nao chama Discord.
- O painel mostra `Processar rascunhos legados` apenas quando houver `DRAFT` antigo.

## V1.4.4 Qualidade de dominio e coleta unificada

- Criado classificador `TECH`, `POSSIBLY_TECH` e `NON_TECH`.
- Vagas `NON_TECH`, como Direito Societario, Marketing de Performance e Afiliados/Parcerias, sao rejeitadas no filtro de qualidade antes do banco.
- Prioridade aplica penalidade forte e nunca classifica `NON_TECH` como `HIGH`.
- Remotar deixou de usar busca ampla `estagio tecnologia` e passou a exigir aderencia tech mais forte.
- Painel `/admin/jobs` passou a exibir um unico botao `Coletar vagas`.
- Provider mock/teste e rota `POST /admin/jobs/collect` foram removidos do fluxo atual.

## V1.4.5 Pipeline automatizado sem DRAFT

- `DRAFT` foi aposentado do fluxo principal sem alterar o schema Prisma.
- `runAutomatedJobCollection()` coleta, normaliza, filtra dominio/qualidade, deduplica, calcula prioridade, seleciona pelo limite diario, gera IA e cria `PENDING`.
- Vagas recusadas por dominio, qualidade, prioridade, duplicidade ou falha de IA nao sao persistidas.
- O limite diario considera `dailyLimit - SENT hoje - PENDING atuais`; se nao houver espaco, nada e criado.
- Gupy e Programathor entraram em `automaticJobProviders`; ATS publicos continuam apenas no botao manual.

## V1.5 autenticacao simples

- Proteger painel admin com autenticacao simples.
- Considerar senha via variavel de ambiente ou solucao equivalente.
- Evitar complexidade de permissoes ate existir necessidade real.

## V2 scraping avancado e multiplas fontes

- Suportar multiplos providers.
- Melhorar deduplicacao.
- Adicionar painel de revisao de coletas.
- Avaliar uso pontual de Playwright.
- Monitorar qualidade das fontes.
- Considerar metricas de vagas publicadas, erros e fontes mais uteis.
