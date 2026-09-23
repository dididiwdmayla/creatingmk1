# `multimarcas-vortice` — fechamento da validação (2026-09-23)

Migração de quatro presets para quatro VARIANTES (`vortice`/`patio`/
`garagem`/`campo`). Resultados brutos, limitações da instrumentação e o
que cada portão cobre.

## Portão de fps — variante × modo de cor (20 células)

`node scripts/qa-visual.mjs --so=fps --skin=multimarcas-vortice`

Celular 390×844 (dpr 2), CPU 4×, efeito `grao` em intensidade 3, rolagem
contínua a 1800 px/s, mediana de 5 cargas independentes por célula.
Veredito: piso de **45 fps**, e só ele reprova.

**20/20 aprovadas. Nenhum modo desabilitado.** Menor mediana: **53,0 fps**
(`campo` × `fixa`) — 8 fps acima do piso.

| variante | tema | fixa | transicao | iridescente | arco-iris |
|---|---|---|---|---|---|
| `nenhum` (referência) | 59,4 | 59,1 | 58,3 | 58,9 | 59,6 |
| `vortice` | 58,1 | 59,1 | 58,1 | 58,9 | 57,9 |
| `patio` | 56,9 | 57,4 | 57,4 | 56,9 | 56,6 |
| `garagem` | 59,0 | 58,9 | 57,9 | 57,7 | 58,5 |
| `campo` | 55,7 | 53,0 | 54,5 | 54,2 | 53,7 |

Superfície repintada (Mpx/s, rolando): entre 41,0 e 78,7 — **todas abaixo
do limiar de marcação** (+40 Mpx/s sobre a referência sem efeito, ~53,3).
A `campo` repinta mais que as outras três (75–79) porque a abertura
`dividida` mantém a foto emoldurada visível o tempo todo ao lado do
texto, enquanto vortice/patio não desenham foto na abertura e a garagem a
esconde atrás de véu; ainda assim, 21–26 Mpx/s de distância do limiar.

Como nenhuma célula reprovou, `modosDeCorReprovados` fica **vazio nas
quatro variantes**. Tabela completa em [FPS.md](FPS.md).

## Portão de drasticidade — as quatro em cinza

`node scripts/qa-multimarcas.mjs`

Página inteira no celular, convertida para escala de cinza, lado a lado.
**As quatro passam**: sem cor, cada coluna é um site diferente.

| variante | altura da página | abertura | estoque | avaliação/troca |
|---|---|---|---|---|
| `vortice` | 10.371px | tipográfica, diagonal, velocímetro selo | grade 3 colunas | faixa no acento + marquee |
| `patio` | 7.207px | busca por faixa de preço, velocímetro pequeno | lista densa, parcela em destaque | tarja com CTA |
| `garagem` | 10.237px | foto sangrada, véu, velocímetro grande | vitrine, um carro por linha | linha discreta + marquee lenta |
| `campo` | 8.142px | dividida: texto + foto emoldurada | tabela com colunas ano/km/câmbio | formulário de troca em cartão |

Diferença média em cinza nas três primeiras telas (região correspondente
nas quatro):

| par | diferença |
|---|---|
| `vortice` × `patio` | 48,7 |
| `garagem` × `campo` | 56,9 |
| `vortice` × `garagem` | 158,8 |
| `vortice` × `campo` | 160,7 |
| `patio` × `garagem` | 179,1 |
| `patio` × `campo` | 181,8 |

O par mais próximo (`vortice`/`patio`) é as duas variantes de fundo
CLARO — esperado, já que a métrica mede luminância antes de composição.
**O número dá escala, não veredito** — quem julga é quem olha a folha
(`qa-shots/multimarcas/_folha-cinza.png`): abertura tipográfica × busca
com faixas de preço, grade × lista × vitrine × tabela, CTA pílula × CTA
duplo, não se confundem mesmo nas duas claras.

Duas folhas, e o motivo: uma página de 390×10.371 não cabe ao lado de
outras três num tamanho que se enxergue. A de ABERTURA mostra três telas
em tamanho de leitura; a de SILHUETA mostra a página inteira das quatro
no mesmo fator, para apertar os olhos.

## Contrato no navegador, sem JavaScript

390 e 1100px, `javaScriptEnabled: false`, nas quatro variantes:

- um `<h1>` só, dentro da âncora `hero`, com o nome do negócio INTEIRO,
  caixa NÃO-ZERO **e VISÍVEL** (opacidade/visibility/display computados —
  não só a caixa, ver "defeito 3" abaixo);
- as nove seções, sem duplicata, sem transbordo horizontal;
- caixa de cada um dos onze slots de imagem: **zero** para `hero` em
  `vortice`/`patio` (declarado em `imagensOcultas`), **maior que zero**
  para os outros nove — as duas direções reprovam.

