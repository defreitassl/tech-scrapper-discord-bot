Provedores de vagas para o bot de vagas PD
Objetivo

Identificar fontes de vagas de tecnologia (júnior/estágio/iniciante) que possam ser usadas como provedores externos no projeto tech‑scrapper‑discord‑bot. Devem ser fontes públicas (APIs ou páginas simples/RSS) com vagas remotas ou presenciais/híbridas que cumpram os critérios de coleta já definidos: vagas recentes (publicadas nos últimos 30 dias), nível júnior ou estágio, e localidade aceitável (remoto em qualquer lugar ou presencial/híbrido apenas em Minas Gerais). Cada fonte foi classificada quanto à dificuldade de integração (fácil, média ou difícil) e suas principais características.

Metodologia
Levantar fontes em listas públicas – foram usadas listas de APIs públicas de empregos (publicapis.dev) e artigos de comunidades (DEV Community) para identificar provedores de vagas que disponibilizam API ou feed RSS.
Consultar documentação oficial – para cada fonte, verificar se existe documentação ou README que descreve os endpoints disponíveis, campos retornados e condições de uso (link‑back, rate limit etc.).
Analisar exemplos de resposta – examinar os campos retornados (título, empresa, localização, descrição, data de publicação, etc.) para decidir se a fonte contém informações suficientes e em formato adequado.
Classificar dificuldade – baseado no acesso (público x autenticado), necessidade de scraping HTML, uso de JavaScript, existência de API oficial, e requisitos de login ou anti‑scraping.
Fontes encontradas
1. GitHub repositories (integrados)

Já está implementado um provedor GitHub que coleta issues abertas dos repositórios de vagas da comunidade brasileira (FrontendBR, Backend‑BR, React‑Brasil, QA‑Brasil, NodejsDevBR, DotNetDevBR e SouJava). Esses repositórios exigem que as vagas sejam publicadas como issues com cidade entre colchetes, título e nome da empresa, e as labels devem indicar nível (Júnior/Estágio) e tipo de contratação. O provedor usa a API do GitHub para buscar issues abertas, filtrar por data (até 30 dias), por labels (Júnior, Estágio), e descartar vagas sênior/ pleno. Além disso, filtra vagas presenciais/híbridas apenas em Minas Gerais. As vagas coletadas entram como DRAFT e precisam ser preparadas manualmente.

Campos obtidos: título (cargo), empresa, localidade (cidade ou remoto), modalidade (remoto/híbrido/presencial), nível (júnior ou estágio), descrição (extraída do corpo da issue), stacks (de requisitos), URL da issue, data de criação e fonte (owner/repo).

Dificuldade: Média – é necessário tratar variações de labels e títulos, extrair textos do corpo da issue e filtrar localidade.

