import type { PenetracaoSite } from "@/lib/leads/penetracao";

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
  /**
   * Busca recorrente: o cron diário (/api/cron) re-executa com os mesmos
   * parâmetros e anexa os novos leads a ESTE grupo. Teto de recorrentes
   * simultâneas em config.maxBuscasRecorrentes. Ausente/false = só manual.
   */
  recorrente?: boolean;
  /** Parâmetros da execução original, reusados pelo cron ("mesmo pipeline"). */
  qualificada?: boolean;
  quantidade?: number;
  criadaEm: string;
  totalCriados: number;
  totalExistentes: number;
  /** Usuário que executou a busca (ausente em docs anteriores ao multiusuário). */
  userId?: string;
  /**
   * Penetração de site próprio do nicho+região deste grupo (todas as
   * buscas com o MESMO nicho+região, não só esta — "neste nicho nesta
   * cidade" é o grupo lógico). Cacheada aqui, recalculada toda vez que
   * ESTA busca roda de novo (manual ou cron). 100% sobre dados já salvos:
   * nunca dispara request ao Google.
   */
  penetracao?: PenetracaoSite;
}

/**
 * Resumo do delta de uma re-execução do cron, um doc por rodada em
 * /buscas/{id}/execucoes (subcoleção — ID UUID, ordenação pelo campo em).
 */
export interface BuscaExecucao {
  em: string;
  novos: number;
  existentes: number;
}

/** Caminho da subcoleção de execuções de uma busca recorrente. */
export function execucoesCollection(buscaId: string): string {
  return `${BUSCAS_COLLECTION}/${buscaId}/execucoes`;
}
