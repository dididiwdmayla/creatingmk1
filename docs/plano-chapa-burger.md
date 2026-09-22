# Plano — `lancheria-chapa-burger`: de quatro presets para quatro variantes

Aprovado em 2026-09-22. **O contrato de seções NÃO cresce**: continuam cinco
seções, só `hero` fixa. As etapas rodam em sessões separadas; este documento é
a fonte única entre elas.

---

## 1. Inventário da skin hoje

Cinco seções (`src/components/demos/lancheria/secoes.ts`), só `hero` é fixa.
`contato` é a única com `alignOptions` (`esquerda`/`centro`); as quatro
não-fixas oferecem `entradaOptions` sem typewriter (o material bruto não tinha
máquina de escrever em título nenhum).

| seção | composição atual | slots de texto |
|---|---|---|
| hero (fixa) | tela cheia, foto sangrada + gradiente `to-r`, `<h1>` poster contornado, CTA pílula, indicador de scroll | `secoes.hero.titulo` (fallback `nome`), `.texto`, `.cta` |
| cardapio | grade 1/2/3 colunas de `BurgerCard`, lente circular no hover revelando `prato-vazio` | `.rotulo`, `.titulo`, `servicos.N.{nome,descricao,preco}` |
| bebidas | `CompactSection` — trilho horizontal de cards 150/180px | `.titulo`, `.itens.N.{titulo,subtitulo}` |
| acompanhamentos | idêntica a bebidas, mesmo componente | idem |
| contato | `<footer>` três colunas + barra de copyright | `.titulo`, `.cta`, `.texto`, `nome`, `slogan`, `endereco`/`cidade`, `telefone`, `instagram`, `horarios` |

Chrome fora de seção, sem `data-d-secao` (correto): `Header` (fixed),
`CategoryNav` (sticky), `IntroExperience`, `LedEdges`.

**20 slots de imagem:** `hero`, `prato-vazio`, `lanche-1..6`, `bebida-1..5`,
`acompanhamento-1..4`, `flutuante-{bacon,queijo,bebida}`.

### O que é literal e precisa virar slot ou token

**Cores cravadas** — `bg-black/10` em `interactive/BurgerCard.tsx:118` e
`interactive/CompactSection.tsx:34` (lavagem preta sob a foto; em paleta clara
é sujeira — é o análogo exato das três cores cravadas da tatuagem). O gradiente
do hero (`Skin.tsx:177`) usa token mas com direção fixa `to-r`, que não serve a
uma abertura dividida ou empilhada.

**Português no chrome** — `"Horário"` (`Skin.tsx:372`; existe `m.horario` em
`lib/demos/microcopy.ts` e não é usado), fallback `"Contato"` (`:389`),
fallback `"FEITO COM OBSESSÃO"` (`:437`), `"ESCOLHER"` (`BurgerCard.tsx:197`),
as três `HOVER_PHRASES` (`BurgerCard.tsx:19-23`), as mensagens de WhatsApp
`"Olá! Gostaria de fazer um pedido."` / `` `Olá! Quero pedir: ${x}.` `` (Header,
rodapé, card, compact) e os `aria-label` `` `Escolher ${x}` `` /
`` `Adicionar ${x}` ``. Metade do chrome já passa por `microcopiaDemo`
(`m.role`, `m.direitosReservados`, `m.fazerPedido`,
`m.disponivelNaVersaoCompleta`) — a migração fecha a outra metade.

**Alts** — todos derivados da copy: `` `Ambiente de ${data.nome}` ``,
`servico.nome`, `item.titulo`, `""` em `prato-vazio` e nos flutuantes. Viram
`imagensAlt` opt-in, 20 chaves declaradas no exemplo (precedente tatuagem).

**Endereço** — `LANCHERIA_EXEMPLO.endereco: "Av. Principal, 500 — Centro"`. É a
linha desta skin na tabela "Auditoria de endereço" do ARCHITECTURE.md. Sai na
migração; a tabela cai de seis para cinco skins.

### Sobre o `<h1>`: ele existe

