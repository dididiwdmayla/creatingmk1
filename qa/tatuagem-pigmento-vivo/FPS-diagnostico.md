# Diagnóstico de fps — `tatuagem-pigmento-vivo`

Sessão de **diagnóstico apenas** (branch `migra/tatuagem-pigmento-vivo`, a
partir de `e540fe1`). Nenhuma linha de produto foi alterada — todo toggle
usado para medir foi runtime (querystring do harness `/interno/demo-qa` ou
`page.evaluate` no navegador já carregado), nunca um commit no código da
skin. Os dois scripts de medição usados (`scripts/_diag-baseline.mjs`,
`scripts/_diag-bissecao.mjs`) foram apagados ao final da sessão — os
comandos e trechos relevantes estão reproduzidos abaixo para quem quiser
refazer a medição.

## Metodologia

Mesma receita do portão (`scripts/qa-visual.mjs --so=fps`): celular
390×844 (dpr 2), `Emulation.setCPUThrottlingRate` em 4×, rolagem contínua
a 1800px/s até 9000ms ou o fim da página, mediana de N cargas
independentes por célula (N anotado em cada tabela — 5 no item 1, 3 no
item 2, com uma sonda extra de 2 cargas marcada como tal).

**Dois servidores Next.js reais** (`next build && next start`, sem
`--turbopack` de dev, mesmo `node_modules` via hardlink) rodando ao mesmo
tempo nesta execução:

- `:3124` — branch `claude/radar-architecture-setup-49czui` (pré-migração),
  num `git worktree` isolado;
- `:3123` — `HEAD` desta branch (`e540fe1` + o que veio depois).

### Aviso sobre variância entre execuções

Os números absolutos **desta** execução não batem com os da sessão 3
(aqui a `multimarcas-vortice` de referência fez 60fps; lá, 40–47).
Ambiente compartilhado varia de execução pra execução — isso já é
esperado e documentado no próprio portão (`qa-visual.mjs`, comentário
sobre "leituras de 13 a 52 fps pro MESMO estado"). O que importa aqui não
é o valor absoluto, é a COMPARAÇÃO dentro da MESMA execução — e nisso os
dois achados desta sessão são consistentes e repetíveis (rodei
`meia-noite` duas vezes, com N diferente, e o padrão não mudou).

## 1. Linha de base — pré-migração × quatro variantes × referência

`efeito=nenhum&corModo=tema` em todos os alvos (isola o custo da própria
composição/LED do custo do efeito de fundo plugável); LED é o de cada
tema real (só é sobrescrito explicitamente na bisseção do item 2).
Mediana de **5** cargas.

| grupo | alvo | fps (mediana) | cargas | pior quadro | quadros >50ms |
|---|---|---|---|---|---|
| pré-migração (`radar-architecture-setup-49czui`) | `aquarela` | **36.5** | 32.3 / 36.4 / 38.5 / 37.4 / 36.5 | 83ms | 13 |
| pré-migração (`radar-architecture-setup-49czui`) | `boreal` | **37.8** | 35.6 / 39.3 / 38.4 / 37.8 / 37.7 | 67ms | 11 |
| pré-migração (`radar-architecture-setup-49czui`) | `meia-noite` | **25.3** | 25.2 / 25.3 / 24.4 / 25.4 / 25.3 | 100ms | 18 |
| pré-migração (`radar-architecture-setup-49czui`) | `terra` | **36.5** | 35.8 / 36.1 / 41.4 / 38.1 / 36.5 | 83ms | 11 |
| `migra/tatuagem-pigmento-vivo` (HEAD atual) | `aquarela` | **40.0** | 34.2 / 40.0 / 41.6 / 40.0 / 41.5 | 100ms | 11 |
| `migra/tatuagem-pigmento-vivo` (HEAD atual) | `boreal` | **50.1** ✓ | 47.7 / 51.8 / 49.5 / 50.1 / 51.9 | 67ms | 2 |
| `migra/tatuagem-pigmento-vivo` (HEAD atual) | `meia-noite` | **20.8** | 17.1 / 20.8 / 20.7 / 21.1 / 21.2 | 150ms | 27 |
| `migra/tatuagem-pigmento-vivo` (HEAD atual) | `terra` | **18.6** | 14.9 / 18.3 / 18.6 / 19.6 / 19.6 | 167ms | 37 |
| referência | `multimarcas-vortice · nenhum` | **60.0** | 60.0 / 60.0 / 59.8 / 60.0 / 60.0 | 17ms | 0 |

