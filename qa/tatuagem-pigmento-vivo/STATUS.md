# `tatuagem-pigmento-vivo` — fechamento dos portões (sessão 3)

Migração de quatro presets para quatro VARIANTES (`aquarela`/`boreal`/
`meia-noite`/`terra`). Resultados brutos, limitações da instrumentação e
o que cada portão cobre. Sessão 3 do plano (docs/plano-tatuagem-
pigmento-vivo.md, Bloco C) — portões, contraste, fps, cinza e documentação;
nenhuma seção foi recomposta.

## Auditoria de cópia (item 1)

Varredura das quatro cópias de exemplo (`exemplos.ts`) por frase que
afirma algo verificável sobre o negócio (especialidade, estilo
exclusivo, anos, equipe, prêmios, nota, clientes, certificações).

**Removido:** `secoes.artistas.titulo` da Meia-noite dizia "Três mãos,
três estilos de jogo." — afirmava tamanho de equipe (mesmo padrão do
"Três mãos, três assinaturas" do §17 D10 do plano). Reescrito para
"Escolha seu estilo de jogo.".

Nada mais encontrado: os nomes dos artistas fictícios (Cora Vidal,
Bento Aoki, Íris Weiss) ficam — são conteúdo de exemplo substituível, não
fato sobre o negócio do lead (mesmo critério da multimarcas). Notas
dentro de depoimento (`★★★★★`) ficam, por regra fechada.

## Trava do contrato + mutação (itens 2, 27, 28)

`pigmento-contrato.test.tsx` (novo): as quatro variantes emitem os onze
`data-d-secao` e os mesmos `data-demo-slot`, sem duplicata, no HTML do
servidor sem JavaScript; wrapper `.pv` com os `data-pv-*` da composição
declarada; `<style>` com regra para cada valor; drasticidade (abertura/
portfolio/investimento/processo distintos nas quatro); separação de
`TatuagemComposicao` na seção análoga; SSR sempre visível; nome fantasma
da Boreal `aria-hidden`, nunca `<h1>`; lead vazio sem literal de
template.

`violacoesDeVariantes()` (`composicao.ts`) — função pura, permanente:
zero violações nas variantes reais; duas mutações sintéticas (boreal
regredida ao preset antigo sem `pigmento`; boreal com a composição da
aquarela e paleta própria) reprovam nomeando `"boreal"`.

**Mutação manual, revertida, não commitada:**
1. Removido "manifesto" do arranjo da aquarela em `variantes.ts` →
   `npx vitest run variantes.test` falhou: `arranjo de "aquarela" é uma
   PERMUTAÇÃO do contrato` — array com 10 ids em vez de 11.
2. Removido `Theme.pigmento` da Boreal em `themes.ts` (preset de antes
   da migração) → `pigmento-contrato.test.tsx` falhou (10 testes,
   cascata do `.pigmento` undefined) e a suíte permanente de mutação
   detectou: `"aquarela" empata com "boreal" nos quatro knobs de
   silhueta (abertura=mancha, portfolio=trilha, investimento=gotas,
   processo=onda)`.

Ambas revertidas antes do commit.

## `<h1>` (item 3)

Já coberto por `pigmento-h1.test.tsx` (sessão anterior) e reconfirmado
aqui: exatamente um `<h1>` por variante, sempre `data.nome`, com espaço
entre palavras. O nome fantasma decorativo da Boreal
(`.pv-hero-fantasma`, visível só com `abertura="sobreposicao"`) já
nasce `<span aria-hidden="true">`, nunca `<h1>` — verificado em
`pigmento-contrato.test.tsx` e em `qa-pigmento.mjs` (navegador real).

## Contraste sobre as superfícies finais (itens 4, 30)

`pigmento-superficies.test.ts` (novo) mede alfa composto sobre o fundo
REAL das composições — não a paleta em isolado (isso já estava coberto
em `pigmento-paletas.test.ts`, sessão de fundação). Texto normal ≥4,5:1,
texto grande (manifesto, ≥28px) ≥3:1.

| superfície | variante | pior par medido | limiar |
|---|---|---|---|
| bilhete (depoimentos) | aquarela | texto 12,7–13,2 · suave 5,76–5,97 · estrelas(tinta) 5,08–5,33 | 4,5:1 |
| ficha (faq) | boreal | texto 14,1 · suave 6,6 | 4,5:1 |
| talão (agendar) | boreal | campoTexto branco/fundo 6,5–7,3 | 3:1 (texto grande) |
| selo (investimento) | terra | tinta/fundo 4,97–5,35 | 4,5:1 |
| grifo (manifesto, palavra acesa) | boreal | normal 11,1 · destacada 3,9–5,0 | 3:1 (texto grande) |
| carta (manifesto, linha pautada) | terra | normal 9,5 · destacada 4,0–4,4 | 3:1 (texto grande) |

