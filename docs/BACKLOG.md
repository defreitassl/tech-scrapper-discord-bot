# Backlog

## Implementado

- Painel admin.
- Coleta manual unificada.
- Coleta agendada configuravel.
- Envio agendado configuravel.
- Providers atuais: GitHub, Himalayas, Jobicy, RemoteOK, Remotive, Remotar, Gupy, Programathor, Solides, Greenhouse, Lever e Ashby.
- Filtro `TECH`/`POSSIBLY_TECH`/`NON_TECH`.
- Prioridade `HIGH`/`MEDIUM`/`LOW` com score e motivos.
- Fila `PENDING`.
- Status final `PENDING`, `SENT`, `ERROR`; `DRAFT` removido antes do deploy.
- Gemini no envio.
- Fallback deterministico.
- Discord embed/card.
- Basic Auth.
- Docker Compose.

## Proximo antes do deploy

- Revisar `.env` de producao.
- Confirmar `ADMIN_USERNAME` e `ADMIN_PASSWORD` fortes.
- Confirmar `DISCORD_TOKEN` e `DISCORD_CHANNEL_ID`.
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
