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
- salva as vagas como `DRAFT`;
- nao chama IA;
- nao envia ao Discord;
- aceita `GITHUB_TOKEN` opcional para aumentar o rate limit.

Depois da coleta, a revisao humana continua obrigatoria. O admin pode usar `Preparar e colocar na fila` para gerar a mensagem com IA e transformar uma vaga revisada em `PENDING`.

O filtro de qualidade nao substitui a revisao humana. Ele apenas reduz ruido antes da criacao do rascunho e registra rejeicoes em `ignoredByQuality` com os motivos no terminal.

Alem da coleta manual no painel, o processo admin agenda a coleta dos providers reais diariamente as 08:00 em `America/Sao_Paulo`. Essa rotina executa GitHub e as APIs externas registradas, nao executa providers de teste/mock, nao chama IA, nao publica no Discord e salva somente rascunhos `DRAFT`.

### Paginas publicas simples

Paginas HTML estaticas ou pouco dinamicas podem ser coletadas com baixo risco usando parsing simples.

### Scraping com Cheerio

Cheerio deve ser a primeira opcao quando scraping HTML for necessario. Ele e mais leve que um navegador real e suficiente para paginas publicas simples.

### Scraping com Playwright

Playwright deve ser usado somente em ultimo caso, quando a pagina depende fortemente de JavaScript e nao ha API, RSS ou HTML simples disponivel.

Ele e mais caro, mais lento e mais sujeito a bloqueios.

## Riscos de LinkedIn, Gupy e Solides

LinkedIn, Gupy, Solides e plataformas similares podem ter:

- protecoes anti-bot;
- conteudo dependente de JavaScript;
- termos de uso restritivos;
- mudancas frequentes de layout;
- necessidade de login;
- bloqueios por IP, captcha ou rate limit.

Essas fontes nao devem ser o ponto de partida. Tambem nao se deve tentar burlar login, captcha ou bloqueios.

## Recomendacao

Comecar por fontes simples, publicas e revisaveis:

- cadastro manual;
- listas publicas;
- RSS;
- APIs;
- paginas HTML simples.

Na fase inicial, qualquer vaga coletada automaticamente deve entrar como `DRAFT` ou equivalente para revisao humana antes de publicacao.

Fontes como Arbeitnow, Findwork, Jobdata, LinkedIn, Gupy, Solides, Programathor e Remotar continuam fora desta etapa por menor aderencia, necessidade de chave/login, uso comercial, captcha, protecoes anti-bot ou risco de scraping pesado.