`Skin.tsx:184`, dentro do wrapper `data-d-secao="hero"` (o `SecaoMarcada`
envolve a `<section>` inteira), e o fallback `?? data.nome` põe o nome da casa
lá. O defeito real é mais estreito: `s.hero?.titulo ?? data.nome` usa `??`,
então um `titulo` salvo como **string vazia** não cai no fallback — o `<h1>`
renderiza vazio e o print da âncora hero sai sem o nome. Troca por `||` com
guarda de `trim()`.

### Dois achados a mais

- `secoes.bebidas.rotulo` e `secoes.acompanhamentos.rotulo` só alimentam as
  pílulas do `CategoryNav`, que não emite `data-demo-slot` — o mapa
  clique-no-preview → campo-do-painel não alcança esses dois.
- `secoes.contato.rotulo` existe no exemplo e **não é renderizado em lugar
  nenhum**. `depoimentos` é campo inerte nesta skin (não há seção).

---

## 2. A essência — o que não muda nas quatro

**A lente.** O cardápio desta skin é o único lugar da Forja onde passar o
cursor (ou tocar) sobre a foto do lanche abre um círculo que revela o prato
vazio embaixo, com uma frase provocativa por cima. É a piada da casa e é o que
faz alguém mexer na página em vez de rolar. **Está nas quatro variantes**, em
composições diferentes (ver §5.1).

Junto dela: o nome do negócio em tipografia poster com contorno grosso e sombra
dura na abertura, o preço sempre no acento "de dinheiro" (`acentoTerciario`), e
todo botão de ação resolvendo em WhatsApp quando o lead tem número.

O que muda é onde o cardápio mora, que tamanho a foto tem, se as bebidas são
trilho ou carta, e o que a abertura mostra além do nome.

---

## 3. As quatro da `lancheria-2`, e por que estas não repetem

| lancheria-2 | tipo de casa | vizinha mais próxima | o que separa |
|---|---|---|---|
| Meia-Noite | prensado de madrugada, letreiro, a história da casa logo depois da prensa | Sala | Meia-Noite vende a noite e o passado da casa; Sala vende autoria e ticket alto, com descrição longa por lanche e carta de cerveja. A Chapa Burger nem tem seção de história |
| Diner | salão fórmica anos 50, placa de porta, painel de fotos em três colunas | Praça | Diner é a nostalgia de **um lugar fixo**; Praça é a ausência dele — truck que muda de esquina, e por isso abre com "onde estamos hoje" acima do cardápio |
| Prático | lista de delivery, foto à esquerda, "adicionar" em primeiro plano, sem intro | Balcão | Prático existe pra você **não sair de casa**; Balcão existe pra você ir até lá agora — a abertura lidera com horário e endereço, e o cardápio é comanda de balcão, não lista de app |
| Cantina | folha de menu em papel, nome ligado ao preço por pontilhado, toldo terracota | Sala | Cantina é impressa, densa e familiar; Sala é arejada, editorial e cara. Uma é papel, a outra é sala de jantar |

Nota: os presets atuais da chapa burger já invadem esse território — existe um
`diner` ("creme, ciano e verde") e um `neon` "Neon Noite". É mais um motivo
para a migração trocar os ids.

---

## 4. As quatro variantes

| id | nome | fundo | tipo de casa e público |
|---|---|---|---|
| `chapa` | Chapa — Casa de Bairro | escuro | Hamburgueria artesanal de rua, humor na marca, pedido por WhatsApp. **Quem chega:** cliente recorrente que já sabe o nome do lanche e pede na sexta à noite. É a conversão fiel do material bruto — uma das quatro tem de carregar o original |
| `balcao` | Balcão — Smash de Almoço | **claro** | Balcão de smash no centro, azulejo e aço, cardápio curto, fila na calçada. **Quem chega:** trabalhador no almoço, decide em 40 segundos, quer preço, horário e endereço antes de sair da mesa |
| `sala` | Sala — Hamburgueria Autoral | escuro | Casa com mesa e serviço, blend assinado, carta de cerveja artesanal. **Quem chega:** casal jantando fora, ticket alto, lê a descrição inteira antes de escolher |
| `praca` | Praça — Food Truck | **claro** | Truck que muda de praça, fim de semana, fila em pé. **Quem chega:** quem está no evento agora, decide pela foto, com o celular numa mão e a cerveja na outra |

