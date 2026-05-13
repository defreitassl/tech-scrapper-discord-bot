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

## V1.1 documentacao + providers

- Criar documentacao inicial do projeto.
- Definir contrato de providers.
- Definir estrategia de fontes.
- Definir guidelines de scraping.
- Planejar normalizacao e deduplicacao sem implementar scraping ainda.

## V1.2 primeiro provider real

- Implementar o primeiro provider com fonte simples e publica.
- Salvar vagas coletadas como `DRAFT`.
- Registrar `source` e `url`.
- Evitar publicacao automatica.
- Validar deduplicacao basica.

## V1.3 agendamento de coletas/providers

- Adicionar execucao agendada de providers.
- Controlar logs e erros por fonte.
- Manter limites conservadores de frequencia.
- Continuar exigindo revisao antes de publicacao.

Observacao: o envio agendado de vagas `PENDING` ja existe e e configurado no painel. Esta etapa futura trata de agendamento de coleta/providers, nao de publicacao.

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