2. Himalayas Remote Jobs API – Fácil
Endpoint: https://himalayas.app/jobs/api (browse) e https://himalayas.app/jobs/api/search. O browse retorna feed completo paginado por offset e limit (máx. 20 registros); o search permite q, country, worldwide, seniority (inclui Entry‑level), employment_type, company e timezone.
Campos retornados: title, excerpt, companyName, companySlug, employmentType, locationRestrictions, timezoneRestriction, category, description, pubDate, applicationLink. A API oferece também feed RSS com as 100 vagas mais recentes e uma especificação OpenAPI.
Características: Gratuito e sem autenticação; taxa de 20 registros por requisição e limites de rate limit para pesquisas. Permite buscar por seniority=Entry‑level para filtrar vagas júnior. locationRestrictions e timezoneRestriction indicam restrições geográficas (útil para filtrar Minas Gerais ou remoto). description contém o texto completo da vaga.
Scraping: Não precisa HTML; basta consultar a API. Filtrar as vagas por pubDate (<= 30 dias), seniority e locationRestrictions (Minas Gerais ou worldwide). Extrair campos para JobPost (title, companyName, location, modality, description, stacks etc.).
Dificuldade: Fácil – API pública com parâmetros adequados; apenas deve respeitar limites de rate (max 20 por requisição).
3. Jobicy Remote Jobs API – Fácil
Endpoint: https://jobicy.com/api/v2/remote-jobs. Aceita parâmetros como count (quantidade de registros até 50), geo (ex: brazil), industry (categoria), tag (palavra‑chave). Retorna campos como id, url, jobTitle, companyName, jobGeo, jobType, jobLevel, jobExcerpt, jobDescription, e salários. Existe feed RSS e documentação.
Características: Gratuito e público; exige citar Jobicy como fonte, não submeter vagas a terceiros e aguardar 6 horas de atraso em relação às vagas publicadas. jobLevel informa o nível (Ex.: Junior), jobGeo indica localidade e jobDescription inclui texto completo. As vagas são todas remotas, mas jobGeo pode indicar região (ex: LATAM, Brazil).
Scraping: Basta consumir a API. Filtrar por jobLevel em Junior ou Intern e por jobGeo (remoto global ou Brasil). Extrair jobDescription para stacks e resumo. Salvar como DRAFT.
Dificuldade: Fácil – API com parâmetros simples; limitar a 50 registros e verificar 6 horas de atraso.
4. RemoteOK API – Fácil/Média
Endpoint: https://remoteok.com/api. Retorna um array de vagas em JSON; cada vaga tem campos slug, id, date, company, position, tags, description. A primeira entrada contém os Termos de Serviço exigindo link‑back e atribuição a RemoteOK.
Características: API gratuita; vagas remotas (tags contêm remote). Não há parâmetros de filtragem; deve filtrar manualmente. Campos tags e position podem indicar nível (ex.: junior) ou tecnologia (ex.: react). description contém HTML; é preciso limpar para extrair stacks.
Scraping: Ler JSON, pular primeira entrada (TOS), filtrar vagas com date (<= 30 dias) e tags que contenham junior/intern e sem senior. tags também indicam local/região (latam) ou worldwide. Se a vaga não for remota ou se restringir a locais fora do Brasil, ignorar. Extrações de stacks a partir de tags e description.
Dificuldade: Média – precisa limpar HTML e interpretar tags; sem filtro de senioridade direto.
5. Remotive API (remote‑jobs) – Média
Endpoint: https://remotive.com/api/remote-jobs. Aceita parâmetros category, company_name, search, limit. A resposta inclui id, url, title, company_name, company_logo, job_type, publication_date, candidate_required_location, salary, description. O site ressalta que as vagas são liberadas com 24 h de atraso e devem ser creditadas à Remotive.
Características: As vagas são remotas por definição, mas candidate_required_location indica regiões (ex.: Americas, LATAM) que podem limitar ao Brasil. description é longo e pode ser HTML; publication_date serve para filtrar 30 dias. job_type indica full_time, contract, etc. category pode ser software-dev, mas não há campo de nível; o nível deve ser extraído de title ou description.
Scraping: Consumir JSON, filtrar por publication_date, extrair level a partir de palavras‑chave (Junior, Entry‑level, Estágio) em title ou description, e descartar vagas com Senior ou Mid. candidate_required_location deve ser Worldwide, LATAM ou similar. Extrair stacks via busca em description. Respeitar o limite de 4 chamadas diárias recomendadas.
Dificuldade: Média – precisa analisar texto para nível, extrair tags de stacks e respeitar rate limit.
6. Arbeitnow Jobs API – Média
Endpoint: https://api.arbeitnow.com/api/jobs (não explicitado; a API pública arbeitnow/api descrita no artigo). Documentação ou exemplo: a API retorna JSON com campos id, title, company, location, description e outros.
Características: Dedicado ao mercado de emprego da Alemanha/EU. Possui parâmetros para remote e format. Não há filtragem por nível; é necessário extrair a senioridade do título ou description. O site está em inglês e as vagas são internacionais.
Scraping: Consumir endpoint, filtrar remote se for explicitado, extrair data de publicação (se houver). Precisa analisar title e description em busca de junior/intern e ignorar senior. Descartar locais fora do Brasil se não for remoto.
Dificuldade: Média – não se sabe se há data de publicação e nível; se a API for estática, pode gerar muitas vagas antigas.
7. Findwork API – Difícil
O site Findwork oferece uma REST API para acessar vagas, mas o acesso exige login e provavelmente assinatura. O portal redireciona para login na área da API. Sem acesso via API gratuita, a integração fica inviável.
Dificuldade: Difícil – requer credenciais e possivelmente pagamento.
8. Jobdata API – Difícil/Comercial
Site comercial para empresas (ATS). Exemplo de endpoint /jobs permite filtros (título, local, remoto, datas) com API key; campos retornados incluem id, title, company, location, has_remote, published, description_md. A API não é gratuita e exige assinatura.
Dificuldade: Difícil – de uso comercial; não adequado para o PD.
9. Job board aggregators (Vagas Aggregator, Adzuna, OkJob) – Difícil/Média
O site Vagas Aggregator (apibr.com) exibe uma lista de vagas com filtros e datas, mas é carregado via JavaScript; scraping requer navegador headless e pode envolver anti‑bot
apibr.com
. Sem API oficial, a coleta é complexa.
Adzuna e OkJob: presentes na lista do publicapis.dev, mas ambos exigem API key e/ou termos de uso restritivos; as vagas são gerais (não focadas em júnior). A integração demandaria registro e implementação de autenticação.
Dificuldade: Difícil/Média – dependem de APIs pagas ou scraping pesado.
Status de implementação

