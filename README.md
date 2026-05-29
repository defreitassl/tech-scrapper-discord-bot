# discord-jobs-bot

Bot de Discord em Node.js + TypeScript para enviar vagas de emprego para iniciantes em tecnologia em um canal especifico.

Nesta etapa, o projeto conecta o bot no Discord, possui banco com Prisma e PostgreSQL, inclui um painel web simples para cadastrar, gerenciar e publicar vagas pendentes manualmente, pode gerar mensagens com IA usando Google AI Studio e possui providers reais para GitHub, APIs publicas JSON, Remotar, ATS publicos e fontes experimentais manuais.

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
GITHUB_TOKEN=
```

`GITHUB_TOKEN` e opcional. Sem ele, a coleta GitHub funciona sem autenticacao, mas fica sujeita a um rate limit menor da API. Com token, o painel envia `Authorization: Bearer <GITHUB_TOKEN>` para aumentar o limite disponivel.

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

Novas vagas cadastradas manualmente entram como `PENDING` por padrao, exibidas no painel como `Pronta para envio`. Quando `useAi` esta marcado e nao ha `readyText`, a mensagem com Google AI Studio/Gemini e gerada somente no momento do envio.

Na pagina de detalhes, o painel mostra um preview da mensagem que seria enviada ao Discord. Esse preview usa `readyText`, depois `aiGeneratedText` valido e, se nenhum deles existir, o fallback deterministico.

Para vagas antigas ou rascunhos legados, a acao `Aprovar para envio` continua disponivel. Internamente o status continua sendo `PENDING`, mas no painel ele aparece como `Pronta para envio`.

`DRAFT` foi aposentado do fluxo principal de coleta. O enum continua no Prisma por compatibilidade, e vagas antigas nesse status nao sao deletadas automaticamente. Quando houver rascunhos legados, o painel mostra uma secao discreta `Rascunhos legados` e permite coloca-los como `PENDING` sem chamar IA.

Vagas coletadas por providers recebem prioridade persistida (`HIGH`, `MEDIUM` ou `LOW`), score e motivos calculados antes da decisao de aprovacao. O novo fluxo automatizado nunca persiste vagas recusadas.

A coleta manual e a coleta automatica configuravel usam o mesmo pipeline: provider, normalizacao, filtro TECH/NON_TECH, filtro de qualidade, deduplicacao, prioridade, preenchimento da fila e criacao do `JobPost` como `PENDING`. A coleta nao chama Gemini e nao envia nada ao Discord; o envio continua sendo feito pelo scheduler nos horarios configurados ou pelas acoes manuais.

Vagas `HIGH` sao elegiveis. Vagas `MEDIUM` so entram se forem estagio, trainee, remotas ou tiverem `priorityScore >= 75`. Vagas `LOW`, `NON_TECH`, sem URL, sem descricao util, com senioridade alta ou duplicadas sao recusadas e nao sao persistidas. O fluxo usa o limite diario configurado no agendamento para montar uma fila alvo: `min(max(dailyLimit * 7, dailyLimit), 30)`. Vagas `SENT` hoje nao reduzem a coleta; elas sao responsabilidade do scheduler no envio.

Para diagnosticar se a pontuacao de prioridade esta coerente e calibrar a autoaprovacao, compile o projeto e rode:

```bash
npm run build
npm run diagnose:priority
```

O diagnostico le vagas `DRAFT` legadas recentes, imprime distribuicoes, top/bottom por score e motivos de prioridade. Ele nao altera dados, nao chama Gemini e nao envia nada ao Discord. Por padrao analisa ate 100 rascunhos; para outro limite, use `PRIORITY_DIAG_LIMIT=200 npm run diagnose:priority`.

Para validar rapidamente o filtro de dominio tech/non-tech sem acessar banco nem fontes externas, compile e rode:

```bash
npm run build
npm run diagnose:domain
```

O diagnostico cobre exemplos como Direito Societario, Marketing de Performance, Afiliados e Parcerias, Suporte Tecnico, Desenvolvimento Front-end e QA Junior.

Para enviar vagas pendentes ao Discord, use o botao `Enviar vagas pendentes` na listagem. O painel busca ate 5 vagas com status `PENDING`, envia no canal configurado em `DISCORD_CHANNEL_ID` e atualiza cada vaga enviada para `SENT`.

Para enviar uma vaga especifica, acesse os detalhes e use `Enviar esta vaga agora`. Vagas ja enviadas nao sao reenviadas e vagas arquivadas nao sao publicadas.

Quando `readyText` estiver preenchido, ele tem prioridade. Se nao houver `readyText`, o bot reutiliza `aiGeneratedText` quando existir e for valido. Se a vaga estiver com `useAi` habilitado e ainda nao tiver texto gerado, o bot gera a mensagem com Google AI Studio no envio, salva em `aiGeneratedText` e envia. Se a IA falhar, o fallback deterministico e usado para nao bloquear o envio.

Cada vaga publicada vai como um Discord embed/card, com um texto curto no `content`, titulo, link quando houver, descricao gerada por `readyText`, `aiGeneratedText`, Gemini ou fallback, campos estruturados opcionais e rodape com a fonte. Isso melhora a separacao visual quando varias vagas sao enviadas pelo mesmo bot. Se o Discord rejeitar o envio com embed, o publisher tenta enviar a mesma mensagem como texto puro antes de marcar erro.

### Coleta de vagas

A listagem possui um unico botao `Coletar vagas`. Ele chama `POST /admin/jobs/collect-all` e executa todos os providers coletaveis manualmente:

- GitHub, por issues publicas;
- Himalayas, Jobicy, RemoteOK e Remotive, por APIs JSON publicas;
- Remotar, por JSON publico;
- Gupy, Programathor e Solides, tambem incluidos na coleta automatica;
- Greenhouse, Lever e Ashby, como ATS publicos por empresas cadastradas.

O provider mock/de teste foi removido do fluxo atual. A coleta manual unificada respeita o lock de coleta existente, aprova vagas elegiveis direto como `PENDING`, salva `useAi = true` e deixa `aiGeneratedText` vazio ate o envio, nao envia nada ao Discord e nao persiste vagas recusadas. O toast do painel e compacto: `Coleta concluida: X vagas aprovadas para fila, Y recusadas, Z duplicatas, W erros.`

O provider GitHub usa a API oficial do GitHub para ler issues abertas dos repositorios:

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

O provider busca issues abertas atualizadas desde os ultimos 30 dias usando o parametro `since`, mas tambem filtra manualmente `created_at` para aceitar somente issues criadas nos ultimos 30 dias.

A coleta aceita somente vagas cujas labels indiquem `junior`, `júnior`, `jr`, `estagio`, `estágio`, `estagiario`, `estagiário` ou `trainee`, incluindo labels compostas como `estágio remoto`. `Trainee` e tratado como nivel de entrada. Labels como `pleno`, `senior`, `sênior`, `especialista`, `tech lead`, `lead`, `staff` e `principal` sao ignoradas. Pull requests e issues antigas sao ignoradas.

O filtro geografico aceita vagas remotas de qualquer lugar. Vagas hibridas ou presenciais so sao aceitas quando a localizacao ou o corpo da issue indicam Minas Gerais; vagas fora de MG, como uma vaga hibrida em Brasilia, sao ignoradas e contabilizadas no resumo como `ignoradas por localização`.

O provider tenta preencher `shortDescription` a partir de secoes como `Descricao da vaga`, `Sobre a vaga`, `Nossa empresa` e `Responsabilidades`, mantendo um resumo curto. Ele tambem tenta extrair `stacks` do corpo da issue a partir de termos tecnicos conhecidos, sem inventar tecnologias.

As vagas coletadas do GitHub sao normalizadas, passam pelo filtro TECH/NON_TECH, pelo filtro deterministico de qualidade, pela deduplicacao existente e pela priorizacao. Vagas aprovadas entram como `PENDING` sem gerar Gemini. Vagas sem URL, sem descricao util, com sinais fortes de senioridade ou experiencia alta, que nao parecam ser de tecnologia ou duplicadas sao recusadas sem persistencia.

Se um repositorio GitHub falhar, o provider registra o erro e continua nos demais repositorios. O resumo da coleta informa novas vagas criadas, duplicatas ignoradas, possiveis duplicatas, vagas ignoradas por localizacao, vagas ignoradas por qualidade e quantidade de erros. Os motivos de rejeicao por qualidade aparecem nos logs do terminal.

Os providers externos usam APIs publicas JSON, sem Playwright, Cheerio ou scraping com navegador:

- Himalayas: `https://himalayas.app/jobs/api/search`
- Jobicy: `https://jobicy.com/api/v2/remote-jobs`
- RemoteOK: `https://remoteok.com/api`
- Remotive: `https://remotive.com/api/remote-jobs`

