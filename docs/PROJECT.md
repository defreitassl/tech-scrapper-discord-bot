# Projeto

## Objetivo

- Coletar, organizar e publicar vagas de tecnologia para iniciantes no Discord da Projeto Desenvolve.
- Reduzir ruido de fontes externas e entregar oportunidades mais aderentes ao publico iniciante.
- Manter um painel simples para revisao, cadastro manual e operacao.

## Publico-alvo

- Alunos da Projeto Desenvolve.
- Pessoas buscando estagio, trainee, junior ou primeira oportunidade em tecnologia.
- Admins/voluntarios que revisam e publicam vagas no Discord.

## Escopo do MVP

- Painel admin em Express server-rendered.
- Cadastro manual de vagas.
- Coleta manual unificada.
- Coleta automatica configuravel.
- Envio agendado configuravel.
- Filtro deterministico de dominio tech.
- Priorizacao deterministica.
- Fila `PENDING`.
- Gemini somente no envio.
- Fallback deterministico.
- Publicacao como embed no Discord via Bot Discord com `discord.js`.
- Basic Auth no painel.
- Docker Compose para app e PostgreSQL.

## Fora de escopo

- Scraping agressivo.
- Login automatizado, captcha, bypass, proxy ou cookies autenticados.
- LinkedIn como provider.
- Publicacao automatica sem passar pela fila `PENDING`.
- Multi-tenant ou SaaS.
- Frontend React/Next/Tailwind.
- Delecao de mensagens ja enviadas ao Discord.
- Comandos interativos no Discord.

## Fluxo principal

1. Admin cadastra uma vaga ou aciona `Coletar vagas`.
2. Providers retornam vagas normalizadas.
3. Runner normaliza a vaga e chama `jobPolicy.ts` para decidir dominio, qualidade, prioridade e elegibilidade.
4. `jobPolicy.ts` rejeita vagas `NON_TECH`, sem qualidade minima, `LOW`, sem dados minimos ou com senioridade alta.
5. Runner deduplica e salva aprovadas como `PENDING`.
6. Coleta rejeita imediatamente o que nao entra na fila, nao chama Gemini e nao envia Discord.
7. Envio manual ou agendado consome vagas `PENDING`.
8. Publisher resolve a mensagem.
9. Discord recebe embed/card enviado pelo bot.
10. Vaga enviada vira `SENT`; falha vira `ERROR`.

`runAutomatedJobCollection` e o fluxo unico de coleta usado por coleta agendada e pelo botao `Coletar vagas`. Nao existe fluxo operacional de rascunho, autoaprovacao ou geracao manual de IA.

## Estados da vaga

- `PENDING`: vaga aprovada e aguardando envio.
- `SENT`: vaga enviada ao Discord.
- `ERROR`: falha no envio.

Nao existe curadoria por rascunho: a coleta aprova ou rejeita imediatamente, e vagas aprovadas entram direto na fila `PENDING`. O painel pode excluir vagas nao enviadas (`PENDING`, `ERROR`) e nao exclui `SENT`.

## Regras de negocio

- Foco em vagas tech de estagio, trainee, junior e primeiro emprego.
- Remoto e priorizado.
- Hibrido/presencial so entra quando for Minas Gerais, Belo Horizonte ou regiao.
- `NON_TECH` e rejeitado antes de salvar.
- Vagas aprovadas pela coleta entram direto como `PENDING`.
- `LOW` e rejeitado no fluxo automatizado.
- `MEDIUM` so entra se for estagio, trainee, remoto ou tiver `priorityScore >= 75`.
- Gemini roda somente no envio.
- Se Gemini falhar, o fallback deterministico deve publicar uma mensagem util.
- Discord recebe embed/card pelo bot; se embed falhar, publisher tenta texto puro.
- Coleta automatica preenche a fila alvo `min(max(dailyLimit * 7, dailyLimit), 30)`.
- Envio em lote busca ate 5 vagas `PENDING`.

## Arquitetura resumida

- `src/admin/`: painel Express, rotas, views, helpers e autenticacao Basic.
- `src/providers/`: providers, normalizacao, registry e runner.
- `src/services/`: politica de decisao da vaga, filtros, prioridade, deduplicacao, schedulers, Gemini e envio ao Discord por bot.
- `src/lib/prisma.ts`: Prisma Client compartilhado.
- `src/lib/logger.ts`: logger simples.
- `prisma/schema.prisma`: modelo de dados.
- `src/scraping/`: camada isolada para acesso publico HTML/JSON e investigacoes controladas.

O Discord e integrado por `discord.js`, usando `DISCORD_TOKEN` e `DISCORD_CHANNEL_ID`. O bot precisa estar no servidor e ter permissao para enviar mensagens no canal. O MVP nao le mensagens, nao responde comandos e nao cria listeners persistentes.

## Providers

- Provider deve ser pequeno e responsavel por uma fonte ou familia de fontes.
- Preferir API publica, RSS, JSON publico ou HTML publico simples.
- Providers nao dependem de browser em runtime.
- Provider retorna dados; runner chama `jobPolicy.ts` para decidir salvar ou recusar.
- Provider nao chama Gemini.
- Provider nao envia Discord.
- Provider deve registrar `source` e preservar URL original quando houver.
- Falha em uma fonte nao deve interromper as demais.
- Registry exposto deve ser simples: `automaticJobProviders` para coleta automatica e `manualJobProviders` para o botao do painel.

Providers do MVP:

- GitHub issues publicas.
- APIs JSON: Himalayas, Jobicy, RemoteOK, Remotive.
- JSON/HTML publico validado: Remotar, Gupy, Programathor, Solides.

Fora da coleta atual:

- Fontes internacionais pouco aderentes ao publico da Projeto Desenvolve.
- Browser scraping em runtime; providers devem usar fontes publicas seguras.

## Logs

- Logs devem ser suficientes para diagnosticar coleta, rejeicoes, duplicatas, prioridades, erros de provider e erros de envio.
- Logs nao devem expor tokens, senhas ou segredos.
- Rejeicoes devem usar motivos estaveis quando possivel, como `non_tech_domain:*`, `outside_technology_profile`, duplicidade ou senioridade alta.

## Painel admin

- Server-rendered em Express.
- HTML/CSS simples, sem framework frontend grande.
- Views mantidas em poucos arquivos didaticos (`layout`, `jobs`, `settings` e `styles`) e helpers consolidados.
- Fluxos principais: listar, criar, editar, ver detalhes, coletar vagas, enviar pendentes, enviar agora e excluir vagas nao enviadas.
- Configuracao de envio mostra um campo de horario para cada vaga definida no limite diario.
- Acoes destrutivas devem ser restritas a vagas nao enviadas.
- Interface deve continuar operacional e direta para o MVP.
