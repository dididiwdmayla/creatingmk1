# Plano — `multimarcas-vortice`: de quatro presets para quatro variantes

Aprovado em 2026-09-23. As etapas rodam em sessões separadas; este
documento é a fonte única entre elas. **O contrato de seções CRESCE nesta
migração** (§5), e cresce na etapa 1 — depois que ela fechar, não cresce
mais.

**Etapa 1 — concluída em 2026-09-23** (itens 1–6, §9). Decisões tomadas na
execução, não previstas em detalhe pelo texto original do plano:

- **Item 5 ficou mínimo de propósito.** `multimarcas/variantes.ts` já
  declara as quatro variantes (`vortice`/`patio`/`garagem`/`campo`) via
  `criarVariante`, com o preset de paleta/tipografia herdado dos presets
  antigos (só renomeado), o arranjo default de seções (§6 "Ordem default")
  e `imagensOcultas` do hero em vortice/patio (§8) — mas as QUATRO
  compartilham a MESMA camada de exemplo (`MULTIMARCAS_EXEMPLO`, sem cópia
  própria por variante) e nenhuma tem `theme.multimarcas` (o tipo existe
  desde o item 3, mas nenhum valor foi atribuído ainda). Composição visual
  (`MultimarcasComposicao` por variante, o CSS de servidor) e cópia própria
  são o item 19/20/21, na etapa 3 — o item 19 deve ATUALIZAR este arquivo,
  não recriá-lo.
- **A seção `destaque` já renderiza**, em `Skin.tsx` — desenho único (foto
  + ficha + CTA), sem os knobs de composição por variante. Foi necessário
  para fechar o item 5: a trava `__tests__/variantes.test.tsx` compara o
  HTML DO SERVIDOR das quatro variantes e exige o MESMO conjunto de
  `data-d-secao` — uma seção nova sem render algum já bastaria para o
  marcador aparecer (o wrapper `<div data-d-secao>` do laço de seções não
  depende de conteúdo), mas deixá-la vazia pareceria defeito. A etapa 3
  (item 17) deve SUBSTITUIR este desenho único pelos quatro knobs, não
  empilhar por cima.
- **`imagens.hero` não é lido por nenhum componente ainda** (`Hero.tsx`
  continua só texto + velocímetro). É dado do contrato (slot existe,
  `imagensOcultas` declarado em vortice/patio), mas a foto de Garagem/Campo
  só aparece quando a etapa 3 (item 17/18) desenhar a abertura `sangrada`/
  `dividida`.

**Decisões da aprovação:**
- Crescer o contrato: seção `destaque` e slots `imagens.hero` e
  `imagens.destaque` (§5).
- `ANCORAS_PADRAO` da skin passa a `hero, destaque, simulador`.
- O `<h1>` é sempre o nome do negócio. Demo já salva com título **não perde
  o texto**: ele vira a linha de apoio, provado por teste (§6.1).
- A nota "4,9★ no Google" **sai do exemplo** — não vira slot. Nota de
  avaliação é fato verificável sobre o negócio do lead; inventá-la é pior
  que deixar vazio. Mesma lógica dos botões Waze e Maps: sem endereço do
  lead, não desenha (§7).
- Os dois achados acima foram verificados nas outras skins não migradas e
  ficam registrados como pendência, sem correção nesta migração (§10).

---

## 1. Inventário da skin hoje

Oito seções (`src/components/demos/multimarcas/secoes.ts`), só `hero` é
fixa. `avaliacao` e `contato` têm `alignOptions` (`esquerda`/`centro`); as
sete não-fixas oferecem `entradaOptions` sem typewriter.

| seção | composição atual | slots de texto |
|---|---|---|
| hero (fixa) | tela cheia tipográfica: `<h1>` em duas linhas (a 2ª no acento) revelado palavra a palavra, linha diagonal com parallax, velocímetro pequeno no canto cuja agulha segue a velocidade do scroll, dois CTAs pílula, chevrons | `secoes.hero.{rotulo,titulo,texto,cta,ctaSecundaria}` (título cai em `nome`) |
| estoque | pílulas de filtro por `categoria` + grade `auto-fill minmax(288px)`; card com foto 16:10, preço contando de zero, chips, painel expansível com descrição + CTA WhatsApp | `.rotulo`, `.titulo`, `.texto` (selo de garantia), `.cta`, `.ctaSecundaria`, `servicos.N.{nome,precoValor,categoria,destaques,descricao}` |
| vantagens | grade de 4 cartões numerados sobre `fundoAlt` | `.rotulo`, `.titulo`, `.itens.N.{titulo,texto}` |
| numeros | linha de 3 contadores, `pt-3` — desenhado como continuação de vantagens | `.itens.N.{titulo,detalhe}` |
| simulador | dois cartões: controles (valor, entrada, 24/36/48/60×) e resultado com odômetro de dígitos | `.rotulo`, `.titulo`, `.texto`, `.cta` |
| avaliacao | faixa inteira no acento, CTA invertido, marquee de marcas | `.rotulo`, `.titulo`, `.texto`, `.cta`, `.itens.N.titulo` (marcas) |
| depoimentos | carrossel arrastável com autoplay de 6s e barra de progresso, avatar de iniciais | `.rotulo`, `.titulo`, `depoimentos.N.{autor,contexto,texto}` |
| contato | `<footer>` em duas colunas (endereço/horário/telefone × botões Waze, Maps, WhatsApp) + barra com wordmark-easter-egg, nav e três ícones sociais | `.rotulo`, `.titulo`, `.cta`, `.texto`, `nome`, `endereco`/`cidade`, `horarios`, `telefone`, `instagram` |

