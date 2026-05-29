# tech-scrapper-discord-bot

Bot e painel admin para coletar, organizar e publicar vagas de tecnologia para iniciantes no Discord da Projeto Desenvolve.

O projeto reduz o ruido de vagas espalhadas em varias fontes, filtra oportunidades aderentes a estagio, trainee, junior e primeiro emprego em tecnologia, monta uma fila revisavel e publica as vagas no Discord.

## Stack

- Node.js
- TypeScript
- Express
- Prisma
- PostgreSQL
- Discord.js
- Gemini
- node-cron
- Docker

## Fluxo

1. Coleta vagas por cadastro manual, GitHub, APIs publicas e fontes publicas simples.
2. Filtra o dominio da vaga como `TECH`, `POSSIBLY_TECH` ou `NON_TECH`.
3. Rejeita `NON_TECH`, duplicadas, vagas sem dados minimos ou com senioridade alta.
4. Calcula prioridade (`HIGH`, `MEDIUM`, `LOW`) com score e motivos.
5. Salva vagas elegiveis como `PENDING`.
6. Gera a mensagem somente no envio, usando Gemini quando habilitado.
7. Usa fallback deterministico se Gemini falhar ou nao estiver configurado.
8. Envia a vaga como embed/card no Discord.

Estados finais da vaga: `PENDING`, `SENT` e `ERROR`. O estado legado `DRAFT` foi removido antes do deploy; nao existe curadoria por rascunho.

## Rodando localmente

Requisitos:

- Node.js 20 ou superior
- PostgreSQL
- Bot criado no Discord Developer Portal
- Canal do Discord configurado para receber mensagens do bot

Instale as dependencias:

```bash
npm install
```

Crie o `.env`:

```bash
cp .env.example .env
```

Configure as variaveis:

```env
NODE_ENV=development
ADMIN_PORT=3000
ADMIN_USERNAME=
ADMIN_PASSWORD=

DISCORD_TOKEN=
DISCORD_CHANNEL_ID=
GOOGLE_AI_API_KEY=
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/discord_jobs_bot?schema=public"

GITHUB_TOKEN=
```

Observacoes:

- `DISCORD_TOKEN` e `DISCORD_CHANNEL_ID` sao necessarios para publicar no Discord.
- `GOOGLE_AI_API_KEY` habilita Gemini; sem ela, o envio deve usar `readyText` ou fallback.
- `GITHUB_TOKEN` e opcional, mas aumenta o rate limit da API do GitHub.
- Em producao, `ADMIN_USERNAME` e `ADMIN_PASSWORD` sao obrigatorios.

## Banco de dados

Gere o Prisma Client:

```bash
npm run prisma:generate
```

Crie/aplique migrations em desenvolvimento:

```bash
npm run prisma:migrate
```

Aplique migrations versionadas em producao:

```bash
npm run prisma:migrate:deploy
```

## Executando

Compile:

```bash
npm run build
```

Inicie o painel admin:

```bash
npm run admin
```

Acesse:

```text
http://localhost:3000/admin/jobs
```

O processo admin tambem inicia os schedulers de coleta e envio configurados no painel.

## Docker

Crie um `.env` de producao com as variaveis reais, incluindo:

```env
NODE_ENV=production
ADMIN_USERNAME=
ADMIN_PASSWORD=
POSTGRES_DB=discord_jobs_bot
POSTGRES_USER=postgres
POSTGRES_PASSWORD=
DISCORD_TOKEN=
DISCORD_CHANNEL_ID=
GOOGLE_AI_API_KEY=
GITHUB_TOKEN=
```

Suba com Docker Compose:

```bash
docker compose up -d --build
```

O compose cria a app Node, PostgreSQL 16, volume persistente e executa migrations com `npm run prisma:migrate:deploy` antes de iniciar `npm run prod`.

## Comandos uteis

```bash
npm run build
npm run admin
npm start
npm run prod
npm run prisma:generate
npm run prisma:migrate
npm run prisma:migrate:deploy
npm run prisma:studio
npm run diagnose:domain
npm run diagnose:priority
npm run diagnose:providers
```

## Status do MVP

Implementado:

- Painel admin server-rendered em Express.
- Cadastro manual e coleta manual unificada.
- Coleta automatica configuravel.
- Envio agendado configuravel.
- Filtro TECH/NON_TECH.
- Priorizacao de vagas coletadas.
- Fila `PENDING`.
- Ciclo de status simplificado: `PENDING`, `SENT`, `ERROR`.
- Gemini somente no envio.
- Fallback deterministico.
- Publicacao como embed no Discord.
- Basic Auth no painel.
- Docker Compose para app e PostgreSQL.

Documentacao principal:

- [Projeto](docs/PROJECT.md)
- [Backlog](docs/BACKLOG.md)
- [Decisoes](docs/DECISIONS.md)
- [Deploy](docs/DEPLOY.md)
