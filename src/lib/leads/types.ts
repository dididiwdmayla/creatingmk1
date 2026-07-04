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