Esses providers fazem poucas chamadas por execucao, filtram vagas publicadas nos ultimos 30 dias, aceitam apenas sinais claros de perfil iniciante (`junior`, `entry-level`, `intern`, `estagio` ou `trainee`) e rejeitam sinais de senioridade alta ou intermediaria, como `senior`, `mid-level`, `lead`, `staff`, `principal`, `manager` e similares.

Como as fontes sao majoritariamente remotas, a coleta externa aceita apenas vagas remotas com localidade global ou compativel com Brasil/LATAM/Americas. Quando a API indica restricao incompatível com o Brasil, a vaga e ignorada.

Jobicy, RemoteOK e Remotive exigem atribuicao/linkback. Por isso a URL original da vaga e preservada, a fonte fica registrada em `source` e o admin deve manter o link original ao revisar/publicar a vaga. A coleta respeita abordagem conservadora de rate limit: Himalayas usa limite de 20 por busca, Jobicy usa poucas buscas com `count=50`, RemoteOK faz uma chamada unica e Remotive faz poucas buscas para respeitar a recomendacao de baixa frequencia.

Os providers ATS usam endpoints publicos, sem Playwright, Cheerio, login, cookies, credenciais pessoais, proxy, captcha ou bypass anti-bot:

- Greenhouse: `https://boards-api.greenhouse.io/v1/boards/{empresa}/jobs?content=true`
- Lever: `https://api.lever.co/v0/postings/{empresa}?mode=json`
- Ashby: `https://api.ashbyhq.com/posting-api/job-board/{empresa}`

