# Revisao Operacional: Providers Experimentais

Data da revisao: 2026-05-25.

## Escopo

Esta revisao executou diretamente os providers experimentais:

- `gupyProvider`;
- `programathorProvider`;
- `remotarProvider`.

O teste nao salvou vagas no banco, nao chamou Gemini, nao publicou no Discord, nao alterou schema Prisma e nao colocou nenhum provider na coleta automatica. O diagnostico aplicou localmente a mesma normalizacao, o filtro deterministico de qualidade e a prioridade em memoria para estimar quais vagas passariam pelo runner antes da deduplicacao em banco.

Atualizacao posterior: a partir desta revisao, a Remotar foi promovida para a coleta automatica diaria por ter apresentado melhor volume e aderencia operacional. Gupy e Programathor permanecem manuais. A promocao da Remotar nao muda o fluxo de seguranca: vagas continuam sendo criadas apenas como `DRAFT`, com `useAi = false`, sem Gemini, sem `PENDING` automatico e sem envio ao Discord.

Comando usado apos build:

```bash
node dist/scripts/diagnoseExperimentalProviders.js
```

Observacao: a primeira execucao sem permissao de rede retornou `fetch failed` para todas as fontes por restricao de sandbox. A execucao com rede aprovada concluiu sem erros de provider.

## Resultado comparativo

| Provider | Analisadas | Retornadas pelo provider | Passariam pela qualidade do runner | Principais descartes | Links testados |
| --- | ---: | ---: | ---: | --- | --- |
| Gupy | 44 | 8 | 8 | localizacao fora da regra, data antiga, senioridade | 5/5 OK |
| Programathor | 123 | 2 | 2 | vagas antigas/vencidas, localizacao fora da regra, senioridade | 2/2 OK |
| Remotar | 32 | 20 | 18 | data antiga, senioridade, rejeicoes de qualidade do runner | 5/5 OK |

`Passariam pela qualidade do runner` significa que a vaga retornada pelo provider passaria por `evaluateCollectedJobQuality`. A revisao nao executou `checkJobDuplicate`, porque isso consultaria o banco; duplicidade real ainda depende do runner em execucao normal.

## Gupy

Resumo numerico:

- vagas analisadas: 44;
- vagas retornadas pelo provider: 8;
- vagas que passariam pela qualidade do runner: 8;
- prioridades estimadas: 8 `HIGH`, 0 `MEDIUM`, 0 `LOW`;
- erros de provider: 0.

Principais motivos de descarte no provider:

- `ignoredByLocation`: 30;
- `ignoredByDate`: 4;
- `ignoredBySeniority`: 2;
- `ignoredByMissingEntryLevel`: 0.

Termos que mais trouxeram resultado:

- `desenvolvedor junior`: 5 retornadas em 10 analisadas;
- `dados junior`: 2 retornadas em 10 analisadas;
- `suporte tecnico junior`: 1 retornada em 10 analisadas.

Qualidade aparente:

- URLs: 8/8;
- `shortDescription`: 8/8;
- `rawText` util: 8/8;
- stacks: 7/8;
- localizacao: 8/8.

Links testados:

- 5 links Gupy abriram com HTTP 200.

Leitura operacional:

Gupy trouxe poucas vagas, mas bem estruturadas. As vagas retornadas tinham descricao, URL, localizacao e nivel claros, e todas passaram no filtro de qualidade. O maior descarte veio de localizacao, o que indica que o provider esta conservador para hibridas/presenciais fora de Minas Gerais. Os termos `estagio tecnologia`, `junior tecnologia` e `qa junior` nao retornaram vaga aproveitavel nesta execucao; a amostra util foi majoritariamente junior remoto ou junior em MG.

Recomendacao:

Gupy e tecnicamente boa para continuar manual/experimental. Pode fazer sentido entrar em coleta automatica futura de baixa frequencia, mas antes vale melhorar cobertura de estagio remoto e revisar se o excesso de descarte por localizacao esta correto para todos os campos da API.

## Programathor

Resumo numerico:

- vagas analisadas: 123;
- vagas retornadas pelo provider: 2;
- vagas que passariam pela qualidade do runner: 2;
- prioridades estimadas: 2 `HIGH`, 0 `MEDIUM`, 0 `LOW`;
- erros de provider: 0.

Principais motivos de descarte no provider:

- `ignoredByDate`: 57;
- `ignoredByLocation`: 4;
- `ignoredBySeniority`: 1;
- `ignoredByMissingEntryLevel`: 0.