Duas claras, duas escuras — acima do mínimo de uma de cada. Os quatro são tipos
reais de casa com lógicas de pedido diferentes (recorrência, pressa, ocasião,
impulso), e é a lógica de pedido que manda na composição.

### IDs e aliases

`SkinDefinition.themeAliases`, só nesta skin, mapeando **por fundo** para
nenhuma demo já publicada trocar de luminância:

```
brasa (claro)  → praca  (claro)
diner (claro)  → balcao (claro)
neon  (escuro) → sala   (escuro)
chapa (escuro) → chapa  (inalterado, continua o default)
```

Precedente `oliva: vinho` da barbearia. `idThemeAtual` atende `getTheme`,
`getVariante`, `exemploDaSkin` e a validação do PUT. Sem migração de banco: o
editor abre a seleção canônica e salvar um payload legado grava o id novo.

---

## 5. Critério de drasticidade

Parametrizado por um tipo novo `ChapaComposicao`, no modelo de
`TatuagemComposicao` — **um único caminho de render**, CSS emitido no servidor.

| seção | chapa | balcão | sala | praça |
|---|---|---|---|---|
| **abertura** | cartaz de tela cheia: foto sangrada, nome contornado sobre ela | ficha de balcão: nome, horário e endereço em cartão, sem foto grande | cisão: foto ocupando metade, tipografia sóbria na outra | pilha: nome ocupando a tela sobre campo de cor, foto como selo pequeno |
| **cardápio** | grade de 3 colunas, card com lente | comanda de uma coluna, preço alinhado à direita, miniatura de 64px com lente ao toque | editorial alternado: foto grande com lente e descrição longa, um por linha | mural de 2 colunas, preço sobre a foto, lente na foto |
| **bebidas** | trilho horizontal de cards | chips em linha, miniatura de 28px | carta tipográfica sem foto | grade 4-up quadrada |
| **acompanhamentos** | trilho horizontal de cards | quadros pequenos em grade | linha de texto discreta sob o cardápio | tira sangrada rolante |
| **contato** | rodapé em três colunas | tarja de uma linha | fecho centralizado com CTA de reserva | bloco "onde estamos hoje", **no topo da página** |

Cinco seções com layout diferente entre todas as quatro — a exigência era
quatro, sobra uma de margem. **Nenhuma composição esconde texto:** a comanda
mantém a descrição em corpo menor, a carta mantém o preço, a linha discreta
mantém o subtítulo.

Na `praca`, `contato` sai como `<section>` em vez de `<footer>` — mesmo
`data-d-secao="contato"`, mesmos slots, mesma âncora de captura.

### 5.1 A lente nas quatro

O raio de 56px é hardcoded em `BurgerCard.tsx` (`radius.set(56)`) e passa a ser
knob de composição (`--d-lente-raio`), porque as caixas mudam de tamanho:

| variante | onde a lente abre | como | frase do hover |
|---|---|---|---|
| chapa | foto do card na grade | hover no desktop, toque no celular (comportamento atual) | dentro da caixa da foto, como hoje |
| balcao | miniatura de 64px da linha da comanda | **toque no item** — a linha inteira é o alvo, não só a miniatura; no desktop, hover na linha | à direita da linha (não cabe dentro de 64px) |
| sala | foto grande do editorial | hover/toque na foto; raio maior, proporcional à caixa | dentro da caixa, canto superior |
| praca | foto do card do mural | hover/toque na foto, raio médio | dentro da caixa |

No `balcao`, o alvo do ponteiro é a linha e a origem do círculo é o centro da
miniatura quando o toque cai fora dela — senão um toque na descrição abriria a
lente num ponto sem foto.

### 5.2 Ordem default

