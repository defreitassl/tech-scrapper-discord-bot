# Arquitetura

## Stack atual

- Node.js com TypeScript.
- Express para o painel admin.
- Prisma como ORM.
- PostgreSQL como banco de dados.
- Discord.js para envio de mensagens ao Discord.
- Google AI Studio/Gemini para gerar mensagens de vaga.

## Principais modulos

- `src/admin/server.ts`: ponto de entrada do painel admin. Cria o app Express, configura middlewares, registra rotas, inicia o servidor, inicia o `scheduledPublisher` e inicia o `scheduledCollector`.
- `src/admin/routes/jobs.routes.ts`: rotas de vagas do painel admin, incluindo listagem, cadastro, detalhe, edicao, aprovacao, arquivamento e envio manual.
- `src/admin/routes/schedule.routes.ts`: rotas de configuracao do envio agendado.
- `src/admin/views/`: renderizacao server-side do painel. `layout.ts` contem o layout base, `styles.ts` contem o CSS inline, `components.ts` contem componentes HTML reutilizaveis, `jobs.views.ts` contem telas de vagas e `schedule.views.ts` contem a tela de agendamento.
- `src/admin/helpers/`: helpers puros do painel. `forms.ts` concentra parse e normalizacao de formularios, `validators.ts` concentra validacoes de formulario/status, `status.ts` concentra labels de status, `formatters.ts` concentra formatacao visual simples e `notifications.ts` concentra notificacoes temporarias via query params.
- `src/providers/`: base de providers de coleta. Inclui contrato (`types.ts`), normalizacao (`normalizeCollectedJob.ts`), registry de providers ativos (`providerRegistry.ts`), provider GitHub (`githubJobs.provider.ts`), providers externos por APIs publicas JSON (`himalayas.provider.ts`, `jobicy.provider.ts`, `remoteOk.provider.ts`, `remotive.provider.ts`), provider Remotar por JSON publico (`remotar.provider.ts`), providers manuais de ATS publicos (`greenhouse.provider.ts`, `lever.provider.ts`, `ashby.provider.ts`), providers Gupy (`gupy.provider.ts`), Programathor (`programathor.provider.ts`) e Solides (`solides.provider.ts`), lista controlada de empresas (`companyTargets.ts`), helpers compartilhados e runner (`providerRunner.ts`).
- `src/scraping/`: camada preparatoria e isolada para futuras fontes publicas mais dificeis. Inclui tipos genericos, politica de permissao, helpers leves de HTML, cliente publico simples para HTML/JSON e uma subcamada experimental `src/scraping/browser/` para Playwright. Os providers ATS usam o cliente JSON publico dessa camada. A subcamada Playwright continua isolada, sem salvar no banco e sem alterar regras do runner.
- `src/services/publishPendingJobs.ts`: fluxo de publicacao de vagas, incluindo envio em lote de vagas `PENDING` e envio de uma unica vaga.
- `src/services/jobDeduplication.ts`: primeira camada reutilizavel de deduplicacao de vagas. Bloqueia duplicata forte por URL normalizada e sinaliza possivel duplicata por titulo + empresa normalizados.
- `src/services/jobDomainClassifier.ts`: classificador deterministico de dominio da vaga. Classifica cada vaga como `TECH`, `POSSIBLY_TECH` ou `NON_TECH` a partir de titulo, stacks, categoria, tags, descricao e texto bruto, sem IA.
- `src/services/jobQualityFilter.ts`: filtro deterministico de qualidade para vagas coletadas por providers. Rejeita vagas antes da criacao no banco quando faltam dados essenciais, falta canal claro de candidatura (URL ou e-mail no texto), ha sinais fortes de senioridade/experiencia alta ou a vaga e `NON_TECH`.
- `src/services/jobPriority.ts`: priorizacao deterministica para vagas coletadas aprovadas pelo filtro de qualidade. Favorece estagio remoto, estagio em Minas Gerais/BH/regiao, trainee remoto e junior remoto, sem descartar vagas `LOW` que continuem uteis. O runner persiste `priority`, `priorityScore` e `priorityReasons` no `JobPost`.
- `src/services/autoApproveJobs.ts`: rotina legada para processar vagas `DRAFT` antigas. O fluxo principal de coleta nao usa mais esse status, mas o botao de rascunhos legados ainda pode mover vagas antigas para `PENDING` sem chamar IA.
- `src/scripts/diagnoseJobPriority.ts`: diagnostico local de prioridade. Consulta vagas `DRAFT` legadas recentes no banco, imprime totais por prioridade, top/bottom por score e distribuicoes por fonte, nivel e modalidade. Nao altera dados, nao chama Gemini e nao envia ao Discord.
- `src/scripts/diagnoseJobDomainClassifier.ts`: diagnostico local e sem banco do classificador de dominio. Cobre exemplos de Direito, Marketing, Afiliados, Suporte Tecnico, Desenvolvimento Front-end e QA Junior.
- `src/services/schedulerSettings.ts`: leitura, criacao padrao, validacao e atualizacao das configuracoes de envio agendado.
- `src/services/schedulerOperations.ts`: consultas operacionais do agendamento, como limite restante do dia e proximas vagas `PENDING`.
- `src/services/scheduledPublisher.ts`: registro dos crons de publicacao e aplicacao do limite diario antes de chamar `publishPendingJobs`.
- `src/services/jobMessage.ts`: montagem de mensagem padrao e fallback de texto.
- `src/services/aiMessageGenerator.ts`: integracao com Google AI Studio/Gemini para gerar mensagens curtas e formatadas para Discord.
- `src/services/discordPublisher.ts`: conexao com Discord, montagem do payload de embed/card da vaga e envio ao canal configurado, com fallback para texto puro quando o embed falhar.
- `src/services/scheduledCollector.ts`: agendamento fixo da coleta automatica diaria dos providers automaticos, com lock simples em memoria para evitar execucoes concorrentes. Usa `runAutomatedJobCollection` e nao cria `DRAFT`.
- `src/lib/prisma.ts`: instancia compartilhada do Prisma Client.
- `src/lib/logger.ts`: logger simples usado nos fluxos do projeto.
- `prisma/schema.prisma`: modelo de dados do banco.

