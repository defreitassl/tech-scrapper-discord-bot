# Contrato de Providers

Este documento propoe um contrato inicial para futuras fontes de coleta de vagas. Nao ha implementacao de providers ainda.

## Interface sugerida

```ts
export interface JobSourceProvider {
  name: string;
  collect(): Promise<CollectedJob[]>;
}
```

O provider deve ser pequeno, testavel e responsavel por uma unica fonte ou familia de fontes.

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

## Deduplicacao

Deduplicacao deve evitar publicar a mesma vaga mais de uma vez.

Possiveis chaves:

- `externalId` quando a fonte fornecer;
- `url` normalizada;
- combinacao de `title`, `company` e `source`;
- hash de texto normalizado quando nao houver URL confiavel.

No inicio, a deduplicacao deve ser conservadora. Em caso de duvida, criar como `DRAFT` para revisao em vez de descartar automaticamente.

## Status sugerido apos coleta

Vagas coletadas automaticamente devem entrar como `DRAFT`.

Motivos:

- permite revisao humana;
- evita publicar vagas ruins, duplicadas ou mal formatadas;
- reduz risco de divulgar dados incorretos;
- mantem controle editorial do canal.

Somente apos revisao a vaga deve ser marcada como `PENDING`.

