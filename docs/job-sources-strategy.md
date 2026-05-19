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

### GitHub e listas publicas

Repositorios, arquivos Markdown, listas publicas e curadorias abertas podem ser boas fontes. Devem ser tratados como dados semi-estruturados e sempre registrar URL de origem.

Nesta etapa, o primeiro provider real usa issues publicas do GitHub nos repositorios `frontendbr/vagas`, `backend-br/vagas`, `react-brasil/vagas`, `qa-brasil/vagas`, `nodejsdevbr/vagas`, `dotnetdevbr/vagas`, `soujava/vagas-java`, `DevOps-Brasil/Vagas`, `programadores-br/geral`, `datascience-br/vagas`, `brasil-php/vagas`, `androiddevbr/vagas`, `CocoaHeadsBrasil/vagas` e `remotejobsbr/design-ux-vagas`. Essa escolha evita scraping HTML e usa uma API publica com contrato mais estavel.

Regras atuais do provider GitHub:

- usa a API oficial do GitHub para listar issues;
- coleta apenas issues abertas;
- coleta apenas issues criadas nos ultimos 30 dias;
- segue nos demais repositorios quando um repositorio falha e contabiliza o erro no resumo;
- filtra por labels de `junior`, `júnior`, `jr`, `estagio`, `estágio`, `estagiario`, `estagiário` ou `trainee`;
- trata `trainee` como nivel de entrada;
- ignora labels de `pleno`, `senior`, `sênior`, `especialista`, `tech lead`, `lead`, `staff` e `principal`;
- aceita vagas remotas de qualquer lugar;
- aceita vagas hibridas ou presenciais somente quando indicam Minas Gerais;
- ignora e contabiliza vagas hibridas/presenciais fora de Minas Gerais no resumo da coleta;
- extrai `shortDescription` e `stacks` do corpo da issue quando ha informacao suficiente;
- salva as vagas como `DRAFT`;
- nao chama IA;
- nao envia ao Discord;
- aceita `GITHUB_TOKEN` opcional para aumentar o rate limit.

Depois da coleta, a revisao humana continua obrigatoria. O admin pode usar `Preparar e colocar na fila` para gerar a mensagem com IA e transformar uma vaga revisada em `PENDING`.

Alem da coleta manual no painel, o processo admin agenda a coleta dos providers reais diariamente as 08:00 em `America/Sao_Paulo`. Essa rotina nao executa providers de teste/mock, nao chama IA, nao publica no Discord e salva somente rascunhos `DRAFT`.

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
