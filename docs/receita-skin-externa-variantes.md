# Receita — skin nova com variantes, para quem constrói FORA deste repositório

Público: o repositório externo que produz o pacote calibrado (ex.: `dididiwdmayla/lancheriademodois` → `@radar/lancheria-rx`, hoje a única skin com variantes: `lancheria-2`, quatro mundos — Meia-Noite/Diner/Prático/Cantina — sobre `@radar/lancheria-rx`). O custo desta receita já foi pago: a `lancheria-2` levou **duas rodadas de exportação** do mesmo pacote (commits `6e32270` e `653cd15`) porque a primeira exportação não emitia o suficiente para virar skin sem retrabalho. Esta lista existe para a próxima skin não pagar de novo.

Formato: checklist. Passe item por item **antes de abrir o PR de clonagem** (o commit `Re-exporta @radar/<pacote>` que traz o material pronto para dentro da árvore).

---

## 1. O que o site externo precisa emitir

### 1.1 Marcação de seção — o que a 1ª rodada da `lancheria-rx` não tinha

- [ ] **Todo** bloco que corresponde a uma seção do contrato emite `data-d-secao="<id>"` no HTML **do servidor** (verificável com `renderToStaticMarkup`/JS desligado — é assim que a captura de prospecção e o SSR da rota pública leem a caixa; um marcador que só aparecesse depois da hidratação não serve para nenhum dos dois). A 1ª exportação da `lancheria-rx` tinha só 3 dos 8 blocos marcados (`cardapio`/`historia`/`contato`); os outros 5 (`hero`, `sugestoes`, `bebidas`, `acompanhamentos`, `horarios`) não tinham `data-d-secao` nenhum — sem isso não existe o que reordenar, ocultar ou capturar.
- [ ] O elemento que carrega `data-d-secao="hero"` **envolve a abertura inteira** (marca do negócio + slogan/faixa + horário compacto), não só o bloco de slogan. Foi o erro da 1ª rodada: a âncora ficava numa `.hero-faixa` que começava ABAIXO do nome — o print de identidade da prospecção saía com o slogan e sem o nome da casa. Regra prática: se a âncora do hero não inclui o `<h1>` do nome do negócio, ela está no lugar errado.
- [ ] Exatamente **um `<h1>`** por página, e ele mora dentro do wrapper `data-d-secao="hero"`. Uma variante pode esvaziar a abertura por dentro (ex.: `hero: 'nenhum'`) sem trocar o conjunto de `data-d-secao` — é o defeito que só aparece verificando o `<h1>`, não a lista de âncoras.
- [ ] Cada id de seção aparece **uma única vez** no DOM (sem duplicata — duas caixas com o mesmo `data-d-secao` tornam a âncora de captura ambígua).
- [ ] O conjunto de ids de seção está **fechado antes do PR de clonagem**. Renomear/remover/inventar seção depois quebra âncoras de captura já configuradas em `/interno/capturas` e a trava de variante (ver 2).

### 1.2 Seção × chrome

- [ ] **Seção** = qualquer bloco com `data-d-secao`, faz parte do fluxo vertical da página e é o que a aba Estrutura reordena/oculta.
- [ ] **Chrome** = elemento `fixed`/`sticky` que fica **fora** de toda seção (nav fixo, header flutuante) — nunca recebe `data-d-secao` e nunca é candidato a reordenação. Exceção: chrome que existe só na primeira tela faz parte da abertura, não é removido na captura.
- [ ] Um elemento `sticky` **dentro** de uma seção (ex.: sidebar de uma lista) é **conteúdo daquela seção**, não chrome — não pode ser tratado como decoração a esconder.
- [ ] Camada puramente decorativa (partículas, aura, glow) usa um atributo próprio (`[data-d-efeito-camada]`, `[data-d-led-estilo]`), nunca `data-d-secao` — ela não é seção e não deve ser confundida com uma pelas ferramentas de captura/verificação.

### 1.3 Slot de imagem — como declarar

