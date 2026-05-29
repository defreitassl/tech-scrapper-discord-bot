# Visao de Produto

## Problema

Alunos iniciantes em tecnologia precisam encontrar vagas relevantes com pouco ruido, mas oportunidades boas costumam estar espalhadas entre sites, listas, redes sociais e paginas de empresas.

O projeto resolve parte desse problema centralizando cadastro, organizacao, revisao e publicacao de vagas em um canal do Discord da Projeto Desenvolve.

## Publico-alvo

- Alunos da Projeto Desenvolve.
- Pessoas iniciantes em tecnologia procurando estagio, junior ou oportunidades de entrada.
- Equipe ou voluntarios que revisam e publicam vagas no Discord.

## Fluxo atual

1. Uma vaga e cadastrada no painel admin.
2. No cadastro manual, a vaga entra como `PENDING` por padrao. Quando `useAi` esta ativo e nao ha `readyText`, a mensagem com IA sera gerada somente no envio.
3. Se a IA falhar no envio, o publisher usa fallback deterministico e nao bloqueia a publicacao.
4. Um administrador revisa os detalhes e o preview da mensagem.
5. O admin pode enviar a vaga especifica pela pagina de detalhes, enviar vagas `PENDING` em lote ou deixar para o envio agendado.
6. O admin tambem pode executar a coleta manual unificada pelo botao `Coletar vagas`, que roda GitHub, APIs externas, Remotar, Gupy, Programathor, Solides e ATS publicos, excluindo qualquer fonte mock/teste. Vagas boas entram direto como `PENDING` sem chamar IA; vagas ruins ou duplicadas nao sao persistidas.
7. `DRAFT` foi aposentado do fluxo principal. O enum continua no Prisma e rascunhos antigos podem aparecer como `Rascunhos legados`, mas novas coletas nao criam esse status.
8. A coleta automatica configuravel pelo painel roda 1x ou 2x por semana, preenche uma fila `PENDING` alvo baseada em `min(max(dailyLimit * 7, dailyLimit), 30)`, sem descontar vagas `SENT` hoje. `LOW` nunca e aprovada; `MEDIUM` exige estagio, trainee, remoto ou `priorityScore >= 75`.
9. O envio manual em lote busca ate 5 vagas `PENDING`.
10. Opcionalmente, o envio agendado configurado no painel tambem pode publicar vagas `PENDING`, respeitando o limite diario configurado. O admin escolhe de 1 a 10 vagas por dia e um horario para cada vaga; o timezone do sistema e `America/Sao_Paulo`.
11. Para cada vaga, o sistema resolve a mensagem usando esta prioridade:
   - `readyText`, quando preenchido.
   - `aiGeneratedText`, quando ja existe e e considerado valido.
   - IA no momento do envio, quando `useAi` esta habilitado.
   - fallback deterministico, quando nao ha texto pronto ou a IA falha.
12. A mensagem e enviada ao canal configurado no Discord.
13. A vaga enviada e marcada como `SENT`; falhas viram `ERROR`.

## Escopo atual

- Cadastro manual de vagas.
- Listagem, detalhe e edicao de vagas no painel admin.
- Controle de status das vagas.
- Geracao de mensagem com IA no momento do envio quando aplicavel.
- Envio manual de uma vaga especifica pela pagina de detalhes.
- Envio manual de vagas `PENDING` para Discord.
- Envio agendado de vagas `PENDING`, configurado no painel admin.
- Providers reais e experimentais com coleta manual unificada, aprovando vagas elegiveis como `PENDING` e recusando as demais sem persistir.
- Provider GitHub para coletar issues abertas e recentes de repositorios brasileiros de vagas, filtrando labels de junior/estagio/trainee, localizacao, qualidade e duplicidade antes de aprovar como `PENDING`.
- Providers externos Himalayas, Jobicy, RemoteOK e Remotive usando APIs publicas JSON, com filtro conservador de data, nivel e localidade remota.
- Providers Remotar, Gupy, Programathor e Solides incluidos na coleta automatica configuravel por fontes publicas validadas e baixo volume.
- Prioridade persistida para vagas coletadas, com badge, score e motivos no painel admin.
- Acao manual para processar rascunhos legados, quando existirem.
- Pipeline automatizado para colocar vagas `HIGH` e `MEDIUM` elegiveis na fila durante a coleta, sem chamar Gemini e sem enviar ao Discord.
- Coleta automatica configuravel no painel em `/admin/settings/collection`, com ativacao, frequencia semanal, dias e horario.
- Classificacao deterministica de dominio em `TECH`, `POSSIBLY_TECH` e `NON_TECH`, rejeitando vagas fora de tecnologia antes de salvar no banco.
- Geracao opcional de mensagem com Google AI Studio/Gemini.
- Persistencia em PostgreSQL via Prisma.
- Fallback deterministico para mensagem quando IA nao e usada ou falha.

## Fora de escopo por enquanto

- Scraping HTML real de vagas.
- Scraping com navegador, Cheerio ou Playwright em fluxo automatico ou sem avaliacao especifica.
- Autenticacao no painel admin.
- Fila de publicacao avancada.
- Moderacao multiusuario.
- Integracao com LinkedIn ou plataformas protegidas. Gupy, Programathor, Remotar e Solides usam apenas acesso publico validado e baixa frequencia.
- Publicacao direta no Discord sem passar por `PENDING` e pelo scheduler.