**A prova do §6.1 — a linha de apoio, visível de verdade.** Com
`secoes.hero.titulo` salvo (`titulo=` na query do harness), o `<h1>`
continua sendo o nome inteiro e a linha de apoio aparece LOGO ABAIXO,
com caixa não-zero e estilo computado visível, nas quatro variantes:

| variante | caixa | visível | texto |
|---|---|---|---|
| `vortice` | 342×51 | sim | "Seminovos com garantia de fábrica" |
| `patio` | 342×51 | sim | "Seminovos com garantia de fábrica" |
| `garagem` | 342×51 | sim | "Seminovos com garantia de fábrica" |
| `campo` | 305×25 | sim | "Seminovos com garantia de fábrica" |

**Aferidor de caixa zerada — §7 (identidade sem bloco/barra oco):** com
`avulsa=1` sem `identidade=cheia` (zero campo de identidade, o estado
normal do harness/avulsa/lead recém-criado), `.mm-dados` — o mesmo
componente de escada usado na barra de identidade do Pátio (abertura) e
no bloco "onde fica o pátio" do Campo (contato) — mede `null` nas
QUATRO variantes, não só nas duas que a desenham quando há dado.

| variante | `.mm-dados` |
|---|---|
| `vortice` | `null` |
| `patio` | `null` |
| `garagem` | `null` |
| `campo` | `null` |

**Defeito 3 do §1, verificado ao vivo:** `vortice` (a única variante que
nasce com a intro LIGADA) com JavaScript DESLIGADO — o estado em que o
robô de prospecção fotografa. Preloader AUSENTE do documento servido,
"GIRI" ausente, e os nove preços do estoque saem já formatados, nenhum
zerado: `R$ 39.900,00 · R$ 49.900,00 · R$ 89.900,00 · R$ 79.900,00 ·
R$ 69.900,00 · R$ 59.900,00 · R$ 119.900,00 · R$ 99.900,00 ·
R$ 149.900,00`. Captura em `qa-shots/multimarcas/intro-vortice.png`.

Dados do navegador completos em [contrato-browser.json](contrato-browser.json).

## Item 23 — a exceção `SKINS_COM_PRECO_ANIMADO` caiu

O preço do carro saía em dois nós (símbolo estático + `StatCounter` só
com o número, sem centavos) — nunca a string contígua que
`formatarPrecoServico` devolve. `CarCard.tsx` passou a animar o preço
JÁ FORMATADO inteiro (símbolo, milhar e centavos inclusos, no mesmo
formato de moeda que as outras sete skins); `StatCounter` só embrulha
prefixo/sufixo num `<span>` quando `corDestaque` é passado (o caso dos
contadores de "Números"), senão sai como texto solto — contíguo com o
número no HTML do servidor. `precos-locale.test.tsx` roda a multimarcas
pelo MESMO caminho das outras sete skins, sem exceção — a lista de
exceção cai a zero entradas (item 23 do plano, sem a lista sobreviver
como comentário morto).

## `qa-cls.mjs --so=skins` — CSS de composição sai do servidor

**CLS 0,0011** para `multimarcas-vortice` — bem abaixo do piso de 0,1
("sem deslocamento" na prática, não zero cravado: um resíduo
sub-perceptível do SVG do velocímetro assentando). Confirma que
`multimarcas/composicao.ts` (emitido em `<style>` dentro do próprio
componente, servido no HTML) decide ordem e colunas ANTES da pintura,
não depois dela.

A mesma rodada reprovou `barbearia-editorial` (CLS 0,1463) —
pré-existente, fora do escopo desta migração; nenhum arquivo da
barbearia foi tocado nela.

## Matriz de imagem, colapso, barra e demo avulsa

`node scripts/qa-visual.mjs --so=variante,colapso,barra,avulsa --skin=multimarcas-vortice`

Rodada fechada — capturas abertas e olhadas uma a uma (regra 5 do
ARCHITECTURE.md) antes deste veredito.

- **`colapso`**: **42/42 slots de imagem OK**, zero problema, nas quatro
  variantes (`vortice`/`patio` 10 cada — sem `hero`, declarado em
  `imagensOcultas` — `garagem`/`campo` 11 cada).
