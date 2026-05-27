# Pesquisa Tecnica: LinkedIn

Data da investigacao: 2026-05-27.

## Resumo

O LinkedIn nao e recomendado como provider do projeto.

A investigacao com Playwright mostrou que algumas listagens e detalhes de vagas ficam parcialmente visiveis sem login, mas nao foi encontrado endpoint JSON publico de vagas. Os endpoints observados retornam HTML fragmentado ou paginas HTML completas, a experiencia publica exibe modal de login para continuar vendo vagas e a pagina carrega protecoes/telemetria anti-abuso, incluindo scripts `protechts` com parametro `uc=scraping`.

Recomendacao: nao implementar scraping de LinkedIn. Usar apenas API oficial autorizada, parceria, curadoria manual de links ou fontes alternativas mais simples.

## URLs analisadas

- `https://www.linkedin.com/jobs/search/?keywords=desenvolvedor%20junior&location=Brasil`
- `https://www.linkedin.com/jobs/search/?keywords=desenvolvedor%20junior&geoId=106057199&location=Brazil&f_TPR=r604800&position=1&pageNum=0`
- `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=desenvolvedor%20junior&geoId=106057199&location=Brazil&f_TPR=r604800&start=0`
- `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=desenvolvedor%20junior&geoId=106057199&location=Brazil&f_TPR=r604800&start=10`
- `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/4090954918?refId=...&trackingId=...`
- `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/4416101000?refId=...&trackingId=...`

Observacao: a URL com `location=Brasil` abriu, mas a UI mostrou resultados em `United States`. A URL com `geoId=106057199` mostrou resultados em `Brazil`.

## JSON publico

Nao foi encontrado JSON publico de vagas.

Endpoints observados:

```text
GET https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?... 
GET https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/{jobId}?refId=...&trackingId=...
```

Ambos responderam `200`, mas com `content-type: text/html; charset=utf-8`. A listagem `seeMoreJobPostings` retorna fragmentos HTML com `<li>` e cards de vaga; `jobPosting` retorna HTML de detalhe da vaga.

Tambem foram observadas chamadas de telemetria e metadados, como:

```text
GET https://www.linkedin.com/litms/api/metadata/user
POST https://www.linkedin.com/jobs-guest/api/ingraphs/gauge
POST https://www.linkedin.com/jobs-guest/api/ingraphs/counter
POST https://www.linkedin.com/li/track
```

Essas chamadas nao sao contrato publico de coleta de vagas.

## Login, captcha e bloqueios

Durante o reconhecimento:

- a listagem publica carregou uma primeira pagina de cards sem login;
- a pagina exibiu modal `Sign in to view more jobs`;
- links de `Apply`, `Save`, `See who ... has hired` e recursos de IA apontaram para login ou abriram contexto de login;
- nao foi usado login;
- nao foram usados cookies autenticados, credenciais, proxy ou rotacao de IP;
- nao apareceu captcha visual durante a investigacao;
- nao houve tentativa de burlar bloqueios.

Sinais de risco/bloqueio observados:

- scripts e frames de protecao em `li.protechts.net`, `client.protechts.net` e `collector-pxdojv695v.protechts.net`;
- URL de protecao com parametro `uc=scraping`;
- pagina servida via Cloudflare;
- modal de login imposto durante a navegacao publica;
- alto volume de telemetria e tracking no carregamento.

Esses sinais tornam a fonte inadequada para coleta automatica do projeto.

## HTML, JavaScript e seletores

A listagem publica e JavaScript-heavy na pagina principal, mas os cards tambem aparecem em HTML inicial/fragmentado.

Seletores/estruturas encontrados na listagem:

- busca por cargo: `combobox` com o valor do termo pesquisado;
- busca por localizacao: `combobox` com o valor da localizacao;
- filtros visiveis: `Any time`/`Past week`, `Company`, `Job type`, `Experience level`, `Location`, `Salary`, `Remote`;
- lista de vagas: `li` contendo `.base-search-card.job-search-card`;
- id externo: atributo `data-entity-urn="urn:li:jobPosting:{id}"`;
- link da vaga: `a.base-card__full-link`;
- titulo: `.base-search-card__title`;
- empresa: `.base-search-card__subtitle`;
- localizacao: `.job-search-card__location`;
- data: `time.job-search-card__listdate` ou `time.job-search-card__listdate--new`;
- sinal operacional: `.job-posting-benefits__text`, por exemplo `Actively Hiring`.

Seletores/estruturas encontrados no detalhe:

- topo da vaga: `.top-card-layout`;
- titulo: `.top-card-layout__title`;
- empresa/localizacao/data: `.topcard__flavor-row`;
- descricao: `.description__text` e `.show-more-less-html__markup`;
- criterios: `.description__job-criteria-list`;
- senioridade: item com `Seniority level`;
- tipo de contrato: item com `Employment type`;
- funcao: item com `Job function`;
- industria: item com `Industries`;
- acoes `Apply` e `Save` exigem ou encaminham para login no fluxo publico observado.

Esses seletores existem, mas nao devem ser usados para provider por causa dos sinais de login/protecao e ausencia de contrato publico estavel.

## Campos observados

Na listagem HTML:

- id externo;
- titulo;
- empresa;
- localizacao;
- data de publicacao em `datetime`;
- URL publica da vaga;
- marcador como `Actively Hiring` quando existe.

No detalhe HTML:

- titulo;
- empresa;
- localizacao;
- tempo desde publicacao;
- quantidade aproximada de candidatos em algumas vagas;
- descricao completa;
- faixa salarial quando fornecida;
- senioridade;
- tipo de contrato;
- funcao;
- industria.

## Riscos

- Nao ha JSON publico estavel nem API publica aberta para o caso do projeto.
- APIs oficiais do LinkedIn normalmente exigem autorizacao e escopos especificos.
- A UI publica limita a navegacao com modal de login.
- O carregamento inclui protecoes explicitamente relacionadas a scraping.
- O layout e classes internas podem mudar sem aviso.
- A fonte tem alto risco de captcha, bloqueio, rate limit ou exigencia de login.
- O uso operacional poderia conflitar com a politica do projeto de nao contornar login, captcha, paywall ou anti-bot.

## Recomendacao

Nao implementar provider para LinkedIn.

Regras para o projeto:

- manter LinkedIn fora da coleta manual e automatica;
- nao usar Playwright operacional para LinkedIn;
- nao usar cookies autenticados, credenciais pessoais, proxy, rotacao de IP, captcha solver ou qualquer bypass;
- nao tentar contornar o modal de login ou protecoes anti-abuso;
- aceitar apenas cadastro manual de links do LinkedIn quando um admin trouxer uma vaga especifica;
- preferir fontes alternativas como GitHub/listas publicas, APIs, RSS, ATS publicos, paginas de carreira e plataformas ja validadas sem bloqueios.

Uma integracao futura so deve ser considerada com API oficial autorizada, permissao explicita ou parceria.
