# Decisoes

## ADR-001 — Usar PostgreSQL desde o inicio

Decisao: usar PostgreSQL com Prisma.
Motivo: o projeto precisa de persistencia real, migrations e deploy simples.
Impacto: ambiente local e producao precisam de banco configurado.
Status: aceito.

## ADR-002 — Admin server-rendered em Express

Decisao: manter o painel em Express com HTML/CSS renderizado no servidor, sem React.
Motivo: simplicidade do MVP e menor custo operacional.
Impacto: UI menos sofisticada, mas facil de manter.
Status: aceito.

## ADR-003 — Remover DRAFT antes do deploy

Decisao: manter apenas `PENDING`, `SENT` e `ERROR` em `JobStatus`; `DRAFT` foi removido antes do primeiro deploy.
Motivo: reduzir etapas, evitar curadoria por rascunho e manter fila operacional clara.
Impacto: coleta aprova ou rejeita imediatamente; vagas aprovadas entram direto como `PENDING`.
Status: aceito.

## ADR-004 — Coleta nao chama Gemini

Decisao: providers e runner de coleta nao chamam IA.
Motivo: economizar cota, evitar latencia e separar coleta de publicacao.
Impacto: `aiGeneratedText` pode ficar vazio ate o envio.
Status: aceito.

## ADR-005 — Gemini roda somente no envio

Decisao: Gemini so pode gerar mensagem quando a vaga for publicada.
Motivo: gerar texto apenas para vagas que realmente saem no Discord.
Impacto: envio precisa lidar com falha de IA.
Status: aceito.

## ADR-006 — Fallback deterministico obrigatorio

Decisao: todo envio deve ter fallback sem IA.
Motivo: falha de Gemini nao pode bloquear publicacao.
Impacto: publisher precisa montar mensagem util com os dados existentes.
Status: aceito.

## ADR-007 — Discord usa embed/card

Decisao: vagas sao enviadas como Discord embed, com fallback para texto puro se o embed falhar.
Motivo: melhorar leitura e separacao visual no canal.
Impacto: publisher monta payload estruturado.
Status: aceito.

## ADR-008 — Providers preferem JSON publico

Decisao: providers devem priorizar API, RSS, JSON publico ou HTML publico simples.
Motivo: reduzir fragilidade e risco operacional.
Impacto: fontes sem acesso publico adequado devem ser evitadas.
Status: aceito.

## ADR-009 — Playwright fora do runtime

Decisao: Playwright nao e dependencia de runtime do MVP.
Motivo: browser scraping e mais caro, fragil e sujeito a bloqueios.
Impacto: providers reais devem usar API, RSS, JSON publico ou HTML publico simples; investigacoes com browser ficam fora do runtime.
Status: aceito.

## ADR-010 — LinkedIn nao sera provider

Decisao: nao implementar LinkedIn como fonte de coleta.
Motivo: exige login/fluxos protegidos e tem alto risco de bloqueio e termos restritivos.
Impacto: buscar fontes mais sustentaveis como APIs publicas, GitHub e sites de carreira.
Status: aceito.

## ADR-011 — Login, captcha e bypass sao proibidos

Decisao: scraping com login, captcha, paywall, Cloudflare/bypass, proxy, rotacao de IP ou credenciais pessoais e proibido.
Motivo: evitar contorno tecnico e risco operacional/legal.
Impacto: se a fonte passar a exigir isso, o provider deve ser pausado.
Status: aceito.

## ADR-012 — Painel protegido por Basic Auth

Decisao: rotas `/admin` usam Basic Auth quando configurado; em producao, credenciais sao obrigatorias.
Motivo: MVP precisa de protecao simples.
Impacto: deploy deve configurar `ADMIN_USERNAME` e `ADMIN_PASSWORD`.
Status: aceito.

## ADR-013 — Rodar apenas uma instancia do app

Decisao: producao deve rodar uma unica instancia do processo admin.
Motivo: o processo inicia schedulers de coleta e envio.
Impacto: multiplas instancias podem duplicar coletas e publicacoes.
Status: aceito.

## ADR-014 — Arquivar foi removido

Decisao: remover arquivamento; painel exclui apenas vagas nao enviadas.
Motivo: simplificar o ciclo de vida da vaga.
Impacto: `SENT` nao e excluida pelo painel e mensagens do Discord nao sao apagadas.
Status: aceito.

## ADR-015 — Coleta usa um fluxo unico

Decisao: manter `runAutomatedJobCollection` como fluxo oficial para coleta agendada e manual.
Motivo: evitar rotas e runners paralelos para rascunho, autoaprovacao ou geracao antecipada de mensagem.
Impacto: coletas aprovadas entram como `PENDING`; mensagens continuam resolvidas somente no envio.
Status: aceito.

## ADR-016 — Registry de providers simplificado

Decisao: expor apenas `automaticJobProviders` e `manualJobProviders`.
Motivo: remover aliases historicos e deixar claro quais providers rodam em cada entrada operacional.
Impacto: botao `Coletar vagas` e coleta agendada usam a mesma lista de providers do MVP.
Status: aceito.

## ADR-018 — ATS publicos internacionais fora do MVP

Decisao: remover Greenhouse, Lever e Ashby da coleta manual do MVP.
Motivo: os alvos configurados eram empresas internacionais e nao traziam vagas relevantes para a Projeto Desenvolve com consistencia.
Impacto: a coleta fica focada em fontes publicas mais aderentes; ATS podem voltar no futuro se houver alvos publicos relevantes para iniciantes no Brasil ou em Minas Gerais.
Status: aceito.

## ADR-017 — Politica central de decisao da vaga

Decisao: concentrar a decisao final de entrada na fila em `src/services/jobPolicy.ts`.
Motivo: deixar dominio, qualidade, prioridade e elegibilidade em um ponto didatico e reduzir regras detalhadas no runner.
Impacto: providers continuam apenas coletando dados; `providerRunner` normaliza, chama a politica, deduplica e persiste vagas aprovadas como `PENDING`.
Status: aceito.
