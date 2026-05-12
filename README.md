# discord-jobs-bot

Bot de Discord em Node.js + TypeScript para enviar vagas de emprego para iniciantes em tecnologia em um canal especifico.

Nesta primeira etapa, o projeto apenas conecta o bot no Discord e envia uma mensagem de teste no canal configurado.

## Requisitos

- Node.js 20 ou superior
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

## Escopo atual

- Conexao com Discord
- Leitura de variaveis de ambiente
- Envio de mensagem de teste

Ainda nao ha banco de dados, scraping ou agendamento.
