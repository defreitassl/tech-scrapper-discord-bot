# Contrato de Providers

Este documento define o contrato inicial para fontes de coleta de vagas. A implementacao atual possui um provider real para issues publicas do GitHub em `src/providers/githubJobs.provider.ts`, providers externos por APIs publicas JSON em `src/providers/himalayas.provider.ts`, `src/providers/jobicy.provider.ts`, `src/providers/remoteOk.provider.ts` e `src/providers/remotive.provider.ts`, provider Remotar por JSON publico em `src/providers/remotar.provider.ts`, providers manuais de ATS publicos em `src/providers/greenhouse.provider.ts`, `src/providers/lever.provider.ts` e `src/providers/ashby.provider.ts`, providers Gupy em `src/providers/gupy.provider.ts`, Programathor em `src/providers/programathor.provider.ts` e Solides em `src/providers/solides.provider.ts`. O provider mock/teste foi removido do fluxo atual.

## Interface sugerida

```ts
export interface JobSourceProvider {
  name: string;
  collect(): Promise<CollectedJob[] | ProviderCollectResult>;
}

export type ProviderCollectResult = {
  jobs: CollectedJob[];
  totalIssuesRead?: number;
  ignoredByDate?: number;
  ignoredBySeniority?: number;
  ignoredByMissingEntryLevel?: number;
  ignoredByLocation?: number;
  ignoredByQuality?: number;
  errors?: ProviderCollectError[];
  repositorySummaries?: ProviderRepositorySummary[];
};

export type ProviderCollectError = {
  provider: string;
  message: string;
};

export type ProviderRepositorySummary = {
  source: string;
  term?: string;
  totalIssuesRead: number;
  returnedByProvider?: number;
  ignoredByDate: number;
  ignoredBySeniority: number;
  ignoredByMissingEntryLevel: number;
  ignoredByLocation: number;
  ignoredByQuality: number;
  ignoredDuplicates: number;
  possibleDuplicates: number;
  created: number;
  errors: number;
};
```

O provider deve ser pequeno, testavel e responsavel por uma unica fonte ou familia de fontes.

Providers ativos devem ser registrados em `src/providers/providerRegistry.ts`. O registry separa `externalJobProviders`, `atsJobProviders`, `automaticJobProviders`, `experimentalJobProviders` e `manualCollectableJobProviders`. A coleta automatica usa `automaticJobProviders`; a coleta manual usa `manualCollectableJobProviders`, que combina automaticos e ATS publicos, excluindo fontes mock/teste. O runner central fica em `src/providers/providerRunner.ts`.

Futuras fontes que dependam de scraping ou pesquisa de paginas publicas devem usar a camada isolada `src/scraping/` antes de virar provider. Essa camada contem tipos genericos (`ScrapingStrategy`, `ScrapingSourceConfig`, `ScrapingResult`, `ScrapedJob`), politica de permissao, helpers leves de HTML e cliente publico simples. Ela nao substitui este contrato: providers continuam entregando `CollectedJob[]` ou `ProviderCollectResult` ao runner.

## Tipo sugerido

```ts
export type CollectedJob = {
  externalId?: string;
  title: string | null;
  company: string | null;
  location: string | null;
  modality: string | null;
  level: string | null;
  stacks: string | null;
  salaryRange: string | null;
  shortDescription: string | null;
  rawText: string | null;
  url: string | null;
  source: string;
  collectedAt: Date;
};
```

## Normalizacao

Cada provider pode retornar dados imperfeitos. Uma etapa de normalizacao deve preparar os dados antes de criar ou atualizar registros no banco.

Normalizacao sugerida:

- remover espacos duplicados;
- padronizar valores vazios como `null`;
- preservar `rawText` original quando existir;
- manter `source` e `url`;
- evitar transformar dados de forma destrutiva;
- inferir campos apenas quando houver confianca clara.

A normalizacao atual fica em `src/providers/normalizeCollectedJob.ts`.

Ela:

- remove espacos duplicados de campos estruturados;
- transforma strings vazias em `null`;
- preserva `rawText` quando ele existe;
- garante `source`, usando o nome do provider como fallback;
- nao chama IA e nao tenta enriquecer dados ausentes.

## Deduplicacao

Deduplicacao deve evitar publicar a mesma vaga mais de uma vez.

A primeira camada reutilizavel ja existe em `src/services/jobDeduplication.ts` e deve ser reaproveitada por futuros providers antes de criar registros no banco.

Possiveis chaves:

