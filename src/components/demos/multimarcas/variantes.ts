import type { DemoData, SkinVariante, Theme } from "@/lib/demos/types";
import { criarVariante } from "@/lib/demos/variantes";

import { MULTIMARCAS_EXEMPLO } from "./exemplo";
import { MULTIMARCAS_SECOES } from "./secoes";
import { MULTIMARCAS_THEME_PRESETS } from "./themes";

/**
 * As quatro VARIANTES da `multimarcas-vortice` — quatro TIPOS DE LOJA, não
 * quatro paletas (ver "As quatro variantes" em docs/plano-multimarcas.md
 * §4). Nesta etapa (1 — contrato e fiação) cada declaração carrega o
 * MÍNIMO que fecha o contrato: o preset de paleta/tipografia que já
 * existia (renomeado com o id novo), o arranjo default de seções (§6
 * "Ordem default") e os slots que a variante não desenha (§8). A
 * composição visual por variante (`MultimarcasComposicao`, os cinco
 * desenhos de cada seção) e a cópia de exemplo própria entram na etapa 3 —
 * até lá as quatro variantes compartilham a MESMA camada de exemplo
 * (`MULTIMARCAS_EXEMPLO`), o que a trava de variantes
 * (`__tests__/variantes.test.tsx`) aceita: o contrato de slots é o mesmo
 * por definição quando o exemplo é o mesmo objeto.
 *
 * IDs e aliases (§4): os ids ANTIGOS de preset (`azul-classico`, `grafite`,
 * `meia-noite`) viram os ids NOVOS de variante (`patio`, `garagem`,
 * `campo`) por `SkinDefinition.themeAliases`, mapeados por FUNDO — nenhuma
 * demo publicada troca de luminância. `vortice` fica com o mesmo id (é o
 * default, inalterado).
 */
interface Declaracao {
  /** Id novo da variante (§4). */
  id: string;
  nome: string;
  /** O tipo de loja e o público dela — é o que justifica a composição futura. */
  descricao: string;
  fundo: "claro" | "escuro";
  /** Id do preset ANTIGO em ./themes.ts que esta variante herda (paleta/tipografia). */
  presetId: string;
  /** Permutação COMPLETA dos ids de MULTIMARCAS_SECOES, incluindo "hero" (ver VarianteArranjo). */
  ordem: readonly string[];
  imagensOcultas?: Record<string, "nenhum" | "so-titulo">;
}

const DECLARACOES: readonly Declaracao[] = [
  {
    id: "vortice",
    nome: "Vórtice — Seminovos Premium",
    descricao:
      "Loja de seminovos de 80–150 mil com laudo e garantia. Quem chega: comprador racional que compara três lojas e decide por procedência. Conversão fiel do material bruto; continua o default.",
    fundo: "claro",
    presetId: "vortice",
    ordem: ["hero", "estoque", "vantagens", "numeros", "destaque", "simulador", "avaliacao", "depoimentos", "contato"],
    // Abertura tipográfica, fiel ao original — sem foto (§8).
    imagensOcultas: { hero: "nenhum" },
  },
  {
    id: "patio",
    nome: "Pátio — Loja de Bairro",
    descricao:
      "Pátio de populares e primeiro carro, até 70 mil, faixa na calçada. Quem chega: quem compra pela parcela e não pelo preço, no celular, entre um compromisso e outro.",
    fundo: "claro",
    presetId: "azul-classico",
    ordem: ["hero", "estoque", "simulador", "avaliacao", "destaque", "numeros", "vantagens", "depoimentos", "contato"],
    // A abertura é a busca por faixa de preço — sem foto (§8).
    imagensOcultas: { hero: "nenhum" },
  },
  {
    id: "garagem",
    nome: "Garagem — Boutique de Esportivos",
    descricao:
      "Poucos carros, cada um um evento: esportivos, importados, clássicos. Quem chega: entusiasta que lê a ficha técnica inteira antes de mandar a primeira mensagem.",
    fundo: "escuro",
    presetId: "grafite",
    ordem: ["hero", "destaque", "estoque", "depoimentos", "vantagens", "numeros", "avaliacao", "simulador", "contato"],
    // Desenha os onze slots (§8) — foto sangrada na abertura.
  },
  {
    id: "campo",
    nome: "Campo — Picapes e Utilitários",
    descricao:
      "Loja de picape, SUV 4×4 e utilitário no interior. Quem chega: produtor ou empresa que troca a caminhonete velha na compra da nova — a troca é o assunto.",
    fundo: "escuro",
    presetId: "meia-noite",
    ordem: ["hero", "avaliacao", "estoque", "destaque", "numeros", "simulador", "vantagens", "depoimentos", "contato"],
    // Desenha os onze slots (§8) — abertura dividida, com foto.
  },
];

export const MULTIMARCAS_VARIANTES: readonly SkinVariante[] = DECLARACOES.map((d) => {
  const preset = MULTIMARCAS_THEME_PRESETS.find((t) => t.id === d.presetId)!;
  const theme: Theme = { ...preset, id: d.id, nome: d.nome };
  const exemplo: DemoData = MULTIMARCAS_EXEMPLO;
  return criarVariante(
    {
      id: d.id,
      nome: d.nome,
      descricao: d.descricao,
      fundo: d.fundo,
      theme,
      exemplo,
      arranjo: { ordem: d.ordem },
      thumbnail: `/demos/multimarcas/${d.id}.jpg`,
      ...(d.imagensOcultas && { imagensOcultas: d.imagensOcultas }),
    },
    MULTIMARCAS_SECOES,
  );
});
