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
- Publicacao como embed no Discord.
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

## Fluxo principal

1. Admin cadastra uma vaga ou aciona `Coletar vagas`.
2. Providers retornam vagas normalizadas.
3. Runner aplica filtro `TECH`/`POSSIBLY_TECH`/`NON_TECH`.
4. Runner rejeita vagas sem qualidade minima, duplicadas, `LOW` ou com senioridade alta.
5. Runner calcula prioridade e salva aprovadas como `PENDING`.
6. Coleta rejeita imediatamente o que nao entra na fila, nao chama Gemini e nao envia Discord.
7. Envio manual ou agendado consome vagas `PENDING`.
8. Publisher resolve a mensagem.
9. Discord recebe embed/card.
10. Vaga enviada vira `SENT`; falha vira `ERROR`.

## Estados da vaga

- `PENDING`: vaga aprovada e aguardando envio.
- `SENT`: vaga enviada ao Discord.
- `ERROR`: falha no envio.

`DRAFT` foi removido antes do deploy. Nao existe curadoria por rascunho: a coleta aprova ou rejeita imediatamente, e vagas aprovadas entram direto na fila `PENDING`. `ARCHIVED` tambem foi removido. O painel pode excluir vagas nao enviadas (`PENDING`, `ERROR`) e nao exclui `SENT`.

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
- Discord recebe embed/card; se embed falhar, publisher tenta texto puro.
- Coleta automatica preenche a fila alvo `min(max(dailyLimit * 7, dailyLimit), 30)`.
- Envio em lote busca ate 5 vagas `PENDING`.

## Arquitetura resumida

- `src/admin/`: painel Express, rotas, views, helpers e autenticacao Basic.
- `src/providers/`: providers, normalizacao, registry e runner.
- `src/services/`: regras de negocio, filtros, prioridade, deduplicacao, schedulers, Gemini e Discord.
- `src/lib/prisma.ts`: Prisma Client compartilhado.
- `src/lib/logger.ts`: logger simples.
- `prisma/schema.prisma`: modelo de dados.
- `src/scraping/`: camada isolada para acesso publico HTML/JSON e investigacoes controladas.

## Providers

- Provider deve ser pequeno e responsavel por uma fonte ou familia de fontes.
- Preferir API publica, RSS, JSON publico ou HTML publico simples.
- Playwright apenas para investigacao ou ultimo recurso.
- Provider retorna dados; runner central decide salvar ou recusar.
- Provider nao chama Gemini.
- Provider nao envia Discord.
- Provider deve registrar `source` e preservar URL original quando houver.
- Falha em uma fonte nao deve interromper as demais.

Providers atuais:

- GitHub issues publicas.
- APIs JSON: Himalayas, Jobicy, RemoteOK, Remotive.
- JSON/HTML publico validado: Remotar, Gupy, Programathor, Solides.
- ATS publicos manuais: Greenhouse, Lever, Ashby.

## Logs

- Logs devem ser suficientes para diagnosticar coleta, rejeicoes, duplicatas, prioridades, erros de provider e erros de envio.
- Logs nao devem expor tokens, senhas ou segredos.
- Rejeicoes devem usar motivos estaveis quando possivel, como `non_tech_domain:*`, `outside_technology_profile`, duplicidade ou senioridade alta.

## Painel admin

- Server-rendered em Express.
- HTML/CSS simples, sem framework frontend grande.
- Fluxos principais: listar, criar, editar, ver detalhes, coletar, enviar, configurar coleta, configurar envio.
- Acoes destrutivas devem ser restritas a vagas nao enviadas.
- Interface deve continuar operacional e direta para o MVP.
