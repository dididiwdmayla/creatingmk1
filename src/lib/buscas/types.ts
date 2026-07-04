export const BUSCAS_COLLECTION = "buscas";

/**
 * Paleta fixa das buscas (10 cores), atribuída em rotação na criação e
 * editável depois. Validada (skill dataviz) contra a superfície escura:
 * banda de luminância, croma e contraste ≥3:1 passam; com 10 hues a
 * separação CVD de todos os pares é inviável — por isso a cor NUNCA é o
 * único canal: o nome da busca está sempre escrito ao lado do badge.
 */
export const BUSCA_CORES = [
  "#3987e5", // azul
  "#199e70", // verde-água
  "#c98500", // amarelo
  "#008300", // verde
  "#7c6fdb", // violeta
  "#e66767", // vermelho
  "#d55181", // magenta
  "#d95926", // laranja
  "#1f96b4", // ciano
  "#c17a2f", // bronze
] as const;

/**
 * Registro de uma busca executada. Os leads apontam de volta via o campo
 * `buscaId` (array — um lead pode aparecer em várias buscas).
 */
export interface Busca {
  /** Também é o ID do doc em /buscas (UUID gerado na rota). */
  id: string;
  nome: string;
  nicho: string;
  subNicho?: string;
  regiao: string;
  /** Hex de BUSCA_CORES; docs antigos sem cor ganham fallback na leitura. */
  cor: string;
  criadaEm: string;
  totalCriados: number;
  totalExistentes: number;
}