- `externalId` quando a fonte fornecer;
- `url` normalizada;
- combinacao de `title`, `company` e `source`;
- hash de texto normalizado quando nao houver URL confiavel.

No estado atual, a duplicata forte usa URL normalizada com trim e remocao de barra final. Quando nao ha URL duplicada, titulo + empresa normalizados indicam apenas possivel duplicata e nao bloqueiam criacao.

No fluxo automatizado atual, deduplicacao e conservadora para proteger o canal: URL duplicada e titulo + empresa duplicados bloqueiam criacao. Nao ha constraint unica no banco nesta etapa.

O runner atual aplica exatamente essa regra:

- URL duplicada bloqueia a criacao e incrementa `ignoredDuplicates`;
- titulo + empresa iguais bloqueiam a criacao automatizada e incrementam o diagnostico de duplicidade.
- filtro de qualidade rejeita vagas coletadas antes da criacao no banco, incluindo vagas `NON_TECH`, e incrementa `ignoredByQuality`;
- priorizacao e aplicada depois do filtro de qualidade e antes da deduplicacao/escrita no banco;
- providers podem retornar metadados de coleta, como `ignoredByLocation`, para aparecer no resumo operacional sem criar vagas no banco.
- providers podem retornar erros internos, como falha por repositorio, sem interromper a execucao dos demais itens.
- providers podem retornar `repositorySummaries` para o runner completar dados que dependem do banco, como duplicatas e vagas criadas.
- providers podem usar `term` e `returnedByProvider` em `repositorySummaries` quando a fonte executa varias buscas internas, como a Gupy. Nesses casos, `source` deve continuar unico por subfonte/termo para o runner atribuir qualidade, duplicidade e criacao ao summary correto.

## Filtro de qualidade

Antes de salvar uma vaga coletada, o runner executa `evaluateCollectedJobQuality(job)` em `src/services/jobQualityFilter.ts`. O filtro e deterministico, barato e nao chama IA. Ele usa `classifyJobDomain(job)` em `src/services/jobDomainClassifier.ts` para classificar o dominio da vaga como `TECH`, `POSSIBLY_TECH` ou `NON_TECH`.

O resultado contem:

- `accepted`: indica se a vaga pode seguir para deduplicacao, prioridade e aprovacao automatizada;
- `reasons`: motivos estaveis de rejeicao, registrados no terminal;
- `score`: pontuacao simples para diagnostico operacional.

A vaga e rejeitada quando:

- falta `title`;
- falta canal claro de candidatura, ou seja, nao ha `url` nem e-mail no texto da vaga;
- falta texto util em `rawText` ou `shortDescription`;
- o texto contem sinais fortes de senioridade alta, como `pleno`, `senior`, `sênior`, `tech lead`, `lead developer`, `lead`, `especialista`, `staff`, `principal` ou `arquitetura avançada`;
- o texto exige experiencia forte, como `3 anos`, `4 anos`, `5 anos`, `mais de 3 anos`, `experiência sólida`, `sólida experiência`, `forte experiência` ou `domínio avançado`;
- a vaga e classificada como `NON_TECH`.

O classificador considera `TECH` quando ha sinais fortes como desenvolvimento, desenvolvedor, developer, software, programação, frontend, backend, fullstack, QA, testes de software, dados, BI, SQL, suporte tecnico, suporte de TI, help desk, infraestrutura, redes, cloud, devops, segurança da informação, React, Node, Java, Python, JavaScript, TypeScript, PHP, Docker, AWS, Azure ou GCP. Ele considera `NON_TECH` quando ha sinais fortes de Direito, Juridico, Marketing, Social Media, Conteudo, Comercial, Vendas, SDR, BDR, Administrativo, Financeiro, Contabilidade, RH, Departamento Pessoal, Parcerias, Afiliados, Agencias, Logistica, Engenharia Civil, Arquitetura, Design Grafico, Medicina, Enfermagem ou Psicologia sem sinal tech forte.

Exemplos rejeitados: `Estagio em Direito Societario`, `Estagio em Marketing de Performance` e `Estagio em Afiliados e Parcerias`. Exemplos aceitos: `Estagio em Suporte Tecnico`, `Estagio em QA`, `Estagio em Dados` e `Estagio em Desenvolvimento`.

Motivos de rejeicao de dominio usam `non_tech_domain:<termo>` quando ha termo forte identificado, ou `outside_technology_profile` quando falta sinal tech.

Esse filtro nao altera schema, nao cria migrations, nao chama Gemini e nao publica no Discord. A chamada a Gemini acontece somente no envio da vaga.

