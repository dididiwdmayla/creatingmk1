# `lancheria-chapa-burger` — fechamento da validação (2026-09-23)

Migração de quatro presets para quatro VARIANTES. Resultados brutos,
limitações da instrumentação e o que cada portão cobre.

## Portão de fps — variante × modo de cor (20 células)

`node scripts/qa-visual.mjs --so=fps --skin=lancheria-chapa-burger`

Celular 390×844 (dpr 2), CPU 4×, efeito `grao` em intensidade 3, rolagem
contínua a 1800 px/s, mediana de 5 cargas independentes por célula.
Veredito: piso de **45 fps**, e só ele reprova.

**20/20 aprovadas. Nenhum modo desabilitado.** Menor mediana: **55,0 fps**
(`balcao` × `transicao`) — 10 fps acima do piso.

| variante | tema | fixa | transicao | iridescente | arco-iris |
|---|---|---|---|---|---|
| `nenhum` (referência) | 58,6 | 58,2 | 58,2 | 59,1 | 58,6 |
| `chapa` | 58,2 | 57,3 | 57,7 | 57,7 | 58,7 |
| `balcao` | 55,7 | 56,4 | 55,0 | 56,4 | 57,1 |
| `sala` | 60,0 | 60,0 | 60,0 | 60,0 | 60,0 |
| `praca` | 58,1 | 58,8 | 58,8 | 60,0 | 57,5 |

Superfície repintada (Mpx/s, rolando): entre 2,9 e 16,8 — **todas abaixo do
limiar de marcação** (+40 Mpx/s sobre a referência sem efeito, ~5,3). A
`praca` repinta mais que as outras três (16,8) porque o mural de duas
colunas some com mais imagem em tela por quadro que a comanda de uma
coluna da `balcao` (2,9); ainda assim, 24,7 Mpx/s de distância do limiar.

Como nenhuma célula reprovou, `modosDeCorReprovados` fica **vazio nas
quatro variantes**. O mecanismo está ligado e é por célula: a variante
declara os modos, `resolverCamadaEfeito` soma-os aos do efeito, o modo
reprovado cai em `tema` e a variante inteira nunca é desabilitada. Tabela
completa em [FPS.md](FPS.md).

## Portão de drasticidade — as quatro em cinza

`node scripts/qa-chapa.mjs`

Página inteira no celular, convertida para escala de cinza, lado a lado.
**As quatro passam**: sem cor, cada coluna é um site diferente.

| variante | altura da página | abertura | cardápio | contato |
|---|---|---|---|---|
| `chapa` | 4.802px | cartaz de tela cheia | grade de 3 colunas | rodapé 3 colunas |
| `balcao` | 3.342px | ficha (nome+endereço) | comanda de 1 coluna | tarja de 1 linha |
| `sala` | 4.996px | cisão foto+tipografia | editorial alternado | fecho centralizado |
| `praca` | 3.701px | pilha sobre campo de cor | mural de 2 colunas | bloco "onde estamos hoje" (topo) |

Diferença média em cinza nas três primeiras telas (região correspondente
nas quatro):

| par | diferença |
|---|---|
| `chapa` × `sala` | 45,6 |
| `balcao` × `praca` | 71,8 |
| `chapa` × `praca` | 133,1 |
| `sala` × `praca` | 144,9 |
| `chapa` × `balcao` | 162,0 |
| `balcao` × `sala` | 178,5 |

O par mais próximo (`chapa`/`sala`) é as duas variantes de fundo ESCURO —
esperado, já que a métrica mede luminância antes de composição. **O número
dá escala, não veredito** — quem julga é quem olha a folha
(`qa-shots/chapa/_folha-cinza.png`): grade de 3 colunas × editorial
alternado, CTA pílula × redondo, corpo centralizado × alinhado à esquerda
não se confundem mesmo nas duas escuras.

Duas folhas, e o motivo: uma página de 390×4.996 não cabe ao lado de
outras três num tamanho que se enxergue. A de ABERTURA mostra três telas
em tamanho de leitura; a de SILHUETA mostra a página inteira das quatro no
mesmo fator, para apertar os olhos.