- `chapa`: `cardapio, bebidas, acompanhamentos, contato`
- `balcao`: `cardapio, acompanhamentos, bebidas, contato` (lógica de combo do balcão: lanche → batata → bebida)
- `sala`: `cardapio, bebidas, acompanhamentos, contato`
- `praca`: `contato, cardapio, acompanhamentos, bebidas`

`chapa` e `sala` **repetem a ordem de propósito**: com quatro seções
reordenáveis o eixo de ordem é curto, e quem carrega a drasticidade é a tabela
de composição, não a ordem. Nenhuma variante nasce com seção oculta — esconder
uma custa um quarto da página.

O nome do negócio é o maior elemento da primeira tela nas quatro, porque o
print da âncora hero vira miniatura no WhatsApp. A ficha do Balcão e a cisão da
Sala são mais sóbrias, mas o `<h1>` continua dominando.

---

## 6. Slots que alguma variante não desenha

`SkinVariante.imagensOcultas`, motivo em enum fechado (`nenhum` | `so-titulo`),
frase num lugar só no editor (`app/leads/[id]/demo/editar/paineis.tsx:657`), e
**verificado no navegador com JavaScript desligado** — caixa zero para o
declarado, maior que zero para o não declarado, as duas direções reprovando.

| variante | slots ocultos | motivo |
|---|---|---|
| `balcao` | `flutuante-bacon`, `flutuante-queijo`, `flutuante-bebida` | `nenhum` — comida flutuando não cabe num balcão de azulejo |
| `sala` | `bebida-1..5`, `flutuante-bacon`, `flutuante-queijo`, `flutuante-bebida` | `nenhum` — a carta é tipográfica; a casa é sóbria |
| `chapa`, `praca` | — | desenham os 20 |

`prato-vazio` **não é declarado em nenhuma**: a lente existe nas quatro (§5.1).

---

## 7. Identidade no topo sem bloco oco (Balcão e Praça)

O Balcão abre com a ficha (nome + horário + endereço) e a Praça abre com o
bloco "onde estamos hoje". Os dois dependem de campos que **o exemplo não
tem**: `horarios`, `telefone`, `whatsapp`, `instagram` e `cidade` nunca
estiveram em `LANCHERIA_EXEMPLO`, e `endereco` sai nesta migração (§1). Ou
seja: **zero linhas de dado é o caso NORMAL** — harness, demo avulsa e lead
recém-criado —, não uma borda rara. A composição é desenhada a partir disso.

**Escada de renderização**, igual nas duas:

1. `<h1>` com o nome — sempre. É a âncora do bloco.
2. `secoes.hero.texto` (a frase da casa) — sempre; está no exemplo das quatro.
3. `secoes.hero.cta` — sempre.
4. Linhas de dado, cada uma com seu rótulo de `microcopiaDemo` (`m.endereco`,
   `m.horario`, `m.telefone`), na ordem endereço (ou cidade) → horário →
   telefone/whatsapp → instagram. **Cada linha só existe se o valor existe; um
   rótulo nunca aparece sem o valor.**

**Regra do vazio:** com zero linhas de dado, o cromo do cartão — borda, fundo
elevado, grade de rótulos, divisórias — **não é renderizado**. A ficha degrada
para o tratamento tipográfico puro (nome + frase + CTA), que é exatamente o que
a `pilha` faz. Nada de caixa vazia, nada de "Endereço não informado", nada de
espaço reservado. Com uma linha, o cartão tem uma linha e altura natural.

Na `praca`, o título da seção (`secoes.contato.titulo`, "onde estamos hoje") é
slot de conteúdo e renderiza sempre; o sub-bloco de linhas de dado segue a
mesma escada.

**Verificação** (etapa 3): teste SSR com lead **sem `endereco` e sem
`horarios`** nas duas variantes — nenhum container vazio, nenhum rótulo órfão,
`<h1>` presente com o nome e ao menos uma linha de texto não vazia; mais o
aferidor de caixa zerada dentro das âncoras `hero` e `contato` no laço de
navegador, e captura das duas variantes nesse estado.

---

## 8. Intro e captura

