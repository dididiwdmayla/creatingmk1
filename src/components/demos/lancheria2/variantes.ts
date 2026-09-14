import { exemploLancheria, selecionarTema, type Tema, type TextosCasa } from "@radar/lancheria-rx/contrato";

import { inkPara } from "@/lib/demos/tema";
import type { DemoData, DemoLancheria, SkinVariante, Theme } from "@/lib/demos/types";
import { criarVariante } from "@/lib/demos/variantes";

import { LANCHERIA2_SECOES } from "./secoes";

/**
 * As quatro VARIANTES da `lancheria-2` (ver "Variante de skin" em
 * ARCHITECTURE.md). São quatro mundos visuais da MESMA skin: a animação do
 * lanche e o raio-x do hambúrguer — a essência — existem nas quatro; o que
 * muda é textura, composição e paleta.
 *
 * Cada variante declara os knobs de identidade do pacote calibrado (o
 * `Tema` da origem), o arranjo default das seções e os textos de abertura
 * próprios. O arranjo é DEFAULT, não trava: entra na camada de exemplo e o
 * operador reordena/oculta por cima, na aba Estrutura, como em qualquer
 * outra skin.
 *
 * A lista é declarada à mão, e não derivada de `TEMAS`, de propósito: uma
 * variante é decisão de produto (arranjo e cópia inclusos), não algo que
 * apareça sozinho porque a origem ganhou mais um tema.
 */

/** Tradução do `Tema` calibrado para o `Theme` da Forja. */
export function themeRadar(tema: Tema): Theme {
  const c = tema.cores;
  return {
    id: `lancheria-${tema.slug}`,
    nome: tema.nome,
    lancheria: tema,
    paleta: {
      fundo: c.base, fundoAlt: c.superficie, fundoElevado: c.superficie, borda: c.traco,
      texto: c.texto, textoSuave: c.frio, quente: c.quente, frio: c.frio,
      // Compatibilidade com o chrome antigo. A skin lê EXCLUSIVAMENTE quente/frio.
      destaque: c.quente, destaqueInk: inkPara(c.quente), acentoSecundario: c.frio, acentoTerciario: c.traco,
    },
    fontes: {
      display: tema.fontes.display, corpo: tema.fontes.corpo, mono: tema.fontes.medida,
      serif: tema.fontes.corpo, decorativa: tema.fontes.display,
      citacao: tema.fontes.corpo, destaque: tema.fontes.display,
    },
    raio: `${tema.raio}px`,
    densidade: ({ solta: "arejada", media: "confortavel", apertada: "compacta" } as const)[tema.densidade],
    animacao: "sutil",
    intro: tema.intro,
    hover: "lift",
    clique: "nenhum",
    fundoEfeito: "nenhum",
    heroTitulo: { fonte: tema.fontes.display, escala: 1, espacamento: 0, alinhamento: "esquerda" },
    led: "desligado",
    ledEstilo: "barra",
    barraCor: { modo: "fundo" },
  };
}

/** A declaração de uma variante, antes de virar `SkinVariante`. */
interface Declaracao {
  /** Identidade calibrada da origem (slug de `TEMAS`). */
  slug: string;
  descricao: string;
  /**
   * Ajustes de knob que pertencem a ESTA variante do Radar, não à origem.
   * Só entram aqui knobs de composição — paleta, fontes e mecânica seguem
   * a identidade calibrada.
   */
  knobs?: Partial<Tema>;
  /** Permutação dos ids de LANCHERIA2_SECOES (ver VarianteArranjo). */
  ordem: readonly string[];
  ocultas?: readonly string[];
  /** Textos de abertura próprios da variante (camada de exemplo). */
  textos?: Partial<TextosCasa>;
}

