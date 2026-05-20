# Contrato de Providers

Este documento define o contrato inicial para fontes de coleta de vagas. A implementacao atual possui um provider mock/de teste em `src/providers/mockJobs.provider.ts`, um provider real para issues publicas do GitHub em `src/providers/githubJobs.provider.ts` e providers externos por APIs publicas JSON em `src/providers/himalayas.provider.ts`, `src/providers/jobicy.provider.ts`, `src/providers/remoteOk.provider.ts` e `src/providers/remotive.provider.ts`.

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
  totalIssuesRead: number;
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

Providers ativos devem ser registrados em `src/providers/providerRegistry.ts`. O registry separa `testJobProviders`, `externalJobProviders` e `realJobProviders`; a coleta automatica usa somente providers reais. O runner central fica em `src/providers/providerRunner.ts`. Rotas especificas podem chamar o runner com uma lista explicita de providers quando precisam executar apenas uma familia de fontes, como a coleta mock, a coleta GitHub ou a coleta externa.

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

No inicio, a deduplicacao deve ser conservadora. Em caso de duvida, criar como `DRAFT` para revisao em vez de descartar automaticamente. Nao ha constraint unica no banco nesta etapa.

O runner atual aplica exatamente essa regra:

- URL duplicada bloqueia a criacao e incrementa `ignoredDuplicates`;
- titulo + empresa iguais incrementam `possibleDuplicates`, mas a vaga ainda e criada como `DRAFT`.
- filtro de qualidade rejeita vagas coletadas antes da criacao no banco e incrementa `ignoredByQuality`;
- providers podem retornar metadados de coleta, como `ignoredByLocation`, para aparecer no resumo operacional sem criar vagas no banco.
- providers podem retornar erros internos, como falha por repositorio, sem interromper a execucao dos demais itens.
- providers podem retornar `repositorySummaries` para o runner completar dados que dependem do banco, como duplicatas e vagas criadas.

## Filtro de qualidade

Antes de salvar uma vaga coletada, o runner executa `evaluateCollectedJobQuality(job)` em `src/services/jobQualityFilter.ts`. O filtro e deterministico, barato e nao chama IA.

O resultado contem:

- `accepted`: indica se a vaga pode seguir para deduplicacao e criacao como `DRAFT`;
- `reasons`: motivos estaveis de rejeicao, registrados no terminal;
- `score`: pontuacao simples para diagnostico operacional.

A vaga e rejeitada quando:

- falta `title`;
- falta canal claro de candidatura, ou seja, nao ha `url` nem e-mail no texto da vaga;
- falta texto util em `rawText` ou `shortDescription`;
- o texto contem sinais fortes de senioridade alta, como `pleno`, `senior`, `sênior`, `tech lead`, `lead developer`, `lead`, `especialista`, `staff`, `principal` ou `arquitetura avançada`;
- o texto exige experiencia forte, como `3 anos`, `4 anos`, `5 anos`, `mais de 3 anos`, `experiência sólida`, `sólida experiência`, `forte experiência` ou `domínio avançado`;
- a vaga nao parece ser de tecnologia.

Para o perfil de tecnologia, o filtro aceita vagas com termos como `desenvolvimento`, `desenvolvedor`, `frontend`, `backend`, `fullstack`, `software`, `suporte técnico`, `QA`, `dados`, `tecnologia`, `programação`, `React`, `Node`, `Java`, `Python`, `SQL` ou `cloud`.

Esse filtro nao altera schema, nao cria migrations, nao chama Gemini, nao marca vagas como `PENDING` e nao publica no Discord.

## Status sugerido apos coleta

Vagas coletadas automaticamente devem entrar como `DRAFT`.

Motivos:

- permite revisao humana;
- evita publicar vagas ruins, duplicadas ou mal formatadas;
- reduz risco de divulgar dados incorretos;
- mantem controle editorial do canal.

Somente apos revisao a vaga deve ser marcada como `PENDING`.

Na implementacao atual, `runJobProviders()` cria vagas coletadas com:

- `status = DRAFT`;
- `useAi = false`;
- sem `readyText`;
- sem `aiGeneratedText`.

Isso garante que a coleta automatica nao dispare Gemini/IA nem publique vagas no Discord.

A coleta automatica diaria em `src/services/scheduledCollector.ts` reaproveita o mesmo runner e executa apenas `realJobProviders`. Ela roda as 08:00 em `America/Sao_Paulo` enquanto o processo admin estiver ativo, nao executa o provider mock e usa lock simples em memoria para ignorar execucoes concorrentes.

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
- cria vagas apenas como `DRAFT` via runner quando tambem passam pelo filtro de qualidade;
- nao chama IA;
- nao envia ao Discord.

O toast da coleta GitHub mostra um resumo compacto e temporario, sem persistir logs em banco:

```text
Coleta GitHub: 48 issues analisadas, 2 novas, 4 duplicatas, 0 possíveis, 5 antigas, 8 fora de localização, 21 fora do nível, 3 por qualidade, 1 erro.
```

O terminal recebe tambem um log estruturado por repositorio com lidas, criadas, descartes por data/nivel/localizacao, duplicatas e erros. Esse diagnostico e operacional e nao cria tela de logs nem tabela de eventos.

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

Jobicy, RemoteOK e Remotive exigem atribuicao ou linkback. A implementacao preserva `url` e `source`; a revisao humana deve manter o link original ao preparar/publicar a vaga. Himalayas tambem usa a URL original quando disponivel.

Os helpers compartilhados ficam em:

- `src/providers/providerTextUtils.ts`: limpeza de HTML simples, resumo, truncamento e extracao de stacks;
- `src/providers/providerDateUtils.ts`: filtro de data recente e parse seguro;
- `src/providers/providerSeniorityUtils.ts`: deteccao de nivel iniciante e bloqueio de senioridade;
- `src/providers/providerLocationUtils.ts`: avaliacao conservadora de localidade remota;
- `src/providers/providerSalaryUtils.ts`: formatacao simples de faixa salarial;
- `src/providers/providerSummaryUtils.ts`: criacao de resumo operacional por fonte.

## Preparacao de vaga coletada

Vagas coletadas continuam entrando como `DRAFT`, com `useAi = false`, sem `aiGeneratedText` e fora da fila de publicacao.

O painel possui a acao manual `Preparar e colocar na fila`, voltada principalmente para vagas `DRAFT` revisadas pelo admin. Ela:

- chama `generateJobMessage(job)` com Gemini;
- salva o resultado em `aiGeneratedText`;
- marca `useAi = true`;
- altera o status para `PENDING`;
- nao envia a vaga ao Discord.

Se a IA falhar, a vaga permanece como estava, especialmente sem transformar `DRAFT` em `PENDING`. Para vagas ja `PENDING`, a acao pode regenerar `aiGeneratedText` e manter a vaga na fila. Vagas `SENT` ou `ARCHIVED` nao sao preparadas.
