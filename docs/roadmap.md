# Roadmap

## V1 atual

- Bot conectado ao Discord.
- Painel admin em Express.
- Cadastro, listagem, detalhe e edicao de vagas.
- Controle de status.
- Envio manual de vagas `PENDING`.
- Envio agendado de vagas `PENDING` configurado pelo painel.
- PostgreSQL + Prisma.
- Mensagens com `readyText`, `aiGeneratedText`, IA ou template padrao.
- Geracao de mensagem com Google AI Studio/Gemini.
- Primeiro provider real via API oficial do GitHub, coletando issues abertas e recentes de repositorios brasileiros de vagas como `DRAFT`.
- Acao manual para preparar rascunhos coletados com IA e coloca-los na fila como `PENDING`.
- Coleta automatica diaria dos providers reais as 08:00, criando apenas `DRAFT`.

## V1.1 documentacao + providers

- Criar documentacao inicial do projeto.
- Definir contrato de providers.
- Definir estrategia de fontes.
- Definir guidelines de scraping.
- Implementar a base inicial de providers com coleta mock/de teste.
- Normalizar vagas coletadas e reaproveitar deduplicacao por URL antes de criar rascunhos.

## V1.2 primeiro provider real

- Implementado provider GitHub com fonte simples e publica baseada em issues.
- Salva vagas coletadas como `DRAFT`.
- Registra `source` e `url`.
- Evita publicacao automatica, IA automatica e mudanca para `PENDING`.
- Reutiliza normalizacao e deduplicacao basica.
- Filtra apenas issues abertas, criadas nos ultimos 30 dias, com labels de junior/estagio/trainee e sem labels de pleno/senior ou similares.
- Isola falhas por repositorio para continuar a coleta nas demais fontes.
- Mantem coleta sem IA; a preparacao com Gemini ocorre apenas por acao manual do admin.

## V1.3 agendamento de coletas/providers

- Implementada execucao agendada diaria dos providers reais as 08:00 em `America/Sao_Paulo`.
- Controla logs e erros por fonte.
- Mantem limite conservador de frequencia: uma execucao por dia.
- Continua exigindo revisao antes de publicacao.
- Nao executa provider mock automaticamente.

Observacao: o envio agendado de vagas `PENDING` ja existe e e configurado no painel. O agendamento de coleta/providers e separado e nao publica vagas.

## V1.4 autenticacao simples

- Proteger painel admin com autenticacao simples.
- Considerar senha via variavel de ambiente ou solucao equivalente.
- Evitar complexidade de permissoes ate existir necessidade real.

## V2 scraping avancado e multiplas fontes

- Suportar multiplos providers.
- Melhorar deduplicacao.
- Adicionar painel de revisao de coletas.
- Avaliar uso pontual de Playwright.
- Monitorar qualidade das fontes.
- Considerar metricas de vagas publicadas, erros e fontes mais uteis.
