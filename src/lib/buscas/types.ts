export const BUSCAS_COLLECTION = "buscas";

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
  criadaEm: string;
  totalCriados: number;
  totalExistentes: number;
}
