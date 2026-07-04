import type { FiltroPresenca } from "@/lib/config";
import { InvalidTransitionError, NotFoundError, ValidationError } from "@/lib/errors";
import type { AppDb } from "@/lib/firestore-like";
import type { DetalhesLugar, PlaceBasico } from "@/lib/places/client";
import {
  LEADS_COLLECTION,
  LEAD_STATUSES,
  VALID_TRANSITIONS,
  type Lead,
  type LeadStatus,
} from "./types";

/**
 * Repositório de /leads. Single-user: leitura-modificação-escrita simples
 * (sem transação) e filtros em memória — centenas de docs, não milhões.
 * Docs completos são sempre reescritos por inteiro, nunca via merge do
 * Firestore, para o comportamento ser idêntico no fake dos testes.
 */

function docRef(db: AppDb, placeId: string) {
  return db.collection(LEADS_COLLECTION).doc(placeId);
}

function asLead(data: Record<string, unknown>): Lead {
  // Confiamos no que nós mesmos gravamos; validação fica na borda (rotas).
  return data as unknown as Lead;
}

// O Firestore real rejeita undefined como valor; o round-trip JSON descarta
// essas chaves (todos os campos de Lead são JSON-safe).
function toDoc(lead: Lead): Record<string, unknown> {
  return JSON.parse(JSON.stringify(lead)) as Record<string, unknown>;
}

export async function getLead(db: AppDb, placeId: string): Promise<Lead | undefined> {
  const snap = await docRef(db, placeId).get();
  const data = snap.exists ? snap.data() : undefined;
  return data ? asLead(data) : undefined;
}

async function requireLead(db: AppDb, placeId: string): Promise<Lead> {
  const lead = await getLead(db, placeId);
  if (!lead) {
    throw new NotFoundError(`Lead "${placeId}" não encontrado.`);
  }
  return lead;
}

export interface UpsertResult {
  criados: number;
  existentes: number;
  leads: Lead[];
}

/**
 * Upsert dos resultados da busca. Lead novo entra com status "novo";
 * lead existente só tem nome/endereco/location/busca atualizados —
 * NUNCA rebaixa status nem apaga detalhes/contato. O buscaId é ANEXADO
 * ao array existente (um lead pode aparecer em várias buscas).
 */
export async function upsertLeads(
  db: AppDb,
  places: PlaceBasico[],
  busca: { nicho: string; subNicho?: string; regiao: string },
  buscaId: string,
  now: Date = new Date(),
): Promise<UpsertResult> {
  const em = now.toISOString();
  const result: UpsertResult = { criados: 0, existentes: 0, leads: [] };

  for (const place of places) {
    const existing = await getLead(db, place.placeId);
    let lead: Lead;
    if (existing) {
      result.existentes += 1;
      lead = {
        ...existing,
        nome: place.nome,
        endereco: place.endereco ?? existing.endereco,
        location: place.location ?? existing.location,
        busca: { ...busca, em },
        buscaId: [...new Set([...(existing.buscaId ?? []), buscaId])],
        atualizadoEm: em,
      };
    } else {
      result.criados += 1;
      lead = {
        placeId: place.placeId,
        nome: place.nome,
        endereco: place.endereco,
        location: place.location,
        status: "novo",
        busca: { ...busca, em },
        buscaId: [buscaId],
        enriquecido: false,
        criadoEm: em,
        atualizadoEm: em,
      };
    }
    await docRef(db, place.placeId).set(toDoc(lead));
    result.leads.push(lead);
  }

  return result;
}

export interface LeadFilters {
  status?: string;
  temSite?: string;
  temTelefone?: string;
  /** Restringe aos leads que apareceram na busca dada (match no array buscaId). */
  buscaId?: string;
}

function matchesPresenca(
  filtro: FiltroPresenca,
  lead: Lead,
  campo: "site" | "telefone",
): boolean {
  if (filtro === "qualquer") return true;
  // Sem enriquecimento não dá para afirmar presença nem ausência.
  if (!lead.enriquecido) return false;
  const presente = Boolean(lead.detalhes?.[campo]);
  return filtro === "com" ? presente : !presente;
}

function parsePresenca(value: string | undefined, nome: string): FiltroPresenca {
  if (value === undefined) return "qualquer";
  if (value === "qualquer" || value === "com" || value === "sem") return value;
  throw new ValidationError([`${nome} deve ser um de: qualquer, com, sem`]);
}

export async function listLeads(db: AppDb, filters: LeadFilters = {}): Promise<Lead[]> {
  const { status } = filters;
  if (status !== undefined && !(LEAD_STATUSES as readonly string[]).includes(status)) {
    throw new ValidationError([`status deve ser um de: ${LEAD_STATUSES.join(", ")}`]);
  }
  const temSite = parsePresenca(filters.temSite, "temSite");
  const temTelefone = parsePresenca(filters.temTelefone, "temTelefone");
  const { buscaId } = filters;

  const snapshot = await db.collection(LEADS_COLLECTION).get();
  return snapshot.docs
    .map((doc) => asLead(doc.data()))
    .filter(
      (lead) =>
        (status === undefined || lead.status === status) &&
        (buscaId === undefined || (lead.buscaId ?? []).includes(buscaId)) &&
        matchesPresenca(temSite, lead, "site") &&
        matchesPresenca(temTelefone, lead, "telefone"),
    )
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}

/** Carimbo em `contato` que cada transição de status grava. */
const STATUS_STAMPS: Partial<Record<LeadStatus, keyof NonNullable<Lead["contato"]>>> = {
  contactado: "primeiroContatoEm",
  respondeu: "respondeuEm",
  fechado: "fechadoEm",
};

export async function changeStatus(
  db: AppDb,
  placeId: string,
  para: LeadStatus,
  now: Date = new Date(),
): Promise<Lead> {
  const lead = await requireLead(db, placeId);
  if (!VALID_TRANSITIONS[lead.status].includes(para)) {
    throw new InvalidTransitionError(lead.status, para);
  }

  const em = now.toISOString();
  const contato = { ...lead.contato };
  const stamp = STATUS_STAMPS[para];
  if (stamp && !contato[stamp]) {
    contato[stamp] = em;
  }

  const updated: Lead = { ...lead, status: para, contato, atualizadoEm: em };
  await docRef(db, placeId).set(toDoc(updated));
  return updated;
}

export async function saveDetails(
  db: AppDb,
  placeId: string,
  detalhes: DetalhesLugar,
  now: Date = new Date(),
): Promise<Lead> {
  const lead = await requireLead(db, placeId);
  const em = now.toISOString();
  const updated: Lead = {
    ...lead,
    enriquecido: true,
    detalhes: { ...detalhes, enriquecidoEm: em },
    atualizadoEm: em,
  };
  await docRef(db, placeId).set(toDoc(updated));
  return updated;
}