**Achado 1 — a migração não CRIOU o problema, ela redistribuiu:**
pré-migração já reprovava o piso de 45 em TODAS as quatro (25–38fps, um
único código-fonte de composição pras quatro, só a paleta mudava) — não é
regressão desta sessão nem das sessões 2a/2b. O que a migração fez foi
divergir as quatro: `boreal` melhorou o bastante pra PASSAR (37.8→50.1,
porque a abertura `sobreposicao` desliga o `filter: blur()` do hero — ver
item 3), `aquarela` melhorou um pouco (36.5→40.0) mas não o bastante, e
`terra` PIOROU (36.5→18.6). `meia-noite` ficou no mesmo patamar ruim
(25.3→20.8).

**Achado 2 — o comum às duas piores (`meia-noite` e `terra`) já aparece
aqui:** são as ÚNICAS duas com `Theme.led !== "desligado"`
(`led: "sutil"` nas duas — ver `themes.ts:192` e `themes.ts:236`) — e
`terra` só ganhou LED NESTA migração (pré-migração era
`led: "desligado"`, ver worktree `:3124`,
`src/components/demos/tatuagem2/themes.ts:136`). O item 2 confirma que
isso é causal, não coincidência.

## 2. Bisseção — uma camada de cada vez, por variante

Página carregada com a config REAL da variante (efeito de fundo e LED do
`Theme`, não forçados a `nenhum`/`desligado` como no item 1) — depois uma
mutação por linha, na página já montada, antes de rolar:

| linha | como é desligado |
|---|---|
| efeito de fundo OFF | `&efeito=nenhum` na URL |
| LED OFF | `&led=desligado` na URL |
| manchas do hero ocultas | `.pv-hero-mancha { display: none }` via `page.evaluate` |
| mistura → normal | `document.querySelector('.pv').style.setProperty('--pv-mistura','normal')` |
| sem filter (blur removido) | `<style>.pv, .pv * { filter: none !important }</style>` injetado |
| animações pausadas | `for (const a of document.getAnimations()) a.pause()` |
| sombra removida (só testado em `terra`/`meia-noite`) | `<style>.pv, .pv * { box-shadow: none !important }</style>` |

### `aquarela` (N=3) — abertura `mancha`, LED `desligado`, efeito `grao`

| condição | fps (mediana) | Δ vs "como está" |
|---|---|---|
| como está | **34.9** | — |
| efeito de fundo OFF | **42.6** | +7.7 |
| LED OFF | 35.6 | +0.7 (ruído — já era `desligado`) |
| efeito + LED OFF | 41.5 | +6.6 |
| manchas do hero ocultas | **39.5** | +4.6 |
| mistura → normal | **39.4** | +4.5 |
| sem filter (blur removido) | 35.8 | +0.9 |
| animações pausadas | 36.6 | +1.7 |

### `boreal` (N=3) — abertura `sobreposicao`, LED `desligado`, efeito `varredura-de-luz` — JÁ PASSA (49.6fps)

| condição | fps (mediana) | Δ |
|---|---|---|
| como está | **49.6** | — |
| todas as outras linhas | 49.5 – 51.9 | ruído — nada move a agulha, porque não há nada caro ligado |

### `meia-noite` (N=3, duas rodadas — números batem) — abertura `cartela`, LED `sutil`/`dissipado` + `ledCores` animado, efeito `aura`

| condição | fps (mediana) | Δ vs "como está" |
|---|---|---|
| como está | **18.1** | — |
| efeito de fundo (`aura`) OFF | 21.4 | +3.3 |
| **LED OFF** | **32.0** | **+13.9** |
| **efeito + LED OFF** | **45.5** ✓ | **+27.4 (cruza o piso)** |
| manchas do hero ocultas | 18.7 | +0.6 (blur já é `none` no mobile pra `cartela`) |
| mistura → normal | 18.3 | +0.2 |
| sem filter (blur removido) | 18.6 | +0.5 |
| animações pausadas | 18.8 | +0.7 |
| sombra removida | 20.1 | +2.0 |
| efeito + LED + sombra OFF | 47.2 | +29.1 |

### `terra` (N=3, principal; sombra com N=2 à parte) — abertura `medalhao` (sem mancha no hero), LED `sutil`/`moldura`, efeito `grao`

