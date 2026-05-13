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
6. O envio manual em lote busca ate 5 vagas `PENDING`.
7. Opcionalmente, o envio agendado configurado no painel tambem pode publicar vagas `PENDING`, respeitando o limite diario configurado.
8. Para cada vaga, o sistema resolve a mensagem usando esta prioridade:
   - `readyText`, quando preenchido.
   - `aiGeneratedText`, quando ja existe e e considerado valido.
   - IA, quando `useAi` esta habilitado.
   - template padrao, quando nao ha texto pronto ou a IA falha.
9. A mensagem e enviada ao canal configurado no Discord.
10. A vaga enviada e marcada como `SENT`; falhas viram `ERROR`.

## Escopo atual

- Cadastro manual de vagas.
- Listagem, detalhe e edicao de vagas no painel admin.
- Controle de status das vagas.
- Geracao automatica de mensagem com IA no cadastro manual quando aplicavel.
- Envio manual de uma vaga especifica pela pagina de detalhes.
- Envio manual de vagas `PENDING` para Discord.
- Envio agendado de vagas `PENDING`, configurado no painel admin.
- Geracao opcional de mensagem com Google AI Studio/Gemini.
- Persistencia em PostgreSQL via Prisma.
- Template padrao para mensagem quando IA nao e usada ou falha.

## Fora de escopo por enquanto

- Scraping automatico de vagas.
- Agendamento de coletas.
- Autenticacao no painel admin.
- Fila de publicacao avancada.
- Moderacao multiusuario.
- Integracao com LinkedIn, Gupy, Solides ou plataformas protegidas.
- Publicacao automatica sem revisao humana.
