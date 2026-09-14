# Barbearia Editorial — validação em andamento

Migração autorizada; **merge não autorizado**. Branch: `codex/barbearia-editorial-variantes`.

## Implementado e publicado

- Origem: conteúdo e sete imagens em slots, alts editáveis, endereço fictício removido somente desta skin, hero legível no HTML sem JavaScript.
- Variantes: Norte, Meia-noite, Creme e Vinho; alias legado `oliva → vinho`; composição tipada, mesma árvore de render e mesmo contrato.
- Creme e Vinho: agendamento rápido imediatamente após hero.
- Cobertura: os três laços `colapso`, `barra` e `avulsa` passam skin e preset; enumeração de 36 combinações, verificação contra o registro.
- Auditoria das oito skins e dos sete endereços fictícios: ver ARCHITECTURE. As outras sete skins não foram corrigidas.
- Ajustes de revisão: aspas do ritual permanecem no fluxo inline; preferência de movimento via assinatura externa; relatório diferencia largura da viewport da largura do título.
- Contrato SSR ampliado: comparação de todos os slots renderizados nas quatro variantes, com identidade preenchida/ausente.

## Evidência observada antes da indisponibilidade

- Build de produção das variantes concluído; 253 testes de contrato passaram nessa etapa.
- Testes das listas: 2 arquivos, 3 testes aprovados.
- Contrato SSR ampliado e SectionReveal: 2 arquivos, 17 testes aprovados.
- Quatro heroes sem JavaScript foram capturados em 390 e 1100 px com “Barbearia Contrato Real”; composição das quatro páginas revisada.
- As folhas da matriz de Norte e Meia-noite foram vistas; o laço das demais estava em execução. Não há veredito final do conjunto de laços.

## Pendências obrigatórias

O ambiente ficou `unavailable` durante a revisão; não há acesso ao terminal nem aos arquivos locais nesta retomada. Os ajustes foram preservados pelo conector GitHub. Isso não equivale a uma nova execução de build/QA.

1. Recuperar o checkout e comparar alterações locais antes de sincronizar esta branch: há cópias locais dos ajustes publicados pelo conector.
2. Build e lint do estado final.
3. Rodar `node scripts/qa-barbearia.mjs --sem-build` sem restringir IDs, preservando o relatório completo das quatro variantes.
4. Rodar `node scripts/qa-visual.mjs --so=colapso,barra,avulsa,variante --skin=barbearia-editorial --sem-build --marca=barbearia-final`; olhar as quatro folhas e as bandas com identidade ausente/preenchida.
5. Rodar `node scripts/qa-visual.mjs --so=fps --skin=barbearia-editorial --sem-build --marca=barbearia-final`, sem outra carga concorrente: cinco modos, cinco cargas por célula, celular 390×844, DPR 2, CPU 4×, intensidade 3, rolagem ativa. Piso: 45 fps.
6. Reprovação desabilita apenas a célula variante × modo, nunca a variante inteira. Nenhuma reprovação foi declarada ou cadastrada sem medição.
7. Corrigir problemas restantes, publicar evidências e entregar as quatro capturas da âncora hero com o nome do negócio. Nenhum merge até aprovação explícita.