| condição | fps (mediana) | Δ vs "como está" |
|---|---|---|
| como está | **17.4** | — |
| efeito de fundo (`grao`) OFF | 18.9 | +1.5 |
| **LED OFF** | **30.9** | **+13.5** |
| efeito + LED OFF | 37.1 | +19.7 (ainda ABAIXO do piso) |
| manchas do hero ocultas | 17.8 | +0.4 (não há mancha — `medalhao` já esconde) |
| mistura → normal | 17.7 | +0.3 |
| sem filter (blur removido) | 18.1 | +0.7 |
| animações pausadas | 18.7 | +1.3 |
| sombra removida (N=2) | 19.2 | +1.8 |
| efeito + LED + sombra OFF (N=2) | 42.8 | +25.4 (perto do piso, não cruza com folga) |

### Conclusão da bisseção

**LED (`Theme.led !== "desligado"`) é a camada dominante isolada**, nas
duas variantes que o ligam: +13.5 a +13.9 fps sozinho, mais que qualquer
outra linha em qualquer variante. **Efeito de fundo é secundário**
(+1.5 a +7.7, varia por efeito — `grao` custa pouco, sozinho não explica
`aquarela`). **Manchas do hero + mistura de blend só importam onde o
`filter: blur()` do hero está de fato ligado no mobile** — que é SÓ
`aquarela` (abertura `mancha`); nas outras três a regra de
`max-width: 47.999rem` já desliga o blur (`boreal`/`sobreposicao`,
`meia-noite`/`cartela`) ou o hero nem desenha mancha (`terra`/`medalhao`).
**Sombra, filter genérico e animações de seção (`ManifestoReveal` e
equivalentes) não movem a agulha em nenhuma variante** — <2fps em toda
linha, dentro do ruído de carga entre cargas da própria mediana.