A intro **não é desligada por causa da captura**. Ela nasce desligada nas
quatro variantes (fiel ao material bruto, que carrega direto no hero) e
continua **disponível no editor** pela aba Tema, como em qualquer skin.

Quem resolve o conflito é a captura: o motor passa a enviar um header de
segredo compartilhado e a rota pula a intro quando o reconhece.

**Isto é mecanismo novo — `CAPTURA_SECRET` não existe hoje no repositório.** O
que existe é `intro=0` na query string do harness (`scripts/capturas.mjs:231`),
que cobre `--skin` e não cobre `--lead`: a rota pública `/demo/{leadId}` não
tem escape nenhum, então uma demo publicada com intro ligada sairia da splash
na captura de prospecção. O buraco é das nove skins, não desta.

Desenho, com o precedente do `CRON_SECRET` (`app/api/cron/route.ts`):

- Env `CAPTURA_SECRET`, em `.env.example`. **Fail-closed**: sem a variável no
  servidor, o header é ignorado e a intro renderiza normalmente.
- O motor (`capturas.mjs`, `capturas-ci.mjs`) manda o header junto do cookie de
  sessão que já envia.
- A rota pública lê `headers()` e resolve `intro` para `false` antes de passar
  o tema adiante — **decisão da camada de RESOLUÇÃO**, nada gravado no banco,
  mesma filosofia de `SKINS_MIGRADAS` e `EFEITOS_MIGRADOS`. A skin não sabe que
  captura existe.
- Comparação em tempo constante; o valor nunca é ecoado em resposta, log ou
  print. O header só desliga uma animação — vazá-lo não dá acesso a nada.
- `intro=0` no harness continua funcionando como está, para `--skin`.

---

## 9. Itens de implementação, em ordem

Cada etapa é uma sessão. A 1 precisa vir antes da 2 (sem ela o harness não
renderiza as quatro e nenhuma captura existe).

### Etapa 1 — fiação mecânica mínima

1. `ChapaComposicao` em `lib/demos/types.ts` + campo `Theme.chapa?`.
   **Não pode se chamar `Theme.lancheria`** — esse campo é o que
   `temaCalibrado()` (`lib/demos/variantes.ts:116`) testa para decidir se a
   skin vem de pacote calibrado, e o editor esconderia os controles de
   tipografia por engano.
2. `registry.ts`: `variantes: LANCHERIA_VARIANTES`, `themePresets` derivado
   (`variantes.map(v => v.theme)`), e `themeAliases` (§4).
3. Miniaturas `public/demos/lancheria/{chapa,balcao,sala,praca}.jpg`.
4. Tirar `lancheria-chapa-burger` de `PRESETS_SEM_VARIANTES`
   (`capturas/temas.mjs`) e pôr em `VARIANTES_POR_SKIN`
   (`capturas/variantes.mjs`); `temas-mjs.test.ts` verde. `ANCORAS_PADRAO`
   (`hero, cardapio, contato`) fica como está — já correto, não mexer.
5. Espelhar `imagensOcultas` em `IMAGENS_OCULTAS_POR_VARIANTE`
   (`capturas/variantes.mjs`); `variantes-mjs.test.ts` cobre a divergência.

### Etapa 2 — composição visual

Raciocínio estendido + laço de captura, com as imagens abertas e olhadas
(regra 5 do ARCHITECTURE.md). O commit cita qual arquivo de captura confirma
cada item.

6. `lancheria/composicao.ts` — CSS emitido no servidor, especificidade em vez
   de `!important` (as regras competem com utilitárias do Tailwind), nenhuma
   composição escondendo texto.
7. Reescrever os cinco renderizadores de `Skin.tsx` lendo os knobs; um caminho
   só. Inclui `contato` como `<section>` na `praca`.
8. `lancheria/variantes.ts` — as quatro declarações (id, nome, descrição com o
   público, fundo, composição, ordem, textos próprios, `imagensOcultas`) via
   `criarVariante`.
