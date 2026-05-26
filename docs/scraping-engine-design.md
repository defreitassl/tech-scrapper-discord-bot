# Desenho da Camada de Scraping

Este documento descreve a base tecnica para futuras fontes mais dificeis. Ele nao autoriza implementar scraping de plataformas grandes nesta etapa.

## Por que isolar scraping dificil

Scraping de paginas externas e mais instavel que APIs, RSS e listas publicas. Layouts mudam, conteudo pode depender de JavaScript, requisicoes podem receber bloqueios e algumas plataformas possuem termos restritivos.

Por isso, scraping deve ficar em uma camada separada de `src/providers/`. A camada `src/scraping/` deve concentrar utilitarios, politica de permissao e clientes publicos simples. Providers continuam responsaveis por transformar resultados em vagas normalizadas e entregar dados ao `providerRunner`.

Essa separacao evita que detalhes de rede, HTML ou browser vazem para o runner, para o painel admin, para Prisma ou para o envio ao Discord.

## Tipos de fonte

### API publica

E a opcao preferida. APIs publicas ou autorizadas tendem a ter formato estruturado, contrato mais claro e menor risco operacional. Quando a fonte tiver JSON publico estavel, um provider deve usar `api`.

Greenhouse, Lever e Ashby foram adicionados nessa categoria para a primeira leva de ATS publicos. Eles usam apenas endpoints JSON publicos por empresa cadastrada:

- Greenhouse: `https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true`;
- Lever: `https://api.lever.co/v0/postings/{slug}?mode=json`;
- Ashby: `https://api.ashbyhq.com/posting-api/job-board/{slug}`.

Esses providers usam `fetchPublicJson` e passam pela politica `api`. Nao usam browser, Cheerio, login, cookies, credenciais pessoais, proxy, captcha, Cloudflare bypass ou bypass anti-bot.

A Remotar tambem foi classificada nesta categoria apos reconhecimento com Playwright MCP: a UI publica carrega vagas por `https://api.remotar.com.br/jobs`, com filtros publicos por `search`, `tagId` e `categoryId`. O provider usa `fetchPublicJson`, limite baixo, rota manual propria e, desde 2026-05-25, tambem roda na coleta automatica diaria por `realJobProviders`.

### RSS publico

RSS tambem e preferivel a HTML. O formato e simples, estruturado e normalmente feito para consumo automatizado. Quando existir RSS publico, ele deve vir antes de HTML.

### HTML simples

HTML publico simples pode ser usado quando nao houver API ou RSS. A pagina deve ser acessivel sem login, captcha, paywall ou bloqueio anti-bot. O parsing deve ser conservador e aceitar falhas sem derrubar o processo.

O Programathor foi classificado nesta categoria apos pesquisa especifica: nao foi encontrado endpoint JSON publico de vagas, mas as listagens publicas entregam cards no HTML inicial e as paginas de detalhe possuem JSON-LD publico `JobPosting`. O provider experimental usa `fetchPublicHtml`, limite baixo, rota manual e segue fora da coleta automatica.

### Browser/Playwright

Browser scraping deve ser ultimo caso. Ele so deve ser considerado quando:

- a pagina e publica;
- nao ha API, RSS ou HTML simples suficiente;
- a pagina depende fortemente de JavaScript;
- nao ha login, captcha, paywall ou bloqueio conhecido;
- a coleta respeita termos, frequencia baixa e revisao humana.

Playwright agora existe apenas como infraestrutura base isolada para futuras paginas publicas dinamicas. Isso nao autoriza implementar uma plataforma real: cada fonte concreta ainda precisa justificar o custo, passar pela politica e comecar manualmente, desligada da coleta automatica.

## Quando usar Cheerio

Cheerio deve ser usado quando uma pagina publica simples exige seletores HTML mais confiaveis do que regex/helpers leves. Ele e mais barato e previsivel que browser.

Antes de adicionar Cheerio, valide se os helpers existentes em `src/scraping/htmlUtils.ts` e `src/providers/providerTextUtils.ts` resolvem o caso.

## Quando usar Playwright

Use Playwright somente se a fonte for publica, permitida pela politica e realmente depender de JavaScript para renderizar os dados. Mesmo nesse caso, o scraper deve ser pequeno, ter timeout, baixa frequencia, logs claros e nunca simular login ou contornar bloqueios.

A base tecnica fica em `src/scraping/browser/`:

- `types.ts`: `BrowserScrapingConfig`, `BrowserScrapingResult`, `BrowserExtractedJob` e `BrowserScrapingStats`.
- `browserPolicy.ts`: bloqueia pagina nao publica, login, captcha, bypass, credenciais, cookies customizados, proxy e rotacao de IP.
- `browserClient.ts`: cria contexto Playwright com `headless: true` por padrao, timeout conservador, User-Agent identificavel, sem cookies customizados e sem proxy.
- `pageUtils.ts`: helpers para navegar, aguardar seletores, extrair texto, links e normalizar texto.