## Priorizacao persistida

Depois que uma vaga coletada passa pelo filtro de qualidade, o runner executa `evaluateJobPriority(job)` em `src/services/jobPriority.ts`. Essa etapa e deterministica, barata e nao usa IA.

O resultado contem:

- `priority`: `HIGH`, `MEDIUM` ou `LOW`;
- `score`: pontuacao numerica para diagnostico;
- `reasons`: motivos que explicam pontos e penalidades.

A pontuacao favorece principalmente:

- estagio remoto em tecnologia;
- estagio em Minas Gerais/BH/regiao;
- trainee remoto;
- junior remoto;
- junior em Minas Gerais/BH/regiao;
- outras vagas uteis com prioridade menor.

Regras de alto nivel:

- nivel de entrada soma pontos, com maior peso para estagio/internship, depois trainee e junior;
- remoto soma mais que hibrido ou presencial;
- remoto global/Brasil/LATAM/Americas e Minas Gerais/BH/regiao somam pontos extras;
- perfil tecnico e campos de qualidade como descricao, stacks e URL aumentam o score;
- vagas `NON_TECH` recebem penalidade `-100` e prioridade final `LOW`, mesmo se tiverem outros pontos positivos;
- experiencia de 2+ ou 3+ anos, texto generico, localizacao incompatível, falta de descricao e falta de URL reduzem o score.

Classificacao:

- `score >= 90`: `HIGH`;
- `score >= 55`: `MEDIUM`;
- abaixo disso: `LOW`.

O runner ordena as vagas aceitas por qualidade antes da aprovacao: `HIGH`, depois `MEDIUM`, depois `LOW`, preservando a ordem original dentro da mesma prioridade. Vagas `LOW` sao recusadas pelo fluxo automatizado. Vagas `MEDIUM` so seguem se forem estagio, trainee, remotas ou tiverem `priorityScore >= 75`.

A prioridade e persistida no banco em `JobPost`:

- `priority`: enum `JobPriority` com `HIGH`, `MEDIUM` e `LOW`;
- `priorityScore`: pontuacao numerica;
- `priorityReasons`: motivos serializados como JSON string.

O diagnostico da coleta registra `priority`, `score` e `reasons` nos logs. As vagas aprovadas persistem esses campos no `JobPost`. O pipeline automatizado usa esses campos para nunca aprovar `LOW`, preparar `HIGH` elegivel e preparar `MEDIUM` apenas quando houver sinal de estagio, trainee, remoto ou `priorityScore >= 75`.

## Status apos coleta

Vagas coletadas nao entram mais como `DRAFT` no fluxo principal.

O status `DRAFT` permanece no enum Prisma apenas por compatibilidade e para rascunhos legados. Vagas `DRAFT` existentes nao sao deletadas automaticamente.

Fluxo atual:

- vaga elegivel: marca `useAi = true`, deixa `aiGeneratedText` vazio quando nao ha texto pronto e cria `JobPost` como `PENDING`;
- vaga recusada: nao e persistida;
- falha de IA: nao existe como motivo de recusa na coleta, porque a coleta nao chama Gemini;
- coleta nunca envia direto ao Discord.

Na implementacao atual, `runAutomatedJobCollection()` cria vagas aprovadas com:

- `status = PENDING`;
- `useAi = true`;
- sem `readyText`;
- `aiGeneratedText = null`, salvo depois se Gemini gerar mensagem valida no envio;
- `priority`, `priorityScore` e `priorityReasons` preenchidos a partir de `evaluateJobPriority`.

Isso garante que a coleta automatica prepare a fila sem gastar cota de Gemini e sem publicar no Discord.

Scrapers futuros tambem devem respeitar essa regra. Mesmo que uma fonte retorne `ScrapedJob`, a conversao para `CollectedJob` e a criacao no banco devem passar pelo `providerRunner`, que centraliza filtro de dominio, qualidade, deduplicacao, prioridade e preenchimento da fila.

O tamanho alvo da fila `PENDING` e `min(max(dailyLimit * 7, dailyLimit), 30)`. A coleta cria ate `queueTarget - PENDING atuais` vagas e nao desconta `SENT` hoje. O limite diario continua sendo aplicado pelo scheduler/publisher no momento do envio.

## Politica para fontes dificeis

Antes de criar um provider para plataformas maiores, registre a decisao de acesso conforme `docs/scraping-engine-design.md` e `docs/scraping-platforms-research.md`.

