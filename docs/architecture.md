# Arquitetura

## Stack atual

- Node.js com TypeScript.
- Express para o painel admin.
- Prisma como ORM.
- PostgreSQL como banco de dados.
- Discord.js para envio de mensagens ao Discord.
- Google AI Studio/Gemini para gerar mensagens de vaga.

## Principais modulos

- `src/admin/server.ts`: ponto de entrada do painel admin. Cria o app Express, configura middlewares, registra rotas, inicia o servidor e inicia o `scheduledPublisher`.
- `src/admin/routes/jobs.routes.ts`: rotas de vagas do painel admin, incluindo listagem, cadastro, detalhe, edicao, aprovacao, geracao manual de mensagem com IA, arquivamento e envio manual.
- `src/admin/routes/schedule.routes.ts`: rotas de configuracao do envio agendado.
- `src/admin/views/`: renderizacao server-side do painel. `layout.ts` contem o layout base, `styles.ts` contem o CSS inline, `components.ts` contem componentes HTML reutilizaveis, `jobs.views.ts` contem telas de vagas e `schedule.views.ts` contem a tela de agendamento.
- `src/admin/helpers/`: helpers puros do painel. `forms.ts` concentra parse e normalizacao de formularios, `validators.ts` concentra validacoes de formulario/status, `status.ts` concentra labels de status, `formatters.ts` concentra formatacao visual simples e `notifications.ts` concentra notificacoes temporarias via query params.
- `src/providers/`: base inicial de providers de coleta. Inclui contrato (`types.ts`), normalizacao (`normalizeCollectedJob.ts`), registry de providers ativos (`providerRegistry.ts`), provider mock (`mockJobs.provider.ts`) e runner (`providerRunner.ts`).
- `src/services/publishPendingJobs.ts`: fluxo de publicacao de vagas, incluindo envio em lote de vagas `PENDING` e envio de uma unica vaga.
- `src/services/jobDeduplication.ts`: primeira camada reutilizavel de deduplicacao de vagas. Bloqueia duplicata forte por URL normalizada e sinaliza possivel duplicata por titulo + empresa normalizados.
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
2. No cadastro manual de nova vaga, antes de criar o registro, o painel consulta `jobDeduplication`.
3. Se a URL preenchida ja existir apos normalizacao simples, a vaga nao e criada, a IA nao e chamada e o admin e redirecionado para a vaga existente com aviso.
4. Se nao houver URL duplicada, mas ja existir vaga com mesmo titulo e empresa normalizados, o cadastro continua e o painel mostra um aviso de possivel duplicata.
5. No cadastro manual de nova vaga, o painel salva com status `PENDING` por padrao e `useAi` marcado por padrao.
6. Se nao houver `readyText` e `useAi` estiver ativo, o painel tenta gerar `aiGeneratedText` automaticamente com Gemini.
7. Se a IA falhar no cadastro, a vaga continua salva como `PENDING`; o preview e o envio continuam usando o template padrao quando necessario.
8. Na pagina de detalhes, o painel exibe um preview da mensagem que seria enviada ao Discord. Ele usa `readyText`, depois `aiGeneratedText` valido e, se nenhum deles existir, o template padrao.
9. Se quiser atualizar a mensagem, o admin pode acionar `Regenerar mensagem com IA`, que chama Gemini e salva o resultado em `aiGeneratedText` sem enviar ao Discord.
10. Para vagas antigas ou rascunhos, o admin ainda pode usar `Aprovar para envio`, que internamente marca a vaga como `PENDING`.
11. O admin pode acionar `Enviar esta vaga agora` na pagina de detalhes ou `Enviar vagas pendentes` na listagem.
12. `publishPendingJobs` busca ate 5 vagas com status `PENDING`, ordenadas por criacao. O envio individual usa a mesma resolucao de mensagem para a vaga atual.
13. Para cada vaga, o sistema resolve a mensagem:
   - usa `readyText` se existir;
   - reutiliza `aiGeneratedText` se existir e for valido;
   - chama a IA se `useAi` estiver habilitado;
   - usa template padrao se a IA falhar ou estiver desabilitada.
14. `discordPublisher` envia a mensagem ao canal configurado por `DISCORD_CHANNEL_ID`.
15. A vaga e marcada como `SENT` com `sentAt`.
16. Em caso de erro, a vaga e marcada como `ERROR`.