## Contrato no navegador, sem JavaScript

390 e 1100px, `javaScriptEnabled: false`, nas quatro variantes:

- um `<h1>` só, dentro da âncora `hero`, com o nome do negócio INTEIRO e
  caixa NÃO-ZERO (o `<h1>` aqui é texto simples, sem vídeo-no-título — o
  check troca o que seria "amplitude de contraste" por "a caixa existe");
- as cinco seções, sem duplicata, sem transbordo horizontal;
- caixa de cada um dos vinte slots de imagem: **zero** (ou ausente do DOM,
  no caso dos três flutuantes) para o declarado em `imagensOcultas`,
  **maior que zero** para o não declarado — as duas direções reprovam.

**Aferidor de caixa zerada — §7 (identidade sem bloco oco):** com
`avulsa=1` sem `identidade=cheia` (zero campo de identidade, o estado
normal do harness/avulsa/lead recém-criado), `balcao` e `praca` medem
`.ch-ficha`/`.ch-dados` como `null` — nenhum cromo de cartão vazio — com o
`<h1>` e `secoes.hero.texto` presentes nas duas.

| variante | `.ch-ficha` | `.ch-dados` | `secoes.hero.texto` |
|---|---|---|---|
| `balcao` | `null` | `null` | "Chapa quente das 11h às 15h. Pede no balcão…" |
| `praca` | `null` | `null` | "Sexta e sábado, de praça em praça. Segue…" |

Dados do navegador completos em [contrato-browser.json](contrato-browser.json).

## `qa-cls.mjs --so=skins` — CSS de composição sai do servidor

**CLS 0,0000** para `lancheria-chapa-burger` — nenhum deslocamento de
layout pós-hidratação. Confirma que `LANCHERIA_COMPOSICAO_CSS` (emitido em
`<style>` dentro do próprio componente, servido no HTML) decide ordem e
colunas ANTES da pintura, não depois dela.

A mesma rodada reprovou `barbearia-editorial` (CLS 0,1463) — pré-existente,
fora do escopo desta migração; nenhum arquivo da barbearia foi tocado
nela.

## Matriz de imagem, colapso, barra e demo avulsa

`node scripts/qa-visual.mjs --so=variante,colapso,barra,avulsa --skin=lancheria-chapa-burger`

**Rodada em andamento — esta seção fecha numa próxima revisão**, com as
capturas abertas e olhadas (regra 5 do ARCHITECTURE.md), antes de qualquer
veredito final aqui.

- **`barra`**: três das quatro variantes (`chapa`, `balcao`, `sala`) saem
  com **zero divergência** — um platô só, cor idêntica do começo ao fim da
  página. A `praca` acusou UMA: no platô y≈560–2794 (cardápio + vizinhança),
  a barra lê `#fff8ec` (`--d-bg`) e o pixel amostrado em x=3 mede
  `rgb(245,238,226)`, ~4% mais escuro (erro 10, teto de tolerância 8).
  Hipótese sob investigação: o `flutuante-bacon` (`public/demos/lancheria/
  foto/flutuante-bacon.webp`, fundo BRANCO sólido, não um recorte
  transparente) sangra pra fora da seção `cardapio` pela ESQUERDA — a
  única das quatro composições em que a mesma amostragem de borda cruza
  essa decoração — e é isso, não um desalinhamento real de `theme-color`,
  que provavelmente está sendo medido. Ainda não confirmado com captura em
  mãos; nenhum código mudou por causa disto até esta rodada fechar.
- **`variante`/`colapso`/`avulsa`**: rodados (arquivos gerados em
  `qa-shots/`), ainda não revisados imagem por imagem.

## Limitações da instrumentação

1. **fps medido com swiftshader**, não com GPU real: os números servem
   para comparar células entre si nesta máquina, que é o que o portão faz,
   e não para prever fps de um aparelho específico.
2. **A diferença em cinza do portão de drasticidade é escala, não
   veredito** — ela não sabe distinguir "composição diferente" de
   "luminância diferente por acaso"; é por isso que a folha é olhada, não
   só medida.
