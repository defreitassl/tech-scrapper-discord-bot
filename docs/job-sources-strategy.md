# Estrategia de Fontes de Vagas

O projeto nao deve depender apenas de web scraping. Scraping e util em alguns cenarios, mas e fragil, pode quebrar com mudancas de layout e pode envolver restricoes tecnicas ou legais dependendo da fonte.

A estrategia recomendada e combinar fontes simples, revisaveis e sustentaveis.

## Tipos de fonte

### Cadastro manual

Fonte atual do projeto. E simples, confiavel e permite revisao humana antes da publicacao.

Deve continuar existindo mesmo quando houver automacao.

### RSS

Quando disponivel, RSS e uma boa fonte para coleta automatica. Tem formato estruturado, e mais estavel que HTML e reduz custo de manutencao.

### APIs

APIs publicas ou autorizadas sao preferiveis a scraping. Elas tendem a ser mais estaveis, possuem contratos claros e podem oferecer metadados melhores.

Nesta etapa, foram adicionados quatro providers externos por APIs publicas JSON:

- Himalayas, via `https://himalayas.app/jobs/api/search`;
- Jobicy, via `https://jobicy.com/api/v2/remote-jobs`;
- RemoteOK, via `https://remoteok.com/api`;
- Remotive, via `https://remotive.com/api/remote-jobs`.

Esses providers nao usam Playwright, Cheerio, login, captcha ou scraping com navegador. Eles fazem poucas chamadas por execucao, filtram vagas dos ultimos 30 dias, aceitam somente sinais claros de junior/entry-level/intern/estagio/trainee e rejeitam senioridade alta ou intermediaria. Como sao fontes remotas, a coleta aceita apenas vagas com localidade global ou compativel com Brasil, LATAM ou Americas.

Jobicy, RemoteOK e Remotive exigem atribuicao/linkback. O projeto preserva a URL original da vaga e registra `source` para que a revisao humana mantenha a origem visivel na publicacao.

### ATS publicos por empresa

Greenhouse, Lever e Ashby foram adicionados como primeira etapa de ATS publicos. Eles nao sao tratados como scraping pesado: cada provider usa endpoints JSON publicos por empresa, sem navegador, sem Cheerio, sem login, sem cookies, sem credenciais pessoais, sem proxy e sem bypass de captcha, Cloudflare ou anti-bot.

Endpoints usados:

- Greenhouse: `https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true`;
- Lever: `https://api.lever.co/v0/postings/{slug}?mode=json`;
- Ashby: `https://api.ashbyhq.com/posting-api/job-board/{slug}`.

A lista de empresas-alvo e controlada em `src/providers/companyTargets.ts` e comeca pequena:

- GitLab no Greenhouse;
- Kepler Communications no Lever;
- Ashby no Ashby.

Os providers ATS consultam apenas empresas cadastradas nessa lista. Se um endpoint falhar ou deixar de existir, a falha e registrada e os demais alvos continuam. A coleta aceita apenas vagas recentes, com sinal claro de entrada, localizacao compatível e revisao humana obrigatoria.

Nesta etapa, ATS publicos ficam na coleta manual unificada pelo botao `Coletar vagas`. Eles nao entram na coleta automatica configuravel ate a lista de empresas e o volume de chamadas amadurecerem.

### Solides automatica

A Solides foi investigada com Playwright MCP em `docs/solides-scraping-research.md`. O portal publico renderiza a busca com JavaScript, mas os dados foram observados em endpoint JSON publico:

```text
https://apigw.solides.com.br/jobs/v3/portal-vacancies-new
```

Paginas publicas de empresa tambem usam JSON publico em:

```text
https://apigw.solides.com.br/jobs/v3/home/vacancy
```

Por isso, a estrategia atual usa esse JSON publico com baixo volume. O provider `src/providers/solides.provider.ts` entra na coleta automatica configuravel e tambem na coleta manual unificada `POST /admin/jobs/collect-all`.

Regras da coleta:

- reconhecimento feito com Playwright MCP;
- sem login;
- sem cookies autenticados;
- sem credenciais pessoais;
- sem proxy ou rotacao de IP;
- sem captcha ou bypass;
- sem Playwright operacional, porque JSON publico e suficiente;
- sem paginacao agressiva;
- limite de 20 vagas retornadas por execucao;
- vagas aprovadas como `PENDING`;
- `useAi = true`;
- sem chamada de IA durante a coleta;
- sem Discord;
- exige vaga `TECH` ou `POSSIBLY_TECH` com sinal forte;
- rejeita `NON_TECH`, pleno, senior, lead, especialista, manager, coordinator e similares;
- aceita remoto ou hibrido/presencial apenas em Minas Gerais/Belo Horizonte/regiao.

Se a Solides passar a exigir login, captcha, Cloudflare/bypass, proxy, credenciais ou qualquer contorno tecnico, a coleta deve ser interrompida.

### GitHub e listas publicas

Repositorios, arquivos Markdown, listas publicas e curadorias abertas podem ser boas fontes. Devem ser tratados como dados semi-estruturados e sempre registrar URL de origem.

Nesta etapa, o primeiro provider real usa issues publicas do GitHub nos repositorios `frontendbr/vagas`, `backend-br/vagas`, `react-brasil/vagas`, `qa-brasil/vagas`, `nodejsdevbr/vagas`, `dotnetdevbr/vagas`, `soujava/vagas-java`, `DevOps-Brasil/Vagas`, `programadores-br/geral`, `datascience-br/vagas`, `brasil-php/vagas`, `androiddevbr/vagas`, `CocoaHeadsBrasil/vagas` e `remotejobsbr/design-ux-vagas`. Essa escolha evita scraping HTML e usa uma API publica com contrato mais estavel.

Regras atuais do provider GitHub:

- usa a API oficial do GitHub para listar issues;
- coleta apenas issues abertas;
- coleta apenas issues criadas nos ultimos 30 dias;
- segue nos demais repositorios quando um repositorio falha e contabiliza o erro no resumo;
- filtra por labels de `junior`, `júnior`, `jr`, `estagio`, `estágio`, `estagiario`, `estagiário` ou `trainee`, incluindo labels compostas como `estágio remoto`;
- trata `trainee` como nivel de entrada;
- ignora labels de `pleno`, `senior`, `sênior`, `especialista`, `tech lead`, `lead`, `staff` e `principal`;
- aceita vagas remotas de qualquer lugar;
- aceita vagas hibridas ou presenciais somente quando indicam Minas Gerais;
- ignora e contabiliza vagas hibridas/presenciais fora de Minas Gerais no resumo da coleta;
- aplica filtro deterministico de qualidade antes de salvar, rejeitando vagas sem titulo, sem canal claro de candidatura (URL ou e-mail no texto), sem descricao util, vagas com sinais fortes de senioridade/experiencia alta ou vagas fora de tecnologia;
- extrai `shortDescription` e `stacks` do corpo da issue quando ha informacao suficiente;
- aprova vagas elegiveis como `PENDING`;
- nao chama IA durante a coleta;
- nao envia ao Discord;
- aceita `GITHUB_TOKEN` opcional para aumentar o rate limit.

Depois da coleta, vagas boas ja entram na fila `PENDING` sem mensagem gerada por IA. Vagas ruins ou duplicadas nao sao persistidas.

O filtro de qualidade reduz ruido antes da criacao e registra rejeicoes em `rejectedByQuality` com os motivos no terminal.

Alem do filtro de qualidade, o runner calcula uma prioridade deterministica para cada vaga antes da aprovacao. A prioridade valoriza principalmente estagio remoto em tecnologia, estagio em Minas Gerais/BH/regiao, trainee remoto e junior remoto. Vagas `LOW` sao recusadas; vagas `MEDIUM` so seguem quando forem estagio, trainee, remotas ou tiverem `priorityScore >= 75`.

