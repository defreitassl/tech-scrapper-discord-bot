# Arquitetura

## Stack atual

- Node.js com TypeScript.
- Express para o painel admin.
- Prisma como ORM.
- PostgreSQL como banco de dados.
- Discord.js para envio de mensagens ao Discord.
- Google AI Studio/Gemini para gerar mensagens de vaga.

## Principais modulos

- `src/admin/server.ts`: ponto de entrada do painel admin. Cria o app Express, configura middlewares, registra rotas, inicia o servidor, inicia o `scheduledPublisher` e inicia o `scheduledCollector`.
- `src/admin/routes/jobs.routes.ts`: rotas de vagas do painel admin, incluindo listagem, cadastro, detalhe, edicao, aprovacao, geracao manual de mensagem com IA, arquivamento e envio manual.
- `src/admin/routes/schedule.routes.ts`: rotas de configuracao do envio agendado.
- `src/admin/views/`: renderizacao server-side do painel. `layout.ts` contem o layout base, `styles.ts` contem o CSS inline, `components.ts` contem componentes HTML reutilizaveis, `jobs.views.ts` contem telas de vagas e `schedule.views.ts` contem a tela de agendamento.
- `src/admin/helpers/`: helpers puros do painel. `forms.ts` concentra parse e normalizacao de formularios, `validators.ts` concentra validacoes de formulario/status, `status.ts` concentra labels de status, `formatters.ts` concentra formatacao visual simples e `notifications.ts` concentra notificacoes temporarias via query params.
- `src/providers/`: base de providers de coleta. Inclui contrato (`types.ts`), normalizacao (`normalizeCollectedJob.ts`), registry de providers ativos (`providerRegistry.ts`), provider mock (`mockJobs.provider.ts`), provider GitHub (`githubJobs.provider.ts`), providers externos por APIs publicas JSON (`himalayas.provider.ts`, `jobicy.provider.ts`, `remoteOk.provider.ts`, `remotive.provider.ts`), helpers compartilhados e runner (`providerRunner.ts`).
- `src/services/publishPendingJobs.ts`: fluxo de publicacao de vagas, incluindo envio em lote de vagas `PENDING` e envio de uma unica vaga.
- `src/services/jobDeduplication.ts`: primeira camada reutilizavel de deduplicacao de vagas. Bloqueia duplicata forte por URL normalizada e sinaliza possivel duplicata por titulo + empresa normalizados.
- `src/services/jobQualityFilter.ts`: filtro deterministico de qualidade para vagas coletadas por providers. Rejeita vagas antes da criacao no banco quando faltam dados essenciais, falta canal claro de candidatura (URL ou e-mail no texto), ha sinais fortes de senioridade/experiencia alta ou a vaga parece fora de tecnologia.
- `src/services/schedulerSettings.ts`: leitura, criacao padrao, validacao e atualizacao das configuracoes de envio agendado.
- `src/services/schedulerOperations.ts`: consultas operacionais do agendamento, como limite restante do dia e proximas vagas `PENDING`.
- `src/services/scheduledPublisher.ts`: registro dos crons de publicacao e aplicacao do limite diario antes de chamar `publishPendingJobs`.
- `src/services/jobMessage.ts`: montagem de mensagem padrao e fallback de texto.
- `src/services/aiMessageGenerator.ts`: integracao com Google AI Studio/Gemini para gerar mensagens curtas e formatadas para Discord.
- `src/services/discordPublisher.ts`: conexao com Discord e envio da mensagem ao canal configurado.
- `src/services/scheduledCollector.ts`: agendamento fixo da coleta automatica diaria dos providers reais, com lock simples em memoria para evitar execucoes concorrentes.
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
11. Para vagas coletadas como `DRAFT`, o admin pode usar `Preparar e colocar na fila`. Essa acao chama Gemini, salva `aiGeneratedText`, marca `useAi = true` e altera o status para `PENDING` somente se a IA gerar a mensagem com sucesso. A acao nao envia a vaga ao Discord.
12. Se a vaga ja estiver `PENDING`, a mesma acao pode regenerar `aiGeneratedText` e manter a vaga na fila. Vagas `SENT` ou `ARCHIVED` nao sao preparadas.
13. O admin pode acionar `Enviar esta vaga agora` na pagina de detalhes ou `Enviar vagas pendentes` na listagem.
14. `publishPendingJobs` busca ate 5 vagas com status `PENDING`, ordenadas por criacao. O envio individual usa a mesma resolucao de mensagem para a vaga atual.
15. Para cada vaga, o sistema resolve a mensagem:
   - usa `readyText` se existir;
   - reutiliza `aiGeneratedText` se existir e for valido;
   - chama a IA se `useAi` estiver habilitado;
   - usa template padrao se a IA falhar ou estiver desabilitada.
16. `discordPublisher` envia a mensagem ao canal configurado por `DISCORD_CHANNEL_ID`.
17. A vaga e marcada como `SENT` com `sentAt`.
18. Em caso de erro, a vaga e marcada como `ERROR`.

O envio individual nao reenvia vagas `SENT` e nao publica vagas `ARCHIVED`.

