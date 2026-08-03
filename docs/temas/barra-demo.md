# A barra do navegador na demo pública

Levantamento do que cada navegador FAZ com `<meta name="theme-color">`, e
o que a demo (`/demo/{leadId}`) faz por causa disso. O código está em
`src/lib/demos/barra`; o resumo de projeto, em ARCHITECTURE.md,
"Barra do navegador na demo pública".

## O que cada navegador faz

Fontes: **`@mdn/browser-compat-data` 8.0.8** e **`caniuse-db`
1.0.30001806** (os dois lidos do pacote npm nesta sessão, não de memória),
mais as notas de fornecedor citadas no fim. "Aba normal" quer dizer
navegação comum — vários motores usam a cor SÓ quando o site está
instalado como PWA, e essa é a distinção que mais engana.

| Navegador | Usa a meta em aba normal? | Atualiza sem recarregar? | `media="(prefers-color-scheme: …)"` |
|---|---|---|---|
| **Chrome Android** | **Sim** (39+) | **Sim** | Sim |
| **Samsung Internet** | **Sim** (6.2+) | **Sim** | Parcial — ver nota 3 |
| **Brave Android** | **Sim** (Chromium) | **Sim** | Sim |
| **Edge Android** | **Sim** (Chromium) | **Sim** | Sim |
| **Opera Android** | **Não** | — | — |
| **Firefox Android** | **Não** | — | — |
| **Safari iOS 15–18** | **Sim** | **Sim** | Sim |
| **Safari iOS 26+** | **Não** — parseia e ignora; ver nota 1 | Não | — |
| **Safari macOS 15–25** | Sim (barra da aba) | Sim | Sim |
| **Safari macOS 26+** | Não (só PWA instalado) | Não | — |
| **Chrome desktop** | Não — só PWA instalado (73+) | — | — |
| **Edge desktop** | Não — só PWA instalado (79+) | — | — |
| **Brave desktop** | Não — só PWA instalado | — | — |
| **Opera desktop** | **Não** | — | — |
| **Firefox desktop** | **Não** (nenhuma versão) | — | — |
| WebView Android | Não | — | — |
| WebView iOS | Como o Safari da versão | | |

Cobertura somada que o caniuse dá ao recurso: **5,5% "sim" + 69,3%
"parcial"** — o "parcial" é quase todo desktop, onde a cor só vale em PWA
instalado. Em outras palavras: **a feature é de celular**, e é exatamente
onde a demo é aberta.

**Nota 1 — Safari 26+ é a mudança que importa.** O WebKit passou a
derivar a cor da barra do `background-color` do `<body>`, com observador
ao vivo (a barra acompanha mudanças sem recarregar). A meta continua
sendo parseada e passa a ser usada só em web app instalado. Sem `<body>`
com cor, ele cai no `<html>`; sem os dois, branco no claro e preto no
escuro. Um elemento `fixed`/`sticky` que se qualifique e tenha
`background-color` tem PRIORIDADE sobre o `<body>` — vale registrar
porque a demo tem camadas `position: fixed` (efeito de fundo e LED), mas
nenhuma delas declara `background-color` (são transparentes e
`pointer-events: none`), então nenhuma se qualifica.

**Nota 2 — Chrome Android e o modo escuro do sistema.** Até a versão 91,
o Chrome Android IGNORAVA a cor em aparelhos com o tema escuro nativo
ligado, a menos que fosse PWA/TWA instalado. A partir da 92 a ressalva
saiu (BCD 8.0.8 registra `version_removed: 92`). O caniuse ainda carrega
a nota na versão atual; a leitura mais granular do BCD é a que este
documento segue.

**Nota 3 — Samsung Internet e `prefers-color-scheme`.** O motor entende
o atributo `media`, mas por padrão o navegador aplica o "force dark"
dele em vez de respeitar `prefers-color-scheme`; a media query só passa
a valer com a opção de tema escuro de site ligada (Labs, e a partir da
24.0.7 a flag "Enable Adaptive Force Dark"). Na prática: **não dá pra
contar com `media` no Samsung Internet.**

**Sobre o `media`, e por que a demo não usa.** A cor da barra aqui é a
cor de MARCA da skin do lead, não um par claro/escuro do sistema: cada
preset já é claro ou escuro por decisão do preset. Uma variante por
`prefers-color-scheme` daria duas respostas para uma pergunta que só tem
uma. A coluna está na tabela porque foi pedida no levantamento e porque
é a diferença que separa os motores — não porque falte à demo.

## O que a demo faz

