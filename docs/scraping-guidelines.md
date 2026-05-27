# Boas Praticas de Scraping

Scraping deve ser tratado como ultimo recurso quando nao houver cadastro manual, RSS, API ou pagina publica simples com estrutura estavel.

Futuras fontes mais dificeis devem usar a camada isolada `src/scraping/` e seguir `docs/scraping-engine-design.md`. Essa camada existe para manter politica, cliente publico e utilitarios de HTML fora do painel admin, do Prisma, do envio ao Discord e do runner de providers.

A infraestrutura Playwright fica em `src/scraping/browser/` e e documentada em `docs/playwright-scraping.md`. Ela deve ser usada apenas como ultimo recurso para paginas publicas dinamicas, depois de descartar API, RSS e HTML simples.

## Principios

- Prefira fontes publicas simples.
- Respeite rate limits.
- Evite scraping agressivo.
- Registre a fonte e a URL original.
- Preserve o texto bruto quando fizer sentido.
- Mantenha logs suficientes para diagnosticar falhas.
- Nunca envie ao Discord durante a coleta. A coleta pode aprovar vagas como `PENDING`, mas a publicacao continua restrita ao scheduler ou acoes manuais.

## O que evitar

- Login automatizado sem autorizacao clara.
- Circunvencao de captcha, bloqueios ou paywalls.
- Rotacao agressiva de IP ou user agents.
- Coleta em alta frequencia.
- Raspar plataformas que proíbem automacao nos termos de uso.
- Publicar dados sem URL de origem.
- Usar browser para contornar login, captcha, Cloudflare, paywalls ou bloqueios anti-bot.
- Usar credenciais pessoais ou simular usuario autenticado.
- Usar cookies autenticados, proxy ou rotacao de IP.

## Rate limit e frequencia

Cada provider deve ter intervalo conservador entre requisicoes. Para primeiras versoes, prefira execucao manual ou agendada com baixa frequencia.

Quando houver muitas fontes, usar fila ou controle central de rate limit.

O provider GitHub atual nao faz scraping HTML; ele usa a API oficial do GitHub e aceita `GITHUB_TOKEN` opcional para aumentar o rate limit. Sem token, a coleta continua manual, mas deve ser usada com ainda mais parcimonia por causa do limite anonimo menor.

Os providers Himalayas, Jobicy, RemoteOK e Remotive tambem nao fazem scraping HTML. Eles usam APIs JSON publicas, poucas chamadas por execucao e filtros locais antes de entregar vagas ao runner. Remotive deve continuar com baixa frequencia de chamadas; Jobicy, RemoteOK e Remotive exigem atribuicao/linkback por meio da URL original.

Os providers Greenhouse, Lever e Ashby tambem nao fazem scraping HTML pesado. Eles usam somente endpoints JSON publicos de ATS por empresa cadastrada, via coleta manual no painel. Nao usam Playwright, Cheerio, login, cookies, credenciais pessoais, proxy, captcha, Cloudflare bypass ou bypass anti-bot. Nesta etapa, eles nao entram na coleta automatica diaria.

O provider Gupy foi criado apos reconhecimento com Playwright MCP e fica documentado em `docs/gupy-scraping-research.md`. Ele roda automaticamente em baixo volume, com poucas chamadas, limite de 20 vagas por execucao e sem paginacao agressiva.

O provider Remotar foi criado apos reconhecimento com Playwright MCP e fica documentado em `docs/remotar-scraping-research.md`. A implementacao usa JSON publico e, apos revisao operacional em 2026-05-25, foi promovida para a coleta automatica diaria por melhor volume e aderencia. Deve continuar com poucas chamadas, limite de 20 vagas por execucao e sem paginacao agressiva. A rota manual continua disponivel.

O provider Solides foi criado apos reconhecimento com Playwright MCP e fica documentado em `docs/solides-scraping-research.md`. A implementacao usa JSON publico em baixo volume, tem limite de 20 vagas por execucao, entra na coleta manual unificada e tambem na coleta automatica diaria.

## Tratamento de falhas

Scrapers quebram. O sistema deve tolerar:

- pagina fora do ar;
- layout alterado;
- resposta vazia;
- timeout;
- bloqueio temporario;
- dados incompletos.

Falhas de coleta nao devem afetar o painel admin nem a publicacao manual de vagas ja cadastradas.

Se a fonte retornar sinais de bloqueio, captcha, exigencia de login ou termos explicitamente incompativeis, a coleta deve ser interrompida e a fonte deve ser marcada como nao permitida. O projeto nao deve implementar bypass.

Para browser scraping, a politica tambem deve bloquear uso de credenciais, cookies customizados, proxy e rotacao de IP. O contexto Playwright deve usar User-Agent identificavel, `headless: true` por padrao e timeout conservador.

No caso da Gupy, se o endpoint publico passar a exigir login, captcha, Cloudflare/bypass ou qualquer credencial, a coleta deve ser parada em vez de contornada.

No caso da Remotar, se o endpoint publico ou as paginas publicas passarem a exigir login, captcha, Cloudflare/bypass, cookies autenticados, proxy, rotacao de IP ou qualquer credencial, a coleta deve ser parada em vez de contornada.

No caso da Solides, se o endpoint publico ou as paginas publicas passarem a exigir login, captcha, Cloudflare/bypass, cookies autenticados, proxy, rotacao de IP ou qualquer credencial, a coleta deve ser parada em vez de contornada.

A coleta automatica atual aprova vagas elegiveis como `PENDING`, com `useAi = true` e `aiGeneratedText` vazio quando ainda nao ha mensagem pronta, ou recusa sem persistir. Ela nao chama Gemini e nao envia ao Discord. Remotar, Gupy, Programathor e Solides rodam automaticamente em baixo volume por fontes publicas validadas; ATS publicos continuam manuais.

## Revisao antes de publicar

`DRAFT` foi aposentado do fluxo principal. Vagas coletadas automaticamente devem ser aprovadas como `PENDING` ou recusadas sem persistencia.

O fluxo recomendado e:

1. Coletar.
2. Normalizar.
3. Aplicar filtros determinísticos de qualidade quando existirem.
4. Deduplicar.
5. Calcular prioridade.
6. Selecionar apenas a quantidade necessaria para preencher a fila `PENDING` alvo.
7. Salvar aprovadas como `PENDING`, com `useAi = true` e sem gerar IA.
8. Gerar mensagem somente no envio, com fallback deterministico se Gemini falhar.
9. Publicar depois pelo scheduler ou manualmente.

Se a vaga for `NON_TECH`, `LOW`, duplicada, sem URL, sem descricao util ou com senioridade alta, ela deve ser recusada e nao persistida. Falha de IA nao bloqueia mais a coleta nem o envio, porque o publisher usa fallback. Rascunhos `DRAFT` antigos sao apenas legado.
