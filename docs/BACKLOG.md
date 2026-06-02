# Backlog

## Implementado

- Painel admin.
- Painel admin server-rendered com helpers e views consolidados para leitura didatica.
- Coleta manual unificada.
- Coleta agendada configuravel.
- `runAutomatedJobCollection` como fluxo unico de coleta.
- Registry de providers simplificado para automatico e manual.
- Envio agendado configuravel.
- Providers atuais do MVP: GitHub, Himalayas, Jobicy, RemoteOK, Remotive, Remotar, Gupy, Programathor e Solides.
- Fontes internacionais pouco aderentes removidas da coleta manual.
- Browser automation removido das dependencias de runtime.
- Filtro `TECH`/`POSSIBLY_TECH`/`NON_TECH`.
- Prioridade `HIGH`/`MEDIUM`/`LOW` com score e motivos.
- Politica central em `jobPolicy.ts` para dominio, qualidade, prioridade e elegibilidade de fila.
- Fila `PENDING`.
- Painel sem fluxo operacional de rascunho, autoaprovacao ou geracao manual de IA.
- Status final `PENDING`, `SENT`, `ERROR`.
- Gemini no envio.
- Fallback deterministico.
- Discord embed/card via Bot Discord.
- Envio ao Discord com `discord.js`.
- Logs de console mais legiveis.
- Notificacoes em tempo real para coletas e envios no painel admin.
- Basic Auth.
- Docker Compose.

## Proximo antes do deploy

- Revisar `.env` de producao.
- Confirmar `ADMIN_USERNAME` e `ADMIN_PASSWORD` fortes.
- Confirmar `DISCORD_TOKEN` e `DISCORD_CHANNEL_ID`.
- Confirmar que o bot esta no servidor e pode enviar mensagens no canal.
- Rodar migrations em producao com `npm run prisma:migrate:deploy`.
- Testar `GET /healthz`.
- Fazer envio real de uma vaga manual de teste.
- Conferir que apenas uma instancia do app esta rodando.
- Conferir logs de coleta, envio, Prisma, Discord e Gemini.
- Proteger painel com HTTPS e controle de acesso externo quando possivel.

## Melhorias futuras

- Monitoramento.
- Logs persistentes.
- Testes automatizados.
- Metricas por provider.
- Limpeza automatica de `ERROR` antigos.
- Dashboard simples.
- Mais providers seguros.
- Melhor deduplicacao por hash ou chave externa.
- Revisao periodica da qualidade das fontes.

## Fora do MVP

- LinkedIn scraping.
- Login/captcha/bypass.
- Multiplos tenants.
- SaaS.
- Frontend React.
- Delecao de mensagens do Discord.
- Fila avancada de publicacao.
- Moderacao multiusuario.
- Scraping agressivo ou de alta frequencia.

## Riscos conhecidos

- Providers publicos podem mudar endpoints, HTML ou regras de acesso.
- Rodar mais de uma instancia duplica schedulers.
- Falta de `GITHUB_TOKEN` reduz rate limit do GitHub.
- Falhas de Gemini devem continuar cobertas pelo fallback.
- Dados incompletos de fontes externas podem gerar rejeicoes conservadoras.
- Logs ainda nao sao persistentes.
- Cobertura de testes automatizados ainda e limitada.
