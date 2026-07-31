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
  /**
   * Categoria/etiqueta curta do item — usada por skins com filtro (ex.:
   * corpo do veículo num catálogo de carros). Ausente = item some do
   * agrupamento, mas continua na lista "todos".
   */
  categoria?: string;
  /** Badges curtos exibidos como chips (ex.: ano, km, câmbio — specs rápidas). */
  destaques?: string[];
}

/** Depoimento/avaliação exibido na seção de prova social. */
export interface DemoDepoimento {
  autor: string;
  texto: string;
  /** 1–5 estrelas; ausente = depoimento sem nota. */
  nota?: number;
  /** Segunda linha curta sob o autor (ex.: o que comprou/contratou). Opcional. */
  contexto?: string;
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

/**
 * Animação de entrada no scroll de UMA seção (override do comportamento
 * default da skin). "typewriter" anima o TÍTULO da seção como máquina de
 * escrever (com fade no bloco); os demais valem para o bloco inteiro.
 * undefined = padrão do template. A intensidade/duração continua vindo do
 * nível global `Theme.animacao` — e `nenhuma` global (ou
 * prefers-reduced-motion) desliga tudo, inclusive estes overrides.
 */
export type AnimacaoEntrada =
  | "nenhuma"
  | "fade"
  | "deslizar-esquerda"
  | "deslizar-direita"
  | "typewriter";

export const ANIMACOES_ENTRADA: readonly AnimacaoEntrada[] = [
  "nenhuma",
  "fade",
  "deslizar-esquerda",
  "deslizar-direita",
  "typewriter",
];

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
  /** Só vale se a skin declara entradaOptions para a seção (ver SkinSecaoDef). */
  animacaoEntrada?: AnimacaoEntrada;
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
  /**
   * Vídeo por slot de vídeo-no-texto (chaves = SkinDefinition.videoSlots —
   * opt-in por skin, ver ./registry.ts). Slot ausente = sem vídeo: a skin
   * cai no fallback (imagem do slot correspondente, se houver, senão cor
   * sólida). NUNCA tem placeholder — ao contrário de `imagens`, vídeo é
   * sempre conteúdo real do lead (a Forja não versiona vídeo de terceiros).
   * URL sempre do Storage (upload em /api/leads/[id]/demo/videos).
   */
  videos?: Record<string, string>;
}

/** Densidade de espaçamento vertical das seções. */
export type Densidade = "compacta" | "confortavel" | "arejada";

/**
 * Nível de animação do tema: afeta entrada de seção (scroll reveal),
 * hovers (lift/scale) e transições (duração) — ver aplicarTema em
 * ./tema.ts e a implementação na skin de barbearia.
 */
export type Animacao = "nenhuma" | "sutil" | "marcante";

export const ANIMACOES: readonly Animacao[] = ["nenhuma", "sutil", "marcante"];

/**
 * Micro-interações opcionais do tema. Tudo CSS puro (transform/opacity/
 * box-shadow — custo baixo em mobile), com intensidade escalada pelo nível
 * global `Theme.animacao` e desligado por completo em `nenhuma` /
 * prefers-reduced-motion.
 */

/** Estilo do hover de cards/botões da skin. */
export type HoverEstilo = "lift" | "zoom" | "brilho";

export const HOVER_ESTILOS: readonly HoverEstilo[] = ["lift", "zoom", "brilho"];

/** Animação de clique (pressionar) em botões/CTAs. */
export type CliqueEstilo = "nenhum" | "pressao" | "pulso";

export const CLIQUE_ESTILOS: readonly CliqueEstilo[] = ["nenhum", "pressao", "pulso"];

/** Efeito sutil de fundo (overlay fixo, GPU-friendly). */
export type FundoEfeito = "nenhum" | "gradiente" | "particulas";

export const FUNDO_EFEITOS: readonly FundoEfeito[] = ["nenhum", "gradiente", "particulas"];

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

/**
 * Estilo do título principal (hero), independente do resto da tipografia
 * — o editor dá controles próprios pra ele (aba Tema): fonte (da lista
 * curada, papel "display"), escala (multiplica o clamp de tamanho da
 * skin, dentro de SkinDefinition.heroEscalaLimites) e alinhamento do
 * bloco. `texto` continua em DemoData (dados.secoes.hero.titulo — ausente
 * = nome do negócio), já que é conteúdo, não estilo.
 */
export interface HeroTituloTema {
  /** Valor CSS pronto (var(--font-demo-*) + fallback); ausente = fontes.display do tema. */
  fonte: string;
  /** Multiplica o tamanho-base do título hero da skin; 1 = tamanho default. */
  escala: number;
  alinhamento: Alinhamento;
}

/** Preset de LED (efeito lateral) — ver Theme.led. */
export type LedPreset = "desligado" | "sutil" | "marcante";

export const LED_PRESETS: readonly LedPreset[] = ["desligado", "sutil", "marcante"];

