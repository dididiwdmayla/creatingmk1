import type { ComponentType } from "react";

/**
 * Contratos centrais da Forja de Demos.
 *
 * Uma "skin" é um componente PURO que recebe { data: DemoData, theme: Theme }
 * e renderiza um site de demonstração completo — nenhum texto, imagem ou cor
 * hardcoded no componente. DemoData carrega os slots de conteúdo (o QUE
 * aparece); Theme carrega os tokens visuais (COMO aparece). A demo de um
 * lead nasce do exemplo do template + dados do lead + edições da ficha
 * (ver montarDemoData em ./montar.ts).
 */

/** Um serviço com preço — linha da lista de serviços da demo. */
export interface DemoServico {
  nome: string;
  preco: string;
  descricao?: string;
}

/** Depoimento/avaliação exibido na seção de prova social. */
export interface DemoDepoimento {
  autor: string;
  texto: string;
  /** 1–5 estrelas; ausente = depoimento sem nota. */
  nota?: number;
}

/**
 * Item genérico de uma seção: pilar de filosofia, passo de agendamento,
 * membro da equipe… O skin decide como renderizar cada lista.
 */
export interface DemoItem {
  titulo: string;
  subtitulo?: string;
  /** Segunda linha curta, com peso visual mais leve que subtitulo (ex.: tempo de experiência). */
  detalhe?: string;
  texto?: string;
}

/** Alinhamento do conteúdo de uma seção (onde a skin declarar alignOptions). */
export type Alinhamento = "esquerda" | "centro" | "direita";

export const ALINHAMENTOS: readonly Alinhamento[] = ["esquerda", "centro", "direita"];

/** Bloco de textos de uma seção. Slots que o skin não usa são ignorados. */
export interface DemoSecao {
  /** Etiqueta pequena da seção (ex.: "SERVIÇOS"). */
  rotulo?: string;
  /** Headline da seção. */
  titulo?: string;
  texto?: string;
  cta?: string;
  ctaSecundaria?: string;
  itens?: DemoItem[];
  /** Seção escondida no editor (só para seções não-fixas da skin). */
  oculta?: boolean;
  /** Só vale se a skin declara alignOptions para a seção (ver SkinSecaoDef). */
  alinhamento?: Alinhamento;
}

/**
 * Slots de conteúdo de uma demo. Os campos de topo (nome, endereço,
 * telefone…) são os que a ficha do lead pré-preenche; `secoes` e `imagens`
 * usam chaves definidas por cada skin.
 */
export interface DemoData {
  nome: string;
  slogan?: string;
  endereco?: string;
  telefone?: string;
  /** Número do wa.me exibido/linkado (formato livre; dígitos são extraídos). */
  whatsapp?: string;
  instagram?: string;
  cidade?: string;
  horarios?: string;
  servicos: DemoServico[];
  depoimentos: DemoDepoimento[];
  /** Textos por seção; as chaves são definidas por cada skin. */
  secoes: Record<string, DemoSecao>;
  /**
   * Ordem das seções NÃO-fixas da skin (ids de SkinSecaoDef). Ausente =
   * ordem default da skin; ids desconhecidos são ignorados e seções não
   * listadas entram no fim, na ordem default (a skin nunca quebra por
   * dado velho de uma versão anterior do contrato).
   */
  ordemSecoes?: string[];
  /**
   * Imagem por slot (chaves definidas pelo skin, ex.: "hero", "equipe-1").
   * Slot ausente = placeholder default do template. Sempre caminhos locais
   * (nunca fotos do cliente original).
   */
  imagens: Record<string, string>;
}

/** Densidade de espaçamento vertical das seções. */
export type Densidade = "compacta" | "confortavel" | "arejada";

export interface ThemePaleta {
  fundo: string;
  fundoAlt: string;
  fundoElevado: string;
  /** Cor de acento (CTAs, etiquetas, hovers). */
  destaque: string;
  /** Cor de texto SOBRE o destaque (contraste garantido pelo preset). */
  destaqueInk: string;
  texto: string;
  textoSuave: string;
  borda: string;
  /** Acento secundário raro — detalhes decorativos (ex.: listra do poste). */
  acentoSecundario: string;
  /** Acento terciário raro — mesmo uso do secundário, para paletas de 3 cores. */
  acentoTerciario: string;
}

