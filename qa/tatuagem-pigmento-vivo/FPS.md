# Portão de qualidade por CÉLULA (variante × modo de cor) — `tatuagem-pigmento-vivo`, efeito `grao`

A linha `nenhum` é a referência: a página sem efeito, na primeira variante (`aquarela`). Modo que reprova é desabilitado SOZINHO (ver `SkinVariante.modosDeCorReprovados`) — a variante inteira nunca é.

# Portão de qualidade dos efeitos — celular 390×844 (dpr 2), CPU 4×, intensidade 3, rolando a página inteira

Mediana de 5 cargas independentes por célula; rolagem contínua a 1800 px/s até o fim da página (teto de 9000ms). Veredito: **45 fps** em TODO modo de cor — e só isso reprova.

## fps (mediana) — DEPOIS da correção do item 6 (memo em ManifestoReveal)

| variante | tema | fixa | transicao | iridescente | arco-iris |
|---|---|---|---|---|---|
| `nenhum` | 16.4 | 16.0 | 16.3 | 16.3 | 16.6 |
| `aquarela` | **16.4 ✗** | **16.0 ✗** | **16.0 ✗** | **16.1 ✗** | **16.5 ✗** |
| `boreal` | **16.0 ✗** | **17.1 ✗** | **17.1 ✗** | **17.3 ✗** | **17.1 ✗** |
| `meia-noite` | **16.5 ✗** | **16.8 ✗** | **16.2 ✗** | **17.1 ✗** | **17.4 ✗** |
| `terra` | **16.9 ✗** | **16.6 ✗** | **16.5 ✗** | **16.8 ✗** | **16.4 ✗** |

## superfície repintada (Mpx/s, rolando)

| variante | tema | fixa | transicao | iridescente | arco-iris |
|---|---|---|---|---|---|
| `nenhum` | 17.3 | 18.1 | 18.2 | 17.7 | 17.2 |
| `aquarela` | 17.7 | 16.3 | 18.6 | 18.1 | 18.0 |
| `boreal` | 13.0 | 12.3 | 13.0 | 13.2 | 13.9 |
| `meia-noite` | 11.8 | 11.2 | 11.2 | 13.1 | 12.8 |
| `terra` | 13.9 | 13.7 | 14.7 | 15.0 | 12.3 |

A superfície repintada NÃO é mais alta que a de outras skins que passam no piso (ver calibração abaixo) — o gargalo não é "pinta demais", é o CUSTO POR PIXEL do que é pintado.

## veredito

**REPROVADO nas 20 células E na referência.** Por §14 do plano ("se a linha de referência cair abaixo de 45, não é problema de modo de cor — é custo da própria skin; a variante não sai com a referência reprovada"), `modosDeCorReprovados` NÃO é o remédio certo aqui: ele desliga um modo de cor quando as OUTRAS células/a referência passam; aqui nada passa. Nenhuma variante recebeu `modosDeCorReprovados` — ficaria mentindo que o problema é o modo de cor.

## Calibração — o ambiente alcança o piso (não é o sandbox)

Mesma máquina, mesmas flags (CPU 4×, SwiftShader), `multimarcas-vortice` — skin de mesmo porte (variantes, seções, portfólio de fotos):

| skin | referência (`nenhum`) | variantes (`tema`) |
|---|---|---|
| `multimarcas-vortice` | 45.2 fps | 40.4 – 44.7 fps (perto do piso) |
| `tatuagem-pigmento-vivo` | 16.4 fps | 16.0 – 16.9 fps |

O ambiente chega a 40-47 fps quando a página pede menos do renderizador — a diferença é real, não um teto do sandbox.

## Investigação — o que foi checado

1. **Componentes "sempre montados" (mesmo caminho de render nas quatro variantes):** `CustomCursor` (guardado por `pointer:fine`, nunca ativa no celular — não é o custo), `PigmentTracker` (`IntersectionObserver`, sem listener de scroll), `ScrollGallery` (cai pro scroll nativo em `pointer:coarse`, sem pin no celular), `LineDraw`/`SectionReveal`/`FadeUp` (todos `IntersectionObserver` + Web Animations API, sem estado React por quadro).
2. **`ManifestoReveal`** tinha um listener de `scroll` que reescrevia `style.color` de cada palavra a CADA quadro, pela vida inteira da página (não só perto do manifesto) — corrigido nesta sessão (memoiza `prog`/`lit`, só escreve quando o valor muda). Medido ANTES e DEPOIS da correção: **sem diferença mensurável** (16.3 → 16.4 fps na referência). Mantido — é uma correção real e sem risco, só não é a causa dominante.
3. **Trace do CDP (`Tracing.start`) durante a rolagem**: `UpdateLayoutTree`/`GPUTask`/`RasterTask`/`Layerize`/`Paint` aparecem, mas a soma ingênua por nome não separa trabalho de thread principal do de composição.
4. **CPU profile (`Profiler.start`, amostragem 0,2ms) durante a rolagem**: **72,1% do tempo de amostra é `(idle)`** na thread principal, 16,4% é `(program)` (GC/engine) — só ~11,5% é JavaScript de verdade, e nenhuma função de aplicação passa de 2,3% individualmente. **A thread de JavaScript não é o gargalo.** O custo está em pintura/composição (raster) fora da thread principal — onde um profile de CPU comum não enxerga.
5. **Imagens do portfólio**: 8 fotos WebP, 660KB no total, 900–1200px de lado — tamanho e peso razoáveis, não explicam a diferença.
6. **`mix-blend-mode`**: só 3 regras no CSS inteiro (`.d-blob`, `.d-estilo-card::before` — este último só ativa no hover, que não existe em toque/celular). Não é о fator dominante sozinho.

## Conclusão — reportado, NÃO corrigido

O custo é de RASTERIZAÇÃO/COMPOSIÇÃO (não de JavaScript), num renderizador por software (SwiftShader — sem GPU real neste ambiente de execução). Os suspeitos do §14 do plano que sobram depois da investigação (retícula da meia-noite, mesa com sombras da Terra, blobs com filtro/mistura) são cada um específico de UMA variante, mas a lentidão é UNIFORME nas quatro — o que sobra em comum é a composição de formas orgânicas com raio de borda irregular, sombra e gradiente/color-mix() usada nas ONZE seções de todas as composições (etiquetas, selos, bilhetes, fichas, talão, grifo, carta — ver `pigmento-superficies.test.ts`), não uma seção isolada.

Uma correção de verdade aqui é reduzir essa camada visual (menos formas orgânicas raster-pesadas, menos sombra, menos gradiente por seção) — e isso é recompor a composição das quatro variantes, que a sessão de portões e documentação não faz (docs/plano-tatuagem-pigmento-vivo.md, "Aqui NÃO se redesenha nada"). Reportado para decisão do Will: (a) aceitar o piso de 45 fps como não alcançável nesta linguagem visual e abrir item de redesenho numa sessão própria; ou (b) medir num dispositivo/CI com GPU real antes de decidir — o gargalo é de composição, que hardware real acelera e software não.
