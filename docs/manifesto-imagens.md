# Manifesto de Imagens — Forja de Demos

Levantamento e documentação de todos os slots de imagem das 8 skins registradas em `src/lib/demos/registry.ts`. Este documento **não altera nenhuma skin nem nenhum arquivo de produção** — é só o briefing para produzir/gerar as fotos que substituirão os placeholders SVG locais (`public/demos/<nicho>/*.svg`).

Cada slot listado é editável pelo usuário no editor da Forja (aba Imagens) — o nome de arquivo aqui é só o do **placeholder local de exemplo**, que a demo usa até o lead subir a própria foto.

## Regras gerais (valem para toda foto gerada/produzida a partir deste manifesto)

1. **Sem rosto identificável.** Nenhuma foto de pessoa (equipe, cliente, depoimento) pode mostrar um rosto reconhecível — use enquadramentos de costas, de perfil sem foco no rosto, close em mãos/ferramentas/ação, ou silhueta contra a luz.
2. **Sem fachada de estabelecimento real.** Nenhuma foto pode ser de um endereço, loja, casa ou fachada que exista de fato — tudo é ambientação genérica, criada ou fotografada sem vínculo com um negócio real.
3. **Sem logotipo ou marca visível.** Nenhuma placa, etiqueta, rótulo, embalagem ou tela com logotipo, nome de marca ou identidade visual de terceiros pode aparecer no quadro.
4. **Licença de uso comercial obrigatória.** Toda imagem usada (banco de imagens, geração por IA, foto própria) precisa ter licença que permita uso comercial irrestrito — a Forja gera demos comerciais para prospecção de clientes reais.

---

## Barbearia Editorial (`barbearia-editorial`)

**Tema padrão:** `norte` — **escuro**. `--d-bg: #1A1411` (madeira quase preta) · `--d-accent: #B8862D` (dourado).

**Tratamento CSS:** a skin trata sozinha. **Todas** as imagens (hero, agendamento, serviços, equipe) passam pelo mesmo componente `Placeholder`/`TeamCard`, que aplica sempre:
```css
filter: contrast(0.95) saturate(0.9);
```
Um amaciamento sutil de contraste/saturação — não é preto-e-branco. **Entregar a foto em cor normal, bem exposta**; a skin já suaviza.

Total: **7 slots**.

| Slot (`imagens.*`) | Arquivo a criar | Alt atual | Proporção CSS | Seção |
|---|---|---|---|---|
| `hero` | `hero.webp` | "Ambiente de {nome}" | sem aspect fixo — preenche coluna alta (60vh mobile / 80vh desktop) | Hero |
| `agendamento-rapido` | `agendamento-rapido.webp` | "Cliente sendo atendido na cadeira" | `aspect-square` mobile → `aspect-[4/3]` desktop | Agendamento rápido |
| `servicos` | `servicos.webp` | "Ferramentas do ofício" | `aspect-[4/3]` mobile → `aspect-[3/4]` desktop | Serviços (sidebar) |
| `equipe-1` | `equipe-1.webp` | nome do membro (TeamCard) | `aspect-[3/4]` | Equipe |
| `equipe-2` | `equipe-2.webp` | nome do membro (TeamCard) | `aspect-[3/4]` | Equipe |
| `equipe-3` | `equipe-3.webp` | nome do membro (TeamCard) | `aspect-[3/4]` | Equipe |
| `mapa` | `mapa.webp` | "Mapa de {endereço}" | `aspect-square` mobile → `aspect-[4/5]` desktop | Contato/rodapé |

**Lista de produção:**