/**
 * Famílias tipográficas como valores CSS prontos — normalmente
 * `var(--font-demo-*)` (carregadas via next/font em src/app/demo) + fallback.
 */
export interface ThemeFontes {
  /** Títulos e números grandes. */
  display: string;
  corpo: string;
  /** Etiquetas, preços e dados tabulares. */
  mono: string;
  /** Bios e corpo de texto editorial mais longo. */
  serif: string;
  /** Logotipo/assinatura. */
  decorativa: string;
  /** Citações curtas e taglines em itálico. */
  citacao: string;
  /** Subtítulo de destaque (ex.: linha de abertura do hero). */
  destaque: string;
}

/** Tokens visuais de um tema de skin. */
export interface Theme {
  id: string;
  nome: string;
  paleta: ThemePaleta;
  fontes: ThemeFontes;
  /** Raio de borda base (ex.: "0px" editorial, "12px" soft). */
  raio: string;
  densidade: Densidade;
}

/** Props que TODO componente de skin recebe. */
export interface SkinProps {
  data: DemoData;
  theme: Theme;
}

/**
 * Uma seção declarada pela skin, na ordem default de render. O editor usa
 * esta lista para reordenar/ocultar seções e oferecer alinhamento; a
 * validação do PUT usa `alignOptions` para rejeitar alinhamento onde a
 * skin não suporta.
 */
export interface SkinSecaoDef {
  /** Chave da seção em DemoData.secoes (e em ordemSecoes). */
  id: string;
  /** Nome legível no editor (ex.: "Filosofia"). */
  nome: string;
  /** Fixa = não reordenável nem ocultável (ex.: hero de abertura). */
  fixa?: boolean;
  /** Alinhamentos que a skin suporta nesta seção; ausente = sem opção. */
  alignOptions?: readonly Alinhamento[];
}

/**
 * Ajustes de tema por cima do preset escolhido (LeadDemo.tema). Fontes
 * vêm da lista curada (ids de DEMO_FONTES em ./fontes.ts); `destaque` é a
 * cor primária em hex — o ink sobre ela é recalculado por contraste
 * (ver aplicarTema em ./tema.ts).
 */
export interface TemaPatch {
  /** Id da fonte curada para títulos (fontes.display). */
  fonteDisplay?: string;
  /** Id da fonte curada para o corpo (fontes.corpo). */
  fonteCorpo?: string;
  /** Cor primária (#rrggbb) — substitui paleta.destaque do preset. */
  destaque?: string;
  /** Raio de borda base — um de TEMA_RAIOS (./tema.ts). */
  raio?: string;
  densidade?: Densidade;
}

/** Entrada do registro de skins (ver ./registry.tsx). */
export interface SkinDefinition {
  id: string;
  /** Nicho a que a skin se destina (ex.: "barbearia"). */
  nicho: string;
  nome: string;
  descricao?: string;
  componente: ComponentType<SkinProps>;
  themeDefault: Theme;
  /** Presets oferecidos na ficha do lead (inclui o default). */
  themePresets: Theme[];
  demoDataExemplo: DemoData;
  /** Seções da skin, na ordem default de render (contrato do editor). */
  secoes: SkinSecaoDef[];
}

/**
 * Overrides parciais de DemoData salvos na ficha. `secoes` mescla por chave
 * (campos informados sobrescrevem; `itens` substitui a lista inteira);
 * `imagens` mescla por slot; `servicos`/`depoimentos` substituem a lista.
 */
export type DemoDataPatch = Partial<DemoData>;

/** Configuração da demo de um lead (campo `demo` do doc /leads/{id}). */
export interface LeadDemo {
  skinId: string;
  themeId: string;
  dados: DemoDataPatch;
  /** Ajustes de tema por cima do preset (fontes, cor primária, raio, densidade). */
  tema?: TemaPatch;
  atualizadoEm: string;
}
