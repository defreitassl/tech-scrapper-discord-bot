# Roadmap

## V1 atual

- Bot conectado ao Discord.
- Painel admin em Express.
- Cadastro, listagem, detalhe e edicao de vagas.
- Controle de status.
- Envio manual de vagas `PENDING`.
- Envio agendado de vagas `PENDING` configurado pelo painel.
- PostgreSQL + Prisma.
- Mensagens com `readyText`, `aiGeneratedText`, IA no envio ou fallback deterministico.
- Geracao de mensagem com Google AI Studio/Gemini no momento do envio.
- Primeiro provider real via API oficial do GitHub, coletando issues abertas e recentes de repositorios brasileiros de vagas e aprovando elegiveis como `PENDING`.
- Providers externos por APIs publicas JSON: Himalayas, Jobicy, RemoteOK e Remotive.
- Providers Remotar, Gupy, Programathor e Solides incluidos na coleta automatica configuravel por fontes publicas validadas.
- Coleta manual unificada pelo botao `Coletar vagas`, executando providers automaticos e ATS publicos sem mock/teste.
- Filtro de dominio tech/non-tech rejeitando vagas fora de tecnologia antes de salvar.
- Prioridade de vagas coletadas persistida em `JobPost` e exibida no painel para apoiar revisao humana.
- Acao manual para processar rascunhos legados e coloca-los na fila como `PENDING` sem IA.
- Coleta automatica configuravel pelo painel, 1x ou 2x por semana, preenchendo fila `PENDING` para vagas aprovadas sem chamar Gemini e recusando as demais sem persistir.

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
- Nao chama Gemini na coleta; a mensagem e resolvida no envio.

## V1.3 agendamento de coletas/providers

- Implementada execucao agendada dos providers reais em `America/Sao_Paulo`.
- Controla logs e erros por fonte.
- Mantem limite conservador de frequencia.
- Continua exigindo scheduler ou acao manual para publicacao no Discord.
- Executa GitHub, APIs externas, Remotar, Gupy, Programathor e Solides; ATS publicos seguem manuais.

Observacao: o envio agendado de vagas `PENDING` ja existe e e configurado no painel. O agendamento de coleta/providers e separado e nao publica vagas.

## V1.4 providers externos por API

- Implementados providers Himalayas, Jobicy, RemoteOK e Remotive usando APIs publicas JSON.
- Adicionados providers externos por APIs publicas JSON, hoje acionados tambem pelo botao unico `Coletar vagas`.
- Registrados como providers reais para coleta automatica.
- Mantidas regras de seguranca da etapa de coleta: vagas recusadas nao sao persistidas e a coleta nao envia ao Discord.
- Adicionados filtros conservadores de data, senioridade e localidade remota.
- Preservada URL original para atribuicao/linkback de Jobicy, RemoteOK e Remotive.

## V1.4.1 Remotar na coleta automatica

- Promovida Remotar para `realJobProviders` apos revisao operacional em 2026-05-25.
- Remotar passou a ser acionada manualmente pelo botao unico `Coletar vagas`.
- Gupy e Programathor passaram a entrar na coleta automatica.
- Coleta automatica cria apenas vagas aprovadas como `PENDING`, sem Gemini e sem envio ao Discord.

## V1.4.2 Prioridade persistida para revisao

- Adicionados `priority`, `priorityScore` e `priorityReasons` ao `JobPost`.
- `providerRunner` salva a prioridade calculada por `evaluateJobPriority`.
- Painel mostra badge, score e motivos nos detalhes e nos rascunhos legados, quando existirem.
- A lista principal passou a focar em `PENDING`, historico, arquivadas e `DRAFT` apenas como legado.
- Prioridade nao publica no Discord; ela alimenta a aprovacao automatizada dentro da coleta.

## V1.4.3 Autoaprovacao V1 legada

- Criado `src/services/autoApproveJobs.ts`.
- A rotina foi mantida para rascunhos `DRAFT` legados.
- O fluxo principal agora calcula quantas vagas precisa criar durante a coleta usando uma fila alvo baseada em `dailyLimit * 7`, com teto de 30, e vagas ja `PENDING`.
- A regra considera apenas vagas elegiveis, nunca aprova `LOW`, exige URL e descricao util.
- `HIGH` pode ser autoaprovada; `MEDIUM` so entra se for estagio, trainee, remota ou tiver `priorityScore >= 75`.
- Para cada vaga selecionada, marca `useAi = true`, deixa `aiGeneratedText` vazio e cria como `PENDING`.
- Falha de IA nao afeta a coleta, porque Gemini so roda no envio.
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
- `runAutomatedJobCollection()` coleta, normaliza, filtra dominio/qualidade, deduplica, calcula prioridade, seleciona pela fila alvo e cria `PENDING` sem IA.
- Vagas recusadas por dominio, qualidade, prioridade ou duplicidade nao sao persistidas.
- A fila alvo considera `min(max(dailyLimit * 7, dailyLimit), 30) - PENDING atuais`; se nao houver espaco, nada e criado.
- Gupy e Programathor entraram em `automaticJobProviders`; ATS publicos continuam apenas no botao manual.

## V1.4.6 Solides automatica

- Criado reconhecimento tecnico da Solides com Playwright MCP.
- Encontrado endpoint JSON publico `https://apigw.solides.com.br/jobs/v3/portal-vacancies-new`.
- Criado `src/providers/solides.provider.ts` com limite de 20 vagas por execucao, filtros de TECH/NON_TECH, senioridade, data e localizacao.
- Solides entrou em `automaticJobProviders` e tambem roda pelo botao unico `Coletar vagas` por estar dentro de `manualCollectableJobProviders`.
- A coleta continua passando pelo runner central, sem salvar direto no banco e sem enviar Discord.

## V1.4.7 Gemini somente no envio

- A coleta deixou de chamar Gemini e passou a montar estoque de vagas `PENDING`.
- `PENDING` significa vaga aprovada e aguardando envio; `aiGeneratedText` pode ficar vazio.
- O publisher resolve a mensagem no envio: `readyText`, `aiGeneratedText` valido, Gemini quando `useAi = true`, ou fallback deterministico.
- Falha de Gemini nao bloqueia envio quando o fallback consegue montar uma mensagem.
- O limite diario controla o envio; a coleta preenche fila alvo `min(max(dailyLimit * 7, dailyLimit), 30)`.

## V1.4.8 Coleta automatica configuravel

- Criado model `CollectionSchedulerSettings`.
- Criada tela `/admin/settings/collection`.
- Admin pode ativar/desativar a coleta, escolher 1x ou 2x por semana, dias da semana e horario fixo.
- `scheduledCollector` recarrega os crons ao salvar configuracao.
- Coleta agendada usa apenas `automaticJobProviders`; ATS publicos continuam manuais.
- Coleta e envio seguem separados: coleta cria `PENDING` sem Gemini; envio consome `PENDING` e gera mensagem somente no momento do envio.

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
