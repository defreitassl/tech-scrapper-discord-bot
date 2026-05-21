# Pesquisa Tecnica: Gupy

Data da investigacao: 2026-05-21.

## Resumo

A Gupy e tecnicamente viavel para uma primeira coleta experimental e manual porque o portal publico carrega vagas por um endpoint JSON publico, sem login e sem captcha durante a investigacao.

Recomendacao: implementar agora de forma experimental, manual e conservadora, usando o endpoint JSON publico observado. Playwright deve ficar como ferramenta de reconhecimento/validacao e fallback para paginas dinamicas; a coleta em si deve preferir o JSON publico enquanto ele estiver disponivel.

## URLs analisadas

- `https://portal.gupy.io/job-search/term=desenvolvedor`
- `https://portal.gupy.io/job-search/term=estagio%20tecnologia`
- `https://portal.gupy.io/job-search/term=junior%20tecnologia`
- `https://portal.gupy.io/job-search/term=suporte%20tecnico%20junior`
- `https://portal.gupy.io/job-search/term=qa%20junior`
- `https://employability-portal.gupy.io/api/v1/jobs?jobName=desenvolvedor&limit=10&offset=0`
- `https://employability-portal.gupy.io/api/v1/jobs?jobName=estagio%20tecnologia&limit=10&offset=0`
- `https://employability-portal.gupy.io/api/v1/jobs?jobName=desenvolvedor&limit=3&offset=0&workplaceType=remote`
- `https://employability-portal.gupy.io/api/v1/jobs?jobName=desenvolvedor&limit=3&offset=0&state=Minas%20Gerais`
- `https://employability-portal.gupy.io/api/v1/jobs?jobName=desenvolvedor&limit=3&offset=0&city=Belo%20Horizonte`

## Endpoint JSON publico

O portal chama:

```text
GET https://employability-portal.gupy.io/api/v1/jobs?jobName={termo}&limit={limite}&offset={offset}
```

Tambem foram observados parametros publicos funcionais:

- `workplaceType=remote`
- `state=Minas%20Gerais`
- `city=Belo%20Horizonte`

O retorno contem `data` e `pagination`. Campos uteis observados:

- `id`
- `name`
- `description`
- `careerPageName`
- `type`
- `publishedDate`
- `applicationDeadline`
- `isRemoteWork`
- `city`
- `state`
- `country`
- `jobUrl`
- `workplaceType`
- `skills`

Tambem apareceu uma chamada para `private-api.gupy.io/authentication/candidate/account/current` retornando `401`, aparentemente para checar usuario logado. Essa chamada nao foi necessaria para acessar listagens publicas.

## Login, captcha e bloqueios

Durante o reconhecimento com Playwright MCP:

- a busca publica abriu sem login;
- as listagens renderizaram vagas sem autenticacao;
- o endpoint JSON respondeu `200`;
- nao apareceu captcha;
- nao apareceu tela de Cloudflare;
- nao houve bloqueio tecnico que exigisse bypass;
- nao foram usados cookies autenticados, credenciais, proxy ou rotacao de IP.

Se esse comportamento mudar, a coleta deve ser interrompida e o provider deve ser desativado.

## HTML, JavaScript e seletores

A pagina publica e renderizada por JavaScript. Os dados aparecem nos cards da UI, mas a fonte mais estavel observada foi o endpoint JSON.

Seletores/estrutura uteis encontrados na pagina:

- busca: `searchbox "Enter a job title"`;
- lista de vagas: `main` > heading `Jobs` > `list`;
- card: `listitem`;
- link da vaga: `a[href*=".gupy.io/job/"]`;
- titulo: heading `h3` dentro do card;
- empresa: grupo acessivel `Company {nome}`;
- localizacao: grupo acessivel `Workplace: ...`;
- modalidade: grupo acessivel `Work model ...`;
- data: texto `Published on: dd/mm/yyyy`;
- paginacao: navigation `navegação de paginação`, botoes `Page N` e `Next page`.

O provider experimental nao depende desses seletores enquanto o JSON publico estiver disponivel.

## Filtros publicos investigados

- tecnologia: por `jobName`, por exemplo `desenvolvedor`, `estagio tecnologia`, `junior tecnologia`;
- estagio: termo `estagio tecnologia` e tipo `vacancy_type_internship`;
- junior: termo `junior tecnologia` e sinais no titulo/descricao;
- remoto: parametro `workplaceType=remote` e campo `workplaceType`;
- Minas Gerais: parametro `state=Minas Gerais` e campo `state`;
- Belo Horizonte: parametro `city=Belo Horizonte` e campo `city`.

Na implementacao inicial, o provider usa poucos termos publicos e filtra localmente para evitar depender demais de parametros nao documentados.

## Riscos

- O endpoint e publico, mas nao ha contrato formal documentado no projeto.
- A Gupy pode mudar parametros, formato ou politica de acesso sem aviso.
- A busca ampla retorna muitas vagas senior/pleno, exigindo filtro conservador.
- O portal pode adicionar captcha, bloqueio ou exigir login no futuro.
- Algumas vagas antigas podem permanecer abertas por meses; por isso a implementacao filtra `publishedDate` em ate 30 dias quando a data existe.

## Estrategia recomendada

Usar JSON publico para a coleta experimental. Playwright deve continuar sendo usado para reconhecimento e pode ser usado para validar paginas publicas dinamicas, mas nao deve ser usado como dependencia operacional quando o JSON publico resolver o caso, nem para burlar bloqueios.

Regras para a etapa atual:

- provider manual e experimental;
- limite de 20 vagas por execucao;
- sem paginacao agressiva;
- sem login;
- sem cookies autenticados;
- sem captcha/bypass;
- sem IA;
- sem Discord;
- criacao apenas como `DRAFT` via `providerRunner`;
- fora da coleta automatica.