| Arquivo a criar | Assunto da foto | Orientação e proporção | Largura recomendada | Tonalidade |
|---|---|---|---|---|
| `hero.webp` | Interior de barbearia vazia, cadeiras de couro e espelhos, luz quente pontual, sem pessoas | Retrato, ~3:4 a 4:5 | 1600px | Escura/quente (harmoniza com o fundo #1A1411) |
| `agendamento-rapido.webp` | Barbeiro cortando cabelo de cliente na cadeira, ângulo lateral, rosto do cliente fora de foco | Quadrada a 4:3 | 1200px | Escura/quente |
| `servicos.webp` | Navalha, tesoura e pente apoiados numa bancada de couro, close, luz lateral | Retrato 3:4 | 1200px | Escura |
| `equipe-1.webp` | Barbeiro de perfil, rosto fora de foco, avental de couro, luz de estúdio quente | Retrato 3:4 | 1000px | Escura/quente, tom médio |
| `equipe-2.webp` | Barbeiro visto de costas ajustando a máquina de corte, luz de estúdio quente | Retrato 3:4 | 1000px | Escura/quente, tom médio |
| `equipe-3.webp` | Mãos de barbeiro segurando pente e tesoura, close, sem rosto no quadro | Retrato 3:4 | 1000px | Escura/quente, tom médio |
| `mapa.webp` | Textura de mapa urbano estilizado, sem nomes de rua legíveis, tom sépia | Quadrada a 4:5 | 1000px | Escura, sépia |

---

## Barbearia Sul (`barbearia2-sul`)

**Tema padrão:** `musgo` — **escuro**. `--d-bg: #101613` (verde-musgo quase preto) · `--d-accent: #B8863B` (latão).

**Tratamento CSS:** a skin trata sozinha. Galeria e equipe usam a classe `.d-foto-img`:
```css
.d-foto-img { filter: grayscale(1) brightness(0.85); transition: filter 0.5s var(--d-anim-ease); }
.d-foto:hover .d-foto-img, .group:hover .d-foto-img { filter: grayscale(0) brightness(1); }
```
Preto-e-branco por padrão, cor revelada no hover/toque. **Entregar a foto em cor** — a conversão para P&B é só visual e reversível.

Total: **7 slots**.

| Slot (`imagens.*`) | Arquivo a criar | Alt atual | Proporção CSS | Seção |
|---|---|---|---|---|
| `galeria-1` | `galeria-1.webp` | título do corte ("CORTE Nº 014") | `aspect-[4/5]` | Galeria (arraste) |
| `galeria-2` | `galeria-2.webp` | título do corte ("CORTE Nº 022") | `aspect-[4/5]` | Galeria (arraste) |
| `galeria-3` | `galeria-3.webp` | título do corte ("CORTE Nº 031") | `aspect-[4/5]` | Galeria (arraste) |
| `galeria-4` | `galeria-4.webp` | título do corte ("CORTE Nº 047") | `aspect-[4/5]` | Galeria (arraste) |
| `galeria-5` | `galeria-5.webp` | título do corte ("CORTE Nº 058") | `aspect-[4/5]` | Galeria (arraste) |
| `equipe-1` | `equipe-1.webp` | nome do barbeiro ("Seu Vicente") | `aspect-[3/4]` | Barbeiros |
| `equipe-2` | `equipe-2.webp` | nome do barbeiro ("Bruno") | `aspect-[3/4]` | Barbeiros |

**Lista de produção:**

| Arquivo a criar | Assunto da foto | Orientação e proporção | Largura recomendada | Tonalidade |
|---|---|---|---|---|
| `galeria-1.webp` | Nuca recém-cortada com acabamento na navalha, close, sem rosto no quadro | Retrato 4:5 | 1000px | Tom médio, bom contraste (a skin converte para P&B) |
| `galeria-2.webp` | Lateral da cabeça com degradê recém-feito, close, sem rosto no quadro | Retrato 4:5 | 1000px | Tom médio, bom contraste |
| `galeria-3.webp` | Barba aparada com navalha, close no queixo, sem rosto completo | Retrato 4:5 | 1000px | Tom médio, bom contraste |
| `galeria-4.webp` | Corte clássico finalizado visto de cima, sem rosto no quadro | Retrato 4:5 | 1000px | Tom médio, bom contraste |
| `galeria-5.webp` | Detalhe de risco/desenho raspado na lateral do cabelo, close | Retrato 4:5 | 1000px | Tom médio, bom contraste |
| `equipe-1.webp` | Barbeiro fundador, visto de perfil sem foco no rosto, avental de trabalho | Retrato 3:4 | 1000px | Tom médio, bom contraste |
| `equipe-2.webp` | Barbeiro mais jovem, mãos ajustando a máquina, sem rosto em foco | Retrato 3:4 | 1000px | Tom médio, bom contraste |

---

## Tatuagem Editorial Sombria (`tatuagem-editorial`)

**Tema padrão:** `sangue` — **escuro**. `--d-bg: #0A0A0A` (preto profundo) · `--d-accent: #8B0000` (vermelho-sangue).

**Tratamento CSS:** a skin trata sozinha, exceto o hero. O componente `Placeholder` tem um prop `filtro` (default `true`); só o hero passa `filtro={false}` (fica só com gradiente escuro por cima). `sobre` e todo `portfolio-N` recebem:
```css
filter: grayscale(100%) contrast(1.25) brightness(0.75);
```
Preto-e-branco de alto contraste e mais escuro. **Entregar em cor** (a conversão é 100% CSS); o hero é a única foto que fica em cor na tela — priorize boa exposição nela.

Total: **10 slots**.

| Slot (`imagens.*`) | Arquivo a criar | Alt atual | Proporção CSS | Seção |
|---|---|---|---|---|
| `hero` | `hero.webp` | "Ambiente de {nome}" | sem aspect fixo — cobre `100vw` × `min-h-[100svh]`/`90svh` | Hero (também fallback do vídeo-no-título mascarado no wordmark) |
| `sobre` | `sobre.webp` | título do artista (ex.: "Duda Ferraz") | `aspect-[3/4]` | O Artista / Sobre |
| `portfolio-1` | `portfolio-1.webp` | "{item.titulo} — {item.detalhe}" | `aspect-[4/5]` | Portfólio (masonry) |
| `portfolio-2` | `portfolio-2.webp` | idem | `aspect-[4/5]` | Portfólio (masonry) |
| `portfolio-3` | `portfolio-3.webp` | idem | `aspect-[4/5]` | Portfólio (masonry) |
| `portfolio-4` | `portfolio-4.webp` | idem | `aspect-[4/5]` | Portfólio (masonry) |
| `portfolio-5` | `portfolio-5.webp` | idem | `aspect-[4/5]` | Portfólio (masonry) |
| `portfolio-6` | `portfolio-6.webp` | idem | `aspect-[4/5]` | Portfólio (masonry) |
| `portfolio-7` | `portfolio-7.webp` | idem | `aspect-[4/5]` | Portfólio (masonry) |
| `portfolio-8` | `portfolio-8.webp` | idem | `aspect-[4/5]` | Portfólio (masonry) |

**Lista de produção:**

| Arquivo a criar | Assunto da foto | Orientação e proporção | Largura recomendada | Tonalidade |
|---|---|---|---|---|
| `hero.webp` | Estúdio de tatuagem em penumbra, maca profissional e luminária de trabalho, luz pontual dramática, sem pessoas | Paisagem ampla, preenche a tela | 2400px | Escura (fica em cor na tela, harmoniza com o fundo #0A0A0A) |
| `sobre.webp` | Mãos de tatuador segurando a máquina sobre a pele, close, luz dramática lateral | Retrato 3:4 | 1200px | Boa faixa tonal, evitar estouro de luz (converte para P&B de alto contraste) |
| `portfolio-1.webp` | Tatuagem blackwork de antebraço, close na pele | Retrato 4:5 | 1200px | Boa faixa tonal, evitar estouro de luz |
| `portfolio-2.webp` | Tatuagem de realismo dark nas costelas, close na pele | Retrato 4:5 | 1200px | Boa faixa tonal, evitar estouro de luz |
| `portfolio-3.webp` | Tatuagem de iconografia na panturrilha, close na pele | Retrato 4:5 | 1200px | Boa faixa tonal, evitar estouro de luz |
| `portfolio-4.webp` | Fechamento blackwork de braço, ângulo lateral, close na pele | Retrato 4:5 | 1200px | Boa faixa tonal, evitar estouro de luz |
| `portfolio-5.webp` | Tatuagem dotwork nas costas, close na pele | Retrato 4:5 | 1200px | Boa faixa tonal, evitar estouro de luz |
| `portfolio-6.webp` | Tatuagem linework no peito, close na pele | Retrato 4:5 | 1200px | Boa faixa tonal, evitar estouro de luz |
| `portfolio-7.webp` | Fechamento de realismo dark na perna, close na pele | Retrato 4:5 | 1200px | Boa faixa tonal, evitar estouro de luz |
| `portfolio-8.webp` | Tatuagem blackwork pequena na mão, close na pele | Retrato 4:5 | 1200px | Boa faixa tonal, evitar estouro de luz |

---

## Tatuagem Pigmento Vivo (`tatuagem-pigmento-vivo`)

**Tema padrão:** `aquarela` — **claro**. `--d-bg: #FAF6F0` (creme) · `--d-accent: #D6336C` (rosa/magenta).

**Tratamento CSS:** **nenhum**. `Placeholder` é só `object-cover`, sem `filter`. A foto aparece exatamente como enviada — não há grayscale, contraste ou máscara. **A skin não trata: a foto precisa chegar já no tom/cor final.** Hero e cartões de "Estilos"/"Artistas" não têm slot de imagem (fiéis ao material bruto, que usa blobs de cor e SVG ali) — só o Portfólio tem fotos de verdade.

Total: **8 slots**.

| Slot (`imagens.*`) | Arquivo a criar | Alt atual | Proporção CSS | Seção |
|---|---|---|---|---|
| `portfolio-1` | `portfolio-1.webp` | "{item.titulo} — {item.subtitulo}" | retrato ~4:5 (420×520, trilha horizontal) | Portfólio (trilha arrastável) |
| `portfolio-2` | `portfolio-2.webp` | idem | retrato 3:4 (300×400) | Portfólio (trilha arrastável) |
| `portfolio-3` | `portfolio-3.webp` | idem | retrato 3:4 (360×480) | Portfólio (trilha arrastável) |
| `portfolio-4` | `portfolio-4.webp` | idem | retrato ~7:9 (280×360) | Portfólio (trilha arrastável) |
| `portfolio-5` | `portfolio-5.webp` | idem | retrato 4:5 (400×500) | Portfólio (trilha arrastável) |
| `portfolio-6` | `portfolio-6.webp` | idem | retrato ~17:22 (340×440) | Portfólio (trilha arrastável) |
| `portfolio-7` | `portfolio-7.webp` | idem | retrato 4:5 (420×520) | Portfólio (trilha arrastável) |
| `portfolio-8` | `portfolio-8.webp` | idem | retrato 3:4 (300×400) | Portfólio (trilha arrastável) |

**Lista de produção:**

| Arquivo a criar | Assunto da foto | Orientação e proporção | Largura recomendada | Tonalidade |
|---|---|---|---|---|
| `portfolio-1.webp` | Tatuagem estilo aquarela colorida no antebraço, close na pele, fundo neutro | Retrato ~4:5 | 1200px | Clara, cores vivas (harmoniza com o fundo #FAF6F0) |
| `portfolio-2.webp` | Tatuagem neo-tradicional colorida no braço, close na pele | Retrato 3:4 | 1200px | Clara, cores vivas |
| `portfolio-3.webp` | Tatuagem fineline botânica delicada, close na pele | Retrato 3:4 | 1200px | Clara |
| `portfolio-4.webp` | Tatuagem old school (âncora ou andorinha), close na pele | Retrato ~7:9 | 1200px | Clara, cores vivas |
| `portfolio-5.webp` | Tatuagem blackwork de traço fino, close na pele, fundo claro | Retrato 4:5 | 1200px | Clara |
| `portfolio-6.webp` | Tatuagem aquarela abstrata, close na pele | Retrato ~17:22 | 1200px | Clara, cores vivas |
| `portfolio-7.webp` | Tatuagem neo-tradicional em outra área do corpo, close na pele | Retrato 4:5 | 1200px | Clara, cores vivas |
| `portfolio-8.webp` | Tatuagem fineline pequena, close na pele | Retrato 3:4 | 1200px | Clara |

---

## Lancheria Chapa Burger (`lancheria-chapa-burger`)

**Tema padrão:** `chapa` — **escuro**. `--d-bg: #1A0F0A` (marrom-chapa quase preto) · `--d-accent: #FF6321` (laranja).

**Tratamento CSS:** nenhum filtro de cor. `lanche-N` usa `object-cover` com `p-2` + `drop-shadow-md`; `bebida-N`/`acompanhamento-N` e os `flutuante-*` usam `object-contain` com `p-2`/sem padding e `drop-shadow` — ou seja, a skin espera **fotos de produto isoladas** (comida centralizada, sem preencher o quadro todo), não fotos de ambiente. **A skin não trata cor**: a foto precisa vir pronta, e o corte/enquadramento do produto já isolado ajuda o `object-contain` a não distorcer.

Total: **20 slots**.

| Slot (`imagens.*`) | Arquivo a criar | Alt atual | Proporção CSS | Seção |
|---|---|---|---|---|
| `hero` | `hero.webp` | "Ambiente de {nome}" | sem aspect fixo — cobre `100vw` × `min-h-screen` | Hero |
| `prato-vazio` | `prato-vazio.webp` | (decorativo, `alt=""`) | mesmo contêiner do lanche: `h-48` mobile / `h-28 w-28` desktop | Cardápio (reveal por lente no hover de TODOS os cards) |
| `lanche-1` | `lanche-1.webp` | nome do lanche | `h-48` mobile / `h-28 w-28` desktop (isolado, `object-cover p-2`) | Cardápio |
| `lanche-2` | `lanche-2.webp` | nome do lanche | idem | Cardápio |
| `lanche-3` | `lanche-3.webp` | nome do lanche | idem | Cardápio |
| `lanche-4` | `lanche-4.webp` | nome do lanche | idem | Cardápio |
| `lanche-5` | `lanche-5.webp` | nome do lanche | idem | Cardápio |
| `lanche-6` | `lanche-6.webp` | nome do lanche | idem | Cardápio |
| `bebida-1` | `bebida-1.webp` | nome da bebida | `aspect-square` (isolado, `object-contain p-2`) | Bebidas (lista compacta) |
| `bebida-2` | `bebida-2.webp` | nome da bebida | `aspect-square` | Bebidas |
| `bebida-3` | `bebida-3.webp` | nome da bebida | `aspect-square` | Bebidas |
| `bebida-4` | `bebida-4.webp` | nome da bebida | `aspect-square` | Bebidas |
| `bebida-5` | `bebida-5.webp` | nome da bebida | `aspect-square` | Bebidas |
| `acompanhamento-1` | `acompanhamento-1.webp` | nome do acompanhamento | `aspect-square` (isolado, `object-contain p-2`) | Acompanhamentos (lista compacta) |
| `acompanhamento-2` | `acompanhamento-2.webp` | nome do acompanhamento | `aspect-square` | Acompanhamentos |
| `acompanhamento-3` | `acompanhamento-3.webp` | nome do acompanhamento | `aspect-square` | Acompanhamentos |
| `acompanhamento-4` | `acompanhamento-4.webp` | nome do acompanhamento | `aspect-square` | Acompanhamentos |
| `flutuante-bacon` | `flutuante-bacon.webp` | (decorativo, `alt=""`) | `aspect-square`, ~180px, `object-contain` | Flutuante na borda do Cardápio |
| `flutuante-queijo` | `flutuante-queijo.webp` | (decorativo, `alt=""`) | `aspect-square`, ~200px, `object-contain` | Flutuante na borda de Bebidas |
| `flutuante-bebida` | `flutuante-bebida.webp` | (decorativo, `alt=""`) | `aspect-square`, ~220px, `object-contain` | Flutuante na borda de Acompanhamentos |

**Lista de produção:**

| Arquivo a criar | Assunto da foto | Orientação e proporção | Largura recomendada | Tonalidade |
|---|---|---|---|---|
| `hero.webp` | Interior de hamburgueria em luz baixa, chapa quente ao fundo desfocada, sem pessoas nem placas | Paisagem ampla | 2400px | Escura/quente (harmoniza com o fundo #1A0F0A) |
| `prato-vazio.webp` | Prato branco vazio fotografado de cima, isolado, sem marca | Quadrada/paisagem leve | 1200px | Clara e neutra (contrasta com o fundo escuro) |
| `lanche-1.webp` | Hambúrguer artesanal clássico isolado, vista em 3/4, fundo neutro liso | Paisagem/quadrada leve | 1000px | Clara e vívida (destaca contra o fundo escuro) |
| `lanche-2.webp` | Hambúrguer com bacon crocante isolado, vista em 3/4, fundo neutro liso | Paisagem/quadrada leve | 1000px | Clara e vívida |
| `lanche-3.webp` | Hambúrguer com onion rings isolado, vista em 3/4, fundo neutro liso | Paisagem/quadrada leve | 1000px | Clara e vívida |
| `lanche-4.webp` | Hambúrguer tradicional com alface e tomate isolado, vista em 3/4 | Paisagem/quadrada leve | 1000px | Clara e vívida |
| `lanche-5.webp` | Sanduíche de frango empanado crocante isolado, vista em 3/4 | Paisagem/quadrada leve | 1000px | Clara e vívida |
| `lanche-6.webp` | Hambúrguer vegetariano isolado, vista em 3/4, fundo neutro liso | Paisagem/quadrada leve | 1000px | Clara e vívida |
| `bebida-1.webp` | Milkshake isolado em copo alto, fundo neutro/transparente | Quadrada | 800px | Clara e vívida |
| `bebida-2.webp` | Suco natural isolado em copo, fundo neutro/transparente | Quadrada | 800px | Clara e vívida |
| `bebida-3.webp` | Lata ou copo de refrigerante cola isolado, fundo neutro/transparente | Quadrada | 800px | Clara e vívida |
| `bebida-4.webp` | Lata ou copo de refrigerante guaraná isolado, fundo neutro/transparente | Quadrada | 800px | Clara e vívida |
| `bebida-5.webp` | Copo d'água com gelo isolado, fundo neutro/transparente | Quadrada | 800px | Clara e vívida |
| `acompanhamento-1.webp` | Porção de batata frita grande isolada, fundo neutro/transparente | Quadrada | 800px | Clara e vívida |
| `acompanhamento-2.webp` | Porção de onion rings isolada, fundo neutro/transparente | Quadrada | 800px | Clara e vívida |
| `acompanhamento-3.webp` | Porção de nuggets isolada, fundo neutro/transparente | Quadrada | 800px | Clara e vívida |
| `acompanhamento-4.webp` | Porção de batata frita pequena isolada, fundo neutro/transparente | Quadrada | 800px | Clara e vívida |
| `flutuante-bacon.webp` | Tira de bacon crocante recortada, fundo transparente | Quadrada | 600px | Clara e vívida |
| `flutuante-queijo.webp` | Fatia de queijo derretendo recortada, fundo transparente | Quadrada | 600px | Clara e vívida |
| `flutuante-bebida.webp` | Copo de bebida com gelo recortado, fundo transparente | Quadrada | 600px | Clara e vívida |

---

## Imobiliária Curada (`imobiliaria-curada`)

**Tema padrão:** `terracota` — **claro**. `--d-bg: #F7F1E8` (creme) · `--d-accent: #C4572E` (terracota).

**Tratamento CSS:** nenhum filtro de cor. O hero tem `drop-shadow` decorativo (fora da imagem) e é recortado por uma máscara orgânica (`border-radius` composto tipo blob) — só estética de moldura, não altera cor. **A skin não trata: entregar em cor natural.**

Total: **12 slots**.

| Slot (`imagens.*`) | Arquivo a criar | Alt atual | Proporção CSS | Seção |
|---|---|---|---|---|
| `hero` | `hero.webp` | "Fachada de imóvel de {nome}" | `aspect-[4/5]`, moldura orgânica (blob) | Hero |
| `imovel-1` | `imovel-1.webp` | nome do imóvel (ex.: "Casa-jardim em Alto de Pinheiros") | bento — `h-[420px]/[500px]` ou `h-[380px]/[420px]` conforme coluna | Imóveis em destaque |
| `imovel-2` | `imovel-2.webp` | nome do imóvel | idem | Imóveis em destaque |
| `imovel-3` | `imovel-3.webp` | nome do imóvel | idem | Imóveis em destaque |
| `imovel-4` | `imovel-4.webp` | nome do imóvel | idem | Imóveis em destaque |
| `imovel-5` | `imovel-5.webp` | nome do imóvel | idem | Imóveis em destaque |
| `bairro-1` | `bairro-1.webp` | nome do bairro (ex.: "Jardins") | fixo 330×470px (~7:10, retrato) | Bairros (carrossel arrastável) |
| `bairro-2` | `bairro-2.webp` | nome do bairro | idem | Bairros |
| `bairro-3` | `bairro-3.webp` | nome do bairro | idem | Bairros |
| `bairro-4` | `bairro-4.webp` | nome do bairro | idem | Bairros |
| `bairro-5` | `bairro-5.webp` | nome do bairro | idem | Bairros |
| `depoimento-1` | `depoimento-1.webp` | nome do autor do depoimento | círculo 72×72px (`aspect-square`) | Depoimento |

**Lista de produção:**

| Arquivo a criar | Assunto da foto | Orientação e proporção | Largura recomendada | Tonalidade |
|---|---|---|---|---|
| `hero.webp` | Fachada de casa genérica contemporânea, jardim frontal, luz de tarde, sem número de rua ou placa visível | Retrato 4:5 | 1400px | Clara/quente (harmoniza com o fundo #F7F1E8) |
| `imovel-1.webp` | Casa térrea genérica com jardim e piscina, fachada ou área externa, luz de fim de tarde | Paisagem/quadrada (varia por card) | 1400px | Clara |
| `imovel-2.webp` | Terraço de cobertura genérico ao pôr do sol, vista aberta | Paisagem/quadrada | 1400px | Clara |
| `imovel-3.webp` | Interior de studio genérico com pé-direito duplo e luz natural | Paisagem/quadrada | 1400px | Clara |
| `imovel-4.webp` | Sala de apartamento reformado genérico, piso de taco, luz natural | Paisagem/quadrada | 1400px | Clara |
| `imovel-5.webp` | Cobertura duplex genérica com vista para área verde | Paisagem/quadrada | 1400px | Clara |
| `bairro-1.webp` | Rua residencial arborizada e clássica, sem placas de nome legíveis | Retrato ~7:10 | 1000px | Clara |
| `bairro-2.webp` | Viela estreita com ateliês e fachadas coloridas genéricas | Retrato ~7:10 | 1000px | Clara |
| `bairro-3.webp` | Esquina de bairro movimentado, cafés e calçada arborizada | Retrato ~7:10 | 1000px | Clara |
| `bairro-4.webp` | Rua residencial calma perto de um parque | Retrato ~7:10 | 1000px | Clara |
| `bairro-5.webp` | Prédio modernista genérico com padaria de esquina | Retrato ~7:10 | 1000px | Clara |
| `depoimento-1.webp` | Mãos segurando um molho de chaves novas, close, sem rosto no quadro | Quadrada (avatar circular) | 600px | Clara |

---

## Multimarcas Vórtice (`multimarcas-vortice`)

**Tema padrão:** `vortice` — **claro**. `--d-bg: #F5F0E6` (creme) · `--d-accent: #D40000` (vermelho).

**Tratamento CSS:** nenhum. `object-cover` puro, sem filtro. **A skin não trata: entregar em cor natural.** Sem slot de hero — o hero é só texto + velocímetro decorativo (fiel ao material bruto); só o Estoque tem fotos.

Total: **9 slots**.

| Slot (`imagens.*`) | Arquivo a criar | Alt atual | Proporção CSS | Seção |
|---|---|---|---|---|
| `carro-1` | `carro-1.webp` | nome do veículo (ex.: "Hyundai HB20 Platinum") | `aspect-[16/10]` | Estoque |
| `carro-2` | `carro-2.webp` | nome do veículo (ex.: "VW Polo GTS") | `aspect-[16/10]` | Estoque |
| `carro-3` | `carro-3.webp` | nome do veículo (ex.: "Honda Civic Touring") | `aspect-[16/10]` | Estoque |
| `carro-4` | `carro-4.webp` | nome do veículo (ex.: "Toyota Corolla Altis Hybrid") | `aspect-[16/10]` | Estoque |
| `carro-5` | `carro-5.webp` | nome do veículo (ex.: "Jeep Compass Limited") | `aspect-[16/10]` | Estoque |
| `carro-6` | `carro-6.webp` | nome do veículo (ex.: "VW T-Cross Highline") | `aspect-[16/10]` | Estoque |
| `carro-7` | `carro-7.webp` | nome do veículo (ex.: "Toyota Hilux SRX") | `aspect-[16/10]` | Estoque |
| `carro-8` | `carro-8.webp` | nome do veículo (ex.: "Ford Ranger Limited") | `aspect-[16/10]` | Estoque |
| `carro-9` | `carro-9.webp` | nome do veículo (ex.: "BMW M240i Coupé") | `aspect-[16/10]` | Estoque |

**Lista de produção:**

| Arquivo a criar | Assunto da foto | Orientação e proporção | Largura recomendada | Tonalidade |
|---|---|---|---|---|
| `carro-1.webp` | Hatch compacto em estúdio, ângulo 3/4 frontal, fundo neutro, placa não legível | Paisagem 16:10 | 1600px | Clara/neutra (harmoniza com o fundo #F5F0E6) |
| `carro-2.webp` | Hatch esportivo em estúdio, ângulo 3/4 frontal, fundo neutro | Paisagem 16:10 | 1600px | Clara/neutra |
| `carro-3.webp` | Sedan executivo em estúdio, ângulo 3/4 frontal, fundo neutro | Paisagem 16:10 | 1600px | Clara/neutra |
| `carro-4.webp` | Sedan híbrido em estúdio, ângulo 3/4 frontal, fundo neutro | Paisagem 16:10 | 1600px | Clara/neutra |
| `carro-5.webp` | SUV médio em estúdio, ângulo 3/4 frontal, fundo neutro | Paisagem 16:10 | 1600px | Clara/neutra |
| `carro-6.webp` | SUV compacto em estúdio, ângulo 3/4 frontal, fundo neutro | Paisagem 16:10 | 1600px | Clara/neutra |
| `carro-7.webp` | Picape robusta em estúdio, ângulo 3/4 frontal, fundo neutro | Paisagem 16:10 | 1600px | Clara/neutra |
| `carro-8.webp` | Picape de trabalho em estúdio, ângulo 3/4 frontal, fundo neutro | Paisagem 16:10 | 1600px | Clara/neutra |
| `carro-9.webp` | Cupê esportivo premium em estúdio, ângulo 3/4 frontal, fundo neutro | Paisagem 16:10 | 1600px | Clara/neutra |

---

## Petshop Focinho Feliz (`petshop-focinho-feliz`)

**Tema padrão:** `pastel` — **claro**. `--d-bg: #FFF6EA` (creme) · `--d-accent: #FF6B2C` (laranja).

**Tratamento CSS:** nenhum filtro de cor. Hero e equipe têm moldura orgânica (blob-mask), sem alterar tom. **A skin não trata: entregar em cor natural.**

Total: **15 slots**.

| Slot (`imagens.*`) | Arquivo a criar | Alt atual | Proporção CSS | Seção |
|---|---|---|---|---|
| `hero` | `hero.webp` | "Pet feliz em {nome}" | `aspect-[0.92]` (quase quadrado), moldura orgânica | Hero |
| `servico-1` | `servico-1.webp` | nome do serviço (ex.: "Banho & Tosa") | `h-44` fixo (card, paisagem) | Serviços |
| `servico-2` | `servico-2.webp` | nome do serviço (ex.: "Hidratação & Spa") | `h-44` fixo | Serviços |
| `servico-3` | `servico-3.webp` | nome do serviço (ex.: "Day Care") | `h-44` fixo | Serviços |
| `servico-4` | `servico-4.webp` | nome do serviço (ex.: "Táxi Pet") | `h-44` fixo | Serviços |
| `equipe-1` | `equipe-1.webp` | nome do membro (ex.: "Marina Duarte") | círculo 120×120px, moldura orgânica | Equipe |
| `equipe-2` | `equipe-2.webp` | nome do membro (ex.: "Beto Sales") | círculo 120×120px | Equipe |
| `equipe-3` | `equipe-3.webp` | nome do membro (ex.: "Dra. Fernanda Lima") | círculo 120×120px | Equipe |
| `equipe-4` | `equipe-4.webp` | nome do membro (ex.: "Kaique Rocha") | círculo 120×120px | Equipe |
| `galeria-1` | `galeria-1.webp` | nome do pet (ex.: "Pipoca") | `aspect-square` | Clientes da semana (galeria) |
| `galeria-2` | `galeria-2.webp` | nome do pet (ex.: "Baguete") | `aspect-square` | Clientes da semana |
| `galeria-3` | `galeria-3.webp` | nome do pet (ex.: "Frida") | `aspect-square` | Clientes da semana |
| `galeria-4` | `galeria-4.webp` | nome do pet (ex.: "Simba") | `aspect-square` | Clientes da semana |
| `galeria-5` | `galeria-5.webp` | nome do pet (ex.: "Olívia") | `aspect-square` | Clientes da semana |
| `galeria-6` | `galeria-6.webp` | nome do pet (ex.: "Jorge") | `aspect-square` | Clientes da semana |

**Lista de produção:**

| Arquivo a criar | Assunto da foto | Orientação e proporção | Largura recomendada | Tonalidade |
|---|---|---|---|---|
| `hero.webp` | Cão de porte médio recém-tomado banho, pelagem limpa e fofa, still em fundo neutro claro, sem tutor no quadro | Quase quadrada (~0.92:1) | 1400px | Clara (harmoniza com o fundo #FFF6EA) |
| `servico-1.webp` | Cão sendo enxaguado numa banheira de pet shop, sem rosto de tutor no quadro | Paisagem | 1000px | Clara |
| `servico-2.webp` | Pet recebendo escovação/hidratação, still com produtos de spa ao redor | Paisagem | 1000px | Clara |
| `servico-3.webp` | Cães brincando juntos num espaço de day care, still | Paisagem | 1000px | Clara |
| `servico-4.webp` | Pet sendo acomodado num transporte pet com cinto de segurança | Paisagem | 1000px | Clara |
| `equipe-1.webp` | Mãos de tosadora cuidando de um pet, close, sem rosto no quadro | Círculo (quadrada) | 800px | Clara |
| `equipe-2.webp` | Groomer visto de costas segurando tesoura de tosa, sem rosto no quadro | Círculo (quadrada) | 800px | Clara |
| `equipe-3.webp` | Mãos de veterinária examinando a pata de um pet, close, sem rosto no quadro | Círculo (quadrada) | 800px | Clara |
| `equipe-4.webp` | Recreador de costas brincando com um cão no pátio, sem rosto no quadro | Círculo (quadrada) | 800px | Clara |
| `galeria-1.webp` | Cachorro pequeno de pelagem clara, still sorridente, fundo neutro | Quadrada | 1000px | Clara |
| `galeria-2.webp` | Cachorro de porte médio, still, fundo neutro | Quadrada | 1000px | Clara |
| `galeria-3.webp` | Gato de pelagem longa, still, fundo neutro | Quadrada | 1000px | Clara |
| `galeria-4.webp` | Cachorro de porte grande, still, fundo neutro | Quadrada | 1000px | Clara |
| `galeria-5.webp` | Gato de pelagem curta, still, fundo neutro | Quadrada | 1000px | Clara |
| `galeria-6.webp` | Cachorro filhote, still, fundo neutro | Quadrada | 1000px | Clara |

---

## Resumo — slots por skin

| Skin | Total de slots |
|---|---|
| `barbearia-editorial` | 7 |
| `barbearia2-sul` | 7 |
| `tatuagem-editorial` | 10 |
| `tatuagem-pigmento-vivo` | 8 |
| `lancheria-chapa-burger` | 20 |
| `imobiliaria-curada` | 12 |
| `multimarcas-vortice` | 9 |
| `petshop-focinho-feliz` | 15 |
| **Total geral** | **88** |