## Fluxo de publicacao

1. O admin cadastra ou edita uma vaga.
2. No cadastro manual de nova vaga, antes de criar o registro, o painel consulta `jobDeduplication`.
3. Se a URL preenchida ja existir apos normalizacao simples, a vaga nao e criada, a IA nao e chamada e o admin e redirecionado para a vaga existente com aviso.
4. Se nao houver URL duplicada, mas ja existir vaga com mesmo titulo e empresa normalizados, o cadastro continua e o painel mostra um aviso de possivel duplicata.
5. No cadastro manual de nova vaga, o painel salva com status `PENDING` por padrao e `useAi` marcado por padrao.
6. Se nao houver `readyText` e `useAi` estiver ativo, o painel nao chama Gemini no cadastro; a mensagem sera gerada no envio.
7. Se a IA falhar no envio, o publisher usa fallback deterministico e continua a publicacao.
8. Na pagina de detalhes, o painel exibe um preview da mensagem que seria enviada ao Discord. Ele usa `readyText`, depois `aiGeneratedText` valido e, se nenhum deles existir, o fallback deterministico.
9. O admin pode editar `readyText` manualmente se quiser controlar exatamente a mensagem enviada.
10. Para vagas antigas ou rascunhos, o admin ainda pode usar `Aprovar para envio`, que internamente marca a vaga como `PENDING`.
11. Para vagas `DRAFT` legadas, o admin pode usar `Preparar rascunho legado`. Essa acao marca `useAi = true` e altera o status para `PENDING` sem chamar Gemini. A acao nao envia a vaga ao Discord.
12. A rotina `autoApproveJobsForToday` ficou legada e e acionada apenas pelo botao `Processar rascunhos legados`, quando houver `DRAFT` antigo.
13. Se a vaga ja estiver `PENDING`, a acao manual de preparo apenas mantem a vaga na fila com IA no envio. Vagas `SENT` ou `ARCHIVED` nao sao preparadas.
14. O admin pode acionar `Enviar esta vaga agora` na pagina de detalhes ou `Enviar vagas pendentes` na listagem.
15. `publishPendingJobs` busca ate 5 vagas com status `PENDING`, ordenadas por criacao. O envio individual usa a mesma resolucao de mensagem para a vaga atual.
16. Para cada vaga, o sistema resolve a mensagem:
   - usa `readyText` se existir;
   - reutiliza `aiGeneratedText` se existir e for valido;
   - chama a IA se `useAi` estiver habilitado;
   - usa fallback deterministico se a IA falhar ou estiver desabilitada.
17. `discordPublisher` monta um payload com `content` curto e um embed/card da vaga, usando a mensagem resolvida como descricao e campos opcionais para empresa, local, modalidade, nivel, stacks e faixa salarial.
18. O embed inclui link da vaga quando a URL existe, rodape `Projeto Desenvolve • Fonte: {source}` quando ha fonte, timestamp e cor fixa alinhada ao visual do painel.
19. Se o envio com embed falhar, o publisher tenta enviar a mesma mensagem como texto puro. Se essa segunda tentativa tambem falhar, a vaga segue para erro.
20. A vaga e marcada como `SENT` com `sentAt`.
21. Em caso de erro, a vaga e marcada como `ERROR`.

O envio individual nao reenvia vagas `SENT` e nao publica vagas `ARCHIVED`.

## Fluxo de coleta/providers

O projeto possui uma base de providers em `src/providers/`. A coleta manual e a coleta automatica usam o pipeline automatizado: vagas boas entram como `PENDING`; vagas ruins nao sao persistidas.

Fontes publicas mais dificeis devem ser preparadas na camada isolada `src/scraping/`, documentada em `docs/scraping-engine-design.md` e `docs/playwright-scraping.md`. Essa camada existe para separar politica, cliente HTTP publico, utilitarios de HTML e utilitarios de browser do contrato de providers. APIs e RSS continuam preferiveis; HTML simples vem antes de browser; scraping com browser e ultimo caso e so pode ser considerado para paginas publicas sem login, captcha ou bloqueio conhecido. Nao e permitido burlar login, captcha, Cloudflare, paywalls ou protecoes anti-bot.