Himalayas, Jobicy, RemoteOK e Remotive foram implementados como providers reais em `src/providers/` usando apenas APIs JSON publicas. Eles foram registrados em `realJobProviders` e tambem agrupados em `externalJobProviders` para permitir coleta manual separada pelo painel.

A implementacao atual:

- filtra publicacoes dos ultimos 30 dias;
- aceita somente sinais claros de nivel iniciante;
- rejeita senioridade alta/intermediaria;
- aceita apenas vagas remotas com localidade global ou compativel com Brasil/LATAM/Americas;
- preserva a URL original e `source` para atribuicao/linkback;
- salva somente por meio do runner central como `DRAFT`, sem IA e sem Discord.

Arbeitnow, Findwork, Jobdata API e agregadores que exigem chave, login, uso comercial ou scraping pesado nao foram implementados nesta rodada.

Conclusões e recomendações
Focus on easy/public APIs first – As melhores fontes para a fase atual são Himalayas API, Jobicy API, RemoteOK API e Remotive API, pois oferecem JSON ou RSS sem login. Elas já contêm campos úteis (título, empresa, descrição, localidade, data de publicação) e permitem filtrar ou pós‑processar para vagas júnior/estágio. A normalização, filtro de qualidade e deduplicação já existentes são reaproveitados pelo runner central.
Implement providers iteratively – A primeira implementação inclui os quatro providers externos, mas a qualidade deve ser monitorada pelo admin nos rascunhos criados. Ajustes futuros devem calibrar queries, filtros de localização e termos de senioridade com base nos resultados reais.
Dynamic site scraping deferred – Sites que exigem scraping pesado ou login (Findwork, Jobdata, Vagas Aggregator) devem ser postergados para fases futuras, pois demandam navegador headless, bypass de Cloudflare ou credenciais. O Programathor foi reavaliado depois deste mapeamento e entrou apenas como experimento manual por HTML publico simples, documentado em `docs/programathor-scraping-research.md`. A Remotar foi reavaliada depois deste mapeamento com Playwright MCP e entrou apenas como experimento manual por JSON publico, documentado em `docs/remotar-scraping-research.md`. Focar em APIs públicas e HTML publico simples reduzirá a manutenção e riscos de bloqueio.
Quality control essential – independentemente da fonte, manter filtros de senioridade, localização e novos critérios de qualidade (p. ex. eliminar vagas que exigem mais de 3 anos de experiência). As descrições podem ser longas, mas extrair shortDescription e stacks a partir de texto seguirá padrão já implementado.
Referências principais
Himalayas API – documentação do site explica endpoints, parâmetros e campos retornados, com opções de filtragem por seniores, país e mundo inteiro.
Jobicy remote jobs API – README do repositório descreve endpoint, parâmetros (count, geo, industry, tag) e campos retornados (jobTitle, companyName, jobGeo, jobLevel, jobDescription, salary etc.), além de mencionar as regras de uso e atraso de 6 horas.
RemoteOK API – sample JSON feed e termos de serviço exigem link‑back ao site.
Remotive API – README do repositório (raw GitHub) define endpoints, parâmetros e campos retornados e menciona a necessidade de atribuição a Remotive e limite de 4 chamadas diárias.
Arbeitnow API – documentação do site mostra campos típicos de resposta (title, company, location, description), mas não fornece detalhamento de filtros por nível.
Listas de APIs públicas – a lista publicapis.dev enumerou vários provedores de empregos, incluindo Jobicy, Arbeitnow e Adzuna, e informou se exigem API key.
