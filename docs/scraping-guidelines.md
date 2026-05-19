# Boas Praticas de Scraping

Scraping deve ser tratado como ultimo recurso quando nao houver cadastro manual, RSS, API ou pagina publica simples com estrutura estavel.

## Principios

- Prefira fontes publicas simples.
- Respeite rate limits.
- Evite scraping agressivo.
- Registre a fonte e a URL original.
- Preserve o texto bruto quando fizer sentido.
- Mantenha logs suficientes para diagnosticar falhas.
- Evite publicar automaticamente sem revisao na fase inicial.

## O que evitar

- Login automatizado sem autorizacao clara.
- Circunvencao de captcha, bloqueios ou paywalls.
- Rotacao agressiva de IP ou user agents.
- Coleta em alta frequencia.
- Raspar plataformas que proíbem automacao nos termos de uso.
- Publicar dados sem URL de origem.

## Rate limit e frequencia

Cada provider deve ter intervalo conservador entre requisicoes. Para primeiras versoes, prefira execucao manual ou agendada com baixa frequencia.

Quando houver muitas fontes, usar fila ou controle central de rate limit.

O provider GitHub atual nao faz scraping HTML; ele usa a API oficial do GitHub e aceita `GITHUB_TOKEN` opcional para aumentar o rate limit. Sem token, a coleta continua manual, mas deve ser usada com ainda mais parcimonia por causa do limite anonimo menor.

## Tratamento de falhas

Scrapers quebram. O sistema deve tolerar:

- pagina fora do ar;
- layout alterado;
- resposta vazia;
- timeout;
- bloqueio temporario;
- dados incompletos.

Falhas de coleta nao devem afetar o painel admin nem a publicacao manual de vagas ja cadastradas.

## Revisao antes de publicar

Na fase inicial, vagas coletadas automaticamente devem ser criadas como `DRAFT`.

O fluxo recomendado e:

1. Coletar.
2. Normalizar.
3. Deduplicar.
4. Salvar como `DRAFT`.
5. Revisar no painel.
6. Marcar como `PENDING`.
7. Publicar manualmente.