- **`barra`**: três das quatro variantes (`vortice`, `patio`, `campo`)
  saem com **zero divergência** entre o `theme-color` reportado e o
  pixel amostrado, nos platôs onde a cor não muda. A `garagem` acusa
  UMA: no platô y=8160 (a faixa `avaliacao` — "linha discreta +
  marquee lenta"), a barra lê `#111113` (o fundo da seção) e o pixel
  amostrado na borda esquerda mede `rgb(242,240,236)` (erro 225).
  **Investigado e confirmado**: é o `marquee` de marcas (`Porsche · BMW
  · Audi …`) — um trilho DUPLICADO para rolagem contínua sem costura —
  cujo texto branco em negrito cruza a coluna x=3 amostrada em ambas as
  bordas simultaneamente (o marquee é full-bleed, texto igual nas duas
  pontas por desenho), o que engana a checagem "bordas concordam ⇒ não
  é conteúdo de margem" (`medirBarra`, `qa-visual.mjs`) — ela foi
  desenhada pra filtrar decoração ASSIMÉTRICA (a `flutuante-bacon` da
  chapa burger), não um trilho que se repete nas duas pontas por
  desenho. Não é desalinhamento de `theme-color`: o fundo real da
  seção é escuro nas quatro medições vizinhas, e o HTML servido bate
  `#0E0E0F`/`--d-bg` em todas as variantes, sem exceção. Pré-existente
  na CATEGORIA de achado (mesma classe do `flutuante-bacon` da chapa
  burger), puramente uma limitação da amostragem de UM pixel por borda
  contra um elemento animado que varre a tela inteira, e nunca reprova
  sozinho: `medirBarra` só reporta, nunca lança. Decisão: documentar
  aqui, não tocar no marquee (a marca "cruza a tela inteira, sem
  costura" é o desenho pedido pelo §6 do plano) nem no script de
  medição por um achado cosmético de instrumentação, sem produto
  quebrado por trás.
- **`variante`**: as quatro folhas (`_folha-variante-{vortice,patio,
  garagem,campo}-item28.png`) foram olhadas — sem efeito, tema/fixa/
  transição/iridescente/arco-íris, todas as fases. Nenhuma corrupção
  visual, nenhum texto cortado, nenhum grão vazando fora da página;
  cores e composição batem com a tabela de drasticidade acima em cada
  variante.
- **`avulsa`**: as quatro folhas (celular × topo/rodapé) foram olhadas —
  em-branco vs. preenchida lado a lado nas quatro variantes. A regra do
  §7 se confirma visualmente: nenhuma variante mostra bloco/barra de
  identidade fantasma em branco; cada uma ganha exatamente o CTA de
  WhatsApp secundário (e, no Pátio, a escada inteira) só quando a
  identidade está preenchida.

## §2 — contraste das quatro paletas, refeito (item 20)

`textoSuave` composto sobre fundo/alt/elevado/chip; todo acento como
texto medido contra as três superfícies; `ink` inteiro sobre o acento —
as regras que reprovaram três dos quatro presets antigos (ver §2 do
plano). Nenhum par abaixo de **4,5:1** em texto de leitura, nas quatro:

| par (onde aparece) | vortice | patio | garagem | campo |
|---|---|---|---|---|
| texto/fundo | 15,58 | 16,27 | 16,95 | 16,18 |
| texto/alt | 14,11 | 14,38 | 15,72 | 14,83 |
| texto/elevado | 16,41 | 17,96 | 14,26 | 13,31 |
| suave/fundo | 5,79 | 6,80 | 8,11 | 7,91 |
| suave/alt | 5,51 | 6,40 | 7,80 | 7,44 |
| suave/elevado | 5,91 | 7,13 | 7,26 | 6,91 |
| suave/chip | 5,76 | 6,92 | 6,90 | 6,53 |
| destaque/fundo | 5,66 | 7,88 | 9,35 | 7,81 |
| destaque/alt | 5,12 | 6,96 | 8,67 | 7,16 |
| destaque/elevado | 5,96 | 8,70 | 7,87 | 6,43 |
| ink/destaque | 5,96 | 8,70 | 9,35 | 7,81 |

O pior caso é `destaque/alt` na `vortice`, a **5,12:1** — ainda 0,62
acima do piso. Medição refeita com a mesma fórmula WCAG de
`lib/demos/contraste.ts` e a mistura linear `fg·α + bg·(1−α)` por canal
que o teste de contrato usa (`multimarcas-contrato.test.tsx`, item 20).

## Limitações da instrumentação

1. **fps medido com swiftshader**, não com GPU real: os números servem
   para comparar células entre si nesta máquina, que é o que o portão
   faz, e não para prever fps de um aparelho específico.
2. **A diferença em cinza do portão de drasticidade é escala, não
   veredito** — ela não sabe distinguir "composição diferente" de
   "luminância diferente por acaso"; é por isso que a folha é olhada,
   não só medida.
3. **`medirBarra` amostra UM pixel por borda** — um elemento animado que
   varre a tela inteira (o `marquee` da garagem) pode ocupar a mesma
   coluna amostrada nas duas bordas ao mesmo tempo, por desenho, e
   escapar da checagem "bordas concordam ⇒ não é conteúdo de margem".
4. **`html { scroll-behavior: smooth }`** (imobiliaria e multimarcas)
   quebrava o laço de fps genérico até este item (`window.scrollTo` por
   quadro virava uma animação que nunca chegava ao alvo) —
   `scripts/qa-visual.mjs` agora desliga o scroll suave antes de medir,
   no mesmo padrão que `medirBarra` já usava.
