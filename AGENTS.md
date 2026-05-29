# AGENTS.md

Orientacoes para agentes de IA/Codex trabalhando neste repositorio.

## Comportamento

- Responda em portugues.
- Seja direto e objetivo.
- Explique mudancas com clareza, sem excesso de contexto.
- Nao sugira escopo extra sem necessidade.
- Preserve a simplicidade do MVP.

## Antes de alterar

Leia:

- `README.md`
- `docs/PROJECT.md`
- `docs/BACKLOG.md`
- `docs/DECISIONS.md`
- `docs/DEPLOY.md` quando mexer em deploy, Docker, ambiente, banco em producao ou operacao.

Atualize a documentacao apenas quando a mudanca alterar escopo, arquitetura, fluxo, regras de negocio, providers, scraping, agendamento, deploy, banco ou integracoes.

## Padroes do projeto

- Nao chame Gemini na coleta.
- Nao reintroduza `DRAFT`; o schema usa apenas `PENDING`, `SENT` e `ERROR`.
- Nao use login, captcha, bypass, proxy ou credenciais pessoais em scraping.
- Nao adicione provider sem documentacao curta em `docs/PROJECT.md` ou `docs/DECISIONS.md`, conforme o caso.
- Nao altere schema Prisma sem migration.
- Mantenha o painel admin simples, server-rendered em Express.
- Mantenha coleta e envio separados.
- Mantenha fallback deterministico no envio.
- Preserve o envio ao Discord como embed/card.
- Proteja o painel com Basic Auth em producao.
- Rode apenas uma instancia do app em producao para evitar schedulers duplicados.

## Regras de negocio

- Foco em vagas tech para estagio, trainee, junior e primeiro emprego.
- Vagas remotas sao priorizadas.
- Vagas hibridas ou presenciais so entram quando forem de Minas Gerais, Belo Horizonte ou regiao.
- Vagas `NON_TECH` devem ser rejeitadas antes de salvar.
- Vagas aprovadas pela coleta entram como `PENDING`.
- Vagas recusadas pela coleta nao sao persistidas.
- A mensagem final usa, nesta ordem: `readyText`, `aiGeneratedText` valido, Gemini no envio quando `useAi = true`, fallback deterministico.
- Vagas `SENT` nao devem ser excluidas pelo painel.
- O painel pode excluir vagas nao enviadas (`PENDING` ou `ERROR`).

## Finalizacao

- Rode `npm run build` quando alterar TypeScript.
- Rode `git diff --check` ao final.
- Informe arquivos alterados.
- Informe regras de negocio afetadas.
- Informe documentacao atualizada ou diga por que nao foi necessario.
- Informe comandos executados e resultado.
- Informe como testar.

Nesta tarefa, nao altere `src/`, `prisma/`, `package.json`, `Dockerfile` ou providers sem pedido explicito.
