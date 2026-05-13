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

