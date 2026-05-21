# Pesquisa Tecnica: Programathor

Data da investigacao: 2026-05-21.

## Resumo

O Programathor e tecnicamente viavel para uma primeira coleta experimental, manual e conservadora.

A estrategia recomendada e HTML publico simples, nao Playwright operacional. A listagem publica entrega os cards de vagas no HTML inicial e a pagina de detalhe contem dados estruturados `JobPosting` em JSON-LD, incluindo `datePosted`. Durante a validacao, nao foi encontrado endpoint JSON publico de vagas.

## URLs analisadas

- `https://programathor.com.br/jobs`
- `https://programathor.com.br/jobs?expertise=J%C3%BAnior`
- `https://programathor.com.br/jobs?contract_type=Est%C3%A1gio`
- `https://programathor.com.br/jobs?expertise=J%C3%BAnior&remoto=true`
- `https://programathor.com.br/jobs-front-end?expertise=J%C3%BAnior`
- `https://programathor.com.br/jobs-quality-assurance?expertise=J%C3%BAnior`
- `https://programathor.com.br/jobs-data-science?expertise=J%C3%BAnior`
- `https://programathor.com.br/jobs?place=Belo%20Horizonte&expertise=J%C3%BAnior`
- `https://programathor.com.br/jobs/33477-desenvolvedor-a-java-jr-pj`

Termos avaliados no reconhecimento:

- `estagio tecnologia`
- `desenvolvedor junior`
- `junior tecnologia`
- `front-end junior`
- `backend junior`
- `suporte tecnico`
- `qa junior`
- `dados junior`
- `remoto junior`

## Endpoint JSON publico

Nao foi encontrado endpoint JSON publico de listagem de vagas durante a investigacao.

O carregamento observado por Playwright fez requisicao principal `text/html` para a propria pagina e assets estaticos. Os dados de cards aparecem no HTML retornado por `GET /jobs...`, e os detalhes aparecem no HTML da vaga e no JSON-LD embutido.

## Login, captcha e bloqueios

Durante a validacao:

- as listagens abriram sem login;
- as paginas de detalhe abriram sem login;
- nao apareceu captcha;
- nao apareceu tela de bloqueio exigindo bypass;
- nao foram usados cookies autenticados;
- nao foram usadas credenciais pessoais;
- nao foi usado proxy ou rotacao de IP;
- nao houve tentativa de burlar Cloudflare.

O site responde por Cloudflare e injeta script de deteccao JavaScript (`/cdn-cgi/challenge-platform/...`), mas as paginas publicas analisadas responderam normalmente com HTTP 200 e conteudo de vagas. Se isso mudar para desafio, captcha, login obrigatorio ou bloqueio tecnico, a coleta deve ser interrompida.

Observacao operacional: o MCP do Playwright estava bloqueado por uma instancia existente do perfil local. A validacao com browser foi feita com Chromium/Google Chrome em perfil temporario e isolado, sem credenciais ou cookies autenticados.

## HTML, JavaScript e seletores

A listagem nao depende de JavaScript para expor os dados principais. Seletores/estruturas uteis:

- lista de cards: `.cell-list`;
- link da vaga: `a[href^="/jobs/"]`;
- titulo: `.cell-list-content h3`;
- metadados: `.cell-list-content-icon span`;
- empresa: `span` com icone `fa-briefcase`;
- localizacao/modalidade: `span` com icone `fa-map-marker-alt`;
- salario: `span` com icone `far fa-money-bill-alt`;
- nivel: `span` com icone `far fa-chart-bar`;
- contrato: `span` com icone `far fa-file-alt`;
- stacks: `.tag-list.background-gray`;
- paginacao: `.pagination .page-link`.

Na pagina de detalhe:

- titulo: `h1`;
- empresa: `h2 a`;
- conteudo: `.line-height-2-4`;
- dados estruturados: `<script type="application/ld+json">` com `@type = JobPosting`;
- data: campo `datePosted` no JSON-LD;
- validade: campo `validThrough` no JSON-LD.

## Filtros publicos

Filtros publicos observados:

- nivel: `?expertise=J%C3%BAnior`, `Pleno`, `S%C3%AAnior`;
- remoto: `?remoto=true`, redirecionando/normalizando para rotas como `/jobs-city/remoto?...`;
- cidade: `?place=Belo%20Horizonte`, com rota normalizada `/jobs-city/belo-horizonte?...`;
- contrato: `?contract_type=CLT`, `PJ`, `Est%C3%A1gio`;
- tecnologia/area: rotas como `/jobs-front-end`, `/jobs-quality-assurance`, `/jobs-data-science`, `/jobs-java`, `/jobs-python`;
- paginacao: `/jobs/page/2?...` ou `?page=2` em rotas de tecnologia/cidade.

Nao foi observado filtro publico direto por data/ordenacao alem da ordenacao padrao da listagem.

## Campos disponiveis

Listagem:

- id externo a partir da URL;
- titulo;
- empresa;
- localizacao;
- modalidade inferida de localizacao;
- nivel;
- salario;
- contrato;
- stacks;
- URL.

Detalhe:

- descricao;
- requisitos;
- descricao da empresa;
- data de publicacao (`datePosted`);
- validade (`validThrough`);
- empresa;
- localidade.

## Riscos

- Nao ha endpoint JSON publico documentado; a estrategia depende de HTML publico.
- O HTML pode mudar nomes de classes e estrutura dos cards.
- Cloudflare esta presente como CDN e deteccao JS; se virar desafio/bloqueio, o provider deve parar.
- Muitas listagens antigas permanecem publicas como `Vencida`; o provider precisa filtrar `Vencida` e `datePosted` acima de 30 dias.
- Filtros amplos retornam muitas vagas fora de MG ou antigas, entao o provider deve ser conservador.

## Recomendacao

Implementar agora, com estrategia HTML simples.

Regras recomendadas:

- provider experimental;
- acionamento manual;
- fora da coleta automatica;
- sem Playwright operacional;
- sem login, cookies autenticados, credenciais, proxy, rotacao de IP, captcha ou bypass;
- poucas URLs publicas por execucao;
- sem paginacao agressiva;
- maximo de 20 vagas retornadas por execucao;
- vagas criadas apenas como `DRAFT` via `providerRunner`;
- `useAi = false`;
- sem Gemini;
- sem Discord.
