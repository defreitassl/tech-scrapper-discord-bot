# Deploy

## Pre-requisitos

- Node.js 20 ou superior, se rodar sem Docker.
- PostgreSQL, se rodar sem Docker.
- Docker e Docker Compose, se rodar com containers.
- Bot Discord no servidor, com permissao para enviar mensagens no canal.
- Repositorio clonado no servidor.

## Variaveis obrigatorias

Arquivo `.env` na raiz do projeto:

```env
NODE_ENV=production
ADMIN_PORT=3000
ADMIN_USERNAME=
ADMIN_PASSWORD=

DATABASE_URL=

DISCORD_TOKEN=
DISCORD_CHANNEL_ID=
GOOGLE_AI_API_KEY=
GITHUB_TOKEN=
```

Para Docker Compose, tambem configure:

```env
POSTGRES_DB=discord_jobs_bot
POSTGRES_USER=postgres
POSTGRES_PASSWORD=
```

Obrigatorias em producao:

- `NODE_ENV=production`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `DISCORD_TOKEN`
- `DISCORD_CHANNEL_ID`
- `DATABASE_URL` sem Docker, ou `POSTGRES_PASSWORD` com Docker Compose

Opcionais:

- `GOOGLE_AI_API_KEY`: habilita Gemini; sem ela, use `readyText` ou fallback.
- `GITHUB_TOKEN`: aumenta rate limit do GitHub.
- `ADMIN_PORT`: porta HTTP do painel.

## Bot Discord

O envio para Discord usa um Bot Discord com `discord.js`. Nao ha comandos interativos ou listeners persistentes no MVP; o app apenas conecta, publica embeds no canal configurado e encerra o client.

Para configurar:

1. Crie uma aplicacao no Discord Developer Portal.
2. Crie o bot e copie o token.
3. Convide o bot para o servidor.
4. De permissao para enviar mensagens no canal.
5. Copie o ID do canal.
6. Configure `DISCORD_TOKEN` e `DISCORD_CHANNEL_ID` no `.env` de producao.

Trate `DISCORD_TOKEN` como segredo e nao exponha o token em logs, issues ou commits.

## Rodar sem Docker

```bash
npm install
npm run prisma:generate
npm run build
npm run prisma:migrate:deploy
npm run prod
```

`npm run prod` inicia `dist/admin/server.js`, incluindo schedulers configurados.

## Rodar com Docker Compose

```bash
docker compose up -d --build
```

O compose:

- sobe app Node;
- sobe PostgreSQL 16;
- usa volume `postgres-data`;
- executa `npm run prisma:migrate:deploy`;
- inicia `npm run prod`.

## Migrations em producao

Use apenas migrations versionadas:

```bash
npm run prisma:migrate:deploy
```

Com Docker:

```bash
docker compose run --rm app npm run prisma:migrate:deploy
```

Nao use `prisma migrate dev` em producao.

## Healthcheck

```bash
curl -i http://localhost:3000/healthz
```

Resposta esperada:

```text
HTTP/1.1 200 OK
```

O healthcheck nao deve expor segredos.

## Logs

App:

```bash
docker compose logs -f app
```

Postgres:

```bash
docker compose logs -f postgres
```

Ultimas linhas:

```bash
docker compose logs --tail=100 app
```

Verifique:

- painel iniciado;
- Basic Auth ativo em producao;
- schedulers carregados ou desativados;
- erros de Prisma;
- erros de Discord;
- erros de Gemini;
- erros de providers.

## Backup do Postgres

Exemplo com Docker:

```bash
docker compose exec postgres pg_dump -U postgres discord_jobs_bot > backup.sql
```

Antes de restaurar ou remover volumes, confirme que existe backup recente.

## Checklist pos-deploy

- `GET /healthz` retorna 200.
- `/admin/jobs` pede usuario e senha.
- Criar vaga manual de teste.
- Confirmar que a vaga entra como `PENDING`.
- Abrir detalhes e revisar preview.
- Enviar com `Enviar agora`.
- Confirmar embed no canal do Discord.
- Confirmar que a vaga mudou para `SENT`.
- Conferir logs sem erro critico.
- Conferir `/admin/settings/schedule`.
- Conferir `/admin/settings/collection`.
- Confirmar que apenas uma instancia do app esta rodando.

## Avisos

- Rode uma unica instancia do app para evitar schedulers duplicados.
- Proteja o painel com Basic Auth forte.
- Nao exponha `.env`.
- Use HTTPS, Cloudflare Access, Tailscale, firewall ou proxy reverso autenticado.
- Nao remova volumes do Postgres sem backup.
