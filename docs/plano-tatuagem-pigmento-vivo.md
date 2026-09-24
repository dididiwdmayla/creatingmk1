# Plano — `tatuagem-pigmento-vivo`: de quatro presets para quatro variantes

Escrito em 2026-09-24 (sessão 1: leitura e plano, nenhum código). As
sessões 2 e 3 executam; este documento é a fonte única entre elas.
**Status: CONCLUÍDO (2026-09-24)** — as sessões 2 (composição visual) e
3 (portões, contraste, fps, cinza e documentação) fecharam. As quatro
variantes (Aquarela, Boreal, Meia-noite, Terra) estão compostas,
testadas e documentadas; a única pendência é o piso de fps (item 33/
§14 — reprovado na REFERÊNCIA das quatro variantes, reportado para
decisão, não corrigido — ver [qa/tatuagem-pigmento-vivo/FPS.md](../qa/tatuagem-pigmento-vivo/FPS.md)
e [STATUS.md](../qa/tatuagem-pigmento-vivo/STATUS.md)). As decisões do
§17 foram todas fechadas (ver ARCHITECTURE.md, seção "Tatuagem Pigmento
Vivo — migração de presets para variantes").

**Base verificada nesta sessão.** O repositório não tem branch `main`: o
branch padrão do remoto é `claude/radar-architecture-setup-49czui`, e é a
partir dele que `migra/tatuagem-pigmento-vivo` foi criado (HEAD
`9543823`). As três migrações anteriores estão mescladas nele, sem commit
pendente nos branches de origem: tatuagem-editorial (PR #121), chapa
burger (PR #122; `lancheria-chapa-burger-variants-txz1o9` com 0 commits
fora), multimarcas (PR #123).

Convenções deste plano: `pv` é o prefixo da skin (`data-pv-*`,
`--pv-*`, `.pv`), como `te` é o da tatuagem-editorial e `mm` o da
multimarcas. Os arquivos continuam em `src/components/demos/tatuagem2/`
(o id da skin no registro não muda).

---

## 1. Inventário antes de propor

Onze seções (`tatuagem2/secoes.ts`), só `hero` é fixa. `depoimentos` e
`processo` têm `alignOptions` (`esquerda`/`centro`); `manifesto` não tem
`entradaOptions` (revelação própria), as outras nove não-fixas têm, sem
typewriter.

| seção | composição atual | slots de texto |
|---|---|---|
| hero (fixa) | 100svh, três manchas borradas com parallax + traço SVG, rótulo, `<h1>` com a última palavra em itálico no acento, texto, CTA pílula | `secoes.hero.{rotulo,titulo,texto,cta}` (título cai em `nome`) |
| manifesto | parágrafo serif gigante, palavras "acendem" com o scroll, 1 a cada 5 em itálico no ciclo de pigmentos | `.texto` |
| estilos | grade 1/2/3/5 colunas de cartões com mancha que cresce no hover + tilt 3D; o último cartão invertido (escuro) | `.rotulo`, `.titulo`, `.itens.N.{titulo,texto}` (`.detalhe` marcado mas o número é gerado) |
| investimento | faixa `fundoAlt`, lista de linhas: nome itálico + descrição, preço em pílula colorida | `.rotulo`, `.titulo`, `servicos.N.{nome,descricao,preco}` |
| portfolio | trilha horizontal pinada (sticky + translateX) no desktop; no toque, rolagem horizontal nativa | `.rotulo`, `.titulo`, `.itens.N.{titulo,subtitulo,detalhe}` |
| artistas | três colunas flex: rabisco SVG que se desenha + nome + especialidade no pigmento + bio | `.rotulo`, `.titulo`, `.itens.N.{titulo,subtitulo,texto}` |
| depoimentos | três cartões `fundoElevado` com estrelas no pigmento | `.rotulo`, `.titulo`, `depoimentos.N.{texto,autor,nota}` |
| processo | 4 colunas numeradas em círculo, linha ondulada ligando | `.rotulo`, `.titulo`, `.itens.N.{titulo,subtitulo,texto}` |
| faq | acordeão, um aberto por vez, ponto colorido | `.rotulo`, `.titulo`, `.itens.N.{titulo,texto}` |
| agendar | 92vh, gradiente dos três pigmentos + duas manchas, título branco, CTA claro + CTA contorno | `.titulo`, `.cta`, `.ctaSecundaria` |
| contato | `<footer>` flex: nome + ponto, endereço/cidade/horário/telefone/instagram empilhados, © + texto | `.texto`, `nome`, `endereco`, `cidade`, `horarios`, `telefone`, `instagram` |

**Partes fixas** (chrome, fora de toda seção, sem `data-d-secao` —
correto): `Nav` (fixed, nome + ponto de pigmento + links + CTA),
`CustomCursor`, `IntroExperience` (splash opcional), `LedEdges`,
`PigmentTracker` (wrapper que escreve `--d-pigment`). Rabiscos de
assinatura (`RABISCOS_ARTISTA`) e o traço do hero são decoração fixa.

**Slots de imagem: 8** — `portfolio-1..8`. Nenhum no hero, estilos ou
artistas (fiel ao material bruto). Nenhum `imagensAlt`. Placeholders em
`public/demos/tatuagem2/portfolio-{1..8}.svg` + `thumb.svg`.

### O que é literal e precisa virar slot ou token

**Cores cravadas.**
- `accentCycle={["#FFFFFF", "#FFFFFF", "#FFFFFF"]}` e `text-white` no
  título do CTA final (`Skin.tsx:623-624`). O branco sobre o gradiente dos
  três pigmentos mede 2,23–2,84 em três das quatro paletas (§2).
- `mix-blend-mode: multiply` nas manchas do hero (`Skin.tsx:698`), na
  mancha dos cartões de estilo (`:757`) e no cursor (`CustomCursor.tsx`).
  Não é hex, mas é cor cravada no efeito: `multiply` sobre fundo quase
  preto não produz nada — **na Meia-noite as manchas, a mancha do cartão
  e o cursor são invisíveis**. A essência da skin some na única paleta
  escura. Vira token `--pv-mistura` (`multiply` no claro, `screen` no
  escuro).
- `.d-cta-contorno` pinta o texto na cor `--d-bg` sobre o gradiente: no
  claro, creme sobre rosa/azul/laranja (2,63–5,37); no escuro, preto sobre
  os vivos.
- O `<em>` do `SplashTitle` tem `color: var(--d-accent)` inline — no CTA
  final ele pinta **o acento sobre um gradiente que começa no próprio
  acento: 1,00:1** nas quatro paletas (a última palavra do título some).

**Português fora de `microcopiaDemo`.** Só dois, os dois em `??`:
- `s.contato?.texto ?? "Estúdio fictício, tinta imaginária."` (`Skin.tsx:679`)
- `s.hero?.cta ?? "Agendar sessão"` (`Skin.tsx:808`, CTA do Nav)

Já passam por `m`: `m.avaliacaoEstrelas`. Nav, FAQ e galeria não têm
texto próprio.

**Alts derivados.** `alt={`${item.titulo} — ${item.subtitulo ?? ""}`}`
(`Skin.tsx:424`) — derivado da copy, mesmo caso das três migrações
anteriores. Viram `imagensAlt` opt-in, 8 chaves (mais as do §8, se o
contrato crescer).

**Endereço fictício no exemplo.** `TATUAGEM2_EXEMPLO.endereco:
"Rua das Aquarelas, 88 — Centro"` (`exemplo.ts:21`), desenhado no rodapé
(`Skin.tsx:650`) para todo lead sem endereço. É a linha desta skin na
tabela "Auditoria de endereço" do ARCHITECTURE.md. Sai na migração; a
tabela cai de quatro para três skins.

**O `<h1>` do hero.** `SplashTitle as="h1"` (`Skin.tsx:236`), dentro do
wrapper `data-d-secao="hero"`. Três defeitos:
1. `texto={s.hero?.titulo ?? data.nome}` (`:237`) — e é pior que nas
   outras skins: `SplashTitle` faz `if (!texto) return null`, então um
   título salvo como string vazia **não deixa `<h1>` em branco, apaga o
   `<h1>` inteiro**. A trava (`variantes.test.tsx`) pega a variante sem
   `<h1>`, mas não pega a demo salva — só a abertura do lead real some.
2. Com título preenchido, o nome sai do `<h1>`. `dadosDoLead` grava
   `quebrarTitulo(lead.nome)` no título, então o caso normal é nome; mas
   qualquer slogan digitado no campo tira o nome da abertura (o default
   histórico `"Sua história,\nnossa tinta."` já é filtrado por
   `legado.ts`).
3. Sem JavaScript o hero sai pela metade: rótulo, texto e CTA estão em
   `FadeUp` (motion, `initial={{opacity:0, y}}` no HTML do servidor), e
   as nove não-fixas que não são o manifesto em `SectionReveal` (`opacity:0`). O `<h1>` em
   si fica visível (não está em `FadeUp`).

**Todos os `??` que deveriam ser `||`** (string vazia não cai no fallback):

| onde | expressão | efeito com `""` |
|---|---|---|
| `Skin.tsx:237` | `s.hero?.titulo ?? data.nome` | **o `<h1>` some** (`SplashTitle` devolve `null`) |
| `Skin.tsx:808` | `s.hero?.cta ?? "Agendar sessão"` | CTA do Nav vazio (pílula sem texto) — e o fallback é literal PT |
| `Skin.tsx:679` | `s.contato?.texto ?? "Estúdio fictício, tinta imaginária."` | linha em branco — e o fallback afirma que o estúdio do lead é fictício |
| `Skin.tsx:423` | `data.imagens[\`portfolio-${i+1}\`] ?? Object.values(data.imagens)[0]` | não é `??`→`||` (slot não aceita vazio), mas é defeito vizinho: do 9º item em diante a figura mostra a foto do slot 1 com `data-demo-slot="imagens.portfolio-9"`, slot que não existe — clique no preview leva a campo nenhum |

Os `??` de `ScrollGallery`, `SplashTitle` internos, `alinhamento` e
`itens ?? []` estão corretos (não são texto de slot).

### Defeitos de documento servido (sem JavaScript)

É o estado em que o robô de prospecção fotografa. Lidos no código, a
confirmar no laço da sessão 3:
- `FadeUp`/`SectionReveal`: tudo abaixo do `<h1>` sai com `opacity:0`.
- `ManifestoReveal`: toda palavra sai em `--d-unlit` (32% do texto
  misturado ao fundo) — **1,97 a 2,64:1** nas quatro paletas. O manifesto
  impresso é ilegível.
- `LineDraw`: `strokeDashoffset: 1` — rabiscos dos artistas e linha do
  processo invisíveis.
- `IntroExperience` com `intro: true`: `mostrando` é verdadeiro no
  servidor → a camada `fixed inset-0` opaca sai no HTML e cobre a página
  (mesmo defeito do preloader da multimarcas). Hoje as quatro nascem com
  `intro: false`, mas o editor liga.
- `FaqAccordion`: só o item 0 abre; os outros dependem de `onClick` —
  sem JS as respostas 2–4 são inalcançáveis. Vira `<details>/<summary>`.

### Outros achados

- O CTA de agendar sem `whatsapp` aponta para `#agendar` — **inclusive os
  dois botões DENTRO da seção `agendar`**, que apontam para si mesmos.
  Com `agendar` oculta, o link do hero e do Nav não leva a lugar nenhum.
- `estilos.itens.N.detalhe` tem `data-demo-slot` mas o conteúdo é o
  número gerado (`01`…): clicar leva a um campo que não controla nada.
- As manchas usam `filter: blur(48px)` animado (três no hero, duas de
  60px no CTA final) — custo de rasterização por quadro no celular; é o
  primeiro suspeito se a linha de referência do fps cair (§14).

---

## 2. Contraste das paletas atuais

Alfa composto sobre a superfície real onde o texto pousa, fórmula WCAG de
`contraste.ts`, mistura linear `fg·α + bg·(1−α)` por canal. Mancha do hero
no pior caso (centro, sem a queda do gradiente radial): `multiply` do
pigmento sobre o fundo ao alfa declarado no CSS. Piso 4,5:1 para texto de
leitura (≤18px), 3:1 para texto grande. Medido com script descartável
desta sessão; a sessão 3 refaz com `contrasteWcag` (§16, item 30).

| par (onde aparece) | aquarela | boreal | meia-noite | terra |
|---|---|---|---|---|
| texto / fundo · alt · elevado | 17,11 · 15,28 · 13,92 | 17,02 · 15,61 · 14,51 | 17,39 · 16,39 · 14,86 | 14,43 · 12,41 · 10,57 |
| suave / fundo (hero, estilos, artistas, processo, FAQ, rodapé) | 5,56 | 4,99 | 6,97 | **4,48** |
| suave / alt (descrição do investimento) | 5,31 | 4,84 | 6,82 | **4,22** |
| suave / elevado (autor do depoimento, 11px) | 5,11 | 4,71 | 6,46 | **3,95** |
| suave / fundo **sob a mancha do hero** (pior caso: mancha 1 · mancha 2) | **3,80 · 4,10** | **3,82 · 3,70** | 7,00 · 7,00 ¹ | **3,19 · 3,53** |
| destaque / fundo (nº do 1º estilo, especialidade do 1º artista, nº do passo 1) | **4,29** | **3,22** | 8,31 | **4,03** |
| acento2 / fundo (idem, 2º pigmento) | 5,36 | 6,71 | 5,08 | **4,21** |
| acento3 / fundo (idem, 3º pigmento) | **2,63** | 5,37 | 8,77 | 5,33 |
| preço: pigmento / pílula 16% sobre alt (1 · 2 · 3) | **3,09 · 3,81 · 2,04** | **2,50** · 4,80 · **3,91** | 6,07 · **4,04** · 6,28 | **2,88 · 3,04 · 3,74** |
| cartão escuro de estilo: fundo 70% / texto | 8,74 | 8,71 | 7,07 | 7,67 |
| ink / destaque (CTA no hover) | 4,62 | **3,46** | 6,43 | 4,68 |
| branco / gradiente do CTA final (título grande, 3:1) | 4,62 · 5,77 · **2,84** | 3,46 · 7,22 · 5,77 | **2,35** · 3,85 · **2,23** | 4,68 · 4,90 · 6,20 |
| fundo / gradiente (botão contorno do CTA final, 15px) | **4,29** · 5,36 · **2,63** | **3,22** · 6,71 · 5,37 | 8,31 · 5,08 · 8,77 | **4,03 · 4,21** · 5,33 |
| `<em>` no acento / gradiente do CTA final | **1,00** · 1,25 · 1,63 | **1,00** · 2,09 · 1,67 | **1,00** · 1,64 · 1,06 | **1,00** · 1,05 · 1,32 |
| manifesto no servidor: `--d-unlit` / fundo | **2,06** | **2,06** | **2,64** | **1,97** |
| estrela: pigmento / elevado (gráfico, 3:1) | 3,49 · 4,36 · **2,14** | **2,74** · 5,72 · 4,58 | 7,10 · 4,34 · 7,50 | **2,95** · 3,09 · 3,91 |
| `<em>` do título: destaque / fundo (grande, 3:1) | 4,29 | 3,22 | 8,31 | 4,03 |

¹ Na Meia-noite a mancha não reduz o contraste porque não aparece:
`multiply` sobre `#0E0B10` é preto. O número "passa" pelo defeito do §1.

**As quatro reprovam** — pior que a previsão de 3 em 4:
- **Aquarela** (a paleta do material bruto): o laranja `#FF6B35` como
  texto (2,63), o rosa como texto pequeno (4,29), as pílulas de preço
  (2,04–3,81), o texto do hero sob as manchas (3,80), o branco sobre o
  laranja do CTA final (2,84).
- **Boreal**: o verde `#0F9D6E` como texto (3,22) e como fundo de CTA
  (3,46), pílulas, texto sob as manchas.
- **Meia-noite**: o título branco do CTA final sobre ciano e laranja
  (2,35 / 2,23), a pílula do 2º pigmento (4,04) — e as manchas invisíveis.
- **Terra**: `textoSuave` a 62% reprova nas três superfícies (4,48 / 4,22
  / 3,95), terracota e mostarda como texto, pílulas, texto sob as manchas.
- Nas quatro: o `<em>` do CTA final a 1,00:1 e o manifesto servido a ~2:1.

**Regras para as paletas novas** (aplicadas no §6):
1. **Pigmento tem dois tons**: a *mancha* (vivo, só preenchimento e
   decoração) e a *tinta* (o mesmo matiz escurecido — ou clareado, no
   escuro — até ≥4,5:1 sobre fundo, alt, elevado **e** sobre a pílula de
   16% do próprio pigmento). Texto, número, estrela e ícone usam a tinta;
   só mancha e campo de cor usam o vivo.
2. `textoSuave` é cor sólida, não alfa, e é medido sobre as três
   superfícies e sobre a mancha a α 0,30.
3. **Mancha atrás de texto de leitura nunca passa de α 0,30** no ponto
   onde o texto pousa; o `<h1>` (grande) aceita α 0,55.
4. O campo de cor do CTA final é feito das *tintas* no claro (texto
   branco) e dos *vivos* no escuro (texto no fundo escuro); `<em>` sobre
   campo de cor usa a cor do título (itálico sem troca de cor); botão
   sobre campo de cor é sempre cheio (`fundo`/`texto`), nunca contorno
   transparente.
5. O manifesto sai **aceso** do servidor (§16, item 4).

---

## 3. A essência

**Pigmento vivo: a página é tingida por três pigmentos em rodízio — cada
item, seção e palavra de destaque recebe o próximo — e a tinta se
espalha e acende: manchas que se movem atrás do nome, o manifesto que
passa de apagado a tingido palavra por palavra no scroll, e o ponto ao
lado do nome que muda para a cor da seção em foco.**

Três marcas, obrigatórias nas quatro, em forma e escala diferentes:

| marca | aquarela | boreal | meia-noite | terra |
|---|---|---|---|---|
| **tríade em rodízio** (3 pigmentos ciclando por item) | três manchas borradas na abertura; números de estilo, preços, especialidades e passos alternando as três tintas | as três cores como camadas de "cobertura" sobre o decalque violeta; o rodízio pinta as camadas do processo | faixas verticais cheias na abertura (cartela); cada disco de estilo e cada etiqueta de preço num vivo | anel de três arcos em volta do medalhão; selos de preço e passos do ciclo nas três tintas |
| **tinta que acende** (manifesto palavra a palavra) | manifesto dentro de uma mancha circular que cresce conforme acende | palavras acesas ganham um grifo de pigmento atrás (marca-texto cobrindo o apagado) | uma palavra por linha, gigante, acendendo em brilho (`screen`) | carta manuscrita: a palavra "seca" do tom apagado para a tinta |
| **ponto rastreador + mancha viva** (`PigmentTracker`) | ponto ao lado do nome no Nav + cursor que tinge (original) | ponto no Nav + o fantasma do nome na abertura troca de cor com a seção | ponto no Nav em brilho + LED nas bordas nas três cores | ponto no Nav + o anel do medalhão gira para a cor da seção |

Não muda em nenhuma: o `SplashTitle` (última palavra em itálico, letras
que saltam no hover com ponteiro fino), o CTA em pílula, o traço que se
desenha (`LineDraw`) — num lugar diferente em cada uma (§5).

Na Meia-noite a essência depende do token `--pv-mistura: screen` (§1):
sem ele, as manchas, o cursor e a mancha do cartão somem no preto, que é
exatamente o estado atual.

---

## 4. Separação da irmã (`tatuagem-editorial`, já migrada)

Tipos de composição que a irmã usa (`TatuagemComposicao`,
`tatuagem/composicao.ts`), e o análogo de cada um aqui:

| seção aqui | análogo na irmã | tipos da irmã | tipos da pigmento-vivo (aquarela · boreal · meia-noite · terra) | por que não repetem |
|---|---|---|---|---|
| abertura | abertura | monolito (foto sangrada) · cisão (título \| foto) · ficha (título, foto larga, tarja) · cartaz (só tipografia, sem elemento de fundo) | **mancha** · **sobreposição** · **cartela** · **medalhão** | Três das da irmã são FOTO; aqui não há foto na abertura (sem slot, §8). A única tipográfica da irmã (cartaz) é o título sozinho sobre fundo liso com fio; nenhuma das quatro daqui tem título sozinho: mancha = título ancorado a três manchas estruturais, assimétrico; sobreposição = o nome duas vezes, camada fantasma de decalque + camada sólida; cartela = faixas de cor cheia com o nome numa tarja sólida; medalhão = nome encerrado numa moldura oval. |
| manifesto | manifesto (`statement`) | alternado (pesos/itálico alternando) · bloco · marca (à esquerda, acento na alternância) · sussurro (mono pequena espaçada) | **círculo** · **grifo** · **pilha** · **carta** | O desenho ORIGINAL daqui (parágrafo à esquerda, 1 em 5 palavras em itálico no acento) é praticamente o `marca` da irmã — por isso muda até na Aquarela (§17, D2). Círculo = texto composto dentro de uma forma; grifo = faixas de cor atrás das palavras; pilha = uma palavra por linha; carta = manuscrito em coluna estreita com capitular. Nenhuma é variação de peso/tamanho sobre bloco retangular. |
| portfólio | galeria | mosaico (colunas irregulares) · mural (grade cerrada 2px) · tira (carrossel horizontal com encaixe) · lista (uma por linha, numerada) | **trilha** · **vitrine** · **manchas** · **mesa** | O original no celular É a `tira` da irmã (rolagem horizontal nativa) — muda (§17, D2). Trilha = pinada e movida pelo scroll vertical no desktop, zigue-zague vertical de larguras variadas no celular; vitrine = uma peça dominante + miniaturas; manchas = fotos recortadas em forma orgânica, escalonadas; mesa = polaroides giradas e sobrepostas com legenda manuscrita. Nenhuma é grade regular, coluna de alvenaria, carrossel de encaixe ou lista numerada. |
| artistas | o artista (`sobre`) | retrato 3/4 · índice sem retrato (estilos em 2 colunas) · faixa (foto sangrada) · dossiê (retrato pequeno, nome enorme, medida estreita) | **assinaturas** · **monogramas** · **bandeiras** · **livro** | As quatro da irmã giram em torno de UMA pessoa e da foto dela; aqui são TRÊS artistas sem foto. Assinaturas = rabisco grande que se desenha, em colunas; monogramas = inicial gigante em disco de pigmento; bandeiras = bloco de cor cheia por artista; livro = linhas de livro de visitas com rabisco pequeno à margem. |
| investimento | preços | lista (linha alta com descrição) · tabela (mono cerrada) · cartões (valor grande, cartão com fio) · prosa | **gotas** · **régua** · **etiquetas** · **selos** | O original daqui É a `lista` da irmã — muda. Gotas = forma orgânica de pigmento com o preço dentro, fluxo escalonado, sem fio nem grade; régua = serviços posicionados numa escala de preço; etiquetas = tags penduradas num fio; selos = selo circular carimbado ao lado do nome. |
| depoimentos | provas | cartões · tira · empilhado (autor \| fala) · citação (uma gigante por vez) | **bilhetes** · **conversa** · **coro** · **caderno** | O original daqui É `cartoes` — muda. Bilhetes = papéis girados, sobrepostos na borda; conversa = balões alternados com cauda; coro = as três falas num texto corrido único, cada uma na sua tinta; caderno = fala manuscrita sobre pauta, assinatura abaixo à direita (sem as duas colunas do empilhado). |
| processo | protocolo | linhas (número \| texto) · colunas (4 lado a lado) · escada (degraus com fio vertical) · numerado (número domina) | **onda** · **camadas** · **quadrinhos** · **ciclo** | O original daqui (4 colunas com linha ondulada) está a um passo de `colunas` — muda. Onda = passos alternados acima/abaixo da linha ondulada (no celular, à esquerda/direita de uma onda vertical); camadas = quatro folhas sobrepostas em cascata; quadrinhos = painéis de tamanhos irregulares com calhas diagonais; ciclo = anel com quatro nós. |
| agendar | fecho | centralizado · colunas (rodapé 3 col) · tarja (dados em mono entre fios duplos) · cartaz (CTA ocupa a tela) | **gota** · **talão** · **diagonal** · **postal** | O original daqui (campo de cor de tela cheia, título central) é o `cartaz` da irmã — muda. Gota = o CTA dentro de uma única forma orgânica fora de centro, sem sangrar; talão = canhoto com picote; diagonal = faixa inclinada atravessando a página; postal = cartão-postal com selo. |
| contato | fecho (a irmã funde agendar+rodapé numa seção) | idem | **assinatura** · **recibo** · **letreiro** · **colofão** | Nenhuma é centralizada, de três colunas ou tarja mono entre fios: assinatura = nome + ponto e dados empilhados (original); recibo = linhas com guias pontilhadas alinhadas à direita; letreiro = o nome na largura inteira no pé; colofão = um parágrafo corrido em corpo pequeno. |
| estilos | sem seção própria; o mais próximo é o `indice` do artista (estilos em 2 colunas numeradas) e a faixa rolante | indice · rolante/estática | **mostruário** · **bento** · **paleta** · **baralho** | Nenhuma é índice de duas colunas nem faixa: mostruário = grade uniforme de cartões com mancha (original); bento = um estilo dominante + quatro menores; paleta = discos de cor; baralho = cartas sobrepostas e giradas. |
| faq | a irmã não tem | — | **acordeão** · **fichas** · **manchete** · **respostas** | Sem conflito possível. |

**Garantia mecânica, não só este texto**: o teste de contrato (§9) exige
que nenhum valor de `PigmentoComposicao` coincida com um valor de
`TatuagemComposicao` na seção análoga (a tabela acima vira um mapa no
teste).

---

## 5. Critério de drasticidade

Parametrizado por `PigmentoComposicao` (`Theme.pigmento`), no modelo de
`TatuagemComposicao`/`MultimarcasComposicao`: **um caminho de render**,
CSS emitido no servidor em `tatuagem2/composicao.ts`, especificidade em
vez de `!important`, layout default também na folha, **nenhuma
composição esconde texto**.

| seção | aquarela | boreal | meia-noite | terra |
|---|---|---|---|---|
| **abertura** | mancha: nome em 2 linhas à esquerda, três manchas estruturais, traço SVG cruzando, 100svh | sobreposição: nome fantasma em decalque violeta tracejado, deslocado, e o `<h1>` sólido por cima; régua "antes → depois" sob o texto; 88svh | cartela: três faixas verticais de cor cheia na metade de cima; nome condensado gigante numa tarja escura que monta a borda inferior das faixas | medalhão: moldura oval de fio duplo centrada, nome serif dentro, anel de três arcos em volta; texto e CTA fora da moldura |
| **portfólio** | trilha pinada (desktop) / zigue-zague de larguras variadas (celular) | vitrine: peça 1 dominante 4:5 + 7 miniaturas em fileira | manchas: fotos recortadas em forma orgânica, 2 por linha escalonadas, tamanhos alternados | mesa: polaroides giradas ±4°, sobrepostas até 20%, legenda manuscrita |
| **investimento** | gotas: forma orgânica do pigmento com preço grande dentro, fluxo escalonado | régua: escala de preço horizontal (vertical no celular) com cada serviço como marcador | etiquetas: tags penduradas num fio, giradas | selos: linha de nome + descrição com selo circular carimbado à direita |
| **processo** | onda: passos alternados em torno da linha ondulada (vertical no celular) | camadas: quatro folhas em cascata, cada uma deslocada, como decalque sobre desenho | quadrinhos: painéis irregulares com calha diagonal | ciclo: anel SVG com quatro nós; textos 2×2 em volta (abaixo do anel no celular) |
| manifesto | círculo | grifo | pilha | carta |
| estilos | mostruário (grade uniforme, mancha no hover, último invertido) | bento (1 grande + 4) | paleta (discos de cor, título dentro) | baralho (cartas sobrepostas giradas) |
| artistas | assinaturas (rabisco grande que se desenha, 3 colunas) | monogramas (inicial em disco) | bandeiras (bloco de cor cheia por artista) | livro (linhas com rabisco pequeno à margem) |
| depoimentos | bilhetes | conversa | coro | caderno |
| faq | acordeão (`<details>`, 1º aberto) | fichas (2 colunas, todas abertas) | manchete (pergunta gigante, resposta pequena, todas abertas) | respostas (versalete + parágrafo corrido) |
| agendar | gota | talão | diagonal | postal |
| contato | assinatura | recibo | letreiro | colofão |

**Onze seções com layout diferente entre as quatro**; o portão pede
quatro, e as que o seguram mesmo se alguma linha escorregar na execução
são as quatro em negrito — abertura, portfólio, investimento, processo —
porque mudam a SILHUETA (altura e distribuição de massa), que é o que a
folha em cinza mostra.

Regras de desenho que a execução segue:
- **O título do hero nunca encolhe por composição**: o `font-size` do
  `<h1>` é o mesmo token nas quatro, só a moldura em volta muda (regra 5
  de `tatuagem/composicao.ts`).
- **Forma orgânica recorta, nunca corta texto**: gotas, manchas, círculo
  e bilhetes crescem com o conteúdo (a forma vira elipse ou retângulo
  arredondado quando o texto excede); o teste de transbordo do laço
  (§16, item 29) mede `scrollHeight ≤ clientHeight` em cada forma.
- A **mesa** sobrepõe no máximo 20% de cada foto; o laço mede a fração
  visível por amostragem de `elementFromPoint` (≥ 60% de cada foto).
- A **régua** de preço usa `precoValor`; serviço sem valor ("Sob
  consulta") entra como marcador fora da escala, no fim, com o prefixo —
  nunca some.

---

## 6. As quatro variantes

**IDs inalterados, sem alias, sem migração** (precedente da irmã): `aquarela`,
`boreal`, `meia-noite`, `terra` já são o que `LeadDemo.themeId` grava,
e nenhuma troca de luminância (três claras, uma escura — a regra pede ao
menos uma de cada; alternativa no §17, D5). `aquarela` continua default e
é a que carrega a conversão fiel do material bruto — com as mudanças que a
separação da irmã obriga (§17, D2).

| id | nome | fundo | tipo de estúdio | quem chega |
|---|---|---|---|---|
| `aquarela` | Aquarela — Ateliê de Cor | claro | estúdio autoral de cor: aquarela, neo-tradicional colorido | escolhe pela COR do portfólio e quer uma peça única; lê o manifesto |
| `boreal` | Boreal — Cobertura e Reforma | claro | cobertura (cover-up) e restauração de cor | tem uma tatuagem antiga que incomoda e quer saber se tem jeito: resultado, processo e dúvida antes do preço |
| `meia-noite` | Meia-noite — Cor Pop | **escuro** | cor saturada pop: anime, geek, neo-trad de desenho | jovem que chega pelo Instagram, escolhe por estilo e artista |
| `terra` | Terra — Homenagem e Retrato | claro | homenagem, retrato colorido (pessoas, pets), memória | quer eternizar alguém; lê depoimento antes de tudo, tem medo de errar o rosto |

Nenhum dos quatro tipos repete os da irmã (fechamento, ateliê de um
artista só com lista de espera, coletivo de flash/walk-in, primeira
tatuagem fine line).

### Paletas (contraste já medido e aprovado)

A `paleta` do `Theme` passa a guardar as **tintas** (legíveis): é o que
todo o resto da plataforma lê (`destaque`/`destaqueInk` do editor, LED,
barra). Os **vivos** das manchas moram em `Theme.pigmento.manchas`
(§17, D6).

| papel | aquarela | boreal | meia-noite | terra |
|---|---|---|---|---|
| fundo | `#FAF6F0` | `#F4F6F5` | `#0D0A12` | `#F5EFE6` |
| fundoAlt | `#F2EADC` | `#E6ECE9` | `#16111D` | `#EBE1D2` |
| fundoElevado | `#EADFCB` | `#DAE3DF` | `#211A2B` | `#E0D2BD` |
| texto | `#141414` | `#0F1513` | `#F6F2EE` | `#221A13` |
| textoSuave (sólido) | `#534D46` | `#434E4A` | `#B9B2BF` | `#54483C` |
| destaque = tinta 1 | `#A51C4C` | `#0A6B50` | `#3FD0EE` | `#963A1B` |
| destaqueInk | `#FFFFFF` | `#FFFFFF` | `#07141A` | `#FFFFFF` |
| acentoSecundario = tinta 2 | `#2440D0` | `#5A2BBE` | `#FF6CC4` | `#6E5210` |
| acentoTerciario = tinta 3 | `#94380B` | `#1F4FC4` | `#FFA86A` | `#275A4F` |
| manchas (vivos) | `#E0336F` `#2B4EFF` `#FF6B35` | `#12A57C` `#6A35D6` `#2B6BFF` | `#22C3E6` `#FF4FB8` `#FF9A52` | `#C4552F` `#C9961E` `#2F6B5E` |
| `--pv-mistura` | multiply | multiply | screen | multiply |
| luminância do fundo | 0,925 | 0,917 | 0,003 | 0,869 |

Medição (mesmo método do §2; negrito = reprovado — nenhum):

| par | piso | aquarela | boreal | meia-noite | terra |
|---|---|---|---|---|---|
| texto / fundo · alt · elevado | 4,5 | 17,11 · 15,42 · 13,96 | 17,02 · 15,43 · 14,10 | 17,63 · 16,65 · 15,12 | 15,00 · 13,25 · 11,53 |
| suave / fundo · alt · elevado | 4,5 | 7,75 · 6,98 · 6,32 | 7,97 · 7,23 · 6,61 | 9,52 · 9,00 · 8,16 | 7,75 · 6,85 · 5,96 |
| suave / mancha a α 0,30 (pior pigmento) | 4,5 | 4,83 | 4,87 | 5,20 | 4,98 |
| texto / mancha a α 0,55 (`<h1>`) | 3 | 6,84 | 6,48 | 4,96 | 6,28 |
| tinta 1 / fundo · alt · elevado | 4,5 | 6,80 · 6,12 · 5,54 | 5,99 · 5,43 · 4,96 | 10,73 · 10,13 · 9,19 | 6,30 · 5,56 · 4,84 |
| tinta 2 / fundo · alt · elevado | 4,5 | 7,17 · 6,46 · 5,85 | 7,67 · 6,95 · 6,35 | 7,66 · 7,24 · 6,57 | 6,38 · 5,64 · 4,91 |
| tinta 3 / fundo · alt · elevado | 4,5 | 6,89 · 6,21 · 5,62 | 6,51 · 5,90 · 5,39 | 10,34 · 9,77 · 8,87 | 6,90 · 6,10 · 5,31 |
| tinta N / pílula (vivo N a 16% sobre alt), pior | 4,5 | 4,96 | 4,66 | 5,87 | 4,63 |
| ink / tinta 1 (botão cheio) | 4,5 | 7,32 | 6,50 | 10,20 | 7,20 |
| texto do campo / campo do CTA final (tintas no claro, vivos no escuro) | 4,5 | 7,32 · 7,72 · 7,42 | 6,50 · 8,32 · 7,06 | 9,37 · 6,61 · 9,35 | 7,20 · 7,30 · 7,89 |
| vivo / fundo (só mancha e decoração — não é par de leitura) | — | 4,00 · 5,36 · 2,63 | 2,89 · 6,26 · 4,16 | 9,37 · 6,61 · 9,35 | 3,92 · 2,34 · 5,43 |

Folga mínima: `tinta 1 / elevado` na Terra (4,84) e a pílula da Boreal
(4,66). A última linha mostra por que o vivo nunca vira texto nem
estrela: 2,34 no mostarda da Terra. Composições novas que ponham texto
sobre superfície não listada aqui (bilhete, balão, etiqueta, disco da
paleta) entram na medição da sessão 3 antes do commit (§16, item 30).

### Tipografia (fontes locais, `.woff2` no repositório)

Nenhuma fonte das quatro variantes é buscada do Google no build. Fonte:
os pacotes `@fontsource` do npm (todos conferidos no registro em
2026-09-24, versão 5.3.0), subset `latin` (cobre Á-ú, Ç, Ã, Õ), copiados
para o repositório e declarados com `next/font/local` (§17, D7). A
mono da skin continua sendo a do corpo (fiel ao material bruto).

| variante | display (hero, títulos) | corpo | terceira | pacotes |
|---|---|---|---|---|
| aquarela | DM Serif Display | Archivo (variável) | — | `@fontsource/dm-serif-display`, `@fontsource-variable/archivo` (o woff2 de Archivo já está em `public/fontes/`, lancheria-2 — reaproveitar o arquivo, não duplicar) |
| boreal | Bricolage Grotesque (variável, eixo óptico) | Figtree (variável) | — | `@fontsource-variable/bricolage-grotesque`, `@fontsource-variable/figtree` |
| meia-noite | Dela Gothic One | Space Grotesk (variável) | — | `@fontsource/dela-gothic-one`, `@fontsource-variable/space-grotesk` |
| terra | Young Serif | Karla (variável) | Caveat (variável — só o manifesto `carta`, a legenda da `mesa` e o `caderno`) | `@fontsource/young-serif`, `@fontsource-variable/karla`, `@fontsource-variable/caveat` |

Nenhuma coincide com o par da irmã (Pirata One, Inter, JetBrains Mono,
Playfair Display Black). **A conferir na sessão 2, antes de adotar**: se a
Dela Gothic One cobre os acentos do português no subset latin (é uma
fonte de origem japonesa; se faltar glifo, cai para Anton —
`@fontsource/anton`, também conferido).

### Textura, forma e movimento

| | aquarela | boreal | meia-noite | terra |
|---|---|---|---|---|
| textura | manchas borradas `multiply` (original) + papel | decalque: linhas tracejadas violeta (o roxo do stencil), manchas de borda dura | retícula de pontos sobre os vivos, manchas em `screen` (brilho) | borda seca: mancha com anel mais escuro na borda (aquarela secando) + fibra de papel |
| raio (`TEMA_RAIOS`) | 4px | 0px | 12px | 24px |
| densidade | arejada | confortável | compacta | arejada |
| animação | marcante | sutil | marcante | sutil |
| hover · clique | lift · pressão | brilho · nenhum | zoom · pulso | lift · nenhum |
| intro | desligada (fiel) | desligada | desligada | desligada |

As manchas perdem o `filter: blur()` animado nas quatro: o gradiente
radial já é macio, e o filtro rasteriza por quadro (§14). Onde o
borrão for essencial (Aquarela), é aplicado uma vez numa camada estática
e só o `transform` anima.

### Ordem das seções (permutação das dez não-fixas; nenhuma nasce oculta)

- `aquarela`: manifesto, estilos, investimento, portfolio, artistas, depoimentos, processo, faq, agendar, contato *(a do material bruto)*
- `boreal`: portfolio, processo, faq, depoimentos, investimento, artistas, estilos, manifesto, agendar, contato *(resultado → como → dúvida → prova → preço)*
- `meia-noite`: estilos, portfolio, artistas, investimento, manifesto, depoimentos, faq, processo, agendar, contato *(estilo e mão primeiro)*
- `terra`: manifesto, depoimentos, portfolio, processo, artistas, faq, investimento, estilos, agendar, contato *(confiança antes do trabalho)*

### Efeito de fundo e LED sugeridos (defaults da variante, editáveis)

| | `fundoEfeito` | LED |
|---|---|---|
| aquarela | `grao` (papel), intensidade default do nicho | desligado (fiel) |
| boreal | `varredura-de-luz` (a cobertura passando sobre o antigo) | desligado |
| meia-noite | `aura` (brilho dos pigmentos no escuro) | `sutil`, estilo `dissipado`, `ledCores` = as três tintas |
| terra | `grao` | `sutil`, estilo `moldura` (o porta-retrato) |

Sem `faiscas` em nenhuma (255 Mpx/s de repintura na matriz de registro).

### Cópia de exemplo própria

Cada variante declara `slogan`, `hero.{rotulo,texto,cta}`, títulos e
rótulos de seção, os cinco estilos e os passos do processo coerentes com
o tipo de estúdio (Boreal: cobertura, reforma de cor, clareamento;
Meia-noite: anime, neo-trad, geek, cartoon, lettering colorido; Terra:
retrato, pet, flor de nascimento, caligrafia de quem se foi). Sem nome de
marca na cópia (a do exemplo, "MATIZ STUDIO", não pode aparecer em texto
corrido — só em `nome`, que o lead sobrescreve). Sem fato verificável
sobre o negócio (§15). Preços dos serviços coerentes com o tipo (a
cobertura orça por tamanho).

---

## 7. O nome grande na abertura e a âncora `hero`

- **O `<h1>` é sempre `data.nome`, nas quatro** (precedente aprovado da
  multimarcas, §6.1 de `plano-multimarcas.md`; confirmação no §17, D3).
  Quebra em até duas linhas por `quebrarTitulo(data.nome)`. O
  `secoes.hero.titulo`, se preenchido e diferente do nome (comparação
  sem caixa e sem espaços extras — a `linhaDeApoio` da multimarcas sobe
  para `lib/demos/`, não é copiada), vira linha de apoio logo abaixo, com
  o mesmo `data-demo-slot`. Nenhuma demo salva perde texto; nenhuma
  migração de banco.
- A âncora `data-d-secao="hero"` já é o primeiro filho do fluxo (topo da
  página) e envolve a `<section>` inteira; fica assim. O que muda: nas
  quatro composições o `<h1>` tem de estar **dentro dos primeiros 600px**
  do print de 390×844 (o Nav fixo tem 72px) e ocupar **≥ 70% da largura
  útil** em pelo menos uma linha. No medalhão, a moldura se ajusta ao nome
  (nunca o contrário — regra "o título nunca encolhe").
- Piso de corpo: `clamp(2.75rem, 9vw, 7.5rem)` × escala, igual nas
  quatro; no celular, **no máximo 3 linhas** para um nome de ~40
  caracteres (o teste usa "Estúdio de Tatuagem Contrato Real Ltda").
- **Miniatura do WhatsApp**: o print da âncora `hero` reduzido a 300px
  de largura tem de manter a altura de letra do nome ≥ 14px — medido no
  laço (§16, item 29), porque é esse recorte que vira a primeira mensagem
  de prospecção.
- Rótulo, texto e CTA do hero saem **visíveis no HTML do servidor**; a
  entrada animada só é ativada no cliente, abaixo da dobra.

---

## 8. Crescimento do contrato — opções (não decidido)

Só pode crescer agora: depois que a sessão 2 fechar, seção ou slot novo
quebra âncora configurada em `/config/app` e a trava. Se crescer, é o
**primeiro item da sessão 2**, antes de qualquer composição.

| opção | o que resolve | custo |
|---|---|---|
| **A. Não crescer** | Nada novo — e não precisa: onze seções já cobrem o funil de estúdio (estilo, preço, portfólio, artistas, prova, processo, dúvida, CTA). A essência é justamente não ter foto na abertura. | Zero. A drasticidade fica toda na composição (o §5 já tem onze seções diferentes). |
| **B. Seção `cobertura` (antes/depois) + 4 slots (`cobertura-antes-1/2`, `cobertura-depois-1/2`)** | Cobertura é um segmento grande do nicho e a Boreal inteira gira em torno dele; hoje o "antes/depois" só existe por convenção de legenda no portfólio (frágil: o operador reordena e o par se desfaz). | +1 `data-d-secao` (12), +4 slots (12) e `imagensAlt`, placeholders, `SECOES_POR_SKIN` automática, colapso 12×4. A seção existe nas QUATRO (a trava exige); nas outras três nasce oculta (`arranjo.ocultas`) ou precisa de desenho próprio. `ordemEfetiva` já insere seção nova antes da sucessora (multimarcas). Custo de captura: `ANCORAS_PADRAO` da Boreal pode querer apontar para ela. |
| **C. Slot `imagens.hero` (foto de abertura)** | Dá à folha em cinza um bloco escuro de foto — ajuda a drasticidade — e abre a abertura para a foto do próprio estúdio do lead. | +1 slot, `imagensOcultas` nas variantes que não desenham. Empurra a skin para o vocabulário da irmã (três das quatro aberturas dela são foto) e contra a essência (a mancha É a abertura). |
| **D. Slots `artista-1..3` (retrato)** | Rosto do tatuador vende em nicho autoral; hoje só há rabisco. | +3 slots. A composição de artista com retrato é o território da irmã (retrato/faixa/dossiê); a separação do §4 fica mais difícil. Placeholders de rosto precisam de SVG neutro. |

**Recomendação: A (não crescer).** B é a única que resolve um problema de
negócio real, mas o custo recai nas três variantes que não precisam dela
(seção nascida oculta em três de quatro é sinal de que ela é da variante,
não da skin). C e D compram drasticidade com o vocabulário da irmã. Se
você escolher B, o §5 ganha uma linha e a Boreal troca `vitrine` por
`díptico` na galeria.

---

## 9. Como a trava será verificada

**No HTML do servidor, com JavaScript desligado.** `renderToStaticMarkup`
da skin, parse sem executar script (mesmo método de
`barbearia-contrato.test.tsx`/`multimarcas-contrato.test.tsx`). Teste no
DOM do navegador não serve de prova de contrato — só de visibilidade
(§16, item 29).

Três camadas:

1. **`variantes.test.tsx` (existente, roda sozinho)** passa a cobrir a
   skin quando `variantes` entrar no registro: arranjo é permutação dos
   onze ids; mesmas chaves de `secoes` e mesmos VALORES de `imagens` nas
   quatro; cada variante emite exatamente os onze `data-d-secao` sem
   duplicata, na mesma lista; claro e escuro batendo com a luminância;
   um `<h1>` dentro da abertura.
2. **`pigmento-contrato.test.tsx` (novo)**, por variante, pelo caminho
   real (`montarDemoData(exemploDaSkin(...), lead, patch, skinId)`):
   - onze `data-d-secao`, sem duplicata; um único `<h1>`, dentro de
     `data-d-secao="hero"`, cujo texto normalizado é o nome inteiro —
     **com título salvo** (vira linha de apoio visível, depois do `<h1>`),
     **com título `""`** (o caso do `??`: o `<h1>` continua existindo com
     o nome) e **com título igual ao nome** (sem linha de apoio);
   - o wrapper `.pv` carrega os `data-pv-*` da composição declarada, e a
     `<style>` servida contém uma regra para cada valor declarado (knob
     sem CSS reprova);
   - **drasticidade como invariante**: para `abertura`, `galeria`,
     `precos` e `processo`, os quatro valores são distintos; no total,
     ≥ 4 knobs de seção com quatro valores distintos;
   - **separação da irmã**: nenhum valor de `PigmentoComposicao` igual a
     um valor de `TatuagemComposicao` na seção análoga (mapa do §4);
   - SSR visível: nenhum `opacity:0`/`translateY`/`hidden` inline no hero
     nem nos wrappers de seção; palavras do manifesto na cor acesa;
     overlay da intro ausente com `intro: true`;
   - lead vazio (§12): sem "Rua das Aquarelas", sem "desde 2018", sem
     "fictício", sem `href="#agendar"` dentro de `agendar`, nenhum `★`
     fora de `depoimentos`.
3. **Teste de mutação — permanente e manual.**
   - Permanente: `violacoesDeVariantes(variantes)` é uma função pura
     (em `tatuagem2/composicao.ts`) que o teste chama duas vezes: sobre
     as variantes reais (espera zero violações) e sobre uma lista
     **mutada**, em que a `boreal` é substituída pelo preset ANTIGO
     (congelado em `__tests__/fixtures/pigmento-presets-antigos.ts`, cópia
     literal do `themes.ts` de hoje) — espera violação nomeando `boreal`
     (sem `pigmento`, ela cai na composição default e empata com a
     `aquarela` nos quatro knobs de silhueta). Segundo controle: `boreal`
     com a composição da `aquarela` e paleta própria (o "preset de cor"
     puro) — também tem de reprovar.
   - Manual, uma vez, registrado em `qa/tatuagem-pigmento-vivo/STATUS.md`:
     editar `variantes.ts` trocando a declaração da `boreal` pelo preset
     antigo, rodar `npx vitest run pigmento-contrato variantes`, colar a
     saída (tem de falhar), reverter. Mesmo registro das mutações da
     trava original (renomear seção, tirar o escuro, divergir slot,
     esvaziar a abertura).

---

## 10. Portão de cinza

`scripts/qa-pigmento.mjs --so=cinza`, no molde de `qa-multimarcas.mjs`,
com a conversão para cinza extraída das três cópias atuais
(`paraCinza` em `qa-tatuagem.mjs`, `qa-chapa.mjs`, `qa-multimarcas.mjs`)
para `scripts/cinza.mjs` — este laço é o quarto a precisar dela.

1. `next build` + servidor (`qa-servidor.mjs`), rota `/interno/demo-qa`
   com `skin=tatuagem-pigmento-vivo&preset=<variante>` e o mesmo nome de
   lead nas quatro.
2. Celular **390×844, DPR 1** para as folhas (DPR 2 só no fps).
   Animações CONGELADAS antes do print: manchas numa fase fixa,
   manifesto aceso, `LineDraw` completo, trilha no estado do celular
   (zigue-zague), intro desligada — senão a diferença medida é de fase,
   não de composição.
3. Rolar a página inteira até o fim e voltar (dispara o que depende de
   interseção), então `fullPage` por variante.
4. Converter cada PNG para escala de cinza (luminância relativa por
   pixel) e montar **duas folhas**:
   - `qa-shots/pigmento/cinza-abertura.png` — as três primeiras telas
     (390×2532) das quatro lado a lado, em tamanho de leitura;
   - `qa-shots/pigmento/cinza-silhueta.png` — a página inteira das
     quatro no MESMO fator de escala (teto de 4.000px de altura).
5. Números que dão escala (não aprovam sozinhos): diferença média
   absoluta em cinza nas três primeiras telas para os seis pares, e a
   altura de cada página.
6. **Julgamento: abrir e olhar as duas folhas.** Dois de quatro
   indistinguíveis sem cor = as duas variantes voltam para a sessão 2. Os
   pares de risco são os três claros (aquarela × boreal × terra):
   inspeção obrigatória e nominal no STATUS.md. Referência de escala das
   irmãs: menor par da multimarcas 48,7 (as duas claras) — abaixo de 40,
   olhar duas vezes.

---

## 11. Slots que alguma variante não exibe

Com o contrato sem crescer (§8-A): **nenhum**. As quatro composições de
portfólio desenham as oito fotos:

| variante | como o portfólio mostra os 8 slots | risco que o laço mede |
|---|---|---|
| aquarela | trilha / zigue-zague — todas com caixa | caixa > 0 nas oito |
| boreal | vitrine — 1 grande + 7 miniaturas | miniatura ≥ 64px de lado (menor que isso é "não exibido" na prática) |
| meia-noite | manchas — 8 recortes | área visível do recorte ≥ 50% da caixa |
| terra | mesa — 8 polaroides sobrepostas | fração visível ≥ 60% por foto (§5) |

Então `imagensOcultas` fica vazio nas quatro, e
`IMAGENS_OCULTAS_POR_VARIANTE` não ganha entrada para esta skin (o teste
`variantes-mjs.test.ts` só lista skin com declaração não vazia).

**Aviso previsto na aba Imagens** — dois casos:
- Se o contrato crescer com C (foto do hero): cada variante que não
  desenhar a foto declara `imagensOcultas: { hero: "nenhum" }` e o editor
  mostra o aviso que já existe; verificado nas duas direções sem JS.
- **Do 9º item do portfólio em diante** (validate.ts aceita até 30 itens,
  a skin tem 8 slots): hoje a figura reaproveita a foto do slot 1 com um
  `data-demo-slot` inexistente. Proposta: a figura sem slot renderiza só
  a legenda (sem foto) e a aba Imagens avisa "o portfólio tem N itens e 8
  fotos; do 9º em diante sai só a legenda". Não é `imagensOcultas` (não
  depende de variante) — é aviso da skin, texto novo em `microcopiaDemo`
  do editor.

---

## 12. Lead sem dado de identidade

O exemplo passa a não ter `endereco` (§15) e já não tem `telefone`,
`whatsapp`, `instagram`, `cidade`, `horarios`. **Zero dado é o caso
normal** (harness, avulsa, lead recém-criado). Regra geral: campo sem dado
some; bloco com zero linhas não renderiza (nem borda, nem fundo, nem
rótulo órfão) — o componente de escada de identidade da multimarcas
(`Dados`) é o molde.

**Canal de agendamento** (hero, Nav, `agendar`): escada `whatsapp` →
`wa.me` com mensagem de `microcopiaDemo`; senão `telefone` → `tel:`;
senão `instagram` → perfil; **sem nenhum dos três, os botões não
renderizam** (o Nav fica só com nome e links; o hero termina no texto) —
nunca `href="#agendar"` apontando para a própria seção (§17, D4).

| variante | rodapé (`contato`) com dado | sem nenhum dado | `agendar` sem canal | outros lugares |
|---|---|---|---|---|
| aquarela | assinatura: nome + ponto, linhas empilhadas (endereço, cidade, horário, telefone se ≠ WhatsApp, Instagram) | nome + ponto + ©. A coluna de dados não existe | gota com título; sem botões a gota encolhe para o título (sem espaço reservado) | — |
| boreal | recibo: cada campo numa linha com guia pontilhada e rótulo de `microcopiaDemo` (`m.horario` etc.) | o recibo não renderiza; fica nome + © | talão sem o canhoto (a metade dos botões some; o picote vai junto) | a régua "antes → depois" do hero não depende de identidade |
| meia-noite | letreiro: dados numa linha acima do nome gigante, separados por ponto | a linha de dados não existe; só o nome gigante + © | faixa diagonal só com o título | LED não depende de dado |
| terra | colofão: um parágrafo corrido "endereço · cidade · horário · Instagram" | o parágrafo não existe; só "© ano nome" | postal sem o lado do endereço: o cartão vira uma face só com título + selo (o selo leva o nome, não dado de contato) | o medalhão não depende de dado |

`telefone` igual ao `whatsapp` não se repete (regra atual, mantida). Horário
sai de `resumirHorarios` já no idioma. Nenhuma variante mostra mapa, Waze
ou rota (não há hoje; continua não havendo).

Verificação (sessão 3): SSR com lead vazio e com lead cheio nas quatro
(§9) e o aferidor de caixa zerada no navegador para recibo, letreiro,
colofão e o lado do endereço do postal.

---

## 13. Listas dos laços `.mjs`

Onde a skin precisa entrar para os portões a enxergarem hoje:

| lista | arquivo | estado hoje | o que muda |
|---|---|---|---|
| `PRESETS_SEM_VARIANTES` | `capturas/temas.mjs` | tem `tatuagem-pigmento-vivo: [aquarela, boreal, meia-noite, terra]` | sai daqui |
| `VARIANTES_POR_SKIN` | `capturas/variantes.mjs` | ausente | entra, mesma ordem das variantes (`temas-mjs.test.ts` e `variantes-mjs.test.ts` exigem) |
| `IMAGENS_OCULTAS_POR_VARIANTE` | `capturas/variantes.mjs` | ausente | continua ausente (§11), salvo crescimento C |
| `ANCORAS_PADRAO` | `capturas/padrao.mjs` | `hero, investimento, estilos` | mantém (§17, D9) |
| `SECOES_POR_SKIN` | `capturas/ancoras.ts` | importa `TATUAGEM2_SECOES` — já derivada | nada |
| `SKINS` de `qa-cls.mjs` | `scripts/qa-cls.mjs:86` | lista escrita à mão, já com a skin | ver proposta abaixo |
| `SECOES`/`SLOTS` do laço da skin | `scripts/qa-pigmento.mjs` (novo) | — | ver proposta abaixo — não copiar o padrão de `qa-tatuagem.mjs`, que escreve as nove seções e os dez slots à mão |

`qa-visual.mjs --so=fps|variante|colapso|barra|avulsa` passa a percorrer
as quatro variantes sozinho quando `VARIANTES_POR_SKIN` tiver a entrada.

**Proposta de derivar da fonte** (§17, D8): uma rota interna
`GET /interno/demo-qa/contrato`, atrás da mesma guarda de `/interno/demo-qa`,
que devolve em JSON o que o registro sabe — por skin: `secoes` (ids, fixa),
`slots` (chaves de `demoDataExemplo.imagens`), `variantes` (id, fundo,
`imagensOcultas`, `modosDeCorReprovados`). Todo laço que precisa dela já
sobe o servidor antes de medir; um helper `lerContrato(base)` em
`capturas/contrato.mjs` substitui as listas. Nesta migração: o
`qa-pigmento.mjs` nasce lendo a rota, e o `SKINS` do `qa-cls.mjs` passa a
vir dela (hoje ele já esquece a `lancheria-2`). `variantes.mjs`/`temas.mjs`
continuam existindo (os laços leem no topo do módulo, antes do servidor)
e seguem cobertos pelos testes de contrato — a remoção deles é limpeza
separada, fora desta migração.

---

## 14. Fps

`node scripts/qa-visual.mjs --so=fps --skin=tatuagem-pigmento-vivo`: 20
células (4 variantes × 5 modos de cor: tema, fixa, transição,
iridescente, arco-íris) + a linha de referência `nenhum`; celular
390×844 DPR 2, CPU 4×, intensidade 3, rolagem ativa a 1800 px/s,
mediana de 5 cargas, piso 45. O efeito default do laço é `grao`
(comparável com as irmãs); uma segunda rodada com `QA_FPS_EFEITO=` igual
ao efeito default de cada variante (`varredura-de-luz` na boreal, `aura`
na meia-noite) mede o que a demo publicada de fato carrega.

- **Célula reprovada desabilita AQUELE modo de cor naquela variante**:
  entra em `modosDeCorReprovados` + `motivoModosReprovados` da variante,
  o editor já desabilita o modo e a resolução cai em `tema`. **Nunca a
  variante.**
- **Se a linha de referência (`nenhum`) cair abaixo de 45**, não é
  problema de modo de cor e desabilitar modo não resolve: é custo da
  própria skin. Suspeitos na ordem: `filter: blur()` animado nas manchas
  (já removido no §6), a trilha pinada, a retícula da meia-noite, a
  mesa com sombras. Corrige-se a skin; a variante não sai com a
  referência reprovada.
- Saída em `qa/tatuagem-pigmento-vivo/FPS.md` (tabela fps + superfície
  repintada).

---

## 15. Verificação — reportado, NÃO corrigido nesta sessão

| item | tem? | onde | nota |
|---|---|---|---|
| **Endereço fictício no exemplo** | **SIM** | `exemplo.ts:21` — `"Rua das Aquarelas, 88 — Centro"`, desenhado em `Skin.tsx:650` | já listado na "Auditoria de endereço" do ARCHITECTURE.md |
| **Fato inventado sobre o negócio** | **SIM** (não é nota de Google) | `exemplo.ts:75` — `hero.texto`: "Sessões por agendamento, **desde 2018**." (ano de fundação atribuído ao estúdio do lead, na primeira tela); `exemplo.ts:183` e fallback `Skin.tsx:679` — "**Estúdio fictício, tinta imaginária.**" no rodapé: afirma, na demo de um estúdio real, que ele é fictício | nenhum "★ no Google", nenhuma contagem de avaliações, nenhum selo de plataforma. Limítrofes (conteúdo de demonstração, decisão no §17, D10): "cobertura é quase uma especialidade da casa" (`:173`), "Dez anos de traço grosso" (`:124`, sobre artista fictício), "Três mãos, três assinaturas" (tamanho de equipe), "Datas avulsas no Instagram" (`:46`, cita Instagram mesmo sem `instagram`) |
| nota dentro de depoimento | sim | `exemplo.ts:59,64,69` (`nota: 5`) → `★★★★★` em `Skin.tsx:517` | **fica** (decisão já tomada) |
| **Botão de rota para endereço fictício** | **NÃO** | o endereço é só texto; não há Waze, Maps nem mapa | — |
| **`??` no `<h1>`** | **SIM** | `Skin.tsx:237` — `s.hero?.titulo ?? data.nome`; com `""` o `SplashTitle` devolve `null` e o `<h1>` some | pior que as irmãs (lá o `<h1>` saía vazio) |

A correção dos três "SIM" é o item 3 da sessão 2 (sai do exemplo; fato
inventado não vira slot).

---

## 16. Divisão da execução

Um commit por item, cada um citando a captura que o confirma. Numeração
contínua entre as sessões.

### Sessão 2 — composição visual (captura e inspeção OBRIGATÓRIAS)

Laço de captura descartável ou o próprio `qa-pigmento.mjs` em esqueleto;
toda imagem é aberta e olhada antes do commit, nas quatro variantes, em
390 e 1100px.

*Bloco A — fundação (antes de desenhar; mecânica):*

1. **Contrato** — se a decisão do §8 for crescer, a seção/slots entram
   aqui, com placeholders, manifesto de imagens e `registry.test.ts`
   verde. Se não, item vazio (registrar no plano que não cresceu).
2. **Tipo e registro** — `PigmentoComposicao` em `lib/demos/types.ts` +
   `Theme.pigmento?`; `tatuagem2/variantes.ts` via `criarVariante` com as
   quatro declarações (id, nome, descrição, fundo, ordem, composição,
   tema); `registry.ts` com `variantes`, `themePresets` derivado,
   `demoDataExemplo` da primeira; listas do §13 (`temas.mjs` →
   `variantes.mjs`). Trava existente verde.
3. **Exemplo limpo (§15)** — sai `endereco`, sai "desde 2018", sai
   "Estúdio fictício…" (exemplo e fallback), cópia sem "MATIZ" em texto
   corrido; os limítrofes conforme §17, D10.
4. **Documento servido** — `FadeUp`/`SectionReveal` visíveis no servidor
   e animados só no cliente abaixo da dobra; manifesto aceso no servidor
   (o cliente apaga, num efeito de layout, só as palavras ainda não
   alcançadas); `LineDraw` completo no servidor; intro fora do HTML
   servido; FAQ em `<details>/<summary>`.
5. **`<h1>` e `??`** — `<h1>` = `data.nome` com `quebrarTitulo`; linha de
   apoio (`linhaDeApoio` promovida para `lib/demos/`); `?.trim() ||` nos
   três `??` de texto; fallbacks literais removidos (CTA do Nav sem canal
   não renderiza); `<h2>`/rótulo vazio não renderiza.
6. **Canal e identidade (§12)** — escada whatsapp → tel → Instagram →
   nada; nenhum `#agendar` circular; componente de dados com zero linhas
   = zero bloco.
7. **Tokens** — `--pv-mistura`; tinta × mancha (`Theme.pigmento.manchas`);
   branco cravado do CTA final → texto do campo; `<em>` sobre campo na
   cor do título; botão contorno → cheio; `imagensAlt` com as 8 chaves;
   9º item do portfólio sem foto emprestada.
8. **Fontes locais** — `.woff2` dos pacotes do §6 no repositório,
   `next/font/local`, variáveis `--font-demo-*` novas; conferir acentos da
   Dela Gothic One com um print de "ÇÃO ÁÉÍÓÚ ÂÊÔ ÃÕ" antes de adotar.

*Bloco B — composição (visual, um commit por seção, captura citada):*

9. `tatuagem2/composicao.ts` — CSS do servidor, default na folha,
   especificidade sem `!important`; tokens de superfície por variante.
10. Abertura — mancha · sobreposição · cartela · medalhão (e o nome
    dentro dos 600px/70% do §7 conferido no print).
11. Portfólio — trilha/zigue-zague · vitrine · manchas · mesa.
12. Investimento — gotas · régua · etiquetas · selos.
13. Processo — onda · camadas · quadrinhos · ciclo.
14. Manifesto — círculo · grifo · pilha · carta (acendimento nas quatro).
15. Estilos — mostruário · bento · paleta · baralho.
16. Artistas — assinaturas · monogramas · bandeiras · livro.
17. Depoimentos — bilhetes · conversa · coro · caderno (estrelas na
    tinta, dentro do depoimento).
18. FAQ — acordeão · fichas · manchete · respostas.
19. Agendar — gota · talão · diagonal · postal (com e sem canal).
20. Contato — assinatura · recibo · letreiro · colofão (com e sem dado).
21. Textura e essência — manchas por variante (`multiply`/`screen`,
    borda dura, borda seca, retícula), ponto rastreador e cursor nas
    quatro; conferir as três marcas do §3 em cada uma.
22. Paletas, tipografia e tema do §6 aplicados; efeito/LED default.
23. Cópia de exemplo própria por variante (§6).
24. Miniaturas `public/demos/tatuagem2/{aquarela,boreal,meia-noite,terra}.jpg`.
25. **Folha em cinza preliminar** (§10) ao fim da sessão, olhada — se
    dois claros empatarem, a sessão 2 não fecha.

### Sessão 3 — testes de contrato, fps, contraste, cinza, documentação

26. Testes que rodam sozinhos, verdes: `registry`, `variantes`,
    `lead-data-contract`, `imagens-slot-oculto`, `precos-locale`,
    `microcopy-locale-contract`, `temas-mjs`, `variantes-mjs`, `ancoras`;
    ajustar `FaqAccordion.test.tsx` ao `<details>`.
27. `pigmento-contrato.test.tsx` completo (§9, camada 2), incluindo lead
    vazio/cheio e título salvo/vazio/igual ao nome.
28. **Mutação** (§9, camada 3): o teste permanente com a fixture dos
    presets antigos, e a mutação manual registrada no STATUS.md com a
    saída do vitest falhando.
29. `scripts/qa-pigmento.mjs` (lendo a rota de contrato do §13):
    contrato sem JS em 390 e 1100px (nome VISÍVEL no `<h1>`, onze seções,
    sem transbordo horizontal, nome dentro de 600px/70%, miniatura de
    300px com letra ≥ 14px), caixas dos 8 slots e as frações visíveis do
    §11, formas orgânicas sem texto cortado, aferidor de caixa zerada do
    §12. `scripts/cinza.mjs` extraído das três cópias.
30. Contraste refeito com `contrasteWcag`, composto sobre as superfícies
    REAIS das composições novas (bilhete, balão, etiqueta, disco, selo,
    talão, postal) — como teste unitário, não script descartável; a
    tabela do §6 atualizada com o número final.
31. Portão de cinza (§10): as duas folhas, os seis pares medidos,
    inspeção nominal dos três pares claros no STATUS.md.
32. `qa-cls.mjs --so=skins` sem deslocamento (o `SKINS` dele lendo a rota).
33. Matriz de fps (§14): 20 células com `grao` + rodada com o efeito
    default de cada variante; `modosDeCorReprovados` conforme o portão.
34. `--so=variante`, `--so=colapso` (8 slots × 4), `--so=barra`,
    `--so=avulsa`.
35. `qa/tatuagem-pigmento-vivo/{STATUS.md,FPS.md,contrato-browser.json}`;
    seção "Tatuagem Pigmento Vivo" no ARCHITECTURE.md no molde da
    multimarcas; tirar a linha da tabela "Auditoria de endereço" (sobram
    três); "as próximas QUATRO migrações" vira TRÊS; registrar a rota de
    contrato dos laços.

---

## 17. Decisões em aberto

**D1 — Crescer o contrato?** Opções no §8: (A) não crescer, (B) seção
`cobertura` com 4 slots, (C) slot `hero`, (D) slots de retrato de
artista. *Recomendo A*: a essência é a abertura sem foto, e B pesa sobre
três variantes que nascem com a seção oculta. Tem de ser decidido antes
da sessão 2.

**D2 — Fidelidade ao material bruto × separação da irmã.** O desenho
original da pigmento-vivo coincide com tipos da irmã em seis seções
(manifesto ≈ `marca`, portfólio no celular = `tira`, investimento =
`lista`, depoimentos = `cartoes`, processo ≈ `colunas`, agendar ≈
`cartaz`). Opções: (a) a separação vence e a Aquarela muda essas
seções, preservando o original nas assinaturas (manchas, `SplashTitle`,
manifesto que acende, ponto rastreador, trilha pinada no desktop,
rabiscos); (b) a Aquarela fica fiel e aceita repetir tipos da irmã —
viola o requisito; (c) fiel só no desktop. *Recomendo (a)*: o requisito é
explícito, e a conversão fiel continua recuperável no histórico do git.

**D3 — `<h1>` sempre o nome, título vira linha de apoio.** Precedente
aprovado na multimarcas. Alternativa: manter `<h1>` = título com
`?.trim() ||` (menor mudança, mas um slogan digitado tira o nome do print
de prospecção). *Recomendo seguir o precedente.*

**D4 — CTA sem nenhum canal (sem WhatsApp, telefone e Instagram).**
(a) Os botões não renderizam (hero termina no texto; `agendar` fica só
com o título na forma da variante); (b) apontam para `#portfolio` com
rótulo "Ver portfólio" de `microcopiaDemo`; (c) como hoje, `#agendar`.
*Recomendo (a)*: é honesto, e a maioria dos leads reais tem telefone vindo
do Google; (c) é o defeito atual (botão que aponta para si mesmo).

**D5 — Três claras e uma escura.** Manter os ids e as luminâncias (sem
alias, sem migração) deixa três variantes claras — o par mais difícil do
portão de cinza. Alternativa: a Terra vira escura com id novo
(`terra-noite`?) e alias `terra → aquarela` por luminância. *Recomendo
manter*: a drasticidade do §5 é de silhueta, não de luminância, e a
folha em cinza (item 25) é o teste; se reprovar, esta decisão reabre.

**D6 — Onde mora a cor viva.** (a) `paleta` guarda as tintas legíveis e
os vivos vão para `Theme.pigmento.manchas`; se o operador trocar a cor N
no editor, a mancha N passa a ser a cor nova (simples, previsível);
(b) `paleta` guarda os vivos e as tintas são derivadas em render
(escurecer até 4,5:1) — o editor e o LED passariam a ver cores que
reprovam contraste. *Recomendo (a).*

**D7 — Como as fontes locais entram.** (a) `next/font/local` com os
`.woff2` em `src/app/demo/fonts/local/`, variáveis `--font-demo-*` como
as do `core.ts` — o resto da Forja (editor, `fontesEscolhidas`) enxerga
igual; (b) folha CSS por variante em `public/fontes/` (precedente da
`lancheria-2`, `Tema.folhaFontes`). *Recomendo (a)*: (b) existe para tema
calibrado vindo de pacote externo. Nas duas, as fontes do `core.ts` que
outras skins usam não mudam nesta migração.

**D8 — Listas dos laços.** (a) Rota `/interno/demo-qa/contrato` e
`lerContrato()` (derivação em tempo de execução, zero cópia); (b) arquivo
`.mjs` gerado do registro por script + teste que falha se estiver
defasado; (c) manter listas à mão com teste de contrato (hoje). *Recomendo
(a)* para o laço novo e o `qa-cls.mjs`, deixando a troca de
`variantes.mjs`/`temas.mjs` para uma limpeza à parte.

**D9 — `ANCORAS_PADRAO` da skin.** Manter `hero, investimento, estilos`
ou trocar para `hero, portfolio, investimento`. *Recomendo manter*: o
portfólio é a seção mais alta no celular em três variantes (o caso ruim
da moldura, mesmo raciocínio da multimarcas com o estoque), e só afeta
skin sem marcação salva em `/config/app`.

**D10 — Conteúdo de demonstração limítrofe.** Artistas com nome próprio,
"dez anos de traço", "três mãos", "cobertura é especialidade da casa".
(a) Manter os nomes (regime dos carros da multimarcas: conteúdo de
exemplo) e tirar só as afirmações de tempo, tamanho de equipe e
especialidade; (b) manter tudo; (c) neutralizar também os nomes. *Recomendo
(a)*: o que se afirma sobre o NEGÓCIO do lead (anos, equipe, especialidade)
é fato verificável; o nome de um artista fictício é claramente
substituível pelo operador.
