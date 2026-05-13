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
2. A vaga fica com status inicial, normalmente `DRAFT`.
3. Um administrador revisa os campos principais e o texto.
4. A vaga pode ser marcada como `PENDING` quando esta pronta para envio.
5. O envio manual busca ate 5 vagas `PENDING`.
6. Para cada vaga, o sistema resolve a mensagem usando esta prioridade:
   - `readyText`, quando preenchido.
   - `aiGeneratedText`, quando ja existe e e considerado valido.
   - IA, quando `useAi` esta habilitado.
   - template padrao, quando nao ha texto pronto ou a IA falha.
7. A mensagem e enviada ao canal configurado no Discord.
8. A vaga enviada e marcada como `SENT`; falhas viram `ERROR`.

## Escopo atual

- Cadastro manual de vagas.
- Listagem, detalhe e edicao de vagas no painel admin.
- Controle de status das vagas.
- Envio manual de vagas `PENDING` para Discord.
- Geracao opcional de mensagem com Google AI Studio/Gemini.
- Persistencia em PostgreSQL via Prisma.
- Template padrao para mensagem quando IA nao e usada ou falha.

## Fora de escopo por enquanto

- Scraping automatico de vagas.
- Agendamento de coletas ou publicacoes.
- Autenticacao no painel admin.
- Fila de publicacao avancada.
- Moderacao multiusuario.
- Integracao com LinkedIn, Gupy, Solides ou plataformas protegidas.
- Publicacao automatica sem revisao humana.