A base Playwright fica em `src/scraping/browser/` e fornece tipos, politica, cliente de browser e helpers de pagina. Ela usa navegador headless por padrao, timeout conservador, User-Agent identificavel, sem cookies customizados, sem login e sem proxy. O provider `src/providers/playwrightSmokeTest.provider.ts` existe apenas para validar a infraestrutura em uma pagina publica simples e nao esta registrado em `providerRegistry.ts`, nao roda na coleta automatica, nao chama IA, nao cria vagas e nao envia ao Discord.

A pesquisa da Gupy fica em `docs/gupy-scraping-research.md`. O provider `src/providers/gupy.provider.ts` usa apenas acesso publico, sem login/cookies/proxy/bypass, limita a coleta a 20 vagas por execucao e entra na coleta automatica junto com os demais providers automaticos.

A pesquisa do Programathor fica em `docs/programathor-scraping-research.md`. O provider `src/providers/programathor.provider.ts` usa HTML publico simples da camada `src/scraping/` e detalhes com JSON-LD embutido, sem Playwright operacional, sem login/cookies/proxy/bypass, com limite de 20 vagas retornadas por execucao, e entra na coleta automatica junto com os demais providers automaticos.

A pesquisa da Remotar fica em `docs/remotar-scraping-research.md`. O provider `src/providers/remotar.provider.ts` foi promovido para `realJobProviders` apos a revisao operacional de 2026-05-25, por ter melhor volume e aderencia entre os experimentais. Ele tambem e acionado pela coleta manual unificada `POST /admin/jobs/collect-all`. O reconhecimento foi feito com Playwright MCP e encontrou endpoint JSON publico em `https://api.remotar.com.br/jobs`; por isso a coleta usa `fetchPublicJson`, sem Playwright operacional, sem login/cookies/proxy/bypass, com limite de 20 vagas retornadas por execucao.

A pesquisa da Solides fica em `docs/solides-scraping-research.md`. O provider `src/providers/solides.provider.ts` usa apenas endpoint JSON publico observado com Playwright MCP em `https://apigw.solides.com.br/jobs/v3/portal-vacancies-new`, entra em `automaticJobProviders` e tambem roda pelo botao unico `Coletar vagas`, sem Playwright operacional, sem login/cookies/proxy/bypass e com limite de 20 vagas retornadas por execucao.

Antes de implementar plataformas maiores, a fonte deve ser avaliada conforme `docs/scraping-platforms-research.md`. LinkedIn, Gupy, Solides e similares nao devem ser implementados por suposicao; precisam de pesquisa especifica, decisao explicita e respeito a termos e bloqueios tecnicos.

O fluxo manual unificado e acionado pela rota `POST /admin/jobs/collect-all`, exibida na listagem como `Coletar vagas`. Essa rota executa `manualCollectableJobProviders`, que inclui `automaticJobProviders` e `atsJobProviders`, excluindo fontes mock/teste. As rotas antigas de coleta por provider especifico e a rota mock `POST /admin/jobs/collect` foram removidas do painel e do router.

1. O admin aciona `Coletar vagas` na listagem.
2. A rota chama `runRealJobCollection('manual', manualCollectableJobProviders)`, reaproveitando o lock em memoria.
3. Cada provider executa `collect()` e retorna `CollectedJob[]` ou um resultado com `jobs` e metadados operacionais.
4. Cada vaga coletada passa por `normalizeCollectedJob`, que remove espacos duplicados em campos estruturados, transforma strings vazias em `null`, preserva `rawText` quando existir e garante `source`.
5. Antes de criar no banco, o runner chama `evaluateCollectedJobQuality`, que usa `classifyJobDomain` para rejeitar `NON_TECH`.
6. Vagas rejeitadas pelo filtro de qualidade nao sao criadas, incrementam `ignoredByQuality` e registram os motivos no terminal, como `non_tech_domain:direito`, `non_tech_domain:marketing`, `non_tech_domain:afiliados` ou `outside_technology_profile`.
7. Para vagas aceitas por qualidade, o runner chama `evaluateJobPriority` em `src/services/jobPriority.ts`. A prioridade e calculada, logada com `priority`, `score` e `reasons`, e persistida no banco em `priority`, `priorityScore` e `priorityReasons`.
8. Se uma vaga `NON_TECH` passar por algum caminho inesperado, a prioridade aplica penalidade `-100` e força `LOW`.
9. O runner ordena as vagas aceitas por prioridade antes de salvar: `HIGH`, depois `MEDIUM`, depois `LOW`; dentro da mesma prioridade, preserva a ordem original do provider.
10. Para cada vaga ordenada, o runner chama `checkJobDuplicate` em `src/services/jobDeduplication.ts`.
11. Duplicata forte por URL normalizada bloqueia a criacao.
12. Possivel duplicata por titulo + empresa agora tambem bloqueia a criacao automatizada.
13. Vagas `LOW` sao recusadas. Vagas `MEDIUM` so seguem quando forem estagio, trainee, remotas ou tiverem `priorityScore >= 75`.
14. O runner seleciona apenas a quantidade necessaria para preencher a fila `PENDING` alvo: `min(max(dailyLimit * 7, dailyLimit), 30)`.
15. Para cada selecionada, o runner cria o registro como `PENDING`, com `useAi = true` e `aiGeneratedText = null`.
16. A coleta nao chama Gemini; falhas de IA nao existem como motivo de recusa na coleta.
17. A coleta manual nao envia nada ao Discord.
18. O painel redireciona de volta para `/admin/jobs` com um toast compacto: `Coleta concluida: X vagas aprovadas para fila, Y recusadas, Z duplicatas, W erros.`

