# Pesquisa tecnica de scraping - Solides

Data da pesquisa: 2026-05-26.

## Objetivo

Investigar se a Solides possui caminho publico, seguro e de baixo volume para coleta de vagas de tecnologia de entrada, sem login, cookies autenticados, captcha, Cloudflare/bypass, proxy, rotacao de IP ou credenciais pessoais.

## Uso do Playwright MCP

O reconhecimento foi feito obrigatoriamente com Playwright MCP. Foram abertas paginas publicas e inspecionadas as chamadas de rede geradas pela UI.

Nao houve login, uso de cookies autenticados, captcha, proxy, rotacao de IP ou tentativa de contornar bloqueio tecnico.

## URLs analisadas

- `https://vagas.solides.com.br/`
- `https://vagas.solides.com.br/vagas?search=desenvolvedor%20junior`
- `https://solides.vagas.solides.com.br/`
- `https://solides.vagas.solides.com.br/vaga/807304`
- `https://apigw.solides.com.br/jobs/v3/portal-vacancies-new?search=&title=desenvolvedor%20junior&locations=&take=14&page=1`
- `https://apigw.solides.com.br/jobs/v3/home/vacancy?take=12&slug=solides&title=&locations=&page=1`
- `https://apigw.solides.com.br/jobs/v3/home/company/solides`
- `https://apigw.solides.com.br/jobs/v3/home/cities?slug=solides`

## Resultado do reconhecimento

A home publica `https://vagas.solides.com.br/` abriu sem login e exibiu busca por cargo e localizacao. A listagem publica `https://vagas.solides.com.br/vagas?search=desenvolvedor%20junior` abriu sem login, captcha ou bloqueio tecnico.

A pagina de empresa `https://solides.vagas.solides.com.br/` tambem abriu sem login, exibiu cards de vagas e chamou JSON publico para empresa. A pagina de detalhe `https://solides.vagas.solides.com.br/vaga/807304` abriu sem login; o HTML renderizado ja continha o detalhe da vaga, e a pagina enviou apenas telemetria alem dos recursos estaticos.

Nao foi observado captcha, Cloudflare interativo, tela de bloqueio, paywall ou exigencia de autenticacao durante o reconhecimento.

## Endpoints JSON publicos

### Busca geral do portal

Endpoint observado:

```text
GET https://apigw.solides.com.br/jobs/v3/portal-vacancies-new
```

Parametros observados/usados:

- `search`
- `title`
- `locations`
- `take`
- `page`

Exemplo validado:

```text
https://apigw.solides.com.br/jobs/v3/portal-vacancies-new?search=&title=desenvolvedor%20junior&locations=&take=14&page=1
```

Esse endpoint retornou JSON publico com `success`, `data.count`, `data.totalPages`, `data.currentPage` e `data.data`.

### Busca por pagina de empresa

Endpoint observado:

```text
GET https://apigw.solides.com.br/jobs/v3/home/vacancy
```

Parametros observados:

- `take`
- `slug`
- `title`
- `locations`
- `page`

Exemplo observado:

```text
https://apigw.solides.com.br/jobs/v3/home/vacancy?take=12&slug=solides&title=&locations=&page=1
```

Esse endpoint retornou JSON publico com vagas da empresa Sólides Tecnologia, incluindo descricao em HTML.

## Campos disponiveis

Os campos observados nos JSONs incluem:

- `id`
- `title`
- `description`
- `currentState`
- `companyName`
- `state`
- `city`
- `address`
- `slug`
- `redirectLink`
- `type`
- `homeOffice`
- `jobType`
- `salary`
- `seniority`
- `recruitmentContractType`
- `benefits`
- `hardSkills`
- `education`
- `createdAt`
- `occupationAreas`
- `availablePositions`

Campos uteis para o provider:

- URL: `redirectLink` quando aponta para URL publica valida; quando o JSON retorna dominio legado `*.solides.jobs`, normalizar para `https://{slug}.vagas.solides.com.br/vaga/{id}`.
- Data: `createdAt`.
- Nivel: `seniority`, `recruitmentContractType`, `title` e `description`.
- Localizacao: `city`, `state`, `address.city`, `address.state`, `address.country`.
- Modalidade: `homeOffice`, `jobType` e `type`.
- Dominio/tecnologia: `occupationAreas`, `hardSkills`, `title` e `description`.
- Texto bruto: `description` em HTML publico.

