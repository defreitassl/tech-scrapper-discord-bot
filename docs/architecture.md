# Arquitetura

## Stack atual

- Node.js com TypeScript.
- Express para o painel admin.
- Prisma como ORM.
- PostgreSQL como banco de dados.
- Discord.js para envio de mensagens ao Discord.
- Google AI Studio/Gemini para gerar mensagens de vaga.

## Principais modulos

- `src/admin/server.ts`: servidor Express do painel admin. Renderiza HTML/CSS diretamente e define as rotas de cadastro, listagem, detalhe, edicao e acoes manuais.
- `src/services/publishPendingJobs.ts`: fluxo de publicacao manual de vagas `PENDING`.
- `src/services/jobMessage.ts`: montagem de mensagem padrao e fallback de texto.
- `src/services/aiMessageGenerator.ts`: integracao com Google AI Studio/Gemini para gerar mensagens curtas e formatadas para Discord.
- `src/services/discordPublisher.ts`: conexao com Discord e envio da mensagem ao canal configurado.
- `src/lib/prisma.ts`: instancia compartilhada do Prisma Client.
- `src/lib/logger.ts`: logger simples usado nos fluxos do projeto.
- `prisma/schema.prisma`: modelo de dados do banco.

## Fluxo de publicacao

1. O admin aciona `Enviar vagas pendentes` no painel.
2. `publishPendingJobs` busca ate 5 vagas com status `PENDING`, ordenadas por criacao.
3. Para cada vaga, o sistema resolve a mensagem:
   - usa `readyText` se existir;
   - reutiliza `aiGeneratedText` se existir e for valido;
   - chama a IA se `useAi` estiver habilitado;
   - usa template padrao se a IA falhar ou estiver desabilitada.
4. `discordPublisher` envia a mensagem ao canal configurado por `DISCORD_CHANNEL_ID`.
5. A vaga e marcada como `SENT` com `sentAt`.
6. Em caso de erro, a vaga e marcada como `ERROR`.

## Papel do painel admin

O painel admin e a interface operacional do projeto. Ele permite criar, revisar, editar, visualizar, arquivar e preparar vagas para publicacao.

Ele nao deve conter regras complexas de coleta automatica. A responsabilidade principal do painel e apoiar revisao humana e operacao manual segura.

## Papel do banco

O PostgreSQL armazena as vagas, seus textos, metadados, status, datas de criacao/atualizacao/envio e informacoes usadas na geracao da mensagem.

O banco tambem sera o ponto natural para deduplicacao futura quando providers de coleta forem adicionados.

## Papel do Discord

O Discord e o canal de distribuicao para os alunos. O sistema deve enviar mensagens curtas, bem formatadas e uteis para leitura rapida.

O Discord nao deve ser usado como fonte da verdade das vagas; a fonte da verdade e o banco.

## Papel da IA

A IA ajuda a transformar textos longos de vagas em mensagens curtas e revisaveis para Discord.

Ela deve:

- resumir descricoes extensas;
- manter informacoes importantes para alunos iniciantes;
- evitar inventar dados;
- respeitar campos estruturados;
- produzir texto formatado em Markdown para Discord.

A IA nao deve ser tratada como etapa obrigatoria. O sistema precisa continuar publicando com `readyText` ou template padrao quando necessario.

