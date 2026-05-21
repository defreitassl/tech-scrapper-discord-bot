# Scraping com Playwright

Playwright existe no projeto como infraestrutura base para validar paginas publicas dinamicas. Ele nao muda o fluxo de coleta atual, nao registra provider real automaticamente e nao autoriza implementar plataformas complexas.

## Quando usar

Use Playwright somente como ultimo recurso, quando todas as condicoes abaixo forem verdadeiras:

- a pagina e publica;
- nao ha API publica, RSS ou HTML simples suficiente;
- o conteudo relevante depende de JavaScript;
- a fonte nao exige login, cookies autenticados, credenciais pessoais, captcha, paywall, proxy, rotacao de IP ou bypass anti-bot;
- a primeira versao do scraper ficara manual, pequena e fora da coleta automatica.

Se a fonte tiver JSON publico, RSS ou HTML estavel, prefira essas alternativas.

## Limites eticos e tecnicos

Scrapers com browser nao podem:

- fazer login;
- usar cookies autenticados;
- usar credenciais pessoais;
- burlar captcha;
- burlar Cloudflare ou bloqueios tecnicos;
- usar proxy ou rotacao de IP;
- tentar contornar rate limit ou protecao anti-bot;
- publicar vagas automaticamente sem revisao humana.

Se uma pagina exibir captcha, exigir login ou sinalizar bloqueio tecnico, interrompa a implementacao e registre a fonte como nao permitida. O projeto deve aceitar a falha, nao contornar o bloqueio.

## Estrutura

A base fica em `src/scraping/browser/`:

- `types.ts`: tipos para configuracao, resultado, vaga extraida e estatisticas.
- `browserPolicy.ts`: validacao de permissao para paginas publicas e bloqueios explicitos.
- `browserClient.ts`: cria contexto Playwright seguro, abre pagina publica e fecha o navegador.
- `pageUtils.ts`: helpers de navegacao, seletores, texto e links.

O contexto usa `headless: true` por padrao, timeout conservador, User-Agent identificavel, sem cookies customizados, sem login e sem proxy.

## Como criar um scraper novo

1. Pesquise se existe API, RSS ou endpoint JSON publico. So considere Playwright se nao houver alternativa mais simples.
2. Documente a fonte e os limites conhecidos antes de implementar.
3. Crie uma configuracao `BrowserScrapingConfig` com `isPublicPage: true` e todos os sinais de bloqueio como falsos ou ausentes.
4. Use `withBrowserPage(config, callback)` para garantir abertura e fechamento do navegador.
5. Extraia apenas dados publicos necessarios, com seletores pequenos e tolerantes a falha.
6. Converta o resultado para `CollectedJob` apenas dentro de um provider manual e nao registrado automaticamente.
7. Passe pelo `providerRunner` somente quando houver decisao explicita de ativar a fonte.
8. Salve vagas coletadas como `DRAFT`, com `useAi = false`, sem IA e sem envio ao Discord.

Cada scraper real deve comecar desligado da coleta automatica. O primeiro teste deve ser manual e com volume baixo.

## Inspecao de seletores com Playwright/Codex

Para investigar uma pagina publica, use as ferramentas Playwright/Codex apenas para observar a estrutura renderizada, testar seletores e confirmar se os dados aparecem sem login ou bloqueio.

Fluxo recomendado:

1. Abra a URL publica sem credenciais.
2. Verifique se o conteudo de vagas aparece sem interacao autenticada.
3. Inspecione seletores estaveis para cards, titulo, empresa, localizacao e link.
4. Confirme que nao ha captcha, tela de login, Cloudflare ou bloqueio tecnico.
5. Registre no codigo apenas os seletores necessarios e mantenha fallback para pagina vazia.

Nao use MCP, Playwright ou qualquer automacao para contornar bloqueios, simular usuario autenticado ou capturar cookies.

## Provider experimental

`src/providers/playwrightSmokeTest.provider.ts` valida a infraestrutura contra uma pagina publica simples. Ele nao coleta plataforma real complexa, nao salva vagas, nao chama IA e nao envia ao Discord.

Esse provider nao esta registrado em `realJobProviders`, `testJobProviders`, `atsJobProviders` ou na coleta automatica. Para testar outra pagina publica simples, defina `PLAYWRIGHT_SMOKE_TEST_URL` ao chamar o provider diretamente em codigo local de validacao.