A lista inicial controlada de empresas-alvo fica em `src/providers/companyTargets.ts` e comeca pequena para validar a arquitetura:

- GitLab, via Greenhouse (`gitlab`);
- Kepler Communications, via Lever (`kepler`);
- Ashby, via Ashby (`ashby`).

Esses providers buscam apenas empresas cadastradas nessa lista. Se uma empresa falhar ou o endpoint publico nao estiver acessivel, o erro e registrado e a coleta continua nos demais alvos do mesmo provider.

A coleta ATS filtra vagas publicadas nos ultimos 30 dias quando o ATS fornece data, exige sinal claro de perfil iniciante (`junior`, `jr`, `entry-level`, `intern`, `internship`, `estagio` ou `trainee`), rejeita senioridade intermediaria/alta e aceita remoto apenas quando for global, Brasil, LATAM ou Americas, ou sem restricao incompatível. Vagas hibridas ou presenciais sao aceitas somente em Minas Gerais.

O provider Gupy foi criado apos investigacao tecnica documentada em `docs/gupy-scraping-research.md`. A pagina publica da Gupy carrega vagas por endpoint JSON publico em `https://employability-portal.gupy.io/api/v1/jobs`, sem login, captcha, cookies autenticados, proxy ou bypass durante a validacao. Como JSON publico e preferivel a browser scraping, a coleta usa o cliente publico da camada `src/scraping/` e consulta poucas buscas com `limit=10`, sem paginacao agressiva.

A coleta prioriza sinais de entrada (`estagio`, `junior`, `trainee`) em tecnologia, suporte tecnico, desenvolvimento, dados e QA. Vagas remotas sao aceitas de qualquer lugar; vagas hibridas ou presenciais sao aceitas somente em Minas Gerais/Belo Horizonte/regiao. Vagas publicadas ha mais de 30 dias sao ignoradas quando a data publica existe.

O provider Programathor foi criado apos investigacao tecnica documentada em `docs/programathor-scraping-research.md`. Nao foi encontrado endpoint JSON publico de vagas; como as listagens publicas entregam cards no HTML inicial e as paginas de detalhe possuem JSON-LD `JobPosting`, a coleta usa HTML publico simples via `src/scraping/`, sem Playwright operacional.

A coleta consulta poucas URLs publicas para estagio, junior, front-end, QA, dados, remoto e Belo Horizonte/regiao, sem login, cookies autenticados, credenciais pessoais, proxy, rotacao de IP, captcha ou bypass. Se a fonte passar a exibir captcha, login obrigatorio, bloqueio tecnico ou desafio Cloudflare que exija contorno, a coleta deve ser interrompida.

O provider filtra vagas vencidas, vagas com `datePosted` acima de 30 dias, senioridade acima de entrada e localizacao fora da regra do projeto. Vagas remotas sao aceitas de qualquer lugar; hibridas/presenciais so entram quando indicam Minas Gerais/Belo Horizonte/regiao. O limite e de 20 vagas retornadas por execucao.

O provider Remotar foi criado apos reconhecimento obrigatorio com Playwright MCP, documentado em `docs/remotar-scraping-research.md`. A Remotar carrega listagens por endpoint JSON publico em `https://api.remotar.com.br/jobs`, com filtros publicos por busca, categoria e tags. Como JSON publico e preferivel a browser scraping, a coleta usa `fetchPublicJson` pela camada `src/scraping/`, sem Playwright operacional.