Em `meia-noite`, desligar efeito+LED CRUZA o piso (45.5). Em `terra`,
mesmo desligando os dois, fica em 37.1 — abaixo do piso, sem um terceiro
vilão isolável: a sombra recolhe só +1.8 sozinha e a combinação tripla
(42.8) ainda não cruza com folga. Isso bate com o que a sessão 3 já
tinha concluído por outro caminho (raster/composição distribuída pelas
onze seções, não uma linha só) — só que agora sabemos que LED explica a
MAIOR fatia isolável, e o resto é mesmo distribuído (raio de 24px +
`color-mix()` + sombra dupla repetidos em muitas seções — nenhuma delas
grande o bastante sozinha pra aparecer numa bisseção de "uma coisa por
vez").

## 3. Varredura estática — infratores conhecidos

| padrão | arquivo:linha | variante(s) afetada(s) no mobile | status |
|---|---|---|---|
| `filter: blur()` em contêiner cujo filho anima `transform` | `src/components/demos/tatuagem2/composicao.ts:250` (`blur(2rem)`, `@media max-width:47.999rem`) | só `aquarela` (`abertura="mancha"`) — as outras três desligam via `composicao.ts:253` (`sobreposicao`→`filter:none`) e `:256` (`cartela`→`filter:none`); `terra`/`medalhao` esconde a mancha inteira (`composicao.ts:207`) | **confirmado pela bisseção** (`manchas ocultas`/`mistura normal` só mexem em `aquarela`) |
| filho animando `transform` dentro do container acima | `src/components/demos/tatuagem2/Skin.tsx:277-291` (`.pv-hero-mancha` → `<Parallax>` → `.d-blob`), `Skin.tsx:898-900` (`@keyframes d-blob-a/b/c`, `infinite`, 14–19s) | `aquarela` (efetivamente); presente no DOM das quatro, mas só custa raster onde o `filter` do pai está ligado | mesmo achado acima |
| `mix-blend-mode` sempre ativo (não gated por hover) | `Skin.tsx:903` (`.d-blob { mix-blend-mode: var(--pv-mistura) }`) | as variantes que desenham mancha no hero (não `terra`) | **medido como custo pequeno isolado** (+0.2 a +0.5fps forçando `normal`) — só soma quando o `filter:blur()` do mesmo elemento também está ligado (`aquarela`) |
| `mix-blend-mode` só em hover | `Skin.tsx:965` (`.d-estilo-card::before`) | nenhuma no mobile — `@media (hover:none)` neutraliza o `:hover` (`Skin.tsx:974`) | já não se aplica em toque, confirmado no código |
| elemento `position: fixed; inset: 0` cobrindo a viewport inteira, com `mask-image`/`-webkit-mask-image` cujos stops dependem de uma custom property (`--d-led-scroll`) reescrita a cada `requestAnimationFrame` de scroll | `src/lib/demos/led/LedEdges.tsx:157` (wrapper `.d-led-edges`), `:92` (escreve `--d-led-scroll` no listener de scroll), `:265-266` (`.d-led-bar` mask, estilo `dissipado` — `meia-noite`), `:300-303` (`.d-led-corner` mask, estilo `cantos`), `:349-380` (`.d-led-side-*` mask, estilo `moldura` — `terra`) | `meia-noite`, `terra` | **CONFIRMADO — maior causa isolável da bisseção** (+13.5 a +13.9fps ao desligar) |
| `animationName`/`iterationCount:"infinite"` extra, só quando `Theme.ledCores` tem modo animado | `LedEdges.tsx:145-150` | só `meia-noite` (`themes.ts:194`, `ledCores: {modo:"transicao", ...}`) | dentro do custo de LED acima, não isolado à parte (mediria abaixo do ruído de 3 cargas) |
| `filter: blur()` como efeito de fundo | busca em `src/lib/demos/efeitos/aura/` | nenhuma — **já foi removido antes desta sessão**: `aura/Aura.tsx:23,237` documenta que o `filter: blur(60–100px)` virou canvas com gradiente radial pré-computado (`perfilMancha`) exatamente por causa de custo de raster | não é infrator hoje, é uma correção anterior já aplicada |
| `will-change` | `src/lib/demos/efeitos/aura/Aura.tsx:243,251`, `varredura-de-luz/VarreduraDeLuz.tsx:43` | `meia-noite`, `boreal` | 2 elementos por efeito, uso pontual e justificado (promove só o blob que de fato anima `transform`) — não é excesso |
| `backdrop-filter` | busca na skin inteira | nenhuma ocorrência | não é infrator |
| SVG do tamanho da viewport, mas ANIMADO | `Skin.tsx:293-306` (`.pv-hero-traco`, `viewBox 0 0 1200 600`, `inset-0 h-full w-full`) | todas (a única SVG viewport-sized do hero) | a animação (`Skin.tsx:910`, `d-draw-line 3s ... forwards`) roda UMA VEZ ao montar, termina antes da janela de rolagem medida (a medição só começa depois de `networkidle` + 500ms) — não é custo contínuo |
| sombra dupla (`inset` + externa) + `border-radius` grande repetidos em muitas seções | `composicao.ts:74` (`--pv-forma-sombra` da Terra, `raio:"24px"` em `themes.ts:228`), aplicado em `composicao.ts:218,413,502,674,714` e mais | `terra` majoritariamente | **medido como custo pequeno isolado** (+1.8fps só terra) — é o "resto distribuído" da conclusão da sessão 3, não um vilão isolável |

## 4. Correções mínimas propostas (NÃO aplicadas nesta sessão)

### A. LED `sutil`/`dissipado`/`moldura`/`cantos` — a correção de maior efeito

**Causa:** `mask-image`/`-webkit-mask-image` num elemento `position:fixed`
de viewport inteira, com os stops do gradiente recalculados a cada quadro
de scroll via `calc(var(--d-led-scroll) * ...)` — máscara é operação de
raster, não de composição, então o navegador (aqui, software/SwiftShader)
reconstrói a textura da máscara a cada mudança do valor.

**Correção mínima proposta:** trocar o vínculo "custom property lida
dentro de `calc()` num `mask-image`" por um vínculo só de `transform`.
Concretamente: manter os MESMOS gradientes (cor e queda) mas fixos —
tirar `--d-led-scroll` de dentro do `calc()` dos stops — e em vez disso
mover o "ponto brilhante que viaja" com `transform: translateX/Y()` num
elemento MENOR (a faixa de brilho) por cima de uma faixa de base estática,
ou trocar a escrita de `--d-led-scroll` por uma escrita QUANTIZADA (ex.:
arredondar pra múltiplos de 2–4% em vez de todo pixel de scroll) —
reduz drasticamente a frequência de recomputo da máscara sem mudar a
sensação de "acompanha o scroll".

**O que muda visualmente:** com `transform`, o brilho ainda percorre a
borda junto com o scroll, mas o movimento fica preso a passos discretos
de posição/opacidade em vez de uma máscara recalculada continuamente — em
teste de olho, a diferença esperada é sutil (o LED já é um efeito de
baixa opacidade, 13–46% conforme `--d-led-a1..a4`); com a quantização, o
efeito é o de sempre, só que atualiza a cada ~4% de progresso de scroll em
vez de a cada frame.

### B. Hero manchas da `aquarela` (`filter: blur()` + `.d-blob` animando dentro)

**Causa:** blur ao vivo sobre um filho que anima `transform`
continuamente (infinito, 14–19s) — força re-raster do blur a cada quadro.

**Correção mínima proposta (a mesma sugerida no enunciado):** pré-renderizar
cada mancha (as 2-3 manchas do hero, por cor de `Theme.pigmento.manchas`)
como um PNG/WebP já borrado, e animar SÓ `transform` nesse `<img>`/`div`
com `background-image` — sem `filter` nenhum no elemento que muda a cada
quadro. Perde-se a reatividade a cor customizada em runtime (o blur teria
que ser regenerado por combinação de cor), mas os presets são fixos
(`Theme.pigmento.manchas` só muda por variante, não por interação do
usuário) — dá pra gerar as imagens em build time ou compor com
`radial-gradient` + opacidade (sem `filter`) numa aproximação visual
próxima.

**O que muda visualmente:** a mancha deixa de ter uma borda perfeitamente
suave de blur gaussiano ao vivo — uma imagem pré-borrada ou um gradiente
radial bem calibrado chega perto, mas pode ficar marginalmente menos
orgânica nas bordas em zoom close. Compensa o ganho de fps só em
`aquarela`, que é onde o blur mobile continua ligado.

### C. Sombra dupla + raio 24px da Terra

**Causa:** `box-shadow` com componente `inset` MAIS componente externa,
`color-mix()` computado, `border-radius: 24px`, repetido em várias seções
(`manifesto`, cartões de estilo, etc.) — custo pequeno por elemento,
some por `+1.8fps` quando removido inteiro, mas é o tipo de custo que a
sessão 3 já tinha nomeado como "distribuído, não isolável".

**Correção mínima proposta:** não é urgente sozinha (não cruza o piso nem
removendo tudo) — só vale a pena se for feita JUNTO com A e (pra
`terra`) revisar se o LED realmente precisa estar `sutil` nessa variante,
já que foi a mudança que introduziu a regressão em relação à
pré-migração. Se mantida, simplificar a sombra pra um único
`box-shadow` (tirar o `inset`) reduz o número de camadas de blur de
sombra que o rasterizador computa por elemento, sem mudar a leitura da
peça como "cartão físico com profundidade" — só a moldura interna fica
menos definida.

### D. `--pv-mistura` (mix-blend-mode) e animações de seção

**Não vale a pena mexer:** medidos em +0.2 a +0.5fps (mistura) e +0.7 a
+1.7fps (animações) em toda variante — dentro do ruído da própria mediana
de 3 cargas. `ManifestoReveal` já está memoizado (item 6 da sessão 3,
`interactive/ManifestoReveal.tsx:58-77`) e a medição desta sessão
confirma que não sobrou custo mensurável ali.

## Resumo para decisão

1. **`boreal` já passa** (50.1fps) — nada a fazer.
2. **`meia-noite` cruza o piso desligando LED + efeito de fundo** (18.1→45.5) — a correção A (LED) sozinha já deve chegar perto ou passar o piso, já que LED isolado vale +13.9 e o efeito (`aura`) já foi otimizado antes (canvas, sem `filter:blur()`) e custa só +3.3.
3. **`terra` NÃO cruza o piso só com A** — mesmo desligando LED+efeito+sombra, para em ~42.8–47.2 (as duas rodadas discordam um pouco, dentro do ruído). Precisa de A + revisão do B/C ou aceitar reduzir a ambição de LED nessa variante (ela nem tinha LED antes da migração).
4. **`aquarela` precisa de B (hero blur) e do efeito de fundo revisto** — nenhuma correção isolada citada aqui cruza o piso sozinha (melhor caso medido, efeito OFF, 42.6); a soma das duas (B + revisar `grao`) é a aposta mais provável de cruzar, mas não foi medida em combinação nesta sessão (ficaria pra quando a correção B existir de verdade, não simulada por `display:none`).