Três superfícies do enunciado não precisaram de número novo (já cobertas
pelo par texto/fundo genérico — ver comentário no topo de
`pigmento-superficies.test.ts`): `cartela` (abertura da Meia-noite — as
manchas ficam confinadas aos 52svh do topo, sem overlap de pixel com o
`<h1>`), o "brilho screen" do manifesto da Meia-noite (é `text-shadow`
com `currentColor`, um halo pra FORA do texto, nunca um fundo por
baixo) e `postal` (Terra — título já usa `color: var(--d-text)` sobre
`--d-bg-elev`, o mesmo par já medido).

## Portão de cinza (itens 5, 10, 31)

`node scripts/qa-pigmento.mjs --so=cinza` — página inteira no celular
(390px, DPR 1), escala de cinza, folha lado a lado. Salva em
`docs/qa/pigmento-cinza-folha-v1.png`.

**Bug descoberto e corrigido:** a `tatuagem-pigmento-vivo` é a primeira
skin do repo alta o bastante (~11.300–14.900px no celular) pra cruzar o
teto de textura do SwiftShader (renderização por software) —
`page.screenshot({ fullPage: true })` saía com um pedaço da página
(hero+manifesto) REPETIDO no meio do portfólio. Trocado por captura em
ladrilhos do tamanho do viewport, compostos por `<canvas>` no navegador
— em `qa-pigmento.mjs` e na função homônima já existente em
`qa-visual.mjs` (`capturarPigmentoPagina`), que tinha o mesmo defeito.

| par | diferença média em cinza | alturas |
|---|---|---|
| `boreal` × `terra` | 40,08 | 11.319 / 12.538px |
| `aquarela` × `terra` | 41,74 | 14.930 / 12.538px |
| `aquarela` × `boreal` | 43,06 | 14.930 / 11.319px |
| `meia-noite` × `terra` | 167,31 | 11.647 / 12.538px |
| `boreal` × `meia-noite` | 174,55 | 11.319 / 11.647px |
| `aquarela` × `meia-noite` | 175,89 | 14.930 / 11.647px |

**Julgamento (inspeção nominal, §10):** os três pares claros ficam
abaixo da referência de 48,7 da multimarcas — **olhados duas vezes**.
Recortada e aberta em ladrilhos de 390×2489px (não só a folha reduzida):
a trilha em zigue-zague da Aquarela, a vitrine (1 foto grande + 7
miniaturas) da Boreal e a mesa de polaroides sobrepostas da Terra têm
silhuetas claramente diferentes mesmo sem cor — nenhuma dupla ficou
indistinguível. Meia-noite (escura) se distingue das três por
luminância (167–176). **As quatro aprovam** — nenhuma volta pra sessão
2.

## Matriz de fps (itens 6, 33)

`node scripts/qa-visual.mjs --so=fps --skin=tatuagem-pigmento-vivo`.
Tabela completa em [FPS.md](FPS.md).

**Reprovado — reportado, não corrigido.** As 20 células E a referência
(efeito `nenhum`) ficam em ~16-17fps contra o piso de 45. Calibrado
contra `multimarcas-vortice` nas mesmas condições (CPU 4×, SwiftShader):
40-47fps — o ambiente alcança o piso, a diferença é real, não é do
sandbox. `modosDeCorReprovados` NÃO é o remédio certo (a referência
também reprova).

Uma correção real (achada e aplicada, sem mudar o veredito): o listener
de scroll do `ManifestoReveal` reescrevia o estilo de cada palavra a
cada quadro pela vida inteira da página, mesmo já saturado em 0 ou 1 —
memoizado. Medido antes/depois: sem diferença mensurável (16,3 → 16,4
fps) — mantido por ser uma correção real e sem risco, mas não é a causa
dominante.