O provider `src/providers/playwrightSmokeTest.provider.ts` existe apenas para smoke test em pagina publica simples. Ele nao esta registrado no registry de providers, nao entra na coleta automatica, nao cria vagas, nao chama IA e nao envia ao Discord.

A pesquisa Gupy (`docs/gupy-scraping-research.md`) usou Playwright MCP para observar a UI publica e a rede. A implementacao experimental usa somente acesso publico, fica em `experimentalJobProviders`, nao entra na coleta automatica e deve ser removida/desativada se surgir login, captcha, Cloudflare/bypass ou exigencia de credenciais.

A pesquisa Programathor (`docs/programathor-scraping-research.md`) tambem usou validacao de paginas publicas durante o reconhecimento, mas a implementacao nao usa browser scraping. Como o HTML inicial e suficiente, o provider `src/providers/programathor.provider.ts` usa a camada publica simples de `src/scraping/`, fica em `experimentalJobProviders`, roda pela coleta manual unificada `POST /admin/jobs/collect-all` e deve ser removido/desativado se surgir login, captcha, Cloudflare/bypass ou exigencia de credenciais.

A pesquisa Remotar (`docs/remotar-scraping-research.md`) usou Playwright MCP para navegar na UI publica, clicar em vaga, observar filtros e inspecionar a rede. A implementacao nao usa browser scraping porque o JSON publico observado e suficiente. O provider `src/providers/remotar.provider.ts` usa `fetchPublicJson`, fica em `realJobProviders`, tambem roda pela coleta manual unificada `POST /admin/jobs/collect-all` e deve ser removido/desativado se surgir login, captcha, Cloudflare/bypass ou exigencia de credenciais.

## Riscos de plataformas com login/captcha

Fontes com login, captcha, Cloudflare/bloqueios anti-bot, paywall ou termos explicitamente incompativeis nao devem ser implementadas. O projeto nao deve:

- usar credenciais pessoais;
- simular usuario autenticado;
- burlar captcha;
- burlar Cloudflare ou bloqueios tecnicos;
- rotacionar IP ou user agent para contornar restricoes;
- raspar conteudo que dependa de acesso privado.

## Politica de permissao

Toda fonte dificil deve passar por decisao explicita antes de virar provider. A base inicial esta em `src/scraping/scrapingPolicy.ts`:

- API publica: permitida.
- RSS publico: permitido.
- HTML publico simples: permitido.
- Browser: permitido apenas sem login, captcha ou bloqueio conhecido.
- Login: bloqueado.
- Captcha: bloqueado.
- Necessidade de bypass anti-bot: bloqueada.
- Termos explicitamente incompativeis registrados: bloqueado.
- Credenciais, cookies customizados, proxy e rotacao de IP: bloqueados para browser scraping.

## Contrato com providerRunner

A camada de scraping nao deve salvar no banco. Um scraper deve retornar dados para um provider, e o provider deve converter os dados para o contrato de coleta.

Fluxo esperado:

1. Scraper busca dados publicos permitidos.
2. Scraper retorna `ScrapingResult` com `ScrapedJob[]`, erros e metadados.
3. Provider converte `ScrapedJob` para `CollectedJob` quando necessario.
4. Provider retorna `CollectedJob[]` ou `ProviderCollectResult`.
5. `providerRunner` normaliza, aplica filtro de qualidade, deduplica e cria registros.

Enquanto a regra atual nao mudar, toda vaga coletada automaticamente deve ser criada como `DRAFT`, com `useAi = false`, sem chamar Gemini e sem enviar ao Discord.

Na coleta ATS manual, os providers Greenhouse, Lever e Ashby tambem seguem esse contrato. A lista de empresas-alvo fica em `src/providers/companyTargets.ts`, falha em uma empresa nao quebra o provider inteiro e o runner continua responsavel por normalizacao, qualidade, deduplicacao e criacao como `DRAFT`.

## Auto-avaliacao futura

No futuro, pode existir uma etapa de auto-avaliacao para decidir se uma vaga coletada tem qualidade suficiente para entrar como `PENDING`. Essa decisao deve ser implementada fora do scraper bruto e antes da publicacao, com criterios auditaveis.

Mesmo nessa evolucao, a arquitetura deve manter:

- fonte original preservada;
- deduplicacao central;
- logs de decisao;
- politica de scraping respeitada;
- bloqueio de login, captcha e bypass;
- possibilidade de revisao humana.
