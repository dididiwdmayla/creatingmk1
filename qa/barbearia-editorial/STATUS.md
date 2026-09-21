# Barbearia Editorial — fechamento da validação

Data: 2026-09-21. Branch: `codex/barbearia-editorial-validacao`.
Base: `464b431ef5975b1252275442e58dca7dd837d1fc`.
A migração anterior já foi integrada pelos PRs #100 e #102. Este fechamento não faz merge.

## Resultado de desempenho

20/20 células aprovadas: quatro variantes × cinco modos de cor. Nenhuma célula foi desabilitada.
Menor mediana: Meia-noite × arco-íris, 52,4 FPS (piso: 45).

- Chromium 153.0.8010.0, viewport 390×844, DPR 2, CPU 4×, efeito `grao`, intensidade 3.
- Cinco cargas independentes por célula: 100 das variantes + 25 de referência sem efeito.
- CDP confirmou o throttle; a taxa foi reafirmada imediatamente antes de cada rolagem.
- Rolagem medida: 8.754–10.403 px por carga, 240–349 intervalos de frame contados. Nenhuma medição ociosa.
- [Tabela completa](FPS.md) e [leituras brutas](fps.json), incluindo frames, duração, scroll e cinco amostras por célula.
- O contador auxiliar LayerTree não retornou eventos de pintura. Seus zeros não são evidência de ausência de repintura e não participam do portão de FPS.
- Build e 166 testes de contrato aprovados na base atual. O código da skin, da rota de QA e do motor de efeitos não mudou entre a base da medição e a atualização para essa base; só o proxy ganhou uma exceção para `/api/fila/`, fora deste caminho.

## Ajustes deste fechamento

- Sombra das fotos usa o token de borda, evitando o halo claro que divergia da barra na Norte.
- Capturas esperam o nome completo e o término do cursor do typewriter.
- Medição de FPS conserva os dados de cada carga e comprova a rolagem; relatório explicita a ausência de eventos LayerTree.
- Captura do ritual da Vinho permite revisar as aspas no fluxo do texto.

## Contrato e origem preservados

- Mesmo contrato de nove seções e sete imagens, com conteúdo e alts editáveis nas quatro variantes; só hero é fixa.
- Vinho é `vinho`, com alias `oliva → vinho` na leitura e gravação canônica.
- `montarDemoData` continua o ponto único; identidade ausente não aparece.
- Creme e Vinho têm agendamento rápido imediatamente após hero. A reserva fica acessível antes da narrativa editorial.
- Os três laços enumeram skin × preset, incluindo todas as 36 combinações do registro. O teste de cobertura compara a lista com `SKINS`.

## Auditoria fora do escopo de correção

As outras sete skins nativas exibem endereço fictício sem dado do lead: `barbearia2-sul`, `tatuagem-editorial`, `tatuagem-pigmento-vivo`, `lancheria-chapa-burger`, `imobiliaria-curada`, `multimarcas-vortice` e `petshop-focinho-feliz`. Os endereços e a causa estão no ARCHITECTURE. Nenhuma dessas sete skins foi corrigida neste bloco.

## Revisão visual e portões

Concluída. As quatro folhas variante × modo de cor foram vistas, incluindo as fases dos modos animados. Textura de fibra na Norte, grade discreta na Meia-noite, papel claro na Creme e molduras bordô na Vinho permanecem legíveis com o efeito de grão.

- `barra`: sem divergências nas quatro variantes; na Norte o erro do primeiro platô caiu de 9 para 0, sem relaxar tolerância. Meta inicial, plano do body, rampa e modos fixos aprovados. Saída real em [portoes.log](portoes.log).
- `colapso`: 28 slots (7 × 4) com dimensões positivas.
- `avulsa`: topo e rodapé revistos em desktop/celular, identidade vazia/preenchida. Cidade e botão de rota somem quando faltam os dados; não há rótulo órfão no rodapé.
- `qa-barbearia`: 16 cenários (4 variantes × 2 larguras × JS ligado/desligado), todos aprovados. Um h1, nome completo dentro de hero, nove seções, endereço ausente e nenhum overflow. [Dados do navegador](contrato-browser.json).
- Heroes finais vistos em 390 e 1100 px. As quatro capturas sem JavaScript mostram “Barbearia Contrato Real”, com o header fixo fora do recorte.
- Ritual da Vinho revisto: aspas acompanham o texto nas três linhas, sem linhas isoladas.
- Miniaturas atualizadas a partir dessas capturas: [Norte](../../public/demos/barbearia/norte.jpg), [Meia-noite](../../public/demos/barbearia/meia-noite.jpg), [Creme](../../public/demos/barbearia/creme.jpg), [Vinho](../../public/demos/barbearia/vinho.jpg).

## Reprodução

Com Chromium compatível indicado em `QA_CHROMIUM`:

```sh
npm run build
npx vitest run src/lib/demos/__tests__/barbearia-contrato.test.tsx src/lib/demos/capturas/__tests__ src/components/demos/barbearia/interactive/__tests__
node scripts/qa-barbearia.mjs --sem-build
node scripts/qa-visual.mjs --so=colapso,barra,avulsa,variante --skin=barbearia-editorial --sem-build --marca=barbearia-final
node scripts/qa-visual.mjs --so=fps --skin=barbearia-editorial --sem-build --marca=barbearia-final
```

Executar FPS sozinho, sem build/testes/browser concorrentes. Não há bloqueio técnico remanescente identificado neste escopo; o merge permanece sujeito à aprovação do usuário.