A prioridade e persistida no banco no `JobPost` aprovado com `priority`, `priorityScore` e `priorityReasons`. `priority` usa o enum `JobPriority` (`HIGH`, `MEDIUM`, `LOW`), `priorityScore` guarda a pontuacao numerica e `priorityReasons` guarda os motivos serializados como JSON string. Os logs mostram pontuacao e motivos.

A aprovacao roda dentro do pipeline de coleta. Ela nunca aprova `LOW`, exige URL e `rawText` ou `shortDescription`, e bloqueia sinais fortes de senioridade alta. Vagas `HIGH` podem ser colocadas automaticamente na fila. Vagas `MEDIUM` so entram quando forem estagio, trainee, remotas ou tiverem `priorityScore >= 75`. A rotina marca `useAi = true`, deixa `aiGeneratedText` vazio e cria `PENDING`; Gemini sera chamado somente no envio. Ela nao envia ao Discord.

Alem da coleta manual no painel, o processo admin agenda a coleta dos providers automaticos conforme a configuracao salva em `/admin/settings/collection`: ativada ou desativada, 1x ou 2x por semana, dias da semana e horario fixo em `America/Sao_Paulo`. Essa rotina executa GitHub, as APIs externas registradas, Remotar, Gupy, Programathor e Solides; nao executa ATS publicos. Antes de criar vagas, calcula a fila alvo `min(max(dailyLimit * 7, dailyLimit), 30)` e cria somente o que falta para completar `PENDING`, sem descontar vagas `SENT` hoje.

### Paginas publicas simples

Paginas HTML estaticas ou pouco dinamicas podem ser coletadas com baixo risco usando parsing simples.

Para futuras fontes HTML, use a camada isolada `src/scraping/` como base tecnica e consulte `docs/scraping-engine-design.md`. Ela separa politica, fetch publico e utilitarios HTML do contrato de providers.

### Scraping com Cheerio

Cheerio deve ser a primeira opcao quando scraping HTML for necessario. Ele e mais leve que um navegador real e suficiente para paginas publicas simples.

### Scraping com Playwright

Playwright deve ser usado somente em ultimo caso, quando a pagina depende fortemente de JavaScript e nao ha API, RSS ou HTML simples disponivel.

Ele e mais caro, mais lento e mais sujeito a bloqueios.

Browser scraping so pode ser considerado quando a pagina for publica e nao exigir login, captcha, paywall, bypass anti-bot ou credenciais pessoais. A infraestrutura Playwright ja existe, mas deve ser usada apenas em fluxos manuais/experimentais ate decisao explicita.

### Gupy automatica

A Gupy foi investigada com Playwright MCP em `docs/gupy-scraping-research.md`. O portal publico renderiza a busca com JavaScript, mas os dados foram observados em endpoint JSON publico:

```text
https://employability-portal.gupy.io/api/v1/jobs
```

Por isso, a estrategia atual usa esse JSON publico com baixo volume. O provider `src/providers/gupy.provider.ts` entra na coleta automatica e na coleta manual unificada `POST /admin/jobs/collect-all`.

Se a Gupy passar a exigir login, captcha, cookies autenticados, Cloudflare/bypass, proxy ou credenciais, a coleta deve ser interrompida.

### Programathor automatica

O Programathor foi investigado em `docs/programathor-scraping-research.md`. Nao foi encontrado endpoint JSON publico de vagas, mas as listagens publicas retornam cards no HTML inicial e os detalhes das vagas possuem JSON-LD `JobPosting` com `datePosted`.

Por isso, a estrategia atual usa HTML publico simples em baixo volume. O provider `src/providers/programathor.provider.ts` entra na coleta automatica e na coleta manual unificada.

Regras do experimento:

- sem login;
- sem cookies autenticados;
- sem credenciais pessoais;
- sem proxy ou rotacao de IP;
- sem captcha ou bypass;
- sem Playwright operacional;
- sem paginacao agressiva;
- limite de 20 vagas retornadas por execucao;
- vagas aprovadas como `PENDING`;
- `useAi = true`;
- sem chamada de IA durante a coleta;
- sem Discord.