O envio individual nao reenvia vagas `SENT` e nao publica vagas `ARCHIVED`.

## Fluxo de coleta de teste/providers

O projeto possui uma base inicial de providers em `src/providers/`, sem scraping real nesta etapa.

O fluxo atual e acionado manualmente no painel pela rota `POST /admin/jobs/collect`, exibida na listagem como `Coletar vagas de teste`.

1. O admin aciona a coleta de teste na listagem de vagas.
2. `runJobProviders` percorre os providers registrados em `providerRegistry`.
3. Cada provider executa `collect()` e retorna `CollectedJob[]`.
4. Cada vaga coletada passa por `normalizeCollectedJob`, que remove espacos duplicados em campos estruturados, transforma strings vazias em `null`, preserva `rawText` quando existir e garante `source`.
5. Antes de criar no banco, o runner chama `checkJobDuplicate` em `src/services/jobDeduplication.ts`.
6. Duplicata forte por URL normalizada bloqueia a criacao.
7. Possivel duplicata por titulo + empresa e apenas contabilizada; a vaga ainda e criada como `DRAFT` para revisao humana.
8. Vagas criadas automaticamente entram sempre como `DRAFT`, com `useAi = false`.
9. A coleta nao chama Gemini/IA, nao marca vagas como `PENDING` e nao envia nada ao Discord.
10. O painel redireciona de volta para `/admin/jobs` com um toast resumindo novas vagas e duplicatas por URL ignoradas.

O provider ativo nesta etapa e apenas `mockJobsProvider`, que retorna vagas fake para validar arquitetura e fluxo operacional. Nao ha provider para LinkedIn, Gupy, Solides ou qualquer fonte real.

## Fluxo de publicacao agendada

1. O admin acessa `Configuracoes de envio` no painel.
2. O admin escolhe a quantidade de vagas por dia em um select e um horario para cada vaga diaria. O timezone nao e editavel e o backend sempre persiste `America/Sao_Paulo`.
3. A configuracao e salva no banco pelo model `SchedulerSettings`.
4. O painel admin agrupa horarios repetidos e registra um cron para cada horario unico em `sendTimes`, usando `America/Sao_Paulo`.
5. Cada item de `sendTimes` representa 1 slot de envio. Horarios duplicados significam multiplos slots no mesmo horario.
6. Em cada execucao, `scheduledPublisher` recarrega a configuracao do banco.
7. Se o agendamento estiver desativado, o horario nao estiver mais configurado ou o limite diario ja tiver sido atingido, nada e enviado.
8. O limite diario considera vagas `SENT` com `sentAt` dentro do dia atual no timezone configurado.
9. Quando ainda ha limite restante, o scheduler chama `publishPendingJobs({ limit })`, usando o menor valor entre os slots daquele horario e o limite restante do dia.

O envio agendado nao duplica a logica de envio: a resolucao da mensagem, envio ao Discord e atualizacao de status continuam concentrados em `publishPendingJobs`.

O envio manual continua disponivel no painel e, nesta etapa, nao e bloqueado pelo limite diario. Como o limite agendado conta vagas enviadas por `sentAt`, envios manuais feitos no mesmo dia reduzem o limite restante para execucoes agendadas futuras.

A tela `/admin/settings/schedule` tambem mostra um resumo operacional com status do agendamento, limite diario, vagas enviadas hoje, restante do dia, timezone do sistema, slots configurados e a fila das proximas vagas `PENDING`, ordenadas por `createdAt` asc como no envio.

## Papel do painel admin

O painel admin e a interface operacional do projeto. Ele permite criar, revisar, editar, visualizar, arquivar, preparar vagas para publicacao e configurar o envio agendado.

O feedback operacional do painel e exibido por notificacoes temporarias server-rendered, usando query params como `message` e `noticeType`. Essas notificacoes nao sao logs persistentes, nao criam tabela no banco e nao substituem os logs da aplicacao.

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

O banco tambem armazena `SchedulerSettings`, que guarda se o agendamento esta ativo, o limite diario, o timezone e os horarios de envio. O campo de timezone existe por compatibilidade, mas o painel sempre salva `America/Sao_Paulo`.

A deduplicacao atual nao usa constraint unica nem altera o schema. Ela consulta os registros existentes via Prisma e compara valores normalizados em `jobDeduplication`. O banco continuara sendo o ponto natural para deduplicacao mais forte quando providers de coleta forem adicionados.

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