A prioridade inicial valoriza mais estagio remoto em tecnologia, depois estagio em Minas Gerais/BH/regiao, trainee remoto, junior remoto, junior em Minas Gerais/BH/regiao e, por fim, outras vagas uteis para entendimento de mercado. O pipeline automatizado usa essa prioridade como criterio auditavel: nunca aprova `LOW`, aprova `HIGH` quando a vaga tem URL e descricao util, e aprova `MEDIUM` apenas quando for estagio, trainee, remota ou tiver `priorityScore >= 75`.

Para calibrar a pontuacao usada pelo pipeline automatizado e por rascunhos legados, rode `npm run build` e `npm run diagnose:priority`. O script consulta apenas vagas `DRAFT` legadas recentes, imprime distribuicoes por prioridade/source/level/modality, top 10 e bottom 10 por score, e nao faz escrita no banco.

O provider mock/teste foi removido do fluxo atual.

## Fluxo de coleta GitHub

Na coleta manual, o provider GitHub roda pelo botao unico `Coletar vagas` (`POST /admin/jobs/collect-all`). Na coleta automatica, ele roda por estar em `automaticJobProviders`.

O provider GitHub usa a API oficial `GET https://api.github.com/repos/{owner}/{repo}/issues` para ler issues publicas abertas de:

- `frontendbr/vagas`
- `backend-br/vagas`
- `react-brasil/vagas`
- `qa-brasil/vagas`
- `nodejsdevbr/vagas`
- `dotnetdevbr/vagas`
- `soujava/vagas-java`
- `DevOps-Brasil/Vagas`
- `programadores-br/geral`
- `datascience-br/vagas`
- `brasil-php/vagas`
- `androiddevbr/vagas`
- `CocoaHeadsBrasil/vagas`
- `remotejobsbr/design-ux-vagas`

Ele envia os headers `Accept: application/vnd.github+json` e `X-GitHub-Api-Version: 2022-11-28`. Quando `GITHUB_TOKEN` existe, tambem envia `Authorization: Bearer <GITHUB_TOKEN>`. Sem token, a coleta continua funcionando sem autenticacao, mas registra aviso sobre rate limit menor.

O provider usa `state=open`, `per_page=100` e `since=<data ISO de 30 dias atras>`. Como o `since` da API considera atualizacao da issue, o provider tambem filtra manualmente `created_at` e aceita somente issues criadas nos ultimos 30 dias. Pull requests retornados pela API sao ignorados. Se um repositorio falhar, o erro e logado e contabilizado no resumo, mas a coleta continua nos demais repositorios.

Durante a coleta, o provider contabiliza `totalIssuesRead`, `ignoredByDate`, `ignoredBySeniority`, `ignoredByMissingEntryLevel`, `ignoredByLocation` e erros por repositorio. O runner complementa o diagnostico com rejeicoes por qualidade, dominio, prioridade, duplicidade e aprovadas, porque esses dados dependem da avaliacao central, da deduplicacao e da escrita no banco.

A filtragem de nivel e baseada em labels. A issue so e coletada quando as labels indicam `junior`, `júnior`, `jr`, `estagio`, `estágio`, `estagiario`, `estagiário` ou `trainee`, incluindo labels compostas como `estágio remoto`. `Trainee` e tratado como nivel de entrada. Labels de `pleno`, `senior`, `sênior`, `especialista`, `tech lead`, `lead`, `staff` ou `principal` bloqueiam a coleta. Se o nivel nao puder ser identificado claramente como `Júnior`, `Estágio` ou `Trainee`, a issue nao e coletada.

O filtro geografico aceita vagas 100% remotas de qualquer cidade, estado ou pais. Vagas hibridas ou presenciais so sao aceitas quando a localizacao ou o corpo indicam Minas Gerais, incluindo referencias como `MG`, `Minas Gerais`, `Belo Horizonte`, `BH`, `Contagem`, `Betim`, `Nova Lima`, `Uberlandia`, `Juiz de Fora` e outras cidades mineiras mapeadas no provider. Quando a modalidade nao e identificada, a issue so e aceita se parecer ser de Minas Gerais. Issues rejeitadas por essa regra incrementam `ignoredByLocation` no resumo.

O titulo da issue e interpretado a partir de formatos como `[Cidade/Remoto] Cargo na Empresa`: a localizacao vem do texto entre colchetes, o cargo fica em `title` e a empresa e extraida de conectores como `na`, `no`, `na empresa` ou `para`, quando possivel. Se a empresa nao vier do titulo, o provider tenta campos confiaveis no corpo, como `Empresa:`.

