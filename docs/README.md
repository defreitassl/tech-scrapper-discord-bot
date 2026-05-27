# Documentacao do Projeto

Esta pasta concentra a documentacao de produto, arquitetura e evolucao do `tech-scrapper-discord-bot`.

O objetivo e ajudar proximos agentes e mantenedores a entenderem rapidamente o contexto atual, as decisoes ja tomadas e os caminhos recomendados para evoluir o projeto sem quebrar regras existentes.

## Indice

- [product-overview.md](./product-overview.md): visao de produto, problema resolvido, publico-alvo, fluxo atual e limites de escopo.
- [architecture.md](./architecture.md): stack, modulos principais e responsabilidades do painel admin, banco, Discord e IA.
- [job-sources-strategy.md](./job-sources-strategy.md): estrategia para fontes de vagas e porque o projeto nao deve depender apenas de scraping.
- [providers-contract.md](./providers-contract.md): contrato para providers de coleta de vagas, incluindo GitHub, APIs externas, Remotar, Gupy, Programathor, ATS publicos e o pipeline automatizado que aprova como `PENDING` sem Gemini ou recusa sem persistir.
- [scraping-guidelines.md](./scraping-guidelines.md): boas praticas e limites para scraping responsavel.
- [linkedin-scraping-research.md](./linkedin-scraping-research.md): reconhecimento tecnico do LinkedIn com Playwright e decisao de nao implementar scraping.
- [solides-scraping-research.md](./solides-scraping-research.md): reconhecimento tecnico da Solides com Playwright MCP e decisao de provider automatico por JSON publico.
- [roadmap.md](./roadmap.md): plano incremental de evolucao do projeto.
- [codex-handoff.md](./codex-handoff.md): resumo rapido para proximos agentes Codex.