- [ ] Toda imagem que deveria ser **editável pelo lead** (não parte fixa do motor/acervo) entra como **parâmetro** do componente, nunca como caminho de arquivo escrito no meio do JSX/copy. O adaptador do lado Radar mapeia esse parâmetro para `DemoData.imagens[slot]`.
- [ ] Cada slot de imagem tem **texto alternativo também parametrizado** (ex.: `heroFoto`/`heroAlt` como par, não `alt` fixo com o nome do arquivo).
- [ ] O conjunto de slots de imagem é o **mesmo em todas as variantes** (mesma chave, e se a variante não usa uma foto — ex.: variante "sem foto no hero" — o slot ainda existe e aceita upload; a variante decide se **exibe**, não se **existe**). Foi assim que o hero de Meia-Noite/Diner (com foto) e Prático/Cantina (só tipografia) continuaram sendo o mesmo contrato de slots.
- [ ] Imagens que são **parte do motor físico** (texturas do raio-x, camadas do produto, ícones fixos) NÃO são slot — ficam no pacote, versionadas e conferidas por hash (ver 3.7), e não aparecem em `DemoData.imagens`.

### 1.4 Campos que nunca podem cair em texto de template

- [ ] **Identidade do negócio nunca é literal no componente/copy exportado**: nome, marca, cidade, endereço, telefone, whatsapp, instagram, horário de funcionamento. Esses campos chegam **exclusivamente** como parâmetros resolvidos pelo lado Radar (mesmo quando vazios) — nunca como default "hardcoded" que sobrevive a um lead sem aquele dado. É a regra que `adapter.ts` aplica: *"Identidade vem SEMPRE dos slots resolvidos pelo Radar, inclusive os vazios"* — um exemplo de origem com telefone/endereço fixos escritos no componente vazaria esse literal para todo lead que ainda não tem telefone cadastrado.
- [ ] O exemplo/copy de demonstração do pacote usa marca **genérica**, nunca a marca real do site que inspirou a skin.
- [ ] Nenhum campo de configuração comercial (preço-base, tabela de ingredientes, regra de física/animação do motor) é editável por fora do schema do pacote — se o adaptador do lado Radar aceitar chave desconhecida aí, ela vira uma porta para o operador "configurar" o motor físico por engano. (Ver `problemasLancheria`: `funcionamento`/`casa` são fechados a chave conhecida; motor físico — `prensa`, `baselines`, `salto` — é território do pacote, rejeitado se aparecer no payload do lead.)

---

## 2. As quatro variantes: o que diverge, o que não diverge

**O que PODE divergir entre variantes** (isso é o que faz cada uma ser um "mundo" e não um clone com paleta trocada):
- [ ] Paleta completa (fundo/superfície/traço/texto/dois acentos independentes — na `lancheria-2`, `quente`/`frio`, não um `destaque` genérico).
- [ ] Tipografia (display/corpo/mono, pesos/estilos).
- [ ] Textura/densidade/raio de borda — os knobs de identidade calibrada do pacote.
- [ ] Arranjo — ordem das seções e quais nascem ocultas (`VarianteArranjo.ordem`/`ocultas`).
- [ ] Cópia de exemplo própria (títulos, descrição do hero, textos de abertura) — desde que não repita a cópia de outra variante ao ponto de duas variantes parecerem a mesma coisa (foi corrigido no Prático: ele não pode herdar o slogan da Cantina só porque reaproveita o mesmo preset de hero da origem).

**O que NÃO PODE divergir** (é a trava — testada, não convenção):
- [ ] **Ids de seção**: cada variante usa a MESMA lista de `SkinSecaoDef.id` da skin — permutação válida, nunca renomeação/remoção/invenção.
- [ ] **Contrato de slots**: mesmas chaves de `DemoData.imagens` e de `DemoData.secoes`, e o MESMO valor-placeholder por slot (não só a mesma chave — o diff do editor compara cada slot contra o SVG de exemplo da skin; se uma variante apontasse outro arquivo, trocar de variante gravaria a imagem no patch como se fosse upload do operador).
- [ ] **Seção fixa continua fixa em toda variante** (nunca oculta, nunca fora da posição default) — ocultar uma seção fixa é removê-la por outro caminho.
- [ ] **Um `<h1>` dentro da abertura**, em toda variante (ver 1.1) — é o item que pega a variante que esvazia o hero por dentro sem mudar o conjunto de `data-d-secao`.