const DECLARACOES: readonly Declaracao[] = [
  {
    slug: "meia-noite",
    descricao:
      "Noite, letreiro e cartões editoriais compactos. A história da casa vem logo depois da prensa.",
    // A variante que CONTA a casa: a história sobe pra antes dos extras.
    ordem: ["hero", "cardapio", "sugestoes", "historia", "bebidas", "acompanhamentos", "horarios", "contato"],
  },
  {
    slug: "diner",
    descricao: "Fórmica azul, placa de porta e painel de fotos em três colunas.",
    // Vitrine: cardápio, prensa e extras primeiro; história por último.
    ordem: ["hero", "cardapio", "sugestoes", "bebidas", "acompanhamentos", "historia", "horarios", "contato"],
  },
  {
    slug: "pratico",
    descricao: "Lista direta, foto à esquerda e adicionar em primeiro plano. Sem intro.",
    // A origem entrega o Prático com `hero: 'nenhum'` — sem faixa de
    // slogan. Aqui ele ganha a faixa enxuta do `menu` (sem foto, tipografia
    // apertada): as quatro variantes emitem a MESMA abertura, e a diferença
    // do Prático volta a ser textura em vez de ausência.
    knobs: { hero: "menu" },
    // Cópia PRÓPRIA. O preset `menu` da origem é o da Cantina; duas
    // variantes com o mesmo slogan derrotariam o propósito do eixo.
    textos: {
      heroTitulo: "Direto ao lanche.",
      heroDescricao: "Preço na frente. Pedido em dois toques.",
      registro: "",
      // Sem frase de rodapé: a assinatura do Prático é "nenhuma".
      rodape: "",
    },
    // O caminho mais curto até o pedido: cardápio, bebida, acompanhamento,
    // horário. A trilha "Na prensa" nasce oculta — é um carrossel de
    // exploração lenta, e esta é a variante que desliga o reencaixe da
    // grade (`movimento.grade: false`). O operador reativa na aba Estrutura.
    ordem: ["hero", "cardapio", "bebidas", "acompanhamentos", "horarios", "sugestoes", "historia", "contato"],
    ocultas: ["sugestoes"],
  },
  {
    slug: "cantina",
    descricao: "Folha de menu em papel, nomes ligados ao preço por pontilhado e toldo terracota.",
    // Folha impressa: a casa se apresenta logo abaixo do cardápio.
    ordem: ["hero", "cardapio", "historia", "sugestoes", "bebidas", "acompanhamentos", "horarios", "contato"],
  },
];

/** Camada de exemplo da variante: catálogo do acervo + textos próprios. */
function exemploDaVariante(tema: Tema, textos: Partial<TextosCasa> | undefined): DemoData {
  const { casa, ...catalogo } = exemploLancheria(tema.hero);
  const lancheria: DemoLancheria = {
    ...catalogo,
    textos: { ...catalogo.textos, ...textos },
    funcionamento: {
      abre: casa.abre, fecha: casa.fecha, fuso: casa.fuso,
      pagamento: casa.pagamento, confirmado: false,
    },
  };
  return {
    nome: casa.nome,
    lancheria,
    servicos: [],
    depoimentos: [],
    // Todas as seções do contrato, nas quatro variantes — é o que o painel
    // Estrutura enumera e o que a trava compara entre variantes.
    secoes: Object.fromEntries(LANCHERIA2_SECOES.map((s) => [s.id, {}])),
    // Os dois slots de foto da página, IGUAIS nas quatro variantes (mesmo
    // contrato de slots — ver a trava). A variante decide se USA o hero
    // (`Tema.heroFoto`: Meia-Noite e Diner sim, Prático e Cantina abrem só
    // com tipografia); o slot existe do mesmo jeito, e um upload do lead
    // aparece assim que a variante o mostra.
    imagens: {
      hero: "/demos/lancheria2/hero.svg",
      historia: "/demos/lancheria2/historia.svg",
    },
  };
}

export const LANCHERIA2_VARIANTES: readonly SkinVariante[] = DECLARACOES.map((d) => {
  const tema: Tema = { ...selecionarTema(d.slug), ...d.knobs };
  return criarVariante(
    {
      id: `lancheria-${tema.slug}`,
      nome: tema.nome,
      descricao: d.descricao,
      fundo: tema.fundo,
      theme: themeRadar(tema),
      arranjo: { ordem: d.ordem, ocultas: d.ocultas },
      exemplo: exemploDaVariante(tema, d.textos),
      thumbnail: `/demos/lancheria2/${tema.slug}.jpg`,
    },
    LANCHERIA2_SECOES,
  );
});