1. **A cor certa sai no HTML servido.** `generateViewport` da rota emite
   `<meta name="theme-color">` já resolvida (ver `barra/modos.ts`), em
   todos os modos — no `automatico`, com a cor do topo da página. Todo
   navegador que ignora a atualização dinâmica, ou que não roda o JS,
   fica com essa cor. É a mesma que a demo tinha antes desta feature.
2. **No modo automático, um componente cliente acompanha a rolagem** e
   reescreve o `content` da tag QUE JÁ EXISTE (nunca uma segunda). A cor
   é a média ponderada das FAIXAS pintadas na banda de foco (uma seção
   pode pintar mais de uma — o rodapé da imobiliária tem duas), então a
   troca é uma rampa de ~meia viewport, função da posição e não do tempo.
3. **O mesmo valor pinta o `background-color` do `<body>`** — o caminho
   do Safari 26+, e o plano que aparece no rubber-band do overscroll em
   qualquer navegador. A cor inicial vai num `<style>` no HTML servido
   (`barra/plano.ts`).
4. **Onde nada disso é lido, nada acontece**: as duas saídas são um
   atributo de meta tag e a cor de um plano que as seções da skin cobrem
   por inteiro. Nenhum pixel de conteúdo muda, nenhum ramo de código
   testa navegador.
5. **A cor é conferida no PAINEL do editor**, não no preview: o preview
   roda em iframe e a barra pertence ao documento de cima. Amostras:
   `barra-editor-automatico.png` (a faixa degradê entre as duas cores por
   onde a barra vai passar) e `barra-editor-personalizada.png` (a faixa
   sólida da cor escolhida).

## O que foi medido AQUI, e o que não foi

Medido nesta máquina, no laço (`node scripts/qa-visual.mjs --so=barra`,
Chromium, viewport de celular 390×844, as 8 skins do registro, sem efeito
e sem LED). Imagem: `barra-rampa.png` (a rampa de cor de cada skin, do
topo ao fim da página, desenhada como faixa).

- a cor no **HTML servido** (lida por `fetch` cru, sem navegador e sem
  JavaScript) bate com a `--d-bg` da skin, na meta E no plano do `<body>`,
  nas 8;
- **a barra assume a cor do que está na tela**: nos platôs da rampa (onde
  a cor não está mudando) ela bate com o PIXEL da página, amostrado nas
  duas bordas laterais. Erro 0 na maioria dos platôs; o maior resíduo é 8
  (a barbearia tem um véu escuro sobre o fundo em duas seções);
- **a troca é rampa**: 11 a 48 cores distintas por página, e o maior salto
  entre dois passos de 40px fica sempre abaixo do teto derivado da
  inclinação do núcleo (ex.: barbearia 7 contra 11, imobiliária 36 contra
  61, petshop 35 contra 58);
- **os modos fixos são fixos**: cor certa no HTML e imóvel do topo ao fim,
  nos três, nas 8 skins.

| skin | cores na rampa | maior salto (teto) | maior erro no platô |
|---|---|---|---|
| barbearia-editorial | 39 | 7 (11) | 8 |
| barbearia2-sul | 13 | 2 (3) | 0 |
| tatuagem-editorial | 11 | 2 (3) | 0 |
| tatuagem-pigmento-vivo | 11 | 4 (6) | 0 |
| lancheria-chapa-burger | 1 | 0 (2) | 2 |
| imobiliaria-curada | 48 | 36 (61) | 0 |
| multimarcas-vortice | 37 | 41 (72) | 0 |
| petshop-focinho-feliz | 35 | 35 (58) | 4 |

A lancheria aparece com **1 cor**: é o resultado certo — nenhuma seção
dela pinta fundo próprio, a página inteira é `--d-bg`. No modo automático
a barra fica na cor do tema, que é o que a demo já fazia.

**Não foi medido aqui**: como cada navegador da tabela PINTA a barra.
Este ambiente tem um Chromium e nenhuma moldura de celular. A tabela é
compilação de dados de compatibilidade e notas de fornecedor, não
observação própria — está dito assim de propósito. O que o Chromium
local prova é o mecanismo (a meta muda sem recarregar, o plano do
`<body>` muda junto), que é a parte que depende deste código.

## Fontes

- `@mdn/browser-compat-data` 8.0.8 — `html.elements.meta.name.theme-color`
- `caniuse-db` 1.0.30001806 — `meta-theme-color` (notas 1–5)
- WWDC21 "Design for Safari 15" (introdução do suporte no Safari 15)
- Relatos sobre o Safari 26 (amostragem do `<body>`, observador ao vivo,
  prioridade de elemento `fixed`/`sticky`) e sobre o Samsung Internet
  (`prefers-color-scheme` atrás de opção), levantados por busca em
  agosto/2026.