## Fluxo de coleta/providers

O projeto possui uma base inicial de providers em `src/providers/`. A coleta continua manual pelo painel e cria apenas rascunhos para revisao humana.

O fluxo de teste/mock e acionado pela rota `POST /admin/jobs/collect`, exibida na listagem como `Coletar vagas de teste`.

1. O admin aciona a coleta de teste na listagem de vagas.
2. A rota chama `runJobProviders([mockJobsProvider])`.
3. Cada provider executa `collect()` e retorna `CollectedJob[]` ou um resultado com `jobs` e metadados operacionais.
4. Cada vaga coletada passa por `normalizeCollectedJob`, que remove espacos duplicados em campos estruturados, transforma strings vazias em `null`, preserva `rawText` quando existir e garante `source`.
5. Antes de criar no banco, o runner chama `evaluateCollectedJobQuality` em `src/services/jobQualityFilter.ts`.
6. Vagas rejeitadas pelo filtro de qualidade nao sao criadas, incrementam `ignoredByQuality` e registram os motivos no terminal.
7. Para vagas aceitas por qualidade, o runner chama `checkJobDuplicate` em `src/services/jobDeduplication.ts`.
8. Duplicata forte por URL normalizada bloqueia a criacao.
9. Possivel duplicata por titulo + empresa e apenas contabilizada; a vaga ainda e criada como `DRAFT` para revisao humana.
10. Vagas criadas automaticamente entram sempre como `DRAFT`, com `useAi = false`.
11. A coleta nao chama Gemini/IA, nao marca vagas como `PENDING` e nao envia nada ao Discord.
12. O painel redireciona de volta para `/admin/jobs` com um toast resumindo novas vagas, duplicatas por URL ignoradas e metadados especificos da coleta quando existirem.

O provider mock retorna vagas fake para validar arquitetura e fluxo operacional.

## Fluxo de coleta GitHub

A rota `POST /admin/jobs/collect-github`, exibida na listagem como `Coletar vagas do GitHub`, executa apenas `githubJobsProvider`.

O provider GitHub usa a API oficial `GET https://api.github.com/repos/{owner}/{repo}/issues` para ler issues publicas abertas de:

- `frontendbr/vagas`
- `backend-br/vagas`
- `react-brasil/vagas`
- `qa-brasil/vagas`
- `nodejsdevbr/vagas`
- `dotnetdevbr/vagas`
- `soujava/vagas-java`
- `DevOps-Brasil/Vagas`
- `programadores-br/geral`
- `datascience-br/vagas`
- `brasil-php/vagas`
- `androiddevbr/vagas`
- `CocoaHeadsBrasil/vagas`
- `remotejobsbr/design-ux-vagas`

Ele envia os headers `Accept: application/vnd.github+json` e `X-GitHub-Api-Version: 2022-11-28`. Quando `GITHUB_TOKEN` existe, tambem envia `Authorization: Bearer <GITHUB_TOKEN>`. Sem token, a coleta continua funcionando sem autenticacao, mas registra aviso sobre rate limit menor.

O provider usa `state=open`, `per_page=100` e `since=<data ISO de 30 dias atras>`. Como o `since` da API considera atualizacao da issue, o provider tambem filtra manualmente `created_at` e aceita somente issues criadas nos ultimos 30 dias. Pull requests retornados pela API sao ignorados. Se um repositorio falhar, o erro e logado e contabilizado no resumo, mas a coleta continua nos demais repositorios.

Durante a coleta, o provider contabiliza `totalIssuesRead`, `ignoredByDate`, `ignoredBySeniority`, `ignoredByMissingEntryLevel`, `ignoredByLocation` e erros por repositorio. O runner complementa o diagnostico com `ignoredByQuality`, `ignoredDuplicates`, `possibleDuplicates` e `created`, porque esses dados dependem da avaliacao de qualidade, da deduplicacao e da escrita no banco.

A filtragem de nivel e baseada em labels. A issue so e coletada quando as labels indicam `junior`, `júnior`, `jr`, `estagio`, `estágio`, `estagiario`, `estagiário` ou `trainee`, incluindo labels compostas como `estágio remoto`. `Trainee` e tratado como nivel de entrada. Labels de `pleno`, `senior`, `sênior`, `especialista`, `tech lead`, `lead`, `staff` ou `principal` bloqueiam a coleta. Se o nivel nao puder ser identificado claramente como `Júnior`, `Estágio` ou `Trainee`, a issue nao e coletada.

O filtro geografico aceita vagas 100% remotas de qualquer cidade, estado ou pais. Vagas hibridas ou presenciais so sao aceitas quando a localizacao ou o corpo indicam Minas Gerais, incluindo referencias como `MG`, `Minas Gerais`, `Belo Horizonte`, `BH`, `Contagem`, `Betim`, `Nova Lima`, `Uberlandia`, `Juiz de Fora` e outras cidades mineiras mapeadas no provider. Quando a modalidade nao e identificada, a issue so e aceita se parecer ser de Minas Gerais. Issues rejeitadas por essa regra incrementam `ignoredByLocation` no resumo.

