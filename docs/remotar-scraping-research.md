# Pesquisa Tecnica: Remotar

Data da investigacao: 2026-05-22.

## Resumo

A Remotar e tecnicamente viavel para coleta conservadora por JSON publico. Ela comecou como provider experimental manual e foi promovida para a coleta automatica diaria em 2026-05-25, apos revisao operacional apontar melhor volume e aderencia entre os providers experimentais.

O reconhecimento obrigatorio foi feito com Playwright MCP em paginas publicas da Remotar. A UI abriu sem login obrigatorio para visualizar listagens e detalhes, sem captcha e sem bloqueio tecnico. A rede mostrou endpoint JSON publico suficiente para a coleta:

```text
GET https://api.remotar.com.br/jobs?search={termo}
```

Como JSON publico e preferivel a browser scraping, a estrategia recomendada e usar esse endpoint pela camada `src/scraping/`, sem Playwright operacional no provider.

## URLs analisadas

- `https://remotar.com.br/`
- `https://remotar.com.br/search/jobs?q=desenvolvedor+j%C3%BAnior`
- `https://remotar.com.br/search/jobs?q=qa+junior&c=8&t=17`
- `https://remotar.com.br/search/jobs?t=17`
- `https://remotar.com.br/search/jobs?t=10`
- `https://remotar.com.br/search/jobs?c=13`
- `https://remotar.com.br/job/136734/gestao-talentos/estagio-em-direito-rede-de-talentos-remoto`
- `https://remotar.com.br/job/138072/montreal-oficial/desenvolvedor-de-software-junior-(php)`
- `https://api.remotar.com.br/timeline?page=1&firstFetchTs=2026-05-22T13:04:18.169Z`
- `https://api.remotar.com.br/jobs?search=desenvolvedor%20j%C3%BAnior`
- `https://api.remotar.com.br/jobs?search=qa%20junior&tagId=17&categoryId=8`
- `https://api.remotar.com.br/jobs?search=&tagId=17`
- `https://api.remotar.com.br/jobs?search=&tagId=10`
- `https://api.remotar.com.br/jobs?search=&categoryId=13`
- `https://api.remotar.com.br/categories/`
- `https://api.remotar.com.br/tags?`
- `https://api.remotar.com.br/timeline-filters/categories`
- `https://api.remotar.com.br/timeline-filters/tags`

Termos avaliados no reconhecimento:

- `desenvolvedor júnior`
- `estágio tecnologia` (removido da implementacao atual por ser amplo demais)
- `junior tecnologia`
- `front-end junior`
- `backend junior`
- `suporte técnico`
- `qa junior`
- `dados junior`
- `remoto junior`

## Fluxo usado com Playwright MCP

1. Abri `https://remotar.com.br/` com `browser_navigate`.
2. Capturei snapshot da home/listagem publica. A pagina renderizou cards de vagas sem login obrigatorio.
3. Inspecionei `browser_network_requests` e identifiquei chamadas publicas para `api.remotar.com.br`, incluindo `timeline`, `jobs`, `categories`, `tags` e filtros.
4. Salvei exemplos de response body de `timeline`, `categories`, `tags` e buscas publicas dentro de `.playwright-mcp/`.
5. Cliquei em card de vaga pela UI (`a[href^="/job/"]`) e abri pagina de detalhe publica em nova aba.
6. Capturei snapshot profundo da pagina de detalhe e confirmei titulo, tags, salario, descricao e botao `Acessar`.
7. Usei a busca publica pela UI preenchendo `Insira sua busca` e pressionando `Enter`, confirmando a rota `/search/jobs?q=...` e a chamada `GET /jobs?search=...`.
8. Naveguei por filtros publicos de tag e categoria (`/search/jobs?t=17`, `/search/jobs?t=10`, `/search/jobs?c=13`) e confirmei os parametros JSON `tagId` e `categoryId`.
9. Testei uma combinacao de busca, categoria e tag (`/search/jobs?q=qa+junior&c=8&t=17`), confirmando `GET /jobs?search=qa%20junior&tagId=17&categoryId=8`.

Nao foram usados login, cookies autenticados, credenciais, proxy, rotacao de IP, captcha ou bypass.

## Endpoint JSON publico

Endpoints observados:

```text
GET https://api.remotar.com.br/jobs?search={termo}
GET https://api.remotar.com.br/jobs?search={termo}&tagId={ids}
GET https://api.remotar.com.br/jobs?search={termo}&categoryId={id}
GET https://api.remotar.com.br/jobs?search={termo}&tagId={ids}&categoryId={id}
GET https://api.remotar.com.br/timeline?page=1&firstFetchTs={iso}
GET https://api.remotar.com.br/categories/
GET https://api.remotar.com.br/tags?
GET https://api.remotar.com.br/timeline-filters/categories
GET https://api.remotar.com.br/timeline-filters/tags
```

O retorno de `jobs` contem `meta` e `data`. Campos uteis observados:

- `id`
- `title`
- `subtitle`
- `description`
- `moreInfos`
- `createdAt`
- `updatedAt`
- `expiresAt`
- `expired`
- `type` (`remote`, `hybrid`)
- `city`
- `state`
- `externalLink`
- `integrationSource`
- `company.name`
- `jobCategories[].category.name`
- `jobTags[].tag.name`
- `jobRequirements[].description`
- `jobSalary.from`
- `jobSalary.to`
- `jobSalary.currency`
- `jobSalary.type`

IDs uteis observados:

- Categorias:
  - `2`: Atendimento & Suporte
  - `4`: Data Science / Analytics
  - `7`: DevOps
  - `8`: QA
  - `9`: SysAdmin
  - `13`: Programacao
  - `14`: Programacao Mobile
  - `6`: UX/UI
