# Pesquisa de Plataformas de Vagas

Este mapeamento orienta futuras decisoes de providers. Ele nao substitui validacao tecnica e juridica antes de implementar uma fonte concreta.

## Resumo de recomendacao

Fontes recomendadas primeiro:

- Greenhouse, Lever e Ashby ja foram iniciados por endpoints JSON publicos da propria empresa. Workable continua para depois/avaliar caso a caso.
- Sites proprios de empresas e paginas publicas de carreiras com HTML simples ou RSS.
- Programathor ja foi iniciado como experimento manual por HTML publico simples apos pesquisa especifica. Remotar foi iniciada como experimento manual por JSON publico apos pesquisa especifica com Playwright MCP e promovida para coleta automatica diaria em 2026-05-25 por melhor volume e aderencia.

Fontes para evitar nesta etapa:

- LinkedIn.
- Plataformas que exigem login, captcha, bypass anti-bot ou uso de credenciais pessoais.

## Gupy

- Tipo de acesso provavel: paginas publicas de vagas por empresa, frequentemente com dados carregados por JavaScript.
- API publica/endpoints conhecidos: pode haver endpoints publicos usados pelo frontend, mas devem ser validados caso a caso.
- Exige login: candidatura pode exigir conta; listagem publica pode nao exigir.
- JS-heavy: sim.
- Risco de captcha/bloqueio: medio.
- Dificuldade estimada: alta.
- Recomendacao: depois.
- Estrategia ideal: avaliar endpoints JSON publicos por empresa; evitar browser se houver bloqueio; nao implementar login.

## Solides

- Tipo de acesso provavel: paginas publicas de vagas por empresa/plataforma.
- API publica/endpoints conhecidos: nao assumir API publica estavel sem pesquisa especifica.
- Exige login: pode exigir em etapas de candidatura.
- JS-heavy: medio a alto.
- Risco de captcha/bloqueio: medio.
- Dificuldade estimada: alta.
- Recomendacao: depois.
- Estrategia ideal: pesquisa por endpoints JSON publicos ou HTML simples de paginas publicas; nao implementar login nem bypass.

## LinkedIn

- Tipo de acesso provavel: plataforma grande com protecoes, conteudo dinamico e forte controle de acesso.
- API publica/endpoints conhecidos: APIs oficiais costumam exigir autorizacao e escopo adequado; scraping publico e arriscado.
- Exige login: frequentemente sim para uso completo.
- JS-heavy: sim.
- Risco de captcha/bloqueio: alto.
- Dificuldade estimada: muito alta.
- Recomendacao: evitar.
- Estrategia ideal: nao implementar scraping. Usar apenas API oficial autorizada, parceria ou fontes alternativas.

## Programathor

- Tipo de acesso provavel: site publico de vagas de tecnologia.
- API publica/endpoints conhecidos: nao foi encontrado endpoint JSON publico de listagem de vagas durante a pesquisa.
- Exige login: nao para visualizar listagens e detalhes publicos analisados; candidatura pode ter fluxo proprio fora da coleta.
- JS-heavy: baixo para coleta atual, pois os cards aparecem no HTML inicial.
- Risco de captcha/bloqueio: baixo no reconhecimento feito; a infraestrutura observada inclui Cloudflare, entao qualquer desafio, captcha ou necessidade de bypass deve interromper a coleta.
- Dificuldade estimada: baixa a media.
- Recomendacao: iniciado como provider experimental manual.
- Estrategia implementada: HTML publico simples via `fetchPublicHtml`, detalhes por JSON-LD publico `JobPosting`, limite de 20 vagas por execucao, sem Playwright operacional, login, cookies autenticados, credenciais, proxy, rotacao de IP, captcha ou bypass.

## Remotar

- Tipo de acesso provavel: site publico/listagem de vagas remotas.
- API publica/endpoints conhecidos: sim, a UI publica usa `https://api.remotar.com.br/jobs`, alem de `categories`, `tags` e `timeline`.
- Exige login: nao para visualizar listagens e detalhes publicos analisados; a pagina de detalhe mostra convite de cadastro, mas o conteudo publico da vaga continua visivel.
- JS-heavy: medio na UI, mas a coleta pode usar JSON publico.
- Risco de captcha/bloqueio: baixo no reconhecimento feito; se surgir captcha, login obrigatorio, bloqueio ou necessidade de bypass, a coleta deve parar.
- Dificuldade estimada: baixa a media.
- Recomendacao: iniciado como provider experimental manual e promovido para coleta automatica diaria em 2026-05-25.
- Estrategia implementada: JSON publico via `fetchPublicJson`, filtros por `search`, `tagId` e `categoryId`, limite de 20 vagas por execucao, sem Playwright operacional, login, cookies autenticados, credenciais, proxy, rotacao de IP, captcha ou bypass. O provider continua criando apenas `DRAFT`, sem Gemini e sem Discord; a autoaprovacao V1 posterior pode preparar rascunhos elegiveis para `PENDING`.