O titulo da issue e interpretado a partir de formatos como `[Cidade/Remoto] Cargo na Empresa`: a localizacao vem do texto entre colchetes, o cargo fica em `title` e a empresa e extraida de conectores como `na`, `no`, `na empresa` ou `para`, quando possivel. Se a empresa nao vier do titulo, o provider tenta campos confiaveis no corpo, como `Empresa:`.

O provider tambem tenta extrair `shortDescription` do corpo da issue a partir de secoes como `Descricao da vaga`, `Sobre a vaga`, `Nossa empresa` e `Responsabilidades`, mantendo um resumo curto de ate cerca de 80 palavras. As `stacks` sao extraidas por termos tecnicos conhecidos, como React, TypeScript, Node.js, SQL, Docker, Java, Python, PHP, HTML e CSS, sem inventar tecnologias. O corpo da issue tambem e salvo em `rawText` com limite de 300 palavras.

Depois da coleta, o runner existente normaliza, aplica o filtro de qualidade, deduplica e cria os registros como `DRAFT`, com `useAi = false`. Vagas rejeitadas por qualidade nao sao criadas e aparecem no diagnostico como `ignoredByQuality`. Duplicatas fortes por URL sao ignoradas. Possiveis duplicatas por titulo + empresa sao contabilizadas no toast, mas ainda podem ser criadas como rascunho.

A coleta GitHub nao chama IA, nao envia vagas ao Discord, nao transforma vagas em `PENDING` automaticamente e nao altera o agendamento. O toast da rota mostra um resumo temporario com issues analisadas, novas vagas, duplicatas, possiveis duplicatas, antigas, fora de localizacao, fora do nivel, rejeitadas por qualidade e erros. O terminal registra tambem um resumo estruturado por repositorio e logs das rejeicoes de qualidade com `reasons`. Nao ha tabela, pagina ou persistencia de logs de coleta.

## Fluxo de coleta de fontes externas

A rota `POST /admin/jobs/collect-external`, exibida na listagem como `Coletar fontes externas`, executa apenas os providers externos registrados em `externalJobProviders`:

- `himalayasProvider`, usando `https://himalayas.app/jobs/api/search`;
- `jobicyProvider`, usando `https://jobicy.com/api/v2/remote-jobs`;
- `remoteOkProvider`, usando `https://remoteok.com/api`;
- `remotiveProvider`, usando `https://remotive.com/api/remote-jobs`.

Esses providers usam apenas APIs JSON publicas. Nao usam Playwright, Cheerio, login, captcha ou scraping HTML com navegador. Cada provider faz chamadas conservadoras, com poucas queries por execucao, e retorna vagas mais metadados operacionais para o runner. Falha em uma busca ou provider e registrada no resumo e nos logs, mas nao interrompe os demais providers.

As fontes externas aplicam filtro antes do runner para reduzir ruido:

- data de publicacao nos ultimos 30 dias;
- sinais claros de nivel iniciante, como `junior`, `entry-level`, `intern`, `estagio` ou `trainee`;
- rejeicao de `senior`, `mid-level`, `lead`, `staff`, `principal`, `manager`, `director` e similares;
- vagas claramente remotas com localidade global ou compativel com Brasil, LATAM ou Americas;
- restricoes regionais incompatíveis com Brasil sao ignoradas.

Depois desse filtro, o mesmo runner central normaliza, aplica `evaluateCollectedJobQuality`, deduplica por URL e cria registros como `DRAFT` com `useAi = false`. A coleta externa nao chama Gemini/IA, nao envia vagas ao Discord e nao muda vagas para `PENDING`.

Jobicy, RemoteOK e Remotive exigem atribuicao/linkback. A implementacao preserva a URL original sempre que fornecida, registra `source` com o nome do provider e deixa a revisao final para o admin antes da publicacao.

## Fluxo de coleta automatica

O painel admin inicia `scheduledCollector` junto com o processo de `npm run admin`.

A coleta automatica roda diariamente as 08:00 no timezone `America/Sao_Paulo`, usando `node-cron` com a expressao `0 8 * * *`.

Ela executa apenas os providers reais registrados em `realJobProviders`, atualmente GitHub, Himalayas, Jobicy, RemoteOK e Remotive. O `mockJobsProvider` fica em `testJobProviders` e nao roda automaticamente.

A coleta automatica chama o mesmo runner de providers, entao preserva as regras centrais:

- cria vagas coletadas apenas como `DRAFT`;
- salva `useAi = false`;
- nao chama Gemini/IA;
- nao marca vagas como `PENDING`;
- nao envia ao Discord;
- reaproveita normalizacao, filtro de qualidade e deduplicacao.

O servico possui um lock simples em memoria (`isCollecting`). Se uma coleta manual GitHub, externa ou automatica ja estiver em execucao, a nova execucao e ignorada com log amigavel. Esse lock evita concorrencia dentro do mesmo processo admin e nao cria estado no banco.

Falhas na coleta automatica sao capturadas e registradas no logger. O processo do painel nao deve cair por erro de provider.

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