O provider tambem tenta extrair `shortDescription` do corpo da issue a partir de secoes como `Descricao da vaga`, `Sobre a vaga`, `Nossa empresa` e `Responsabilidades`, mantendo um resumo curto de ate cerca de 80 palavras. As `stacks` sao extraidas por termos tecnicos conhecidos, como React, TypeScript, Node.js, SQL, Docker, Java, Python, PHP, HTML e CSS, sem inventar tecnologias. O corpo da issue tambem e salvo em `rawText` com limite de 300 palavras.

Depois da coleta, o runner automatizado normaliza, aplica filtro de dominio e qualidade, deduplica, calcula prioridade, seleciona pelo alvo da fila e cria registros como `PENDING` sem chamar IA. Vagas rejeitadas por qualidade, dominio, prioridade ou duplicidade nao sao persistidas.

A coleta GitHub nao chama IA, nao envia vagas ao Discord e nao altera o agendamento de envio. O terminal registra um resumo estruturado por repositorio e logs das rejeicoes com `reasons`. Nao ha tabela, pagina ou persistencia de logs de coleta.

## Fluxo de coleta de fontes externas

Na coleta manual, os providers externos rodam pelo botao unico `Coletar vagas` (`POST /admin/jobs/collect-all`). Na coleta automatica, eles rodam por estarem em `automaticJobProviders`:

- `himalayasProvider`, usando `https://himalayas.app/jobs/api/search`;
- `jobicyProvider`, usando `https://jobicy.com/api/v2/remote-jobs`;
- `remoteOkProvider`, usando `https://remoteok.com/api`;
- `remotiveProvider`, usando `https://remotive.com/api/remote-jobs`.

Esses providers usam apenas APIs JSON publicas. Nao usam Playwright, Cheerio, login, captcha ou scraping HTML com navegador. Cada provider faz chamadas conservadoras, com poucas queries por execucao, e retorna vagas mais metadados operacionais para o runner. Falha em uma busca ou provider e registrada no resumo e nos logs, mas nao interrompe os demais providers.

As fontes externas aplicam filtro antes do runner para reduzir ruido:

- data de publicacao nos ultimos 30 dias;
- sinais claros de nivel iniciante, como `junior`, `entry-level`, `intern`, `estagio` ou `trainee`;
- rejeicao de `senior`, `mid-level`, `lead`, `staff`, `principal`, `manager`, `director` e similares;
- vagas claramente remotas com localidade global ou compativel com Brasil, LATAM ou Americas;
- restricoes regionais incompatíveis com Brasil sao ignoradas.

Depois desse filtro, o mesmo runner central normaliza, aplica `evaluateCollectedJobQuality`, deduplica, prioriza e cria registros como `PENDING` sem IA. A coleta externa nao envia vagas ao Discord.

Jobicy, RemoteOK e Remotive exigem atribuicao/linkback. A implementacao preserva a URL original sempre que fornecida, registra `source` com o nome do provider e deixa a revisao final para o admin antes da publicacao.

Ao final da coleta manual unificada, o painel exibe o toast compacto geral da coleta. O diagnostico completo por provider segue restrito ao terminal.

## Fluxo de coleta de ATS publicos

Na coleta manual, os providers ATS publicos rodam pelo botao unico `Coletar vagas` (`POST /admin/jobs/collect-all`). Eles ficam registrados em `atsJobProviders` e nao entram na coleta automatica:

- `greenhouseProvider`, usando `https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true`;
- `leverProvider`, usando `https://api.lever.co/v0/postings/{slug}?mode=json`;
- `ashbyProvider`, usando `https://api.ashbyhq.com/posting-api/job-board/{slug}`.

A lista inicial de empresas-alvo fica em `src/providers/companyTargets.ts`:

- GitLab no Greenhouse (`gitlab`);
- Kepler Communications no Lever (`kepler`);
- Ashby no Ashby (`ashby`).

Cada provider consulta apenas os alvos cadastrados para seu ATS. A coleta usa somente endpoints JSON publicos permitidos pela politica de scraping, via `fetchPublicJson`, e nao usa Playwright, Cheerio, login, cookies, credenciais pessoais, proxy, captcha ou bypass anti-bot. Se um alvo falhar ou retornar endpoint indisponivel, o erro e contabilizado no resumo e o provider continua nos demais alvos.

Os providers ATS aplicam filtros antes do runner:

- data publicada/criada nos ultimos 30 dias quando o ATS fornece data;
- sinal claro de entrada (`junior`, `jr`, `entry-level`, `intern`, `internship`, `estagio` ou `trainee`);
- rejeicao de `senior`, `pleno`, `mid-level`, `lead`, `staff`, `principal`, `manager`, `director`, `executive`, `head of` e similares;
- remoto apenas quando for global, Brasil, LATAM ou Americas, ou quando nao houver restricao incompatível;
- hibrido/presencial somente quando a localizacao indicar Minas Gerais.

Depois desses filtros, o runner central normaliza, aplica `evaluateCollectedJobQuality`, deduplica, prioriza e cria registros como `PENDING` sem IA. A coleta ATS nao envia vagas ao Discord e nao altera schema Prisma.

Detalhes de data, nivel, localizacao, qualidade, duplicidade e erros continuam nos logs do terminal.

## Fluxo de coleta Gupy