## Sites proprios de empresas

- Tipo de acesso provavel: paginas publicas de carreiras.
- API publica/endpoints conhecidos: variavel; muitas empresas usam Greenhouse, Lever, Workable, Ashby ou JSON proprio.
- Exige login: normalmente nao para listar vagas.
- JS-heavy: variavel.
- Risco de captcha/bloqueio: baixo a medio.
- Dificuldade estimada: baixa a media.
- Recomendacao: agora, quando a pagina for publica e simples.
- Estrategia ideal: API/RSS/endpoint JSON publico; HTML simples quando estavel; browser somente ultimo caso.

## Paginas publicas de carreiras

- Tipo de acesso provavel: HTML publico, RSS, JSON embutido ou endpoint publico.
- API publica/endpoints conhecidos: variavel.
- Exige login: nao deveria exigir para a listagem.
- JS-heavy: variavel.
- Risco de captcha/bloqueio: baixo.
- Dificuldade estimada: baixa.
- Recomendacao: agora.
- Estrategia ideal: RSS ou API publica; HTML simples com Cheerio se necessario.

## Greenhouse

- Tipo de acesso provavel: paginas publicas e endpoints JSON publicos por board/empresa.
- API publica/endpoints conhecidos: sim, ha endpoints publicos de job boards em muitos casos.
- Exige login: nao para listagem publica.
- JS-heavy: baixo a medio.
- Risco de captcha/bloqueio: baixo.
- Dificuldade estimada: baixa.
- Recomendacao: iniciado.
- Estrategia implementada: provider manual usa `https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true`, sem login, cookies, Cheerio, Playwright ou bypass.
- Alvo inicial: GitLab (`gitlab`).

## Lever

- Tipo de acesso provavel: paginas publicas e endpoints JSON publicos por empresa.
- API publica/endpoints conhecidos: sim, frequentemente ha JSON publico para postings.
- Exige login: nao para listagem publica.
- JS-heavy: baixo.
- Risco de captcha/bloqueio: baixo.
- Dificuldade estimada: baixa.
- Recomendacao: iniciado.
- Estrategia implementada: provider manual usa `https://api.lever.co/v0/postings/{slug}?mode=json`, sem login, cookies, Cheerio, Playwright ou bypass.
- Alvo inicial: Kepler Communications (`kepler`).

## Workable

- Tipo de acesso provavel: paginas publicas de carreiras e endpoints usados por widgets.
- API publica/endpoints conhecidos: existem endpoints publicos em alguns cenarios, mas variam por conta.
- Exige login: nao para listagem publica.
- JS-heavy: medio.
- Risco de captcha/bloqueio: baixo a medio.
- Dificuldade estimada: media.
- Recomendacao: depois/avaliar caso a caso.
- Estrategia ideal: endpoint JSON publico quando disponivel; HTML simples se estavel.

## Ashby

- Tipo de acesso provavel: job boards publicos por empresa.
- API publica/endpoints conhecidos: ha endpoints publicos usados por boards em muitos casos.
- Exige login: nao para listagem publica.
- JS-heavy: medio.
- Risco de captcha/bloqueio: baixo.
- Dificuldade estimada: baixa a media.
- Recomendacao: iniciado.
- Estrategia implementada: provider manual usa `https://api.ashbyhq.com/posting-api/job-board/{slug}`, sem login, cookies, Cheerio, Playwright ou bypass.
- Alvo inicial: Ashby (`ashby`).

## Observacoes da primeira validacao ATS

Os alvos cadastrados foram escolhidos por responderem com JSON publico simples durante a validacao inicial:

- `gitlab` em Greenhouse;
- `kepler` em Lever;
- `ashby` em Ashby.

Alguns slugs testados no Lever nao foram cadastrados porque o endpoint retornou `Document not found`/404 na validacao inicial, incluindo `netlify`, `postman`, `sourcegraph`, `scaleai` e `discord`.

Os providers ATS ficam fora da coleta automatica diaria nesta etapa. A ativacao automatica deve ser uma decisao posterior, depois de ampliar a lista de empresas com endpoints estaveis e revisar volume/frequencia de chamadas.

## Bloqueios explicitos

Nao implementar fontes que dependam de:

- login;
- captcha;
- Cloudflare/bloqueio anti-bot que exija bypass;
- credenciais pessoais;
- simulacao de usuario autenticado;
- proxy/rotacao de IP para contornar restricoes;
- termos explicitamente incompativeis com automacao.
