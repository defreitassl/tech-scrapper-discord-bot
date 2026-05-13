# AGENTS.md

Este arquivo orienta agentes de IA/Codex que forem trabalhar neste repositório.

## Visão geral do projeto

Este projeto é o `tech-scrapper-discord-bot`, um bot/painel para cadastrar, organizar, gerar mensagens e publicar vagas de tecnologia para iniciantes no Discord da Projeto Desenvolve.

O objetivo principal é ajudar alunos iniciantes a encontrarem oportunidades de estágio, trainee, júnior e primeiro emprego em tecnologia, além de movimentar o servidor Discord da escola.

## Stack atual

- Node.js
- TypeScript
- Express
- Prisma
- PostgreSQL
- Discord.js
- Google AI Studio/Gemini
- HTML/CSS renderizado pelo próprio painel admin em Express

## Documentação obrigatória

Antes de alterar código, leia a pasta `docs/`, especialmente:

- `docs/README.md`
- `docs/product-overview.md`
- `docs/architecture.md`
- `docs/job-sources-strategy.md`
- `docs/providers-contract.md`
- `docs/scraping-guidelines.md`
- `docs/roadmap.md`
- `docs/codex-handoff.md`

Se alguma alteração mudar escopo, arquitetura, fluxo, regras de negócio, providers, scraping, agendamento, deploy, banco ou integrações, atualize também a documentação correspondente.

Sempre que criar uma funcionalidade relevante, revise se `docs/codex-handoff.md` precisa ser atualizado para ajudar próximos agentes.

## Regras de negócio atuais

O projeto trabalha com vagas cadastradas/coletadas e publicadas no Discord.

Status principais:

- `DRAFT`: vaga cadastrada/coletada, mas ainda não pronta para envio.
- `PENDING`: vaga aprovada/pronta para publicação.
- `SENT`: vaga já enviada ao Discord.
- `ERROR`: houve erro ao publicar.
- `ARCHIVED`: vaga arquivada e não deve ser enviada.

A publicação de vagas pendentes deve respeitar a regra de mensagem:

1. Se `readyText` existir, usar `readyText`.
2. Senão, se `aiGeneratedText` existir e for válido, reutilizar `aiGeneratedText`.
3. Senão, se `useAi = true`, gerar mensagem com IA, salvar em `aiGeneratedText` e enviar.
4. Senão, usar template padrão.

A publicação atual busca até 5 vagas `PENDING` por execução.

## Regras para IA/Gemini

A IA deve:

- gerar mensagens curtas, úteis e humanas;
- manter identidade da Projeto Desenvolve;
- chamar alunos ocasionalmente de PDevs;
- resumir a seção "Sobre a vaga";
- não copiar o texto bruto inteiro;
- não inventar salário, tecnologias, benefícios, empresa, modalidade ou requisitos;
- omitir campos vazios;
- manter a mensagem pronta para Discord.

## Estratégia de coleta de vagas

Não trate o projeto como dependente apenas de web scraping.

A arquitetura deve suportar múltiplos tipos de fonte:

- cadastro manual;
- RSS;
- APIs públicas ou semi-públicas;
- GitHub/listas públicas;
- páginas públicas simples;
- scraping leve com `fetch`/`cheerio`;
- Playwright apenas em último caso.

Evite começar por LinkedIn ou plataformas que exigem login, têm proteção anti-bot forte ou mudam HTML com frequência.

Na fase inicial, vagas coletadas automaticamente devem ser salvas como `DRAFT` ou equivalente para revisão humana, não publicadas automaticamente sem curadoria.

## Princípios de implementação

- Prefira alterações pequenas, testáveis e incrementais.
- Não faça refatorações grandes sem necessidade.
- Não altere regras de negócio sem deixar claro.
- Preserve a simplicidade da V1.
- Priorize funcionamento real sobre arquitetura excessiva.
- Mantenha código TypeScript simples e legível.
- Use nomes claros para arquivos, funções e serviços.
- Não exponha tokens, chaves ou segredos.
- Atualize `.env.example` quando criar novas variáveis de ambiente.
- Atualize o README ou docs quando mudar comandos, setup ou fluxo de uso.

## Comandos úteis

Use os comandos existentes do projeto:

```bash
npm install
npm run build
npm run admin
npm start
npm run prisma:generate
npm run prisma:migrate
npm run prisma:studio
```

Sempre rode `npm run build` após alterações de código TypeScript.

Se alterar Prisma:

1. Atualize `prisma/schema.prisma`.
2. Crie/aplique migration.
3. Atualize docs se houver mudança de modelo de dados.
4. Rode `npm run prisma:generate` se necessário.
5. Rode `npm run build`.

## Restrições importantes

- Não implemente scraping agressivo.
- Não tente burlar login, captcha, bloqueios ou paywalls.
- Não publique vaga coletada automaticamente sem revisão humana enquanto essa regra não for alterada explicitamente.
- Não adicione frameworks grandes sem justificativa.
- Não migre para React/Next/Tailwind sem decisão explícita.
- Não remova o fluxo manual, pois ele é parte central da V1.

## Como responder ao final de uma tarefa

Ao terminar, informe:

1. Arquivos criados/alterados.
2. Regras de negócio afetadas.
3. Documentação atualizada, se aplicável.
4. Comandos executados e resultado.
5. Como testar a mudança.

Se nenhuma documentação precisou ser alterada, diga explicitamente o motivo.