**Regra de fundo claro/escuro:**
- [ ] A skin com variantes tem **ao menos uma variante de fundo `claro` e uma de fundo `escuro`** — quem escolhe a demo precisa dos dois mundos, não de quatro tons do mesmo. `fundo` é um rótulo declarado, mas tem que bater com a luminância relativa real da cor de fundo da paleta (fórmula WCAG, mesmo critério de `tema.ts`) — declarar `"claro"` numa paleta que mede escura é mentira que o teste pega.
- [ ] Contraste texto/fundo ≥ 4.5:1 e `destaque`/`ink` (ou, no caso calibrado, `quente`/`ink` equivalente) ≥ 4.5:1 (mínimo 3:1 só em elemento grande/UI) em **cada** variante — mesma régua da "regra dos 4 mundos" dos presets comuns.

---

## 3. Listas e registros que uma skin nova precisa entrar (com o motivo de cada um)

Este é o ponto que custou uma rodada inteira nas quatro lancherias originais: elas existiam no registro mas ficaram invisíveis para três laços de verificação (`--so=colapso`, `--so=barra`, `--so=avulsa`) porque cada laço lia sua **própria lista escrita à mão** em vez do registro. Um portão que não visita a skin passa sempre — silenciosamente. Toda entrada abaixo é ou (a) o que dá à skin existência no produto, ou (b) uma das listas `.mjs` que um laço de verificação lê porque o laço não compila TypeScript.

- [ ] **`src/lib/demos/registry.ts`** — a entrada `SkinDefinition` (com `variantes`, `heroEscalaLimites`, `thumbnail`). Motivo: sem isto a skin não existe para rota pública, ficha ou editor.
- [ ] **`public/demos/<nicho>/*.svg`** — um placeholder por slot de imagem + `thumb.svg`. Motivo: `registry.test.ts` reprova a skin sem eles (placeholder ausente = build quebrado, não aviso).
- [ ] **`public/demos/<nicho>/<variante>.jpg`** (uma miniatura por variante). Motivo: seletor da aba Tema e passo de escolha de skin mostram a miniatura por variante, não uma só para a skin inteira.
- [ ] **`ANCORAS_PADRAO`** em `src/lib/demos/capturas/padrao.mjs`. Motivo: define o trio padrão de seções (identidade/oferta/prova-fecho) que vira print de prospecção; tem teste de contrato contra o registro — skin de fora dele nunca gera captura.
- [ ] **`SECOES_POR_SKIN`** em `src/lib/demos/capturas/ancoras.ts`. Motivo: é a cópia pura (sem importar componentes React) do contrato de seções que a validação de `/config/app` e o motor de captura leem sem puxar o bundle inteiro de skins para rotas que não precisam dele.
- [ ] **`VARIANTES_POR_SKIN`** em `src/lib/demos/capturas/variantes.mjs` — **só se a skin tem variantes**. Motivo: é exatamente a lista cuja ausência (as quatro lancherias como skins separadas, sem este eixo) apagou o eixo de variante de `qa-visual.mjs --so=colapso` por uma rodada inteira; hoje tem teste de contrato (`variantes-mjs.test.ts`) para nunca mais divergir em silêncio.
- [ ] **`vendor/<pacote>/origem.json`** (manifesto de hashes SHA-256) — **quando a skin vem de pacote externo calibrado**. Motivo: é o que permite provar, a cada re-exportação, que o "motor físico" (a parte que não é copy/dado — física do raio-x, baselines, camadas de imagem, fontes) não foi tocado à mão dentro deste repositório; um teste (`lancheria.test.ts`, "motor e acervo publicados correspondem aos hashes de origem, byte a byte") falha se algum arquivo do motor divergir do que a origem realmente exportou.
- [ ] **`src/app/demo/fonts/core.ts`** (fonte nova default de algum preset/variante) ou **`src/app/demo/fonts/dynamic/` + `registry.ts`** (fonte só alcançável por escolha do editor). Motivo: sem isso a tipografia calibrada não carrega — nem por padrão, nem sob demanda.
- [ ] **Teste de contrato do registro** (`src/lib/demos/__tests__/registry.test.ts`) — roda sozinho contra `SKINS`, nada a escrever à mão; conte com ele para pegar: ids duplicados, placeholder físico ausente, `heroEscalaLimites` incoerente, seção sem nome, `alignOptions`/`entradaOptions` inválidas.
- [ ] **Trava de variante** (`src/lib/demos/__tests__/variantes.test.tsx`) — roda sozinha contra toda skin com `variantes.length > 0`; é o teste que teria pego a 1ª rodada da `lancheria-rx` (seção sem `data-d-secao`) e a divergência do Prático (`hero: 'nenhum'`).
- [ ] **Contrato de identidade por variante** (`src/lib/demos/__tests__/lead-data-contract.test.tsx`) — roda contra toda combinação skin×variante; garante que (a) dados reais do lead aparecem no HTML, (b) o exemplo nunca fixa telefone/whatsapp/instagram/cidade/horário/título-do-hero como string não vazia, e (c) lead vazio nunca vaza um default antigo. É o teste que teria pego qualquer identidade "hardcoded" vinda do pacote de origem (ver 1.4).