Na coleta manual, a Gupy roda pelo botao unico `Coletar vagas` (`POST /admin/jobs/collect-all`). Na coleta automatica, ela tambem roda por estar em `automaticJobProviders`.

O provider Gupy foi implementado apos reconhecimento com Playwright MCP. A pagina publica `https://portal.gupy.io/job-search/term=...` carrega os dados pelo endpoint publico `https://employability-portal.gupy.io/api/v1/jobs`. Durante a validacao, a listagem abriu sem login, captcha, Cloudflare ou bloqueio tecnico. Se isso mudar, o provider deve ser pausado.

A coleta usa o cliente publico da camada `src/scraping/`, porque o endpoint JSON observado e mais simples e estavel que browser scraping. Ela nao usa cookies customizados, credenciais, proxy, rotacao de IP ou bypass, e nao pagina agressivamente. Consulta poucos termos de tecnologia, limita a criacao a 20 vagas por execucao, aceita vagas remotas de qualquer localidade e aceita hibridas/presenciais apenas em Minas Gerais/Belo Horizonte/regiao. Vagas com `publishedDate` acima de 30 dias sao ignoradas.

Depois dos filtros do provider, o runner central normaliza, aplica qualidade, deduplica, prioriza e cria registros como `PENDING` sem IA. A coleta Gupy nao envia ao Discord.

## Fluxo de coleta Programathor

Na coleta manual, o Programathor roda pelo botao unico `Coletar vagas` (`POST /admin/jobs/collect-all`). Na coleta automatica, ele tambem roda por estar em `automaticJobProviders`.

O provider Programathor foi implementado apos reconhecimento tecnico documentado em `docs/programathor-scraping-research.md`. A listagem publica `https://programathor.com.br/jobs` e filtros como `?expertise=J%C3%BAnior`, `?contract_type=Est%C3%A1gio`, `?remoto=true`, `?place=Belo%20Horizonte`, `/jobs-front-end`, `/jobs-quality-assurance` e `/jobs-data-science` retornam cards no HTML inicial. As paginas de detalhe publicas possuem JSON-LD `JobPosting`, incluindo `datePosted`.

A coleta usa HTML publico simples via `fetchPublicHtml`, nao usa Playwright como dependencia operacional e nao usa login, cookies autenticados, credenciais, proxy, rotacao de IP, captcha ou bypass. Se a fonte passar a exigir login, captcha, desafio Cloudflare ou bloqueio tecnico, o provider deve ser interrompido.

O provider consulta poucas fontes/termos, nao pagina agressivamente, limita a 20 vagas retornadas por execucao, ignora cards `Vencida`, filtra `datePosted` acima de 30 dias quando disponivel, exige sinal de entrada, rejeita senioridade acima de entrada e aceita remoto de qualquer lugar ou hibrido/presencial apenas em Minas Gerais/Belo Horizonte/regiao.

Depois dos filtros do provider, o runner central normaliza, aplica qualidade, deduplica, prioriza e cria registros como `PENDING` sem IA. A coleta Programathor nao envia ao Discord.

## Fluxo de coleta Remotar

Na coleta manual, a Remotar roda pelo botao unico `Coletar vagas` (`POST /admin/jobs/collect-all`). Na coleta automatica, ela roda por estar em `automaticJobProviders`.

O provider Remotar foi implementado apos reconhecimento com Playwright MCP documentado em `docs/remotar-scraping-research.md`. A home, buscas, filtros e detalhes publicos abriram sem login obrigatorio, captcha ou bloqueio tecnico. A UI chama endpoints JSON publicos como `https://api.remotar.com.br/jobs?search=desenvolvedor%20j%C3%BAnior`, `?tagId=17`, `?tagId=10`, `?categoryId=13` e combinacoes de busca, tags e categorias.

A coleta usa JSON publico via `fetchPublicJson`, nao usa Playwright como dependencia operacional e nao usa login, cookies autenticados, credenciais, proxy, rotacao de IP, captcha ou bypass. Se a fonte passar a exigir login, captcha, desafio Cloudflare ou bloqueio tecnico, o provider deve ser interrompido.

O provider consulta poucos termos/fontes, nao pagina agressivamente, limita a 20 vagas retornadas por execucao, filtra `createdAt` acima de 30 dias quando disponivel, exige sinal de entrada, rejeita senioridade acima de entrada, rejeita ruido fora de tecnologia e aceita remoto quando nao ha restricao explicita incompatível com Brasil/LATAM/Americas. A busca ampla `estagio tecnologia` foi removida; agora a Remotar usa termos como `estagio desenvolvimento`, `estagio dados`, `junior software`, `suporte tecnico`, `qa junior` e `dados junior`. Vagas hibridas/presenciais so entram quando indicam Minas Gerais/Belo Horizonte/regiao.

A Remotar tambem exige categoria tech ou classificacao `TECH` pelo `jobDomainClassifier`. Se titulo, categoria, tag ou descricao indicarem Direito, Marketing, Comercial, Administrativo, RH, Afiliados, Parcerias ou areas similares sem sinal tech forte, a vaga e rejeitada antes de salvar e contabilizada em `ignoredByQuality`.