Regras obrigatorias:

- API publica e RSS publico sao preferiveis.
- HTML publico simples pode ser usado quando estavel.
- Browser scraping e ultimo caso. A infraestrutura Playwright existe, mas providers reais devem continuar manuais/experimentais ate decisao explicita.
- Fontes com login, captcha, Cloudflare/bloqueio anti-bot que exija bypass, paywall, credenciais pessoais ou termos explicitamente incompativeis devem ser bloqueadas.
- LinkedIn, Solides e similares nao devem ser implementados sem avaliacao especifica e decisao explicita. A Gupy ja possui avaliacao em `docs/gupy-scraping-research.md` e usa endpoint publico validado. O Programathor possui avaliacao em `docs/programathor-scraping-research.md` e usa HTML publico simples. A Remotar possui avaliacao em `docs/remotar-scraping-research.md`. A Solides possui avaliacao em `docs/solides-scraping-research.md` e usa endpoint JSON publico. Essas fontes rodam com baixo volume, sem login/captcha/bypass, dentro do pipeline que aprova como `PENDING` ou recusa sem persistir.

A coleta automatica em `src/services/scheduledCollector.ts` reaproveita o mesmo runner automatizado e executa `automaticJobProviders`. Ela e configurada no painel em `/admin/settings/collection`, pode rodar 1x ou 2x por semana em dias escolhidos pelo admin, usa horario fixo em `America/Sao_Paulo` enquanto o processo admin estiver ativo e usa lock simples em memoria para ignorar execucoes concorrentes.

Os providers ATS publicos ficam em `atsJobProviders` e nao entram na coleta automatica nesta etapa. Gupy, Programathor e Solides entram em `automaticJobProviders` junto com GitHub, fontes externas e Remotar. A coleta manual unificada roda `manualCollectableJobProviders` pelo botao `Coletar vagas` (`POST /admin/jobs/collect-all`) e usa o mesmo lock de coletas reais. A Gupy retorna diagnostico por termo de busca em `repositorySummaries`, com `source` como `gupy:<termo>`, `term` e `returnedByProvider`.

O Programathor retorna diagnostico por termo/fonte em `repositorySummaries`, com `source` como `programathor:<termo>`, `term` e `returnedByProvider`. Ele usa apenas paginas publicas, sem login, cookies autenticados, proxy, rotacao de IP, captcha ou bypass; nao foi encontrado endpoint JSON publico de listagem, entao a estrategia atual usa HTML publico simples e JSON-LD publico nas paginas de detalhe.

O Remotar retorna diagnostico por termo/fonte em `repositorySummaries`, com `source` como `remotar:<termo>`, `term` e `returnedByProvider`. O reconhecimento foi feito com Playwright MCP, mas a coleta usa apenas endpoint JSON publico em `https://api.remotar.com.br/jobs`, sem login, cookies autenticados, proxy, rotacao de IP, captcha ou bypass. A Remotar exige categoria tech ou classificacao `TECH`, rejeita sinais fortes de areas nao tech em titulo/categoria/tags/descricao quando nao ha sinal tech forte e nao usa mais a busca ampla `estagio tecnologia`.

O Solides retorna diagnostico por termo/fonte em `repositorySummaries`, com `source` como `solides:<termo>`, `term` e `returnedByProvider`. O reconhecimento foi feito com Playwright MCP, mas a coleta usa apenas endpoint JSON publico em `https://apigw.solides.com.br/jobs/v3/portal-vacancies-new`, sem login, cookies autenticados, proxy, rotacao de IP, captcha ou bypass. A Solides exige classificacao `TECH` ou `POSSIBLY_TECH` com sinal forte em area, hard skills, stack ou texto, rejeita `NON_TECH`, senioridade acima de entrada e localizacao fora da regra. Ela limita a 20 vagas retornadas por execucao e entra na coleta automatica configuravel e na coleta manual unificada.

## Provider GitHub

O provider `githubJobsProvider` coleta vagas de repositorios GitHub que publicam oportunidades como issues. A lista inicial e:

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

Ele usa somente a API oficial do GitHub:

```text
GET https://api.github.com/repos/{owner}/{repo}/issues
```

Parametros usados:

- `state=open`
- `per_page=100`
- `since=<data ISO de 30 dias atras>`

O `since` da API pode considerar a ultima atualizacao da issue, nao a criacao. Por isso o provider tambem filtra manualmente `created_at` e so aceita issues criadas nos ultimos 30 dias.

Headers enviados:

- `Accept: application/vnd.github+json`
- `X-GitHub-Api-Version: 2022-11-28`
- `Authorization: Bearer <GITHUB_TOKEN>`, apenas quando `GITHUB_TOKEN` estiver configurado

`GITHUB_TOKEN` e opcional, mas recomendado para aumentar o rate limit da API. Sem token, o provider registra um aviso e tenta coletar sem autenticacao.

Regras do provider GitHub:

- coleta apenas issues abertas;
- se um repositorio falhar, registra erro, contabiliza no resumo e continua nos demais repositorios;
- contabiliza issues lidas e motivos de descarte: data antiga, senioridade acima de entrada, ausencia de label de entrada, localizacao e qualidade;
- ignora pull requests;
- aceita apenas labels de entrada: `junior`, `júnior`, `jr`, `estagio`, `estágio`, `estagiario`, `estagiário`, `trainee`, incluindo labels compostas como `estágio remoto` quando contem um desses termos;
- trata `trainee` como nivel de entrada e preenche `level` como `Trainee`;
- ignora labels de senioridade acima de entrada: `pleno`, `senior`, `sênior`, `especialista`, `tech lead`, `lead`, `staff`, `principal`;
- aceita vagas remotas de qualquer cidade, estado ou pais;
- aceita vagas hibridas ou presenciais somente quando a localizacao ou o corpo da issue indicam Minas Gerais;
- quando a modalidade nao e identificada, aceita somente se a localizacao parecer Minas Gerais;
- contabiliza issues ignoradas pelo filtro geografico em `ignoredByLocation`;
- extrai localizacao do texto entre colchetes no titulo da issue;
- tenta extrair empresa quando o titulo contem conectores como `na`, `no`, `na empresa` ou `para`;
- se a empresa nao vier do titulo, tenta um campo confiavel no corpo, como `Empresa:`;
- tenta extrair `shortDescription` de secoes como `Descricao da vaga`, `Sobre a vaga`, `Nossa empresa` e `Responsabilidades`;
- tenta extrair `stacks` do corpo a partir de termos tecnicos conhecidos, sem inventar tecnologias;
- salva o corpo da issue em `rawText` limitado a 300 palavras;
- retorna `salaryRange` como `null` nesta primeira versao;
- entrega vagas ao runner automatizado, que so persiste as aprovadas como `PENDING`;
- nao chama IA;
- nao envia ao Discord.

O toast da coleta GitHub mostra um resumo compacto e temporario, sem persistir logs em banco:

```text
Coleta GitHub: 48 issues analisadas, 2 novas, 4 duplicatas, 0 possíveis, 5 antigas, 8 fora de localização, 21 fora do nível, 3 por qualidade, 1 erro.
```

Quando houver vagas criadas, o toast pode acrescentar ate tres fontes com mais vagas novas, por exemplo `Top fontes: frontendbr/vagas: 1 nova; backend-br/vagas: 1 nova.` O terminal recebe tambem um log estruturado por repositorio com lidas, criadas, descartes por data/nivel/localizacao, duplicatas e erros. Esse diagnostico e operacional e nao cria tela de logs nem tabela de eventos.

## Providers externos por API publica

Os providers `himalayasProvider`, `jobicyProvider`, `remoteOkProvider` e `remotiveProvider` seguem o mesmo contrato e nunca salvam diretamente no banco. Eles apenas consultam APIs JSON publicas, filtram ruido evidente e retornam vagas para o runner central.

Arquivos:

- `src/providers/himalayas.provider.ts`: usa `https://himalayas.app/jobs/api/search`, com poucas buscas e limite de 20 itens por busca.
- `src/providers/jobicy.provider.ts`: usa `https://jobicy.com/api/v2/remote-jobs`, com poucas tags e `count=50`.
- `src/providers/remoteOk.provider.ts`: usa `https://remoteok.com/api`, uma chamada unica por execucao.
- `src/providers/remotive.provider.ts`: usa `https://remotive.com/api/remote-jobs`, com poucas buscas em `category=software-dev`.

Regras comuns:

- aceitar apenas vagas publicadas nos ultimos 30 dias;
- aceitar apenas sinais claros de entrada: `junior`, `jr`, `entry-level`, `intern`, `internship`, `estagio`, `estagiario` ou `trainee`;
- rejeitar sinais como `pleno`, `mid-level`, `senior`, `lead`, `staff`, `principal`, `manager`, `director`, `executive` e similares;
- aceitar apenas vagas remotas com localidade global ou compativel com Brasil, LATAM ou Americas;
- ignorar restricoes regionais incompatíveis com Brasil;
- limpar HTML simples das descricoes com helper local, sem Cheerio e sem navegador;
- preencher `source` com o nome do provider;
- preservar URL original para candidatura/linkback quando fornecida;
- retornar metadados de diagnostico para o runner contabilizar lidas, antigas, fora de nivel, fora de localizacao, qualidade e erros.

