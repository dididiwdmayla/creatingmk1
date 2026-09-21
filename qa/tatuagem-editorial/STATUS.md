# `tatuagem-editorial` — fechamento da validação (2026-09-21)

Migração de quatro presets para quatro VARIANTES. Resultados brutos,
limitações da instrumentação e o que cada portão cobre.

## Portão de fps — variante × modo de cor (20 células)

`node scripts/qa-visual.mjs --so=fps --skin=tatuagem-editorial`

Celular 390×844 (dpr 2), CPU 4×, efeito `grao` em intensidade 3, rolagem
contínua a 1800 px/s, mediana de 5 cargas independentes por célula.
Veredito: piso de **45 fps**, e só ele reprova.

**20/20 aprovadas. Nenhum modo desabilitado.** Menor mediana: **55,7 fps**
(`cripta` × `iridescente`) — 10,7 fps acima do piso.

| variante | tema | fixa | transicao | iridescente | arco-iris |
|---|---|---|---|---|---|
| `nenhum` (referência) | 59,3 | 59,7 | 59,5 | 58,5 | 59,5 |
| `sangue` | 59,5 | 59,2 | 58,8 | 58,8 | 59,0 |
| `vesperal` | 58,7 | 58,3 | 58,3 | 58,1 | 57,8 |
| `cripta` | 58,9 | 59,6 | 58,2 | 55,7 | 58,2 |
| `marfim` | 59,7 | 58,9 | 59,4 | 58,9 | 59,7 |

Superfície repintada (Mpx/s, rolando): entre 15,0 e 33,7 — **todas abaixo
da própria referência sem efeito** (30,1–34,1), e portanto longe do limiar
de marcação (+40 Mpx/s sobre a referência). A `vesperal` repinta metade do
resto (15,0) porque a abertura `cartaz` não tem foto de fundo.

Como nenhuma célula reprovou, `modosDeCorReprovados` fica **vazio nas
quatro variantes**. O mecanismo está ligado e é por célula: a variante
declara os modos, `resolverCamadaEfeito` soma-os aos do efeito, o modo
reprovado cai em `tema` e a variante inteira nunca é desabilitada. Tabela
completa em [FPS.md](FPS.md).

## Portão de drasticidade — as quatro em cinza

`node scripts/qa-tatuagem.mjs`

Página inteira no celular, convertida para escala de cinza, lado a lado.
**As quatro passam**: sem cor, cada coluna é um site diferente.

| variante | altura da página | abertura | galeria | preços |
|---|---|---|---|---|
| `sangue` | 11.425px | foto sangrada, tela cheia | mosaico | lista com descrição |
| `vesperal` | 9.134px | só tipografia, sem foto | lista editorial | prosa |
| `cripta` | 5.896px | dividida com foto | mural cerrado | tabela, 2ª seção |
| `marfim` | 7.332px | ficha de catálogo | carrossel | cartões |

Diferença média em cinza nas três primeiras telas (região correspondente
nas quatro): entre as escuras 14,0 / 22,8 / 24,6; contra a clara 162 / 174
/ 175. **O número dá escala, não veredito** — quem julga é quem olha a
folha (`qa-shots/tatuagem/_folha-cinza.png`).

Duas folhas, e o motivo: uma página de 390×11.400 não cabe ao lado de
outras três num tamanho que se enxergue. A de ABERTURA mostra três telas
em tamanho de leitura; a de SILHUETA mostra a página inteira das quatro no
mesmo fator, para apertar os olhos.

## Contrato no navegador, sem JavaScript

390 e 1100px, `javaScriptEnabled: false`, nas quatro variantes:

- um `<h1>` só, dentro da âncora `hero`, com o nome do negócio INTEIRO;
- as nove seções, sem duplicata, sem transbordo horizontal;
- caixa de cada um dos dez slots de imagem: **zero** para o declarado em
  `imagensOcultas`, **maior que zero** para o não declarado — as duas
  direções reprovam.

**Título no celular** (o pedido da Cripta, cuja abertura é dividida): 3
linhas e corpo 50,7px nas QUATRO, idênticos. A divisão empilha abaixo de
768px e o título recebe a largura inteira, então não espreme.

**Nome no print da âncora hero**, medido dentro da caixa do título
(amplitude p95−p05 em cinza, contorno congelado em fase fixa; piso 20):

| variante | amplitude |
|---|---|
| `sangue` | 24 |
| `vesperal` | 46 |
| `cripta` | 83 |
| `marfim` | 230 |

A `sangue` é a mais discreta por construção — é a variante fiel ao
material bruto, em que as letras são preenchidas pela própria foto escura
do hero e o que as separa do fundo é o contorno multicor.

O piso de 20 não é régua de contraste: ele existe para pegar a caixa que
virou um bloco de UMA cor só, e essa mede perto de zero, não 19. A margem
da `sangue` (24) é estreita porque o valor depende de qual pedaço da foto
cai dentro das letras — ele oscilou entre 24 e 30 durante esta sessão,
conforme o hero mudava de altura. Se um dia encostar no piso sem que nada
tenha quebrado, é o piso que está medindo a coisa errada.

## Título hero, por variante

`node scripts/qa-titulo.mjs` (4 variantes × 2 telas, 42 capturas cada)

✅ uma única caixa de texto por caso, camadas alinhadas, fonte do editor
aplicada. Alinhamento trocado por código, escala 1,70 e 0,70, entre-letras
0,30em e −0,05em, e o repique no topo da rolagem — tudo nas quatro.

**O vídeo APARECE dentro das letras**, e não só encaixa: controle
(nível `imagem`, CSS congelado) **0% em 24/24**; nível `video` muda **22 a
36%** da caixa nos nomes longos, 16 de 16. A cobertura de glifo da skin é
~23–36% — muda onde há letra, e só ali.

## Limitações da instrumentação

1. **Ponto cego do vídeo no nome curto.** `ÓSSEA` (5 letras) mede 36% numa
   aba limpa e 0% depois de algumas navegações na mesma aba: a superfície
   mascarada pequena deixa de receber atualização de composição no
   Chromium headless com swiftshader. É do ambiente, não da skin — o mesmo
   código, na mesma máquina, compõe ou não conforme o histórico da aba.
   Nenhum caso de produção cai aí (`quebrarTitulo` entrega o nome do
   negócio na forma dos casos longos, que são os cobrados). O curto
   continua medido e relatado.
2. **A medida não pode ser cara.** Ler o canvas inteiro a cada quadro
   (451 mil px) estrangula o pipeline que se quer medir: levou o portão de
   1 para 19 reprovações, todas com a tela parada. Amostra-se um canto de
   64×64.
3. **Esperar no relógio não serve.** Com `waitForTimeout(450)` a tela sai
   idêntica mesmo com o canvas trocando de quadro — o headless não produz
   quadros enquanto ninguém pede. A espera gira `requestAnimationFrame`.
4. **fps medido com swiftshader**, não com GPU real: os números servem
   para comparar células entre si nesta máquina, que é o que o portão faz,
   e não para prever fps de um aparelho específico.