Depois dos filtros do provider, o runner central normaliza, aplica qualidade, deduplica, prioriza e cria registros como `PENDING` sem IA. A coleta Remotar nao envia ao Discord.

A Remotar tambem roda na coleta automatica diaria por estar em `automaticJobProviders`. A coleta prepara vagas aprovadas como `PENDING`, mas nunca publica no Discord.

## Fluxo de coleta Solides

Na coleta manual, a Solides roda pelo botao unico `Coletar vagas` (`POST /admin/jobs/collect-all`). Na coleta automatica, ela tambem roda por estar em `automaticJobProviders`.

O provider Solides foi implementado apos reconhecimento com Playwright MCP documentado em `docs/solides-scraping-research.md`. A home publica `https://vagas.solides.com.br/`, a listagem `https://vagas.solides.com.br/vagas?search=desenvolvedor%20junior`, a pagina de empresa `https://solides.vagas.solides.com.br/` e detalhes como `https://solides.vagas.solides.com.br/vaga/807304` abriram sem login obrigatorio, captcha ou bloqueio tecnico. A UI chama endpoints JSON publicos como `https://apigw.solides.com.br/jobs/v3/portal-vacancies-new?search=&title=desenvolvedor%20junior&locations=&take=14&page=1` e `https://apigw.solides.com.br/jobs/v3/home/vacancy?take=12&slug=solides&title=&locations=&page=1`.

A coleta usa JSON publico via `fetchPublicJson`, nao usa Playwright como dependencia operacional e nao usa login, cookies autenticados, credenciais, proxy, rotacao de IP, captcha ou bypass. Se a fonte passar a exigir login, captcha, desafio Cloudflare ou bloqueio tecnico, o provider deve ser interrompido.

O provider consulta os termos `estágio tecnologia`, `desenvolvedor junior`, `junior tecnologia`, `suporte técnico`, `qa junior`, `dados junior` e `remoto junior`, nao pagina agressivamente, limita a 20 vagas retornadas por execucao, filtra `createdAt` acima de 30 dias, exige sinal de entrada ou suporte tecnico, rejeita senioridade acima de entrada, rejeita `NON_TECH` e aceita `POSSIBLY_TECH` somente quando ha sinal forte em area, hard skills, stack ou texto. Vagas remotas sao aceitas quando nao ha restricao explicita incompatível; hibridas/presenciais so entram quando indicam Minas Gerais/Belo Horizonte/regiao.

Depois dos filtros do provider, o runner central normaliza, aplica qualidade, deduplica, prioriza e cria registros como `PENDING` sem IA. A coleta Solides nao envia ao Discord.

A Solides tambem roda na coleta automatica diaria por estar em `automaticJobProviders`. A coleta prepara vagas aprovadas como `PENDING`, mas nunca publica no Discord.

## Fluxo de coleta automatica

O painel admin inicia `scheduledCollector` junto com o processo de `npm run admin`.

A coleta automatica roda diariamente as 08:00 no timezone `America/Sao_Paulo`, usando `node-cron` com a expressao `0 8 * * *`.

Ela executa os providers registrados em `automaticJobProviders`: GitHub, Himalayas, Jobicy, RemoteOK, Remotive, Remotar, Gupy, Programathor e Solides. Os providers ATS ficam em `atsJobProviders` e nao entram na coleta automatica nesta etapa.

A coleta automatica chama o mesmo runner de providers, entao preserva as regras centrais da etapa de coleta:

- cria apenas vagas aprovadas como `PENDING`;
- salva `useAi = true` e deixa `aiGeneratedText` vazio quando nao ha mensagem pronta;
- nao chama Gemini durante a coleta;
- nao envia ao Discord;
- reaproveita normalizacao, filtro de dominio, filtro de qualidade, deduplicacao e prioridade.

Antes de coletar, `runAutomatedJobCollection` calcula o alvo da fila: `min(max(dailyLimit * 7, dailyLimit), 30)`. Ele cria ate `queueTarget - PENDING atuais` vagas e nao considera `SENT` hoje. Se a fila ja estiver cheia, nenhuma vaga e criada. O limite diario continua controlando apenas o envio pelo scheduler.

O botao legado `Processar rascunhos legados` aparece apenas quando ha vagas `DRAFT` antigas. Ele usa `autoApproveJobsForToday` para preparar esses registros antigos, mas nao faz parte do fluxo principal de coleta.

O servico possui um lock simples em memoria (`isCollecting`). Se uma coleta manual unificada ou automatica ja estiver em execucao, a nova execucao e ignorada com log amigavel. Esse lock evita concorrencia dentro do mesmo processo admin e nao cria estado no banco.

Falhas na coleta automatica sao capturadas e registradas no logger. O processo do painel nao deve cair por erro de provider.

## Fluxo de publicacao agendada

