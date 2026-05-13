# Contrato de Providers

Este documento define o contrato inicial para fontes de coleta de vagas. A implementacao atual possui apenas um provider mock/de teste em `src/providers/mockJobs.provider.ts`, sem scraping real e sem acesso a sites externos.

## Interface sugerida

```ts
export interface JobSourceProvider {
  name: string;
  collect(): Promise<CollectedJob[]>;
}
```

O provider deve ser pequeno, testavel e responsavel por uma unica fonte ou familia de fontes.

Providers ativos devem ser registrados em `src/providers/providerRegistry.ts`. O runner central fica em `src/providers/providerRunner.ts`.

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