O painel usa `repositorySummaries` para exibir um resumo visual compacto apos a coleta externa manual, como `Himalayas: 1 nova; Jobicy: 0; RemoteOK: 0; Remotive: 1`. Esse resumo mostra somente vagas criadas e erros por fonte, quando existirem. O diagnostico completo permanece nos logs do terminal e nao e persistido no banco.

Jobicy, RemoteOK e Remotive exigem atribuicao ou linkback. A implementacao preserva `url` e `source`; a revisao humana deve manter o link original ao preparar/publicar a vaga. Himalayas tambem usa a URL original quando disponivel.

Os helpers compartilhados ficam em:

- `src/providers/providerTextUtils.ts`: limpeza de HTML simples, resumo, truncamento e extracao de stacks;
- `src/providers/providerDateUtils.ts`: filtro de data recente e parse seguro;
- `src/providers/providerSeniorityUtils.ts`: deteccao de nivel iniciante e bloqueio de senioridade;
- `src/providers/providerLocationUtils.ts`: avaliacao conservadora de localidade remota;
- `src/providers/providerSalaryUtils.ts`: formatacao simples de faixa salarial;
- `src/providers/providerSummaryUtils.ts`: criacao de resumo operacional por fonte.

## Providers ATS publicos

Os providers `greenhouseProvider`, `leverProvider` e `ashbyProvider` seguem o mesmo contrato e nunca salvam diretamente no banco. Eles consultam somente endpoints JSON publicos de empresas cadastradas em `src/providers/companyTargets.ts`.

Lista inicial de alvos:

- GitLab, Greenhouse slug `gitlab`;
- Kepler Communications, Lever slug `kepler`;
- Ashby, Ashby slug `ashby`.

Endpoints usados:

- Greenhouse: `https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true`;
- Lever: `https://api.lever.co/v0/postings/{slug}?mode=json`;
- Ashby: `https://api.ashbyhq.com/posting-api/job-board/{slug}`.

Regras comuns:

- usar apenas `fetchPublicJson` e politica `api` permitida em `src/scraping/scrapingPolicy.ts`;
- nao usar Playwright, Cheerio, login, cookies, proxy, credenciais pessoais, captcha ou bypass anti-bot;
- se uma empresa-alvo falhar, registrar erro em `errors` e continuar nos demais alvos;
- aceitar apenas vagas com data publicada/criada nos ultimos 30 dias quando a data existe;
- exigir sinal claro de nivel iniciante (`junior`, `jr`, `entry-level`, `intern`, `internship`, `estagio`, `estagiario` ou `trainee`);
- rejeitar sinais de senioridade intermediaria/alta;
- aceitar remoto global, Brasil, LATAM ou Americas, ou remoto sem restricao incompatível;
- aceitar hibrido/presencial somente em Minas Gerais;
- preencher `externalId`, `title`, `company`, `location`, `modality`, `level`, `stacks`, `salaryRange`, `shortDescription`, `rawText`, `url`, `source` e `collectedAt` quando a fonte fornece dados suficientes;
- retornar `ProviderCollectResult` com `repositorySummaries` por alvo.

A coleta ATS manual cria vagas somente via `providerRunner`, que aprova elegiveis como `PENDING` sem IA e recusa as demais sem persistir. Ela nao envia ao Discord, nao altera schema Prisma e nao cria migrations.

## Preparacao de vaga coletada

Vagas coletadas aprovadas entram como `PENDING`, com `useAi = true`, `aiGeneratedText` opcionalmente vazio e fora do Discord ate o scheduler publicar. Vagas recusadas nao entram no banco.

O painel possui a acao manual `Preparar rascunho legado`, voltada para vagas `DRAFT` antigas. Ela:

- marca `useAi = true`;
- nao chama Gemini;
- altera o status para `PENDING`;
- nao envia a vaga ao Discord.

Gemini e chamado pelo publisher quando a vaga for enviada. Para vagas ja `PENDING`, a acao apenas mantem a vaga na fila com IA habilitada para o envio. Vagas `SENT` ou `ARCHIVED` nao sao preparadas.