- Tags:
  - `4`: 100% Remoto
  - `5`: Vaga hibrida
  - `10`: Estagio
  - `17`: Junior
  - `21`: Pleno
  - `23`: Senior

## Login, captcha e bloqueios

Durante o reconhecimento:

- a home abriu sem login;
- as listagens abriram sem login;
- as paginas de detalhe abriram sem login;
- a pagina de detalhe mostra convite para `Cadastre-se na Remotar`, mas o conteudo publico da vaga continuou visivel;
- nao apareceu captcha;
- nao apareceu tela de Cloudflare ou bloqueio tecnico;
- os endpoints JSON publicos responderam `200`.

Se a Remotar passar a exigir login, captcha, cookies autenticados, credenciais, proxy, rotacao de IP, desafio Cloudflare ou qualquer bypass, a coleta deve ser interrompida.

## HTML, JavaScript e seletores

A pagina e renderizada por JavaScript/Next.js, mas a rede publica JSON e suficiente para a coleta. O provider nao deve depender de seletores enquanto o endpoint JSON publico continuar disponivel.

Seletores/estruturas uteis encontrados no reconhecimento:

- busca: `input[placeholder="Insira sua busca"]`;
- card/listagem: blocos com links de vaga e empresa;
- link da vaga: `a[href^="/job/"]`;
- link da empresa: `a[href^="/company/"]`;
- filtro por tag nos cards: `a[href^="/search/jobs?t="]`;
- filtro por categoria/descoberta: rotas `/search/jobs?c={id}`;
- titulo no detalhe: `main h1`;
- subtitulo no detalhe: `main h2`;
- tags no detalhe: `main a[href^="/search/jobs?t="]`;
- descricao no detalhe: conteudo textual em `main p`, `main li` e headings internas;
- acao de candidatura: botao `Acessar`;
- data publica no detalhe: texto `Ultima atualizacao: dd de mes de yyyy`.

Classes observadas, mas menos estaveis por serem internas do frontend:

- `card-header__info` em blocos de titulo/empresa do card.

## Filtros publicos

Filtros publicos observados:

- busca textual: parametro `q` na URL da UI e `search` no endpoint JSON;
- categoria/area: parametro `c` na URL da UI e `categoryId` no endpoint JSON;
- nivel/contrato/modalidade: tags via parametro `t` na URL da UI e `tagId` no endpoint JSON;
- remoto: tag `4` (`100% Remoto`) e campo `type = remote`;
- hibrido: tag `5` (`Vaga hibrida`) e campo `type = hybrid`;
- cidade/estado: campos `city` e `state` no JSON quando existem;
- data/ordenacao: a listagem padrao ordena por recencia; nao foi observado filtro publico direto por data, mas o JSON fornece `createdAt` e `updatedAt`;
- paginacao/infinite scroll: endpoint `timeline?page=...` possui `meta.current_page`, `last_page`, `per_page`; o provider experimental nao deve paginar agressivamente.

## Campos disponiveis

A listagem JSON ja fornece os campos necessarios para o provider:

- id externo;
- titulo;
- empresa;
- descricao/subtitulo;
- requisitos;
- categoria;
- tags;
- modalidade;
- cidade/estado;
- salario;
- data de criacao/atualizacao;
- link externo de candidatura;
- URL publica da vaga na Remotar.

Nao e necessario abrir detalhe por vaga para coletar a primeira versao.

## Riscos

- O endpoint JSON e publico e usado pelo frontend, mas nao ha contrato formal documentado no projeto.
- A Remotar pode mudar parametros, formato ou politica de acesso.
- Algumas vagas sao agregadas de outras fontes, como Gupy, Solides, Empregare e BairesDev; a revisao humana deve preservar o link e conferir origem.
- A busca ampla retorna muitas vagas pleno/senior/manager; o filtro de nivel precisa ser conservador.
- Existem vagas remotas globais com requisitos de idioma ou regiao; o provider rejeita restricoes regionais explicitamente incompatíveis com Brasil.
- A pagina possui anuncios e analytics, mas eles nao sao necessarios para a coleta.

## Recomendacao

Implementar agora como provider experimental manual usando JSON publico.

Regras recomendadas:

- provider em `realJobProviders`;
- acionamento manual tambem disponivel;
- coleta automatica diaria de baixa frequencia;
- usar `fetchPublicJson` na camada `src/scraping/`;
- sem Playwright operacional, porque JSON publico e suficiente;
- sem login;
- sem cookies autenticados;
- sem credenciais pessoais;
- sem proxy ou rotacao de IP;
- sem captcha ou bypass;
- sem paginacao agressiva;
- maximo de 20 vagas retornadas por execucao;
- evitar buscas amplas como `estagio tecnologia`, que podem trazer estagios genericos fora de tecnologia;
- exigir categoria tech ou classificacao `TECH` pelo classificador de dominio;
- rejeitar sinais fortes de Direito, Marketing, Comercial, Administrativo, RH, Afiliados, Parcerias e areas similares quando nao houver sinal tech forte;
- vagas criadas apenas como `DRAFT` via `providerRunner`;
- `useAi = false`;
- sem Gemini;
- sem Discord.

A promocao para coleta automatica nao mudou o provider: ele continua criando apenas `DRAFT`, sem IA e sem Discord. A etapa separada de autoaprovacao, executada depois da coleta automatica, pode preparar vagas Remotar elegiveis para `PENDING`; a publicacao continua sendo feita apenas pelo scheduler de envio ou por acao manual.
