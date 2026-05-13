# discord-jobs-bot

Bot de Discord em Node.js + TypeScript para enviar vagas de emprego para iniciantes em tecnologia em um canal especifico.

Nesta etapa, o projeto conecta o bot no Discord, possui banco com Prisma e PostgreSQL, inclui um painel web simples para cadastrar, gerenciar e publicar vagas pendentes manualmente, e pode gerar mensagens com IA usando Google AI Studio.

## Requisitos

- Node.js 20 ou superior
- PostgreSQL
- Um bot criado no Discord Developer Portal
- O bot adicionado ao servidor com permissao para enviar mensagens no canal desejado
- Uma chave de API do Google AI Studio, caso queira gerar mensagens com IA

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
GOOGLE_AI_API_KEY=chave_do_google_ai_studio
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

Para aplicar migrations ja criadas no projeto, use:

```bash
npx prisma migrate dev
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

Para cadastrar uma vaga, clique em `Nova vaga`, preencha pelo menos o titulo ou o texto bruto e salve. O cadastro tambem aceita stacks, faixa salarial e uma descricao breve da vaga.

Novas vagas cadastradas manualmente entram como `PENDING` por padrao, exibidas no painel como `Pronta para envio`. Quando `useAi` esta marcado e nao ha `readyText`, o painel tenta gerar `aiGeneratedText` automaticamente com Google AI Studio/Gemini ao salvar. Se a IA falhar, a vaga continua salva como pronta para envio e o preview usa o template padrao.

Na pagina de detalhes, o painel mostra um preview da mensagem que seria enviada ao Discord. Esse preview usa `readyText`, depois `aiGeneratedText` valido e, se nenhum deles existir, o template padrao.

Tambem e possivel usar a acao `Regenerar mensagem com IA` nos detalhes da vaga. Essa acao chama o Google AI Studio, salva o resultado em `aiGeneratedText` e volta para a pagina de detalhes. Ela nao envia a vaga ao Discord.

Para vagas antigas ou rascunhos, a acao `Aprovar para envio` continua disponivel. Internamente o status continua sendo `PENDING`, mas no painel ele aparece como `Pronta para envio`.

Para enviar vagas pendentes ao Discord, use o botao `Enviar vagas pendentes` na listagem. O painel busca ate 5 vagas com status `PENDING`, envia no canal configurado em `DISCORD_CHANNEL_ID` e atualiza cada vaga enviada para `SENT`.

Para enviar uma vaga especifica, acesse os detalhes e use `Enviar esta vaga agora`. Vagas ja enviadas nao sao reenviadas e vagas arquivadas nao sao publicadas.

Quando `readyText` estiver preenchido, ele tem prioridade. Se nao houver `readyText`, o bot reutiliza `aiGeneratedText` quando existir. Se a vaga estiver com `useAi` habilitado e ainda nao tiver texto gerado, o bot gera a mensagem com Google AI Studio, salva em `aiGeneratedText` e envia. Se a IA falhar, o template padrao e usado para nao bloquear o envio.

## Envio agendado

O envio agendado e configurado pelo painel admin, nao por `.env`.

Acesse:

```text
http://localhost:3000/admin/settings/schedule
```

Nessa tela e possivel definir:

- se o agendamento esta ativo;
- quantas vagas podem ser enviadas por dia pelo agendamento, escolhendo uma opcao de 1 a 10;
- um horario para cada vaga do dia.

O timezone nao e editavel pela interface. O sistema usa sempre `America/Sao_Paulo`.

Cada slot de horario envia 1 vaga da fila. Horarios repetidos representam multiplos envios no mesmo horario.

A mesma tela tambem mostra um resumo operacional com:

- agendamento ativo ou inativo;
- limite diario configurado;
- vagas enviadas hoje;
- quanto ainda pode ser enviado no dia pelo agendamento;
- timezone do sistema;
- slots configurados;
- proximas vagas `PENDING` na fila de envio.

Exemplo:

```text
Vaga 1: 10:00
Vaga 2: 10:00
Vaga 3: 15:00
```

O agendamento publica somente vagas com status `PENDING`, reutilizando o mesmo fluxo de `publishPendingJobs`. O limite diario considera vagas ja enviadas no dia pelo campo `sentAt`, incluindo envios manuais. O envio manual pelo painel continua disponivel e nao recebe bloqueio de limite diario nesta etapa.

O processo do painel admin precisa estar rodando para que os horarios configurados sejam executados:

```bash
npm run admin
```

## Escopo atual

- Conexao com Discord
- Leitura de variaveis de ambiente
- Envio de mensagem de teste
- Envio manual de vagas `PENDING` para Discord pelo painel
- Envio agendado de vagas `PENDING` configurado pelo painel
- Geracao opcional de mensagens com Google AI Studio
- Schema inicial do Prisma com PostgreSQL
- Model `JobPost` para armazenar vagas
- Model `SchedulerSettings` para configuracao de envio agendado
- Painel admin simples para cadastrar, listar, visualizar e editar vagas

Ainda nao ha scraping ou autenticacao.