1. O admin acessa `Configuracoes de envio` no painel.
2. O admin escolhe a quantidade de vagas por dia em um select e um horario para cada vaga diaria. O timezone nao e editavel e o backend sempre persiste `America/Sao_Paulo`.
3. A configuracao e salva no banco pelo model `SchedulerSettings`.
4. O painel admin agrupa horarios repetidos e registra um cron para cada horario unico em `sendTimes`, usando `America/Sao_Paulo`.
5. Cada item de `sendTimes` representa 1 slot de envio. Horarios duplicados significam multiplos slots no mesmo horario.
6. Em cada execucao, `scheduledPublisher` recarrega a configuracao do banco.
7. Se o agendamento estiver desativado, o horario nao estiver mais configurado ou o limite diario ja tiver sido atingido, nada e enviado.
8. O limite diario considera vagas `SENT` com `sentAt` dentro do dia atual no timezone configurado.
9. Quando ainda ha limite restante, o scheduler chama `publishPendingJobs({ limit })`, usando o menor valor entre os slots daquele horario e o limite restante do dia.

O envio agendado nao duplica a logica de envio: a resolucao da mensagem, envio ao Discord e atualizacao de status continuam concentrados em `publishPendingJobs`.

O envio manual continua disponivel no painel e, nesta etapa, nao e bloqueado pelo limite diario. Como o limite agendado conta vagas enviadas por `sentAt`, envios manuais feitos no mesmo dia reduzem o limite restante para execucoes agendadas futuras.

A tela `/admin/settings/schedule` tambem mostra um resumo operacional com status do agendamento, limite diario, vagas enviadas hoje, restante do dia, timezone do sistema, slots configurados e a fila das proximas vagas `PENDING`, ordenadas por `createdAt` asc como no envio.

## Papel do painel admin

O painel admin e a interface operacional do projeto. Ele permite criar, revisar, editar, visualizar, arquivar, preparar vagas para publicacao e configurar o envio agendado.

A listagem `/admin/jobs` organiza as vagas por fluxo operacional:

- `Prontas para envio`: vagas `PENDING`, que podem ser enviadas manualmente pela listagem ou pelo agendamento. Elas podem ja ter mensagem pronta ou aguardar geracao no envio.
- `Historico recente`: vagas `SENT` e `ERROR`, limitado visualmente as mais recentes para manter a tela leve.
- `Arquivadas`: vagas `ARCHIVED`, exibidas no final com limite visual simples.
- `Rascunhos legados`: exibida apenas quando existem vagas `DRAFT` antigas, com acao para processar legado ou arquivar.

Essa organizacao de secoes e visual. As mudancas de status continuam acontecendo apenas pelas rotas explicitas de preparo manual, processamento legado, envio, edicao e arquivamento.

O feedback operacional do painel e exibido por notificacoes temporarias server-rendered, usando query params como `message` e `noticeType`. Essas notificacoes nao sao logs persistentes, nao criam tabela no banco e nao substituem os logs da aplicacao.

Nas coletas de providers, essas notificacoes sao deliberadamente compactas. O painel mostra aprovadas, recusadas, duplicatas e erros; detalhes como descartes por data, senioridade, localizacao, qualidade, prioridade e duplicidade continuam no terminal.

Na interface, os status sao exibidos com nomes amigaveis:

- `DRAFT`: Rascunho.
- `PENDING`: Pronta para envio.
- `SENT`: Enviada.
- `ERROR`: Erro.
- `ARCHIVED`: Arquivada.

Esses labels nao alteram o enum do banco.

Ele nao deve conter regras complexas de coleta automatica. A responsabilidade principal do painel e apoiar revisao humana e operacao manual segura.

## Papel do banco

O PostgreSQL armazena as vagas, seus textos, metadados, status, datas de criacao/atualizacao/envio e informacoes usadas na geracao da mensagem.

O banco tambem armazena `SchedulerSettings`, que guarda se o agendamento esta ativo, o limite diario, o timezone e os horarios de envio. O campo de timezone existe por compatibilidade, mas o painel sempre salva `America/Sao_Paulo`.

A deduplicacao atual nao usa constraint unica nem altera o schema. Ela consulta os registros existentes via Prisma e compara valores normalizados em `jobDeduplication`. O banco continuara sendo o ponto natural para deduplicacao mais forte quando providers de coleta forem adicionados.

## Papel do Discord

O Discord e o canal de distribuicao para os alunos. O sistema deve enviar mensagens curtas, bem formatadas e uteis para leitura rapida.

As vagas sao enviadas como Discord embeds/cards para separar visualmente publicacoes consecutivas feitas pelo mesmo bot. O `content` fica curto (`Nova vaga para PDevs`) e o card concentra titulo, descricao, metadados opcionais, fonte e timestamp. O conteudo da descricao continua vindo da mesma ordem de resolucao: `readyText`, `aiGeneratedText`, Gemini no envio ou fallback deterministico. O scheduler nao muda; ele continua chamando `publishPendingJobs`.

O Discord nao deve ser usado como fonte da verdade das vagas; a fonte da verdade e o banco.

## Papel da IA

A IA ajuda a transformar textos longos de vagas em mensagens curtas e revisaveis para Discord.

Ela deve:

- resumir descricoes extensas;
- manter informacoes importantes para alunos iniciantes;
- evitar inventar dados;
- respeitar campos estruturados;
- produzir texto formatado em Markdown para Discord.

A IA nao deve ser tratada como etapa obrigatoria. O sistema precisa continuar publicando com `readyText` ou fallback deterministico quando necessario. Gemini roda no envio, nao na coleta.