A coleta Remotar consulta termos mais aderentes a tecnologia para estagio, junior, desenvolvimento, suporte tecnico, QA, dados e remoto. A busca ampla `estagio tecnologia` foi removida para nao aceitar estagios genericos. A Remotar agora exige categoria tech ou classificador `TECH`, e rejeita sinais fortes de Direito, Marketing, Comercial, Administrativo, RH, Afiliados, Parcerias e areas similares quando nao houver sinal tech forte.

Todos os providers filtram vagas antigas quando ha data publica, senioridade acima de entrada, falta de sinal de nivel, ruido fora de tecnologia e localizacao fora da regra. Como a Remotar e focada em remoto, vagas remotas sao aceitas quando nao ha restricao explicita incompatível com Brasil/LATAM/Americas; hibridas/presenciais so entram quando indicam Minas Gerais/Belo Horizonte/regiao. O limite da Remotar e de 20 vagas retornadas por execucao.

O provider Solides foi criado apos reconhecimento obrigatorio com Playwright MCP, documentado em `docs/solides-scraping-research.md`. A pagina publica geral `https://vagas.solides.com.br/vagas` carrega resultados por JSON publico em `https://apigw.solides.com.br/jobs/v3/portal-vacancies-new`; paginas de empresa usam `https://apigw.solides.com.br/jobs/v3/home/vacancy`. A coleta usa somente JSON publico via `fetchPublicJson`, sem Playwright operacional, login, cookies autenticados, credenciais, proxy, rotacao de IP, captcha ou bypass.

A Solides entra no botao unico `Coletar vagas` e tambem na coleta automatica configuravel de baixa frequencia. Ela consulta poucos termos, limita a 20 vagas retornadas por execucao, exige vaga `TECH` ou `POSSIBLY_TECH` com sinal forte, rejeita `NON_TECH`, rejeita pleno/senior/lead/especialista/manager/coordinator e aceita remoto ou vagas hibridas/presenciais apenas em Minas Gerais/Belo Horizonte/regiao.

As vagas coletadas passam pelo runner automatizado central. As boas entram como `PENDING` sem gerar Gemini; as ruins sao recusadas sem registro no banco. A coleta nunca envia direto ao Discord.

### Coleta automatica

A coleta automatica e configurada pelo painel admin, separada do envio agendado.

Acesse:

```text
http://localhost:3000/admin/settings/collection
```

Nessa tela e possivel definir:

- se a coleta automatica esta ativa;
- frequencia de 1x por semana ou 2x por semana;
- dias da semana;
- horario fixo entre 07:00, 08:00, 09:00, 10:00, 14:00, 16:00 e 18:00.

O timezone nao e editavel pela interface. O sistema usa sempre `America/Sao_Paulo`.

Quando o painel admin esta rodando com `npm run admin`, o sistema agenda a coleta dos providers reais conforme essa configuracao.

Essa rotina executa os providers automaticos de baixa frequencia ja habilitados para agendamento: GitHub, Himalayas, Jobicy, RemoteOK, Remotive, Remotar, Gupy, Programathor e Solides. Os providers ATS publicos continuam apenas no botao manual `Coletar vagas`.

A coleta automatica segue as mesmas regras da coleta manual: calcula a fila alvo com base em `dailyLimit * 7`, teto de 30, seleciona as melhores vagas elegiveis e cria somente `PENDING` sem IA. Se a fila `PENDING` ja estiver cheia, nao cria nada. O scheduler continua sendo o unico responsavel por publicar vagas automaticamente no Discord e por respeitar o limite diario.

Se uma coleta manual ou automatica ja estiver em execucao, uma nova execucao e ignorada e registrada em log para evitar concorrencia.

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
- Model `CollectionSchedulerSettings` para configuracao de coleta automatica
- Painel admin simples para cadastrar, listar, visualizar e editar vagas
- Providers reais e experimentais com coleta manual unificada
- Provider GitHub para coletar issues publicas recentes de repositorios brasileiros de vagas no GitHub
- Providers externos por APIs publicas JSON: Himalayas, Jobicy, RemoteOK e Remotive
- Providers manuais de ATS publicos: Greenhouse, Lever e Ashby
- Coleta automatica configuravel dos providers automaticos 1x ou 2x por semana, criando apenas vagas aprovadas como `PENDING`

Ainda nao ha scraping HTML real, browser automation ou autenticacao.