/** Tokens visuais de um tema de skin. */
export interface Theme {
  id: string;
  nome: string;
  paleta: ThemePaleta;
  fontes: ThemeFontes;
  /** Raio de borda base (ex.: "0px" editorial, "12px" soft). */
  raio: string;
  densidade: Densidade;
  /** Nível de animação (entradas de seção, hovers, transições). */
  animacao: Animacao;
  /** Intro/splash de abertura do template ligada? */
  intro: boolean;
  /** Estilo do hover animado de cards/botões. */
  hover: HoverEstilo;
  /** Animação de clique em botões/CTAs. */
  clique: CliqueEstilo;
  /** Efeito sutil de fundo (gradiente animado / partículas leves). */
  fundoEfeito: FundoEfeito;
  /** Estilo/escala/alinhamento do título hero (texto continua em DemoData). */
  heroTitulo: HeroTituloTema;
  /**
   * Bordas laterais com luz LED na cor de destaque, reagindo a scroll
   * (intensidade) e clique (pulso). CSS puro, custo baixo em mobile;
   * desligado por completo em prefers-reduced-motion. Default "desligado".
   */
  led: LedPreset;
}

/** Props que TODO componente de skin recebe. */
export interface SkinProps {
  data: DemoData;
  theme: Theme;
}

/**
 * Um flutuante decorativo lateral (imagem com leve parallax vertical no
 * scroll, ancorada na borda inferior de uma seção — fiel ao efeito de
 * comida flutuando nas laterais do material bruto da lancheria). O slot
 * aponta pra uma chave normal de DemoData.imagens (editável no editor como
 * qualquer outra imagem, mesmo upload/placeholder); posição, tamanho e
 * rotação são decorativos e fixos pela skin, não conteúdo do usuário.
 */
export interface DecorativeFloatDef {
  /** Chave em DemoData.imagens (e em SkinDefinition.demoDataExemplo.imagens). */
  slot: string;
  /** Seção (SkinSecaoDef.id) em que o flutuante é ancorado. */
  secaoId: string;
  lado: "esquerda" | "direita";
  /** Tamanho máximo em px — escala pra baixo em telas estreitas via clamp(). */
  tamanho: number;
  /** Rotação fixa em graus. */
  rotacao: number;
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
  /**
   * Animações de entrada que a skin suporta nesta seção; ausente = sem
   * seletor no editor. Uma seção com sticky interno, por ex., só declara
   * opções sem transform ("fade"/"typewriter") — ver SectionReveal.
   */
  entradaOptions?: readonly AnimacaoEntrada[];
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
  animacao?: Animacao;
  /** Liga/desliga a intro/splash de abertura do template. */
  intro?: boolean;
  hover?: HoverEstilo;
  clique?: CliqueEstilo;
  fundoEfeito?: FundoEfeito;
  /** Ajustes do título hero por cima do preset (fonte/escala/alinhamento). */
  heroTitulo?: Partial<HeroTituloTema>;
  led?: LedPreset;
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
  /** Limites de escala do título hero oferecidos na aba Tema do editor. */
  heroEscalaLimites: { min: number; max: number };
  /**
   * Slots de vídeo-no-texto que esta skin suporta (opt-in — ausente/vazio
   * = a skin não oferece o efeito). Cada id é uma chave de DemoData.videos
   * (ex.: "titulo"). Upload via /api/leads/[id]/demo/videos valida contra
   * esta lista, igual a `imagens` mas sem placeholder — sem vídeo no slot,
   * a skin cai no fallback (imagem correspondente ou cor sólida).
   */
  videoSlots?: readonly string[];
  /** Miniatura estática (ex.: /demos/<nicho>/thumb.svg) pro passo de escolha de skin no fluxo de criação. */
  thumbnail: string;
  /**
   * Ids de DEMO_FONTES (ver ./fontes.ts) curados para o nicho desta skin —
   * 4 a 6 fontes que combinam com o estilo do negócio (ex.: góticas/
   * condensadas para tatuagem, serifas clássicas para barbearia, displays
   * arredondadas para lanchonete). O seletor de fontes do editor mostra
   * essas primeiro, numa seção "Recomendadas para este nicho", com o
   * restante da lista curada abaixo. Ausente/vazio = sem destaque (mostra
   * a lista inteira, sem seção de recomendadas).
   */
  fontesRecomendadas?: readonly string[];
  /**
   * Flutuantes decorativos (imagens com leve parallax nas laterais das
   * seções — ver DecorativeFloatDef) — opt-in por skin, ausente/vazio =
   * a skin não usa o efeito. Cada slot é editável em DemoData.imagens
   * como qualquer outro (upload/placeholder), só posição/tamanho/rotação
   * vêm fixos daqui.
   */
  decorativeFloats?: readonly DecorativeFloatDef[];
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
  /**
   * Idioma-alvo (BCP-47) dos textos gerados pela IA — sobrescrita manual do
   * seletor do editor por cima do default derivado do país do endereço do
   * lead (ver `lib/demos/idioma.ts#idiomaPadraoDoLead`). Ausente = usa o
   * default derivado (não precisa persistir o caso comum). Um de
   * `IDIOMAS_SUPORTADOS` (`@/lib/idioma`).
   */
  idioma?: string;
  /** Primeiro save da demo — preservado entre edições (ver saveDemo em repo.ts). */
  criadoEm: string;
  /** Usuário do primeiro save — preservado entre edições (métricas por usuário). */
  criadoPor?: string;
  atualizadoEm: string;
}