Investigado e descartado como causa: componentes "sempre montados"
(`CustomCursor` guardado por `pointer:fine`, `PigmentTracker` via
`IntersectionObserver`, `ScrollGallery` cai pro scroll nativo em
`pointer:coarse`), peso das imagens do portfólio (660KB total, 8 fotos
900-1200px), `mix-blend-mode` (só 3 regras no CSS, uma só ativa no
hover). Um CPU profile por amostragem durante a rolagem mostrou 72% do
tempo IDLE na thread principal — o gargalo é rasterização/composição
(SwiftShader, sem GPU real neste ambiente), não JavaScript. Decisão
pendente do Will: aceitar o piso como não alcançável nesta linguagem
visual (formas orgânicas + sombra + gradiente nas onze seções) e abrir
sessão de redesenho, ou remedir num ambiente com GPU real antes de
decidir.

## CLS e troca de fonte (item 7)

`node scripts/qa-pigmento.mjs --so=cls` — contexto novo por variante
(cache frio por construção + `Network.setCacheDisabled`), Slow 4G
(RTT 150ms, 1,6Mbps down / 750kbps up, números do Lighthouse).

| variante | CLS | carregou | fontes prontas | nome deslocou ao trocar fonte |
|---|---|---|---|---|
| `aquarela` | 0,0013 | 3.088ms | 3.113ms | não |
| `boreal` | 0,0553 | 6.157ms | 4.537ms | não |
| `meia-noite` | 0,0149 | 3.645ms | 1.693ms | não |
| `terra` | 0,0067 | 3.009ms | 2.964ms | sim (deslocamento ínfimo, dentro do CLS de 0,0067) |

**As quatro passam o piso de 0,1.** Nenhuma precisa do pré-carregamento
extra de fonte (o remédio do item 7 só se aplica quando desloca de
forma visível ou estoura o piso — nenhum dos dois aconteceu).

## LCP (item 8)

Medido via `PerformanceObserver({type: "largest-contentful-paint"})`
real no navegador, nas quatro variantes (viewport celular 390×844,
`efeito=nenhum`, sem lead avulso — o caminho normal do exemplo):

| variante | elemento LCP | slot |
|---|---|---|
| `aquarela` | `<p class="pv-hero-texto">` | `secoes.hero.texto` |
| `boreal` | `<h1 class="pv-hero-nome">` | `nome` |
| `meia-noite` | `<h1 class="pv-hero-nome">` | `nome` |
| `terra` | `<h1 class="pv-hero-nome">` | `nome` |

**Nenhuma imagem é o elemento LCP em nenhuma variante** — a essência da
skin é a abertura sem foto (§1/§8-A do plano: hero nunca teve slot de
imagem), e cada abertura ocupa 88-100svh (`.pv-hero { min-height }`),
então nenhuma foto do portfólio entra na primeira tela, nem na `boreal`
(portfólio é a 2ª seção, mas o hero sozinho já cobre 88svh). A "imagem
acima da dobra" que o item 8 presumia não existe em nenhuma das quatro
— verificado com a API real do navegador, não por inspeção visual.
Nenhuma alteração de `priority`/`loading` foi feita: adicionar
prioridade a `portfolio-1` não mudaria o LCP de nenhuma variante (ele já
é texto) e gastaria banda cedo demais num recurso que o usuário só vê
depois de rolar. O aviso anterior ("portfolio-1.webp sem
loading=eager") descrevia um cenário que a composição atual das quatro
variantes não reproduz.

## Slots do portfólio e aviso na aba Imagens (item 9)

`node scripts/qa-pigmento.mjs --so=slots` — os 8 slots
(`portfolio-1`..`portfolio-8`), com JavaScript DESLIGADO, medidos nas
quatro variantes × 2 telas (390px e 1100px): **64 medições, 0
não-desenhadas.** `imagensOcultas` está vazio nas quatro — provado por
medição de caixa real no navegador, não só ausência no código-fonte
(§11 do plano).

**Aviso novo na aba Imagens** (`PainelImagens`, `paineis.tsx`): o
portfólio aceita até 30 itens (`validate.ts`), mas só há foto pros 8
primeiros — a peça sem slot já saía só com a legenda (`Skin.tsx`,
`temSlot`, de uma sessão anterior), mas sem aviso nenhum no editor. Com
mais de 8 itens, a aba agora mostra "O portfólio tem N itens e 8 fotos;
do 9º item em diante, a peça aparece só com a legenda, sem foto." — não
depende da variante aberta (a contagem é a mesma nas quatro), por isso
não é `imagensOcultas`. Coberto em
`pigmento-portfolio-aviso.test.tsx` (4 testes: sem aviso com 8 ou menos
itens, contagem certa com mais, mesma frase nas quatro variantes).