---

## 4. Checklist final — antes de abrir o PR de clonagem

Marcar item por item, contra o pacote pronto para exportar:

**Contrato de seção**
- [ ] Toda seção do desenho final tem `data-d-secao` no HTML do servidor (JS desligado).
- [ ] O `data-d-secao="hero"` envolve nome + categoria/slogan + horário — a abertura inteira, não um fragmento dela.
- [ ] Exatamente um `<h1>`, dentro do wrapper do hero.
- [ ] Nenhum `data-d-secao` duplicado.
- [ ] Chrome (`fixed`/`sticky` fora de seção) identificado e sem `data-d-secao`; sticky de conteúdo (dentro de seção) identificado como conteúdo.
- [ ] Lista final de ids de seção está fechada — ninguém pretende renomear depois desta exportação.

**Slots e identidade**
- [ ] Todo slot de imagem é parâmetro (com `alt` parametrizado junto), não caminho fixo no JSX.
- [ ] Slots de imagem são os mesmos em todas as variantes (mesma chave; a variante decide exibir ou não, nunca remove o slot).
- [ ] Nenhum campo de identidade (nome/marca/cidade/endereço/telefone/whatsapp/instagram/horário) aparece como literal no componente ou no exemplo — tudo vem por parâmetro, inclusive vazio.
- [ ] Schema do pacote fecha as chaves aceitas (nada de "extra" silenciosamente ignorado ou aplicado).

**Variantes**
- [ ] Todas as variantes compartilham a mesma lista de ids de seção (permutação, nunca invenção/remoção) e o mesmo contrato de slots.
- [ ] Seção fixa nunca nasce oculta em nenhuma variante.
- [ ] Ao menos uma variante `claro` e uma `escuro`, com a luminância real da paleta batendo com o rótulo.
- [ ] Cada variante passa 4.5:1 (texto/fundo) e 4.5:1/3:1 (destaque/ink).
- [ ] Cada variante renderiza um `<h1>` dentro da abertura (checar mesmo quando a variante "esvazia" o hero visualmente).
- [ ] Cópia de exemplo não se repete entre variantes ao ponto de duas parecerem a mesma.

**Motor físico (pacote calibrado)**
- [ ] Arquivos do motor físico (o que não é copy/dado editável) estão separados do que é slot/parâmetro.
- [ ] Manifesto de hashes da exportação (`origem.json`-style) acompanha o pacote, cobrindo motor + acervo de imagens/fontes publicados.

**Registro e listas do laço** (lado Radar, depois do clone)
- [ ] Entrada em `registry.ts` com `heroEscalaLimites`/`thumbnail`.
- [ ] Placeholders físicos (`public/demos/<nicho>/*.svg` + `thumb.svg` + uma miniatura por variante).
- [ ] `ANCORAS_PADRAO` (`capturas/padrao.mjs`).
- [ ] `SECOES_POR_SKIN` (`capturas/ancoras.ts`).
- [ ] `VARIANTES_POR_SKIN` (`capturas/variantes.mjs`), se houver variantes.
- [ ] Fonte nova registrada (`core.ts` se default de algum preset/variante; `dynamic/` + `registry.ts` se só sob demanda).
- [ ] `registry.test.ts`, `variantes.test.tsx`, `lead-data-contract.test.tsx` e (se pacote calibrado) o teste de hash byte a byte — todos verdes.

Só depois de marcar tudo acima o PR de clonagem (o `Re-exporta @radar/<pacote>` que traz o material para dentro da árvore) está pronto para ser aberto.