Termos que mais trouxeram resultado:

- `estagio tecnologia`: 1 retornada em 15 analisadas;
- `desenvolvedor junior`: 1 retornada em 15 analisadas.

Qualidade aparente:

- URLs: 2/2;
- `shortDescription`: 2/2;
- `rawText` util: 2/2;
- stacks: 2/2;
- localizacao: 2/2.

Links testados:

- 2 links Programathor abriram com HTTP 200.

Leitura operacional:

Programathor tem bom detalhamento nas poucas vagas aceitas, com descricao, stacks, localizacao e URL uteis. O volume aproveitavel foi muito baixo nesta execucao: 2 vagas em 123 analisadas. A causa principal foi antiguidade/vencimento, principalmente em termos de QA, dados, front-end e remoto junior. Como a fonte depende de HTML publico, ela tambem tem fragilidade maior que os providers JSON.

Recomendacao:

Programathor deve permanecer manual/experimental por enquanto. Antes de considerar automacao, vale reduzir consultas com baixo retorno, priorizar rotas que realmente trazem vagas recentes e avaliar se ha uma forma publica mais estavel de ordenar por recencia ou filtrar melhor vencidas.

## Remotar

Resumo numerico:

- vagas analisadas: 32;
- vagas retornadas pelo provider: 20;
- vagas que passariam pela qualidade do runner: 18;
- prioridades estimadas: 20 `HIGH`, 0 `MEDIUM`, 0 `LOW`;
- erros de provider: 0.

Principais motivos de descarte no provider:

- `ignoredByDate`: 7;
- `ignoredBySeniority`: 4;
- `ignoredByLocation`: 0;
- `ignoredByQuality`: 0 no provider.

Rejeicoes adicionais pelo filtro de qualidade do runner:

- `outside_technology_profile`: 1;
- `strong_experience:5 anos`: 1.

Termos que mais trouxeram resultado:

- `estagio tecnologia`: 10 retornadas em 15 analisadas;
- `desenvolvedor junior`: 9 retornadas em 15 analisadas;
- `junior tecnologia`: 1 retornada em 2 analisadas.

Qualidade aparente:

- URLs: 20/20;
- `shortDescription`: 20/20;
- `rawText` util: 20/20;
- stacks: 10/20;
- localizacao: 20/20.

Links testados:

- 5 links Remotar abriram com HTTP 200.

Leitura operacional:

Remotar teve o melhor rendimento bruto e a melhor aderencia operacional para automacao: 20 retornadas em 32 analisadas e 18 passariam na qualidade do runner. As vagas vieram com URL, descricao e localizacao consistentes. O ponto de atencao e que o termo `estagio tecnologia` trouxe ruido fora de tecnologia e uma vaga com exigencia forte de experiencia; portanto, ainda precisa de curadoria e talvez de filtros internos mais alinhados ao `jobQualityFilter`.

Recomendacao:

Remotar foi promovida para a coleta automatica diaria por usar JSON publico, ter alto rendimento e ser naturalmente focada em remoto. A rota manual continua disponivel. Ainda precisa de curadoria humana e de filtros mais fortes antes de qualquer autoaprovacao.

## Recomendacao geral

Ordem atual de maturidade:

1. Remotar: promovida para coleta automatica diaria, com alto volume util, JSON publico e melhor cobertura de estagio/junior remoto.
2. Gupy: boa qualidade e links estaveis, mas menor volume e muitos descartes por localizacao; permanece manual.
3. Programathor: qualidade boa nas poucas aceitas, mas baixo rendimento e dependencia de HTML; permanece manual.

Antes de qualquer autoaprovacao:

- persistir `priority` e `score` no banco ou registrar diagnostico equivalente de forma consultavel;
- revisar duplicidade entre Remotar e Gupy, porque Remotar agrega vagas que podem apontar para outras fontes;
- fortalecer filtros de estagio para evitar vagas fora de tecnologia;
- revisar penalidades de experiencia no provider e no filtro de qualidade;
- manter todas as coletas automaticas como `DRAFT` ate decisao explicita;
- validar mais de uma execucao em dias diferentes para confirmar estabilidade dos endpoints e volume.

Conclusao: Remotar entra na coleta automatica diaria como provider real de baixa frequencia, mas sem autoaprovacao. Gupy e Programathor continuam manuais. Remotar e Gupy merecem nova rodada de endurecimento de filtros; Programathor merece reducao/ajuste de fontes antes de qualquer automacao.