9. A lente nas quatro (§5.1): raio como knob (`--d-lente-raio`) no lugar do 56
   hardcoded; alvo de ponteiro na linha inteira na `comanda`; posição da frase
   por composição.
10. A escada de identidade e a regra do vazio (§7) na `ficha` e no `bloco`.
11. Paletas e tipografia por variante; contraste ≥4.5:1 texto/fundo e
    destaque/ink (3:1 só em elemento grande/UI).
12. Cópia de exemplo própria por variante — slogan, hero, rótulos, nomes e
    preços dos itens. Sem duas variantes parecendo a mesma.
13. `CategoryNav` e flutuantes ligados/desligados por composição (chrome e
    decoração, não seção).
14. Tokenizar `bg-black/10` nos dois componentes; direção do gradiente do hero
    por composição.
15. `imagensAlt` opt-in, 20 chaves no exemplo, validação estrita e diff por
    slot.
16. Chrome em português pela `microcopiaDemo`: `m.horario` no lugar de
    `"Horário"`, mais os fallbacks `"Contato"` e `"FEITO COM OBSESSÃO"`,
    `"ESCOLHER"`, as três `HOVER_PHRASES`, as mensagens de WhatsApp e os dois
    `aria-label`.
17. Guarda do `<h1>` vazio (`||` + `trim`).
18. Tirar `endereco` de `LANCHERIA_EXEMPLO`.

### Etapa 3 — contrato, captura e portões

19. `CAPTURA_SECRET` (§8): env + `.env.example`, header no motor de captura,
    resolução na rota pública, teste do fail-closed e do caminho feliz.
20. Testes que rodam sozinhos e passam a cobrir quatro combinações:
    `registry.test.ts`, a trava `variantes.test.tsx`,
    `lead-data-contract.test.tsx`, `imagens-slot-oculto.test.tsx`.
21. Teste SSR próprio da skin (`lancheria-contrato.test.tsx`, modelo do da
    tatuagem): cinco `data-d-secao` sem duplicata, um `<h1>` com o nome inteiro
    dentro da âncora hero, por variante. Inclui o caso do §7 — lead sem
    endereço e sem horário nas variantes `balcao` e `praca`.
22. `scripts/qa-chapa.mjs` — nome novo, porque `qa-lancheria.mjs` já é da
    `lancheria-2`. Carrega: contrato sem JavaScript em 390 e 1100px; medição
    das caixas de `imagensOcultas` nas duas direções; aferidor de caixa zerada
    dentro de `hero` e `contato`; e o **portão de drasticidade** em duas folhas
    (abertura em tamanho de leitura, silhueta da página inteira no mesmo fator
    de escala), em cinza, mais os dois números — diferença média em cinza nas
    três primeiras telas e altura de página por variante. O número dá escala,
    quem aprova é quem olha.
23. `qa-cls.mjs` — confirmar que o CSS de composição sai do servidor (ordem e
    colunas aplicadas depois da hidratação é deslocamento de layout).

### Etapa 4 — matriz de fps e documentação

24. `qa-visual.mjs --so=fps --skin=lancheria-chapa-burger` — 20 células
    (4 variantes × 5 modos de cor), CPU 4×, celular 390×844/DPR 2, grão
    intensidade 3, cinco cargas por célula, rolagem ativa, piso de 45 fps por
    célula. Preencher `modosDeCorReprovados`/`motivoModosReprovados` por
    variante com o que o portão devolver; modo reprovado cai em `tema`, a
    variante inteira nunca é desabilitada.
25. `qa-visual.mjs --so=variante` (matriz de imagem), `--so=colapso` (20 slots
    × 4 variantes), `--so=barra`, `--so=avulsa`.
26. `qa/lancheria-chapa-burger/{STATUS.md,FPS.md,contrato-browser.json}` +
    seção "Lancheria Chapa Burger — migração de presets para variantes" em
    ARCHITECTURE.md; tirar a linha desta skin da tabela de auditoria de
    endereço (sobram cinco) e trocar "as próximas SEIS migrações" por CINCO.
    Registrar o `CAPTURA_SECRET` junto de "Capturas por âncora de seção".
