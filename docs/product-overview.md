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
2. No cadastro manual, a vaga entra como `PENDING` por padrao e o sistema tenta gerar `aiGeneratedText` automaticamente com IA quando `useAi` esta ativo e nao ha `readyText`.
3. Se a IA falhar, a vaga continua pronta para envio e o preview usa o template padrao.
4. Um administrador revisa os detalhes e o preview da mensagem.
5. O admin pode enviar a vaga especifica pela pagina de detalhes, enviar vagas `PENDING` em lote ou deixar para o envio agendado.
6. O admin tambem pode executar uma coleta de teste/mock, uma coleta GitHub, uma coleta de fontes externas por APIs publicas ou coletas manuais especificas como Remotar, Gupy e Programathor. Todas criam vagas como `DRAFT` quando passam pelos filtros de data, nivel, localizacao, qualidade e duplicidade. Vagas coletadas recebem prioridade persistida para apoiar a revisao humana.
7. Para vagas coletadas como `DRAFT`, o admin pode usar `Preparar e colocar na fila`, que gera mensagem com IA, salva `aiGeneratedText`, marca `useAi = true` e muda a vaga para `PENDING` sem enviar ao Discord.
8. O envio manual em lote busca ate 5 vagas `PENDING`.
9. Opcionalmente, o envio agendado configurado no painel tambem pode publicar vagas `PENDING`, respeitando o limite diario configurado. O admin escolhe de 1 a 10 vagas por dia e um horario para cada vaga; o timezone do sistema e `America/Sao_Paulo`.
10. Para cada vaga, o sistema resolve a mensagem usando esta prioridade:
   - `readyText`, quando preenchido.
   - `aiGeneratedText`, quando ja existe e e considerado valido.
   - IA, quando `useAi` esta habilitado.
   - template padrao, quando nao ha texto pronto ou a IA falha.
11. A mensagem e enviada ao canal configurado no Discord.
12. A vaga enviada e marcada como `SENT`; falhas viram `ERROR`.

## Escopo atual

- Cadastro manual de vagas.
- Listagem, detalhe e edicao de vagas no painel admin.
- Controle de status das vagas.
- Geracao automatica de mensagem com IA no cadastro manual quando aplicavel.
- Envio manual de uma vaga especifica pela pagina de detalhes.
- Envio manual de vagas `PENDING` para Discord.
- Envio agendado de vagas `PENDING`, configurado no painel admin.
- Base inicial de providers com coleta mock/de teste, salvando vagas como `DRAFT`.
- Provider GitHub para coletar issues abertas e recentes de repositorios brasileiros de vagas, filtrando labels de junior/estagio/trainee, localizacao, qualidade e duplicidade antes de salvar como `DRAFT`.
- Providers externos Himalayas, Jobicy, RemoteOK e Remotive usando APIs publicas JSON, com filtro conservador de data, nivel e localidade remota.
- Provider Remotar usando JSON publico, incluido na coleta automatica diaria por melhor volume e aderencia operacional, mantendo revisao humana obrigatoria.
- Prioridade persistida para vagas coletadas, com badge, score e motivos no painel admin.
- Acao manual para preparar rascunhos coletados com IA e coloca-los como `PENDING` depois de revisao.
- Geracao opcional de mensagem com Google AI Studio/Gemini.
- Persistencia em PostgreSQL via Prisma.
- Template padrao para mensagem quando IA nao e usada ou falha.

## Fora de escopo por enquanto

- Scraping HTML real de vagas.
- Scraping com navegador, Cheerio ou Playwright em fluxo automatico ou sem avaliacao especifica.
- Autenticacao no painel admin.
- Fila de publicacao avancada.
- Moderacao multiusuario.
- Integracao automatica com LinkedIn, Gupy, Solides ou plataformas protegidas. A Gupy existe apenas como coleta experimental manual por endpoint publico validado; Remotar usa endpoint publico validado e baixa frequencia.
- Publicacao automatica sem revisao humana.
