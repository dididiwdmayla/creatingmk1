export const BUSCAS_COLLECTION = "buscas";

/**
 * Paleta fixa das buscas (10 cores), atribuída em rotação na criação e
 * editável depois. Revalidada (skill dataviz) contra a surface do tema
 * radar (#121b24): banda de luminância, croma e contraste ≥3:1 passam;
 * com 10 hues a separação CVD de todos os pares é inviável — por isso a
 * cor NUNCA é o único canal: o nome da busca está sempre escrito ao lado
 * do badge.
 */
export const BUSCA_CORES = [
  "#2f82e0", // azul
  "#149f77", // verde-água
  "#c98500", // amarelo
  "#008300", // verde
  "#8272e6", // violeta
  "#ea6363", // vermelho
  "#dd5589", // magenta
  "#e05f26", // laranja
  "#1c9dc0", // ciano
  "#c8802f", // bronze
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
  /**
   * Mensagem padrão do grupo (opcional). O botão WhatsApp usa a do grupo
   * quando existir; senão cai na mensagem global de /config/app.
   */
  mensagemPadrao?: string;
  /**
   * Recomendação de priorização gerada pelo Gemini a partir dos leads do
   * grupo (SKU aiGeneration, uma única chamada). Cacheada aqui — só
   * regenera sob clique explícito no botão "Analisar com IA".
   */
  analiseIA?: { texto: string; geradaEm: string };
  criadaEm: string;
  totalCriados: number;
  totalExistentes: number;
  /** Usuário que executou a busca (ausente em docs anteriores ao multiusuário). */
  userId?: string;
}
