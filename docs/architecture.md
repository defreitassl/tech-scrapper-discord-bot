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
- `src/services/publishPendingJobs.ts`: fluxo de publicacao de vagas, incluindo envio em lote de vagas `PENDING` e envio de uma unica vaga.
- `src/services/schedulerSettings.ts`: leitura, criacao padrao, validacao e atualizacao das configuracoes de envio agendado.
- `src/services/schedulerOperations.ts`: consultas operacionais do agendamento, como limite restante do dia e proximas vagas `PENDING`.
- `src/services/scheduledPublisher.ts`: registro dos crons de publicacao e aplicacao do limite diario antes de chamar `publishPendingJobs`.
- `src/services/jobMessage.ts`: montagem de mensagem padrao e fallback de texto.
- `src/services/aiMessageGenerator.ts`: integracao com Google AI Studio/Gemini para gerar mensagens curtas e formatadas para Discord.
- `src/services/discordPublisher.ts`: conexao com Discord e envio da mensagem ao canal configurado.
- `src/lib/prisma.ts`: instancia compartilhada do Prisma Client.
- `src/lib/logger.ts`: logger simples usado nos fluxos do projeto.
- `prisma/schema.prisma`: modelo de dados do banco.

## Fluxo de publicacao

1. O admin cadastra ou edita uma vaga.
2. No cadastro manual de nova vaga, o painel salva com status `PENDING` por padrao e `useAi` marcado por padrao.
3. Se nao houver `readyText` e `useAi` estiver ativo, o painel tenta gerar `aiGeneratedText` automaticamente com Gemini.
4. Se a IA falhar no cadastro, a vaga continua salva como `PENDING`; o preview e o envio continuam usando o template padrao quando necessario.
5. Na pagina de detalhes, o painel exibe um preview da mensagem que seria enviada ao Discord. Ele usa `readyText`, depois `aiGeneratedText` valido e, se nenhum deles existir, o template padrao.
6. Se quiser atualizar a mensagem, o admin pode acionar `Regenerar mensagem com IA`, que chama Gemini e salva o resultado em `aiGeneratedText` sem enviar ao Discord.
7. Para vagas antigas ou rascunhos, o admin ainda pode usar `Aprovar para envio`, que internamente marca a vaga como `PENDING`.
8. O admin pode acionar `Enviar esta vaga agora` na pagina de detalhes ou `Enviar vagas pendentes` na listagem.
9. `publishPendingJobs` busca ate 5 vagas com status `PENDING`, ordenadas por criacao. O envio individual usa a mesma resolucao de mensagem para a vaga atual.
10. Para cada vaga, o sistema resolve a mensagem:
   - usa `readyText` se existir;
   - reutiliza `aiGeneratedText` se existir e for valido;
   - chama a IA se `useAi` estiver habilitado;
   - usa template padrao se a IA falhar ou estiver desabilitada.
11. `discordPublisher` envia a mensagem ao canal configurado por `DISCORD_CHANNEL_ID`.
12. A vaga e marcada como `SENT` com `sentAt`.
13. Em caso de erro, a vaga e marcada como `ERROR`.

O envio individual nao reenvia vagas `SENT` e nao publica vagas `ARCHIVED`.

## Fluxo de publicacao agendada

1. O admin acessa `Configuracoes de envio` no painel.
2. A configuracao e salva no banco pelo model `SchedulerSettings`.
3. O painel admin registra um cron para cada horario configurado em `sendTimes`, usando o timezone salvo.
4. Em cada execucao, `scheduledPublisher` recarrega a configuracao do banco.
5. Se o agendamento estiver desativado, o horario nao estiver mais configurado ou o limite diario ja tiver sido atingido, nada e enviado.
6. O limite diario considera vagas `SENT` com `sentAt` dentro do dia atual no timezone configurado.
7. Quando ainda ha limite restante, o scheduler chama `publishPendingJobs({ limit: limiteRestante })`.

O envio agendado nao duplica a logica de envio: a resolucao da mensagem, envio ao Discord e atualizacao de status continuam concentrados em `publishPendingJobs`.

O envio manual continua disponivel no painel e, nesta etapa, nao e bloqueado pelo limite diario. Como o limite agendado conta vagas enviadas por `sentAt`, envios manuais feitos no mesmo dia reduzem o limite restante para execucoes agendadas futuras.

A tela `/admin/settings/schedule` tambem mostra um resumo operacional com status do agendamento, limite diario, vagas enviadas hoje, restante do dia, timezone, horarios e a fila das proximas vagas `PENDING`, ordenadas por `createdAt` asc como no envio.

## Papel do painel admin

O painel admin e a interface operacional do projeto. Ele permite criar, revisar, editar, visualizar, arquivar, preparar vagas para publicacao e configurar o envio agendado.

Na interface, os status sao exibidos com nomes amigaveis:

- `DRAFT`: Rascunho.
- `PENDING`: Pronta para envio.
- `SENT`: Enviada.
- `ERROR`: Erro.
- `ARCHIVED`: Arquivada.

Esses labels nao alteram o enum do banco.

Ele nao deve conter regras complexas de coleta automatica. A responsabilidade principal do painel e apoiar revisao humana e operacao manual segura.

## Papel do banco

O PostgreSQL armazena as vagas, seus textos, metadados, status, datas de criacao/atualizacao/envio e informacoes usadas na geracao da mensagem.

O banco tambem armazena `SchedulerSettings`, que guarda se o agendamento esta ativo, o limite diario, o timezone e os horarios de envio. Essa configuracao nao deve ser definida por `.env`.

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
