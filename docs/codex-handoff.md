# Handoff para Codex

## Resumo curto

O `tech-scrapper-discord-bot` e um bot/painel para cadastrar, organizar e publicar vagas de tecnologia para iniciantes no Discord da Projeto Desenvolve.

Apesar do nome mencionar scraper, o projeto ainda nao implementa scraping. O estado atual e um painel admin manual com publicacao controlada para Discord.

## Stack

- Node.js + TypeScript.
- Express.
- Prisma + PostgreSQL.
- Discord.js.
- Google AI Studio/Gemini.

## Regras de negocio atuais

- Vagas sao armazenadas como `JobPost`.
- O painel permite criar, listar, ver detalhes, editar, marcar como `PENDING` e arquivar.
- Para marcar como `PENDING`, a vaga precisa ter `readyText`, `useAi` habilitado ou URL preenchida.
- O envio manual busca ate 5 vagas `PENDING` por vez.
- Ordem de resolucao da mensagem:
  1. `readyText`.
  2. `aiGeneratedText` valido.
  3. IA, se `useAi` estiver habilitado.
  4. Template padrao.
- Vaga enviada com sucesso vira `SENT` e recebe `sentAt`.
- Falha no envio marca a vaga como `ERROR`.
- Vagas arquivadas usam status `ARCHIVED`.

## Proximos passos recomendados

- Manter o painel simples e server-rendered em Express ate haver necessidade real de frontend separado.
- Implementar providers apenas depois de definir contrato e estrategia.
- Comecar por uma fonte simples e publica.
- Salvar coletas automaticas como `DRAFT`.
- Adicionar deduplicacao conservadora antes de criar muitas vagas.
- Adicionar autenticacao simples antes de expor o painel fora de ambiente local/confiavel.

## Decisoes importantes ja tomadas

- Nao adicionar React, Tailwind ou frontend separado nesta fase.
- Nao publicar automaticamente vagas coletadas sem revisao.
- Nao depender exclusivamente de scraping.
- Preferir APIs, RSS, listas publicas e HTML simples antes de Playwright.
- Evitar login, captcha, paywalls e circunvencao de bloqueios.
- Manter mensagens de Discord curtas, formatadas e uteis para alunos iniciantes.
- Usar IA como apoio, nao como dependencia obrigatoria.