## Cards, links, paginacao e filtros

Na home do portal foram observados campos de busca por cargo e localizacao e links publicos para areas e cidades, como `/vagas`, `/vagas?occupationAreas=tecnologia`, `/vagas-home-office` e `/vagas/belo-horizonte-mg`.

Na pagina de empresa foram observadas chamadas de rede para:

- dados da empresa;
- cidades da empresa;
- vagas da empresa com `take`, `slug`, `title`, `locations` e `page`.

A paginacao existe no JSON por `page`, `take`, `totalPages` e `count`. Para o provider experimental, a implementacao nao pagina agressivamente: usa apenas `page=1` e `take=14` por termo, com limite total de 20 vagas retornadas por execucao.

Seletores uteis observados na home geral pelo snapshot do Playwright:

- link `Todas as vagas` para `/vagas`;
- textbox `Digite o nome da vaga ou cargo`;
- textbox `Digite o nome da cidade`;
- botao `Buscar vagas`;
- link de area `Tecnologia` para `/vagas?occupationAreas=tecnologia`;
- link `Home Office` para `/vagas-home-office`.

Como existe JSON publico suficiente, a implementacao nao depende desses seletores.

## Termos testados

Termos exigidos e resultado da primeira pagina (`take=14`) no endpoint geral:

| Termo | Total informado pelo endpoint | Itens analisados | Candidatas apos filtros do provider |
| --- | ---: | ---: | ---: |
| `estágio tecnologia` | 27 | 14 | 3 |
| `desenvolvedor junior` | 40 | 14 | 1 |
| `junior tecnologia` | 0 | 0 | 0 |
| `suporte técnico` | 2852 | 14 | 1 |
| `qa junior` | 5 | 5 | 0 |
| `dados junior` | 14 | 14 | 0 |
| `remoto junior` | 0 | 0 | 0 |

Resumo da execucao isolada do provider em 2026-05-26:

- 61 vagas analisadas pelo provider.
- 5 vagas retornadas como candidatas para o runner.
- 18 descartadas por data/estado.
- 4 descartadas por senioridade.
- 4 descartadas por falta de nivel/suporte tecnico.
- 28 descartadas por localizacao.
- 1 descartada por qualidade/domínio.
- 0 erros de provider.

Exemplos de candidatas retornadas ao runner:

- `Estagiário de Tecnologia`, presencial em Sabará/MG.
- `Estágio Tecnologia da Informação`, presencial em Belo Horizonte/MG.
- `Programa de estágio 2026`, híbrida em Belo Horizonte/MG.
- `Desenvolvedor Front-end Júnior (Remoto)`, remoto.
- `Técnico de Instalação e Reparo - Internet Fibra Óptica`, presencial em Ibirité/MG.

Essas candidatas ainda passam pelo runner central, que aplica normalizacao, filtro de qualidade, deduplicacao, prioridade, limite diario e Gemini antes de criar qualquer `PENDING`.

## Decisao

Recomendacao: manter como provider automatico de baixa frequencia na V1, alem do botao manual unificado.

Motivos:

- ha endpoint JSON publico suficiente;
- as paginas abriram sem login, captcha, Cloudflare interativo ou bloqueio tecnico;
- nao e necessario usar Playwright operacional;
- o volume pode ser mantido baixo com poucos termos, `take=14`, apenas primeira pagina e limite total de 20 vagas;
- ha campos suficientes para URL, titulo, empresa, localizacao, modalidade, nivel, descricao, data e dominio.

Restricoes da implementacao:

- usar JSON publico, nao HTML/browser operacional;
- nao salvar direto no banco;
- nao enviar Discord;
- nao alterar schema Prisma;
- entrar em `automaticJobProviders`;
- rodar tambem pelo botao unico `Coletar vagas`, porque `manualCollectableJobProviders` inclui os automaticos;
- passar sempre pelo runner central: normalizacao, TECH/NON_TECH, qualidade, deduplicacao, prioridade, limite diario e Gemini apenas para selecionadas;
- criar aprovadas como `PENDING`;
- recusar vagas ruins sem persistir;
- interromper se houver login, captcha, Cloudflare/bypass, proxy, cookies autenticados ou qualquer necessidade de contorno.
