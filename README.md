# discord-jobs-bot

Bot de Discord em Node.js + TypeScript para enviar vagas de emprego para iniciantes em tecnologia em um canal especifico.

Nesta etapa, o projeto conecta o bot no Discord, possui a base inicial de banco com Prisma e PostgreSQL, e inclui um painel web simples para cadastrar, gerenciar e publicar vagas pendentes manualmente.

## Requisitos

- Node.js 20 ou superior
- PostgreSQL
- Um bot criado no Discord Developer Portal
- O bot adicionado ao servidor com permissao para enviar mensagens no canal desejado

## Instalacao

```bash
npm install
```

## Configuracao

Crie um arquivo `.env` na raiz do projeto usando o `.env.example` como base:

```bash
cp .env.example .env
```

Preencha as variaveis:

```env
DISCORD_TOKEN=token_do_seu_bot
DISCORD_CHANNEL_ID=id_do_canal
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/discord_jobs_bot?schema=public"
```

Crie o banco no PostgreSQL antes de rodar a migration. O nome usado no exemplo e `discord_jobs_bot`.

## Banco de dados

Gere o Prisma Client:

```bash
npm run prisma:generate
```

Crie e aplique a migration:

```bash
npm run prisma:migrate -- --name init
```

Abra o Prisma Studio:

```bash
npm run prisma:studio
```

## Execucao

Compile o TypeScript:

```bash
npm run build
```

Inicie o bot:

```bash
npm start
```

Quando o bot conectar, ele exibira um log no terminal e enviara uma mensagem de teste no canal configurado.

## Painel admin

Com o banco configurado e as migrations aplicadas, compile o projeto:

```bash
npm run build
```

Inicie o painel:

```bash
npm run admin
```

Acesse:

```text
http://localhost:3000/admin/jobs
```

Para cadastrar uma vaga, clique em `Nova vaga`, preencha pelo menos o titulo ou o texto bruto e salve.
Para marcar uma vaga como `PENDING`, ela precisa ter texto pronto, IA habilitada ou URL preenchida.

Para enviar vagas pendentes ao Discord, use o botao `Enviar vagas pendentes` na listagem. O painel busca ate 5 vagas com status `PENDING`, envia no canal configurado em `DISCORD_CHANNEL_ID` e atualiza cada vaga enviada para `SENT`.

## Escopo atual

- Conexao com Discord
- Leitura de variaveis de ambiente
- Envio de mensagem de teste
- Envio manual de vagas `PENDING` para Discord pelo painel
- Schema inicial do Prisma com PostgreSQL
- Model `JobPost` para armazenar vagas
- Painel admin simples para cadastrar, listar, visualizar e editar vagas

Ainda nao ha scraping, IA, autenticacao ou agendamento.
