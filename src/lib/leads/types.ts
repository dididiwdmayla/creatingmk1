import type { LeadDemo } from "@/lib/demos/types";
import type { DetalhesLugar, FaixaHorario } from "@/lib/places/client";

export const LEADS_COLLECTION = "leads";

export const LEAD_STATUSES = ["novo", "contactado", "respondeu", "fechado"] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

/**
 * Transições válidas: novo → contactado → respondeu → fechado,
 * e contactado → fechado direto (não respondeu, desisti).
 */
export const VALID_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  novo: ["contactado"],
  contactado: ["respondeu", "fechado"],
  respondeu: ["fechado"],
  fechado: [],
};

export interface Lead {
  /** Também é o ID do doc em /leads — dedupe natural entre buscas. */
  placeId: string;
  nome: string;
  endereco?: string;
  location?: { lat: number; lng: number };
  status: LeadStatus;
  /** Contexto da última busca que retornou este lead. */
  busca?: {
    nicho: string;
    subNicho?: string;
    regiao: string;
    em: string;
    /**
     * Idioma-alvo (BCP-47) da região geocodificada — ver "Idioma da IA na
     * demo": a sugestão de tema/textos do Gemini usa este idioma (default
     * "pt-BR"). Ausente em leads de antes da feature ou sem busca.
     */
    idioma?: string;
  };
  /** IDs de /buscas em que o lead apareceu — só cresce, nunca é sobrescrito. */
  buscaId?: string[];
  /**
   * O Google retornou ALGUMA URL para o lugar (busca qualificada ou
   * enriquecimento). Na busca qualificada é sempre definitivo: o campo foi
   * pedido no mask, então ausência de websiteUri = false. undefined =
   * desconhecido (busca básica sem enriquecer).
   */
  temSite?: boolean;
  siteUrl?: string;
  /**
   * Classificação da URL (src/lib/site-proprio.ts): true = site próprio;
   * false = SEM site próprio — ou não tem URL nenhuma, ou a URL é rede
   * social/WhatsApp/agregador (lead quente do mesmo jeito); undefined
   * (ausente no doc) = desconhecido. Filtro "Site próprio" usa este campo.
   */
  siteProprio?: boolean;
  /** Da busca qualificada (telefones no Text Search). undefined = desconhecido. */
  temTelefone?: boolean;
  telefone?: string;
  /** Base do link wa.me — o botão WhatsApp funciona sem enriquecer. */
  telefoneIntl?: string;
  /** Anotação curta editável direto no card da lista. */
  notas?: string;
  favorito?: boolean;
  /** Descarte suave: não deleta; vai pro fim da lista com listra. Reversível. */
  descartado?: boolean;
  enriquecido: boolean;
  detalhes?: DetalhesLugar & { enriquecidoEm: string; enriquecidoPor?: string };
  /**
   * Horário de funcionamento estruturado (SKU detailsProHours, tier Pro,
   * contador PRÓPRIO — separado de `detalhes`/`enriquecido`). Chamado junto
   * do enriquecimento quando o lead ainda não tinha nenhum dos dois; leads
   * já enriquecidos ANTES desta feature buscam via botão dedicado
   * ("buscar horários"). Ausente = nunca buscado (nem tentado, nem falhou).
   */
  horarios?: {
    faixas: FaixaHorario[];
    utcOffsetMinutes?: number;
    obtidoEm: string;
  };
  /**
   * Configuração da demo personalizada (Forja de Demos): skin, tema e
   * overrides de conteúdo. O upsert da busca nunca toca neste campo.
   */
  demo?: LeadDemo;
  contato?: {
    primeiroContatoEm?: string;
    /** Usuário que marcou o lead como contactado (métricas por usuário). */
    primeiroContatoPor?: string;
    respondeuEm?: string;
    fechadoEm?: string;
    /**
     * Vendedor do fechamento — default o usuário que marcou "fechado";
     * admin pode ajustar depois (ver ajustarVendidoPor). Base do card
     * "Fechamentos do mês" por usuário.
     */
    fechadoPor?: string;
  };
  /**
   * Selo "já contatou este lead": carimbado ao CLICAR no botão WhatsApp,
   * independente do fluxo de status (`contato` acima) — primeiro clique
   * prevalece, nunca sobrescrito. Visível em card/ficha/hoje pra evitar
   * contato duplicado entre colegas.
   */
  seloContato?: {
    userId: string;
    em: string;
  };
  criadoEm: string;
  atualizadoEm: string;
}