Chrome fora de seção, sem `data-d-secao` (correto): `Nav` (fixed),
`ProgressBar` (fixed), `CustomCursor`, `Preloader` (via `IntroExperience`),
`WhatsAppFloat`, `LedEdges`, e as duas réguas de acento (depois do hero e
depois de depoimentos — esta dentro do marcador de `depoimentos`).

**9 slots de imagem:** `carro-1..9`. Não existe foto de abertura.
Nenhum `imagensAlt`.

### O que é literal e precisa virar slot ou token

**Cores cravadas.**
- `CORES_AVATAR` — sete hex em `interactive/TestimonialCarousel.tsx:8`, com
  `text-white` por cima (`:123`). Um deles (`#A0741F`) mede **4,19:1** com
  o branco das iniciais (15px bold, não é texto grande) — reprova nas
  quatro paletas, porque não depende de paleta.
- Sombra marrom `rgba(60,30,10,.16)` no hover do card (`Skin.tsx:499`) e
  `rgba(60,30,10,.3)` no polegar do range (`Skin.tsx:527,529`) — calibradas
  para creme; em fundo escuro somem ou sujam. Análogo exato do
  `bg-black/10` da chapa.
- O resto já passa por token (`color-mix` sobre `--d-accent`/`--d-text`).
  O `#000` do `maskImage` do filtro é máscara, não cor — fica.

**Português (e italiano) no chrome, fora de `microcopiaDemo`.**
- `Simulador.tsx`: `"VALOR DO VEÍCULO"`, `"ENTRADA · x%"`, `"PARCELAS"`,
  `"PARCELA ESTIMADA"`, `"/mês"`, `"Financiado: R$ … em N× · taxa ref. …
  a.m."`, `"Valores simulados, sujeitos a análise de crédito."`, o fallback
  `"Solicitar proposta"` e a mensagem de WhatsApp. **`R$` cravado quatro
  vezes e `toLocaleString("pt-BR")`** — o simulador ignora `idioma`/`moeda`
  que a skin recebe.
- `Nav.tsx`: `"Falar no WhatsApp →"` e a mensagem
  `"Olá! Vim pelo site e quero mais informações."` (repetida em
  `WhatsAppFloat.tsx`).
- `Skin.tsx`: `NAV_LABEL` (Estoque/Vantagens/…), `"Abrir no Waze"`,
  `"Abrir no Google Maps"`, o fallback `"Conteúdo ilustrativo."`, as
  mensagens `` `Olá! Vim pelo site da ${nome}…` `` e
  `"Olá! Quero uma avaliação do meu carro."`.
- `CarCard.tsx`: `` `Olá! Tenho interesse no ${nome} (${preço}). Ainda está disponível?` ``.
- `Preloader.tsx`: `"GIRI ×1000"` e **`"VEGLIA · MILANO"`** — Veglia é
  fabricante real de instrumentos automotivos. Marca real cravada no
  componente; sai.
- `StatCounter`/`CarCard` formatam o número com `formatarNumeroBR` mesmo em
  `en`/`USD` (o símbolo já vem de `simboloMoeda`; o separador de milhar não).

Já passam por `microcopiaDemo`: `m.scrollEstilizado`, `m.todos`,
`m.menu`/`m.fecharMenu`, `simboloMoeda`.

**Alts.** `CarCard.tsx:263` usa `alt={servico.nome}` — derivado da copy,
mesmo caso da tatuagem e da chapa. Viram `imagensAlt` opt-in (11 chaves,
contando os dois slots novos do §5).

**Endereço fictício.** `MULTIMARCAS_EXEMPLO.endereco:
"Av. Principal, 1000 — Centro"`. É a linha desta skin na tabela "Auditoria
de endereço" do ARCHITECTURE.md, e aqui o defeito é pior que texto: o
endereço **liga os botões Waze e Google Maps**, que navegam para um lugar
inventado em toda demo de lead sem endereço. Sai na migração; a tabela cai
de cinco para quatro skins.

**Links falsos.** Os ícones de Facebook e YouTube apontam sempre para
`#topo`, e o de Instagram também quando não há `@`. Não existe campo de
Facebook/YouTube em `DemoData`: saem. Instagram só com `instagram`.

**A marca do exemplo vaza para o lead.** `vantagens.rotulo` é
`"POR QUE A VÓRTICE"` e um depoimento diz `"Terceira compra na Vórtice"`.
Um lead chamado "Auto Center Silva" recebe a demo falando "Vórtice". A
cópia de cada variante nasce sem nome de marca.

**Nota de avaliação inventada.** `numeros` afirma `"4,9★ avaliação no
Google"` — um fato verificável atribuído ao negócio do lead, que pode ter
3,8, num site que vai para o dono. **O item sai do exemplo; não vira
slot.** Nenhuma variante declara nota, contagem de avaliações ou selo de
plataforma de terceiros (Google, Reclame Aqui, Webmotors…) na cópia de
exemplo. `numeros` fica com os itens sobre a OFERTA (itens revisados,
meses de garantia, minutos de aprovação). Se um dia a nota vier, vem do
dado real do lead, não do exemplo — fora do escopo desta migração.

### O `<h1>` existe, e tem três defeitos

`Hero.tsx:114`, dentro do wrapper `data-d-secao="hero"` (`Skin.tsx:550`).