Se o Programathor passar a exigir login, captcha, Cloudflare/bypass, proxy, credenciais ou qualquer contorno tecnico, a coleta deve ser interrompida.

### Remotar automatica

A Remotar foi investigada com Playwright MCP em `docs/remotar-scraping-research.md`. A UI publica renderiza listagens com JavaScript, mas os dados foram observados em endpoint JSON publico:

```text
https://api.remotar.com.br/jobs
```

Por isso, a estrategia atual usa esse JSON publico em baixo volume. Apos a revisao operacional de 2026-05-25, a Remotar passou a rodar na coleta automatica de baixa frequencia por apresentar melhor volume e aderencia entre os providers avaliados. A Remotar tambem roda pela coleta manual unificada.

Regras da coleta:

- reconhecimento feito com Playwright MCP;
- sem login;
- sem cookies autenticados;
- sem credenciais pessoais;
- sem proxy ou rotacao de IP;
- sem captcha ou bypass;
- sem Playwright operacional, porque JSON publico e suficiente;
- sem paginacao agressiva;
- limite de 20 vagas retornadas por execucao;
- vagas aprovadas como `PENDING`;
- `useAi = true`;
- sem chamada de IA durante a coleta;
- sem Discord.
- exige categoria tech ou classificacao `TECH`, rejeitando Direito, Marketing, Comercial, Administrativo, RH, Afiliados, Parcerias e areas similares quando nao houver sinal tech forte;
- nao usa mais busca ampla como `estagio tecnologia`.

A Remotar segue o mesmo contrato automatizado: vagas elegiveis podem virar `PENDING` sem IA; recusadas nao sao persistidas. Gupy, Programathor e Solides tambem entram na coleta automatica.

Se a Remotar passar a exigir login, captcha, Cloudflare/bypass, proxy, credenciais ou qualquer contorno tecnico, a coleta deve ser interrompida.

## Riscos de LinkedIn, Gupy e Solides

LinkedIn, Gupy, Solides e plataformas similares podem ter:

- protecoes anti-bot;
- conteudo dependente de JavaScript;
- termos de uso restritivos;
- mudancas frequentes de layout;
- necessidade de login;
- bloqueios por IP, captcha ou rate limit.

Essas fontes nao devem ser o ponto de partida. Tambem nao se deve tentar burlar login, captcha ou bloqueios.

Antes de implementar qualquer plataforma maior, consulte `docs/scraping-platforms-research.md`. O LinkedIn ja foi investigado em `docs/linkedin-scraping-research.md`: nao foi encontrado JSON publico de vagas, a UI publica limita navegacao com login e carrega protecoes anti-abuso. A recomendacao atual e priorizar Greenhouse, Lever, Ashby, sites proprios de empresas e paginas publicas de carreiras quando houver API publica, RSS, endpoint JSON publico ou HTML simples. LinkedIn deve ser evitado; Remotar, Gupy, Programathor e Solides rodam na coleta automatica por fontes publicas validadas e baixa frequencia.

## Recomendacao

Comecar por fontes simples, publicas e revisaveis:

- cadastro manual;
- listas publicas;
- RSS;
- APIs;
- paginas HTML simples.

Na fase atual, vagas coletadas automaticamente nao entram mais como `DRAFT`. O pipeline aprova boas vagas como `PENDING` sem chamar Gemini e recusa as demais sem persistir. A publicacao, a geracao de IA e o fallback deterministico acontecem somente pelo scheduler de envio ou por acao manual.

Fontes como Arbeitnow, Findwork, Jobdata e LinkedIn continuam fora desta etapa por menor aderencia, necessidade de chave/login, uso comercial, captcha, protecoes anti-bot ou risco de scraping pesado. Remotar, Gupy, Programathor e Solides ficam na coleta automatica configuravel por fontes publicas observadas e baixo volume. Greenhouse, Lever e Ashby ficam limitados ao botao manual.
