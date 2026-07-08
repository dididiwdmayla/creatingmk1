import type { DetalhesLugar } from "@/lib/places/client";

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
  busca?: { nicho: string; subNicho?: string; regiao: string; em: string };
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
  detalhes?: DetalhesLugar & { enriquecidoEm: string };
  contato?: {
    primeiroContatoEm?: string;
    respondeuEm?: string;
    fechadoEm?: string;
  };
  criadoEm: string;
  atualizadoEm: string;
}