1. **`hero?.titulo ?? nome`** (`Hero.tsx:60`) — `??` só cai no fallback com
   `undefined`; um título salvo como string vazia renderiza `<h1>` em branco.
2. **Quando há título, o nome sai do `<h1>`.** O exemplo não declara
   `hero.titulo` (então hoje cai no nome), mas qualquer título digitado —
   ou o default histórico `"Seu próximo carro já está aqui"` em
   `legado.ts` — tira o nome da abertura. Aprovado (§6.1): o `<h1>` é
   SEMPRE o `nome`; `secoes.hero.titulo`, se preenchido, vira a linha de
   apoio logo abaixo, sem perder o texto de nenhuma demo já salva.
3. **Sem JavaScript o nome não aparece** (lido no código; a confirmar no
   laço da etapa 4). `IntroExperience` começa com `introDone=false` no
   servidor, então cada palavra do `<h1>` sai em `translateY(115%)` dentro
   de `overflow:hidden`; rótulo, texto e CTAs saem com `opacity:0`. Com
   `intro` ligada — as QUATRO presets atuais ligam — o `Preloader` também
   sai no HTML do servidor, `fixed inset-0` com fundo opaco, cobrindo a
   página. E `SectionReveal` (motion, `initial={{opacity:0}}`) deixa as
   sete seções não-fixas transparentes. Os preços saem como `0` até o
   contador rodar. É o mesmo defeito que a barbearia resolveu ("reveals só
   são ativados no cliente, sem esconder o documento servido").

### Os `??` que deveriam ser `||`

| onde | expressão | efeito com string vazia |
|---|---|---|
| `Hero.tsx:60` | `hero?.titulo ?? nome` | `<h1>` em branco |
| `Skin.tsx:136` | `s[id]?.rotulo ?? NAV_LABEL[id] ?? …` | link de nav em branco (topo e rodapé) |
| `Skin.tsx:471` | `s.contato?.texto ?? "Conteúdo ilustrativo."` | linha em branco — e o fallback é literal; sai como o `"FEITO COM OBSESSÃO"` da chapa |
| `Simulador.tsx:194` | `(ctaLabel ?? "Solicitar proposta")` | botão sem texto |

Na mesma família, sem `??`: os `<h2>` de todas as seções e o rótulo de
`avaliacao` (`Skin.tsx:288`) renderizam o elemento com `data-demo-slot`
mesmo vazios.

### Três achados a mais

- **O simulador não alcança o estoque.** `VALOR_MIN` é 60.000; o HB20
  (39.900) e o Polo (49.900) do exemplo não podem ser simulados. `VALOR_MAX`
  é 400.000 para um estoque que para em 149.900.
- **`numeros` supõe vantagens acima.** `pt-3` e o mesmo `fundoAlt` fazem a
  costura; reordenado para longe de `vantagens`, ele gruda no que vier antes.
- `public/demos/multimarcas/foto/*.webp` não é lido por nenhum código —
  só o manifesto de imagens o cita.

---

## 2. Contraste das paletas atuais

Alfa composto sobre a superfície real onde o texto pousa, fórmula WCAG de
`tema.ts`. Só linhas de texto de leitura (≤18px, não bold-grande). A medição
foi um script descartável desta sessão; refazer com `luminancia` de
`tema.ts` e a mistura linear `fg·α + bg·(1−α)` por canal.

| par (onde aparece) | vórtice | meia-noite | grafite | azul-clássico |
|---|---|---|---|---|
| texto / fundo, alt, elevado | 15,6 · 14,1 · 16,4 | 16,5 · 15,6 · 14,8 | 16,3 · 15,0 · 13,6 | 14,6 · 13,0 · 15,6 |
| suave / fundo (texto do hero) | 5,22 | 6,82 | 6,42 | **4,47** |
| suave / alt (horários, legenda dos números) | 5,01 | 6,62 | 6,15 | **4,27** |
| suave / chip (elevado + 3% texto) | 5,21 | 6,14 | 5,54 | **4,48** |
| suave / elevado (texto das vantagens, simulador) | 5,33 | 6,43 | 5,83 | 4,58 |
| destaque / fundo (rótulos 13px) | 4,87 | **2,86** | 7,68 | 7,42 |
| destaque / alt (rótulo de vantagens e contato) | **4,41** | **2,70** | 7,04 | 6,59 |
| destaque / elevado (contexto do depoimento, `R$`, filtro ativo) | 5,13 | **2,56** | 6,42 | 7,89 |
| ink / destaque (CTAs) | 4,87 | 6,08 | 7,68 | 8,39 |
| ink 85% / destaque (texto da avaliação) | **3,72** | 4,87 | 6,03 | 6,57 |
| ink 75% / destaque (rótulo da avaliação) | **3,08** | **4,16** | 4,89 | 5,51 |

**Três das quatro reprovam** — como na chapa.
- **Vórtice** reprova no rótulo sobre `fundoAlt` (4,41) e nos dois textos
  com opacidade sobre o vermelho da avaliação (3,72 e 3,08).
- **Meia-noite** reprova em todo texto no acento: o verde `#0C6B44` sobre
  marrom quase preto mede 2,6–2,9 — rótulos de seção, contexto do
  depoimento, `R$`, pílula de filtro ativa. Mais o rótulo da avaliação (4,16).
- **Azul-clássico** reprova no `textoSuave` a 62%: o parágrafo do hero
  (4,47), horários e legendas sobre `fundoAlt` (4,27), chips (4,48).
- **Grafite** passa em tudo.
- O avatar `#A0741F` com iniciais brancas (4,19) reprova nas quatro.

Regra para as paletas novas: nada de opacidade em texto sobre o acento
(a avaliação usa o `ink` inteiro); `textoSuave` medido composto sobre as
três superfícies e sobre o chip; e todo acento usado como texto medido
contra `fundo`, `fundoAlt` **e** `fundoElevado`, não só contra `fundo`.

---

## 3. A essência — o que existe nas quatro e não muda

**O painel de instrumentos.** Esta é a única skin da Forja em que os números
se movem como mostrador de carro: a agulha do velocímetro segue a velocidade
com que se rola a página, a parcela do simulador rola dígito a dígito como
odômetro, e o preço de cada carro conta de zero quando entra na tela. Está
nas quatro variantes, em escalas e lugares diferentes (§6): selo pequeno no
canto, mostrador grande no pé de uma foto, marcador ao lado da busca.

Junto dele, o que também não muda:
- **O carro como unidade.** Foto, nome, preço em mono tabular e os chips
  ano / km / câmbio / combustível — em card, linha, vitrine ou tabela, mas
  sempre esses quatro dados juntos.
- **Todo CTA leva contexto ao WhatsApp.** O interesse vai com o carro e o
  preço; a simulação vai com valor, entrada e parcelas; a avaliação vai com
  o carro do cliente. Nenhum "Olá, quero informações" genérico onde há
  contexto a mandar.
- **O filtro do estoque.** Por categoria ou por faixa de preço, conforme a
  variante, mas o estoque sempre se deixa recortar.

O que muda é o que a abertura mostra além do nome, se o estoque é grade,
lista, vitrine ou tabela, e qual das quatro necessidades de loja (§5) vem
logo depois da abertura.

---

## 4. As quatro variantes

| id | nome | fundo | tipo de loja e público |
|---|---|---|---|
| `vortice` | Vórtice — Seminovos Premium | **claro** | Loja de seminovos de 80–150 mil com laudo e garantia. **Quem chega:** comprador racional que compara três lojas e decide por procedência. Conversão fiel do material bruto; continua o default |
| `patio` | Pátio — Loja de Bairro | **claro** | Pátio de populares e primeiro carro, até 70 mil, faixa na calçada. **Quem chega:** quem compra pela parcela e não pelo preço, no celular, entre um compromisso e outro |
| `garagem` | Garagem — Boutique de Esportivos | escuro | Poucos carros, cada um um evento: esportivos, importados, clássicos. **Quem chega:** entusiasta que lê a ficha técnica inteira antes de mandar a primeira mensagem |
| `campo` | Campo — Picapes e Utilitários | escuro | Loja de picape, SUV 4×4 e utilitário no interior. **Quem chega:** produtor ou empresa que troca a caminhonete velha na compra da nova — a troca é o assunto |

Duas claras e duas escuras. Cada tipo de loja puxa uma das quatro
necessidades do §5 para logo depois da abertura: Pátio a busca por faixa,
Garagem a ficha técnica, Campo a troca; Vórtice mantém o equilíbrio do
original, com o financiamento.

### IDs e aliases

`SkinDefinition.themeAliases`, só nesta skin, mapeando **por fundo** (mesmo
critério da chapa: nenhuma demo publicada troca de luminância):

```
vortice       (claro)  → vortice (inalterado, default)
azul-classico (claro)  → patio
grafite       (escuro) → garagem
meia-noite    (escuro) → campo
```

Sem migração de banco: `idThemeAtual` resolve, o editor abre a seleção
canônica e salvar um payload legado grava o id novo.

---

## 5. O contrato: crescer ou não

Hoje o contrato já cobre duas das quatro necessidades — mal, mas cobre.

| necessidade | hoje | forma proposta | âncora de captura | listas | verificação |
|---|---|---|---|---|---|
| **Financiamento** | seção `simulador` | **mecânica**, sem seção nova: faixa do slider derivada do `precoValor` do estoque; botão "simular este carro" no card, que só existe se `simulador` está visível | zero (`simulador` já é âncora padrão) | zero; chaves novas de microcopia × 7 idiomas | teste unitário da derivação; SSR com estoque de 39.900 a 149.900 cobre os nove carros |
| **Troca com avaliação** | seção `avaliacao` (CTA + marquee) | **mecânica**, sem seção nova: formulário marca/modelo/ano/km que monta a mensagem de WhatsApp, ligado por composição (§6) | zero | zero; microcopia × 7 | teste da mensagem montada; SSR sem `whatsapp` não renderiza o formulário (§7) |
| **Busca por faixa de preço** | não existe (só categoria) | **mecânica dentro de `estoque`**: 3–4 faixas derivadas do `precoValor`, rótulo formatado pelo locale/moeda | zero | zero | teste unitário das faixas; sem JS o estoque aparece inteiro |
| **Ficha técnica** | não existe (`descricao` é uma string com `·`) | **seção nova `destaque`** — "Veículo em destaque" + slot `imagens.destaque` | +1 seção marcável; configs de `/config/app` continuam válidas | `SECOES_POR_SKIN` (automática: importa `MULTIMARCAS_SECOES`); chave nas quatro variantes; placeholder + `imagensAlt`; colapso de 9→11 slots × 4 | contrato SSR de 8→9 `data-d-secao`; +1 linha no portão de drasticidade; `ordemEfetiva` (abaixo) |

### Por que a busca não é seção

Uma seção de busca separada teria de filtrar OUTRA seção: estado cruzado
entre dois componentes que a aba Estrutura reordena e oculta
independentemente. Com `estoque` oculto, a busca fica órfã; como print de
prospecção, uma caixa de busca sozinha não diz nada. Dentro do estoque é
só mais um modo de filtro. Na abertura do Pátio as faixas aparecem como
botões, mas são **âncoras** (`#estoque` + hash da faixa) lidas pelo filtro
— sem JavaScript viram links para o estoque inteiro.

### Por que a ficha é seção

Ficha técnica por carro exigiria campos estruturados em `DemoServico`
(motor, potência, tração, cor…), que é tipo da plataforma, validado no PUT
de todas as skins. Ler rótulos pela POSIÇÃO dos `destaques` mentiria assim
que o operador trocasse a ordem dos chips. Uma seção `destaque` resolve com
o contrato que já existe: `rotulo` ("DESTAQUE DA SEMANA"), `titulo` (o
carro), `texto` (o argumento), `cta`, e `itens` como linhas da ficha
(`titulo` = rótulo, `texto` = valor). Ela é autocontida — não referencia
`servicos[0]`, porque a IA e o operador renomeiam carros do estoque e a
ficha passaria a descrever outro veículo. O custo aceito: se o destaque
mostrar preço, é uma linha de texto da ficha, não `precoValor` — não segue
o locale automaticamente.

### O slot `hero`

Não serve a nenhuma das quatro necessidades — serve à drasticidade. Sem
foto de abertura, as quatro aberturas seriam variações tipográficas, e
tipografia sozinha em cinza é o que o portão reprova. Garagem e Campo abrem
com foto; Vórtice e Pátio não a desenham e declaram `imagensOcultas`
(§8). Custo: um placeholder, um `imagensAlt`, quatro medições a mais no
colapso.

### O custo que não aparece na tabela: demos salvas com ordem própria

`ordemEfetiva` põe seção não listada **no fim**. Toda demo que o operador
já reordenou tem `ordemSecoes` gravado sem `destaque` — e a seção nova
nasceria **depois do rodapé**. A correção é mecânica e vale para qualquer
contrato que cresça daqui em diante: seção não listada entra antes da
primeira seção listada que a sucede no contrato (e no fim só se nenhuma
sucede). Hoje ninguém depende do comportamento antigo — ele só se
manifesta quando um contrato cresce, e este é o primeiro. Entra com teste
próprio em `estrutura.test.ts`.

### A IA

`sugestao.ts` monta o esquema a partir de `demoDataExemplo.secoes[id].itens`,
então `destaque` entra sozinho e o Gemini passa a escrever as linhas da
ficha. É o mesmo regime do estoque de exemplo (nove carros fictícios): a
ficha de exemplo é conteúdo de demonstração. Aceito, sem mecanismo novo.

### Recomendação (aprovada)

**Crescer: uma seção (`destaque`) e dois slots de imagem (`hero`,
`destaque`), na etapa 1.** As outras três necessidades são mecânica dentro
de seções que já existem, e não custam âncora nem lista. Com isso o
contrato fecha em **nove seções e onze slots**. `ANCORAS_PADRAO` passa de
`hero, estoque, simulador` para `hero, destaque, simulador` — o estoque de
nove carros é a seção mais alta da página no celular, que é o caso ruim da
moldura; um carro com a ficha lê melhor numa conversa. Só afeta skin sem
marcação salva em `/config/app`.

---

## 6. Critério de drasticidade

Parametrizado por `MultimarcasComposicao` (`Theme.multimarcas`), no modelo
de `ChapaComposicao` — **um caminho de render**, CSS emitido no servidor,
especificidade em vez de `!important`, layout default também na folha.
**Nenhuma composição esconde texto.**

| seção | vortice | patio | garagem | campo |
|---|---|---|---|---|
| **abertura** | tipográfica: nome em duas linhas, diagonal, velocímetro selo no canto (original) | busca: nome + botões de faixa de preço + barra de identidade (§7); velocímetro pequeno ao lado das faixas | foto sangrada de tela cheia (`hero`), nome sobre véu, **velocímetro grande** no pé da foto | dividida: nome + CTA de troca à esquerda, foto (`hero`) emoldurada à direita; empilha abaixo de 768px |
| **estoque** | grade 3 colunas, filtro por categoria (original) | lista densa, **parcela em destaque** ("48× R$ …") e preço à vista em corpo menor, filtro por faixa | vitrine: um carro por linha, foto 21:9 sangrada, nome grande, sem filtro | tabela: miniatura + colunas ano/km/câmbio/combustível, filtro por categoria |
| **destaque** (nova) | cartão horizontal: foto metade + ficha em duas colunas | tira "oferta da semana": foto pequena + ficha curta em linha | catálogo: foto grande, ficha técnica em tabela tipográfica de página inteira | ficha de pátio: tabela larga, foto como miniatura |
| **simulador** | dois cartões lado a lado (original) | uma coluna, **resultado acima dos controles** | painel horizontal compacto no fim da página | cartão único ao lado do texto |
| **avaliacao** | faixa no acento + marquee (original) | tarja no acento com CTA | linha discreta "aceitamos seu carro na troca" + marquee lenta | **formulário de troca** em cartão grande + lista de marcas estática |
| **depoimentos** | carrossel arrastável (original) | três cartões empilhados | uma citação gigante por vez | tira com o veículo (`contexto`) em destaque sobre o autor |
| **contato** | rodapé em duas colunas (original) | tarja de uma linha (a identidade já subiu para a abertura) | fecho centralizado, CTA de visita | bloco "onde fica o pátio": endereço grande + horário em tabela |
| vantagens | grade de 4 numerados (original) | faixa de 4 linhas curtas | lista editorial numerada, coluna estreita | 2×2 com número grande |
| numeros | linha de 3 contadores (original) | selos em pílula | numerais gigantes em coluna | placar em grade com borda |

**Nove seções com layout diferente entre as quatro**; o portão pede
quatro, e as quatro que o seguram mesmo se alguma linha escorregar na
execução são as em negrito da primeira coluna: abertura, estoque,
destaque, avaliação. `numeros` ganha padding próprio por composição (não
depende mais de estar abaixo de `vantagens`).

O nome do negócio é o maior elemento da primeira tela nas quatro. Na
Garagem o nome fica sobre a foto com véu tokenizado (`--mm-veu`), medido
por contraste como texto.

### 6.1 O `<h1>` e o título já salvo

- O `<h1>` é sempre `data.nome`, nas quatro variantes.
- `secoes.hero.titulo` continua sendo o mesmo slot, no mesmo caminho do
  patch — **nenhuma migração de banco, nenhum texto descartado**. Se
  `titulo?.trim()` não é vazio, ele renderiza como linha de apoio logo
  abaixo do `<h1>` (um `<p>` com `data-demo-slot="secoes.hero.titulo"`,
  dentro da âncora `hero`), em corpo menor que o nome e maior que o
  `hero.texto`. Vazio ou só espaço: a linha não existe.
- Título igual ao nome (comparação sem caixa e sem espaços nas pontas):
  a linha não é desenhada — o nome não aparece duas vezes.
- A linha de apoio aparece no HTML do servidor e é visível sem
  JavaScript, como o `<h1>` (item 7).
- O default histórico `"Seu próximo carro já está aqui"` continua sendo
  descartado na leitura por `legado.ts`, como hoje: não é edição do
  operador, então não vira linha de apoio. O teste usa um título que o
  operador de fato digitou.
- O editor continua mostrando o campo "Título" da abertura; só o que ele
  alimenta muda de papel. O mapa clique-no-preview → campo segue o
  `data-demo-slot`.

**Prova (item 24):** para cada uma das quatro variantes, monta-se a demo
pelo caminho real — `montarDemoData` com exemplo da variante ← lead com
`nome` ← `lead.demo.dados` com `secoes.hero.titulo` salvo (ex.:
`"Seminovos com garantia de fábrica"`) — e renderiza-se o HTML do
servidor. O teste exige: um único `<h1>` dentro de `data-d-secao="hero"`,
cujo texto é o nome inteiro e não contém o título; o título inteiro num
elemento `data-demo-slot="secoes.hero.titulo"` dentro da mesma âncora,
**depois** do `<h1>` na ordem do documento; e esse elemento sem
`hidden`, `aria-hidden`, `display:none`, `opacity:0` ou `translateY`
inline. Os casos de controle no mesmo arquivo: título vazio (sem linha),
título igual ao nome (sem linha). No navegador, `qa-multimarcas.mjs`
(item 25) repete com JavaScript desligado em 390 e 1100px e mede caixa
maior que zero para o `<h1>` e para a linha de apoio.

### Intro

Ligada só na `vortice` (fiel ao material bruto); nasce desligada nas outras
três — o Pátio vende pressa. Continua editável na aba Tema. A captura já
pula a intro por `CAPTURA_SECRET` (mecanismo da chapa).

### Ordem default

- `vortice`: `estoque, vantagens, numeros, destaque, simulador, avaliacao, depoimentos, contato`
- `patio`: `estoque, simulador, avaliacao, destaque, numeros, vantagens, depoimentos, contato`
- `garagem`: `destaque, estoque, depoimentos, vantagens, numeros, avaliacao, simulador, contato`
- `campo`: `avaliacao, estoque, destaque, numeros, simulador, vantagens, depoimentos, contato`

Nenhuma variante nasce com seção oculta.

---

## 7. Lead sem dado de identidade

O exemplo não tem `telefone`, `whatsapp`, `instagram`, `cidade` nem
`horarios`, e `endereco` sai nesta migração. **Zero dado é o caso normal**
(harness, avulsa, lead recém-criado). Regra por lugar:

| lugar | com dado | sem dado |
|---|---|---|
| barra de identidade (abertura do Pátio) e bloco do pátio (contato do Campo) | escada da chapa: endereço/cidade → horário → telefone → Instagram, cada linha com rótulo de `microcopiaDemo`, só se o valor existe | **zero linhas = o bloco não renderiza**: nem borda, nem fundo, nem grade de rótulos. A abertura degrada para nome + faixas; o contato para título + CTA |
| contato (rodapé das quatro) | coluna de endereço, Waze/Maps (só com `endereco` do lead — o exemplo não tem mais endereço, então não há outra fonte), WhatsApp | sem nenhuma linha e sem `whatsapp`: a grade de duas colunas não é desenhada; título + um link `secoes.hero.cta` para `#estoque` (se o estoque estiver visível) |
| ícones sociais | Instagram com `instagram` | nenhum ícone; a fileira some. Facebook e YouTube saem sempre (não há campo) |
| CTA de interesse do card | WhatsApp com carro e preço | o painel expande só com a descrição (hoje) |
| CTA do simulador | WhatsApp com a simulação | com `telefone`: `tel:`; sem os dois: sem botão, a simulação continua |
| formulário de troca (Campo) | monta a mensagem | **não renderiza** — formulário que não envia para lugar nenhum é pior que nenhum; a seção fica com título, texto e marcas. Sem JavaScript, o formulário envia para o `wa.me` com a mensagem genérica |
| `Nav` e `WhatsAppFloat` | botão WhatsApp | somem (hoje) |
| nota de avaliação | — (não existe campo; a skin não desenha nota nenhuma) | nada: nenhum `★`, nenhuma contagem de avaliações, nenhum selo de plataforma. O item saiu do exemplo (§1) |

Verificação (etapa 4): SSR com lead vazio nas quatro — nenhum rótulo órfão,
nenhum container vazio, nenhum `href="#topo"` de rede social, nenhum link
Waze/Maps; e o aferidor de caixa zerada no navegador para a barra do Pátio
e o bloco do Campo.

---

## 8. Slots que alguma variante não desenha

`SkinVariante.imagensOcultas`, motivo em enum fechado, frase num lugar só no
editor, **verificado no navegador sem JavaScript** nas duas direções.

| variante | slot oculto | motivo |
|---|---|---|
| `vortice` | `hero` | `nenhum` — abertura tipográfica, fiel ao original |
| `patio` | `hero` | `nenhum` — a abertura é a busca |
| `garagem`, `campo` | — | desenham os onze |

Os nove carros e `destaque` aparecem nas quatro (na Campo, `destaque` é
miniatura — caixa maior que zero, não declarado).

---

## 9. Itens de implementação, em ordem

**[M]** = mecânica, **[V]** = composição visual. Cada etapa é uma sessão.

### Etapa 1 — contrato e fiação (fecha o contrato)

1. [M] `destaque` em `secoes.ts`, entre `numeros` e `simulador`, com
   `entradaOptions`; `secoes.destaque` no exemplo; placeholders
   `public/demos/multimarcas/{hero,destaque}.svg` e entradas no manifesto
   de imagens. `registry.test.ts` verde com 9 seções e 11 slots.
2. [M] `ordemEfetiva`: seção não listada entra antes da primeira sucessora
   listada no contrato; teste em `estrutura.test.ts`; nota no
   ARCHITECTURE.md (a regra "entram no fim" muda).
3. [M] `MultimarcasComposicao` em `lib/demos/types.ts` + `Theme.multimarcas?`.
4. [M] `imagensAlt` opt-in, 11 chaves declaradas, validação estrita e diff
   por slot (precedente tatuagem).
5. [M] `registry.ts`: `variantes`, `themePresets` derivado, `themeAliases` (§4).
6. [M] Listas: tirar a skin de `PRESETS_SEM_VARIANTES`, pôr em
   `VARIANTES_POR_SKIN` e `IMAGENS_OCULTAS_POR_VARIANTE`; `ANCORAS_PADRAO` →
   `hero, destaque, simulador`. `temas-mjs`, `variantes-mjs` e o contrato de
   âncoras verdes.

### Etapa 2 — mecânica de loja e limpeza de literais

7. [M] SSR sem JavaScript: `Preloader` não sai no HTML do servidor;
   revelação do título, do hero e de `SectionReveal` só ativada no cliente;
   preço servido já formatado (o contador anima a partir do cliente).
8. [M] `<h1>` sempre `data.nome`; `hero.titulo` vira linha de apoio pelas
   regras do §6.1 (vazio e igual ao nome não desenham). Os quatro `??` →
   `?.trim() ||`; `<h2>`/rótulos vazios não renderizam.
9. [M] Busca por faixa de preço em `logic.ts` (faixas do `precoValor`,
   rótulo por locale/moeda) + modo de filtro no `CarFilterGrid` + âncora
   por hash.
10. [M] Simulador: faixa e valor inicial derivados do estoque; `R$`/`pt-BR`
    por `simboloMoeda`/locale; botão "simular este carro" condicionado à
    seção visível.
11. [M] Formulário de troca (mensagem, condição de WhatsApp, degradação sem JS).
12. [M] Regra do vazio (§7): escada, contato sem grade, redes sociais,
    fallback `tel:`.
13. [M] Chrome pela `microcopiaDemo` nas sete raízes: rótulos do simulador,
    `NAV_LABEL`, Waze/Maps, "Falar no WhatsApp", mensagens de WhatsApp, as
    duas legendas do velocímetro (sai "VEGLIA · MILANO"). Sai o fallback
    `"Conteúdo ilustrativo."`. Separador de milhar pelo locale.
14. [M] Tokens: `CORES_AVATAR` passa a derivar da paleta (com o ink medido);
    sombras marrons viram `--mm-sombra`.
15. [M] Tirar `endereco` do exemplo (sem endereço do lead: nem texto, nem
    Waze, nem Maps); tirar o item "4,9★ avaliação no Google" de `numeros`
    — removido, não convertido em slot; cópia sem nome de marca.

### Etapa 3 — composição visual

Laço de captura com as imagens abertas e olhadas; o commit cita o arquivo
de captura que confirma cada item.

16. [V] `multimarcas/composicao.ts` — CSS do servidor, default na folha.
17. [V] Renderizadores de `Skin.tsx` e dos interativos lendo os knobs (§6),
    um caminho só.
18. [V] O painel de instrumentos nas quatro escalas (selo, mostrador grande,
    marcador ao lado da busca).
19. [V] `multimarcas/variantes.ts` — as quatro declarações via
    `criarVariante` (público, fundo, composição, ordem, `imagensOcultas`).
20. [V] Paletas e tipografia por variante (fontes já em `core.ts`: Bodoni,
    Bebas, Playfair/Instrument, Oswald, Archivo, Inter, Hanken); contraste
    pelas regras do §2.
21. [V] Cópia de exemplo própria por variante, incluindo nove carros
    coerentes com o tipo de loja e a ficha do `destaque`.
22. [V] Miniaturas `public/demos/multimarcas/{vortice,patio,garagem,campo}.jpg`.

### Etapa 4 — contrato, captura e portões

23. [M] Testes que rodam sozinhos: `registry`, a trava `variantes.test.tsx`,
    `lead-data-contract`, `imagens-slot-oculto`, `precos-locale` (a exceção
    `SKINS_COM_PRECO_ANIMADO` cai se o item 7 servir o preço formatado).
24. [M] `multimarcas-contrato.test.tsx`: nove `data-d-secao` sem duplicata,
    um `<h1>` com o nome inteiro na âncora hero, por variante; **a prova do
    §6.1** (demo com título salvo: nome no `<h1>`, título visível abaixo,
    mais os dois controles); o §7 com lead vazio nas quatro — incluindo
    nenhum `href` de Waze ou Maps e nenhuma nota com `★`/"Google" no HTML;
    o `destaque` numa demo com `ordemSecoes` antigo cai antes de `contato`.
25. [M] `scripts/qa-multimarcas.mjs`: contrato sem JavaScript em 390 e 1100
    px (nome VISÍVEL, não só caixa; linha de apoio visível na demo com
    título salvo); caixas de `imagensOcultas` nas duas
    direções; aferidor de caixa zerada; portão de drasticidade em duas folhas
    em cinza + diferença média nas três primeiras telas e altura de página.
26. [M] `qa-cls.mjs --so=skins` sem deslocamento.

### Etapa 5 — matriz de fps e documentação

27. [M] `qa-visual.mjs --so=fps --skin=multimarcas-vortice`: 20 células,
    piso 45 fps; `modosDeCorReprovados` pelo que o portão devolver.
28. [M] `--so=variante`, `--so=colapso` (11 slots × 4), `--so=barra`,
    `--so=avulsa`.
29. [M] `qa/multimarcas-vortice/{STATUS.md,FPS.md,contrato-browser.json}` +
    seção no ARCHITECTURE.md; tirar a linha da tabela de auditoria de
    endereço (sobram quatro) e "as próximas CINCO migrações" vira QUATRO.

---

## 10. Pendência fora desta migração: os dois achados nas outras skins

Verificado em 2026-09-23 por leitura do `exemplo.ts` e do `Skin.tsx` de
cada skin ainda com presets. **Nada foi corrigido** — conforme escopo
aprovado. São quatro skins além desta (`PRESETS_SEM_VARIANTES` tem cinco
entradas, contando a própria multimarcas).

**Nota de avaliação inventada no exemplo**

| skin | onde | o que afirma |
|---|---|---|
| `petshop-focinho-feliz` | `petshop/exemplo.ts:70` (`secoes.hero.itens[0]`) | `"4,9★"` · `"480 avaliações no Google"` — na abertura |
| `petshop-focinho-feliz` | `petshop/exemplo.ts:88` (`secoes.numeros.itens[2]`) | `"4,9★"` · `"de nota no Google"` |
| `barbearia2-sul`, `tatuagem-pigmento-vivo`, `imobiliaria-curada` | — | nenhuma nota nem menção a Google no exemplo |

Caso vizinho, de natureza diferente: `tatuagem-pigmento-vivo` desenha
`★★★★★` a partir de `depoimentos[].nota: 5` (`tatuagem2/Skin.tsx:517`), e
o `petshop` declara `nota: 5` nos depoimentos. É nota de um depoimento
fictício, não do negócio — não afirma nada verificável sobre o lead, mas
é do mesmo gênero e vale decidir junto.

**Rota para endereço fictício**

| skin | endereço fictício no exemplo | botão de rota/mapa |
|---|---|---|
| `barbearia2-sul` | `"Av. Brasil, 500 — Zona 3"` (`exemplo.ts:13`) | nenhum — só texto (`Skin.tsx:541`) |
| `tatuagem-pigmento-vivo` | `"Rua das Aquarelas, 88 — Centro"` (`exemplo.ts:21`) | nenhum — só texto (`Skin.tsx:650`) |
| `imobiliaria-curada` | `"Rua Principal, 100 — Centro"` (`exemplo.ts:20`) | nenhum — só texto (`Skin.tsx:686`) |
| `petshop-focinho-feliz` | `"Rua das Begônias, 240 — Jardim das Flores"` (`exemplo.ts:13`) | nenhum — só texto (`Skin.tsx:859`) |

Nenhuma das quatro tem Waze, Google Maps ou mapa embutido: o botão que
navega para lugar inventado é exclusivo da multimarcas. O endereço
fictício como TEXTO continua nas quatro — é a tabela "Auditoria de
endereço" do ARCHITECTURE.md, que já as lista. Nas skins já migradas, a
`barbearia-editorial` tem link de Maps (`barbearia/Skin.tsx:852`), mas o
exemplo dela não tem endereço desde a migração, então só aparece com o
dado do lead.
