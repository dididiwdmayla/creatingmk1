import type { FiltroPresenca } from "@/lib/config";
import type { DemoDataPatch, TemaPatch } from "@/lib/demos/types";
import { InvalidTransitionError, NotFoundError, ValidationError } from "@/lib/errors";
import type { AppDb } from "@/lib/firestore-like";
import type { DetalhesLugar, PlaceBasico } from "@/lib/places/client";
import { isSiteProprio } from "@/lib/site-proprio";
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

/**
 * Deriva siteProprio para docs gravados antes do campo existir:
 * enriquecido → classifica detalhes.site; busca qualificada antiga →
 * classifica temSite/siteUrl. Sem informação → undefined (desconhecido).
 */
function deriveSiteProprio(lead: Lead): boolean | undefined {
  if (lead.enriquecido) {
    const site = lead.detalhes?.site;
    return Boolean(site) && isSiteProprio(site ?? "");
  }
  if (lead.temSite === false) return false; // sem URL nenhuma = sem site próprio
  if (lead.temSite === true) {
    return lead.siteUrl ? isSiteProprio(lead.siteUrl) : true;
  }
  return undefined;
}

function asLead(data: Record<string, unknown>): Lead {
  // Confiamos no que nós mesmos gravamos; validação fica na borda (rotas).
  const lead = data as unknown as Lead;
  // Migração de leitura: docs antigos não têm siteProprio — deriva.
  if (lead.siteProprio === undefined) {
    const derivado = deriveSiteProprio(lead);
    if (derivado !== undefined) return { ...lead, siteProprio: derivado };
  }
  return lead;
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
        // Busca qualificada traz informação fresca de site/telefone; nunca remove.
        temSite: place.temSite ?? existing.temSite,
        siteUrl: place.siteUrl ?? existing.siteUrl,
        siteProprio: place.siteProprio ?? existing.siteProprio,
        temTelefone: place.temTelefone ?? existing.temTelefone,
        telefone: place.telefone ?? existing.telefone,
        telefoneIntl: place.telefoneIntl ?? existing.telefoneIntl,
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
        temSite: place.temSite,
        siteUrl: place.siteUrl,
        siteProprio: place.siteProprio,
        temTelefone: place.temTelefone,
        telefone: place.telefone,
        telefoneIntl: place.telefoneIntl,
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
  /** "1"/"true" → só favoritos. */
  favorito?: string;
}

/**
 * Presença para os filtros. Site usa a classificação siteProprio (rede
 * social/agregador conta como SEM site próprio — lead quente); telefone
 * usa enriquecimento ou a busca qualificada. undefined = desconhecido
 * (fica fora dos filtros com/sem).
 */
export function presenca(lead: Lead, campo: "site" | "telefone"): boolean | undefined {
  if (campo === "site") return lead.siteProprio ?? deriveSiteProprio(lead);
  if (lead.enriquecido) return Boolean(lead.detalhes?.telefone);
  return lead.temTelefone;
}

function matchesPresenca(
  filtro: FiltroPresenca,
  lead: Lead,
  campo: "site" | "telefone",
): boolean {
  if (filtro === "qualquer") return true;
  const presente = presenca(lead, campo);
  if (presente === undefined) return false;
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
  const soFavoritos = filters.favorito === "1" || filters.favorito === "true";

  const snapshot = await db.collection(LEADS_COLLECTION).get();
  return snapshot.docs
    .map((doc) => asLead(doc.data()))
    .filter(
      (lead) =>
        (status === undefined || lead.status === status) &&
        (buscaId === undefined || (lead.buscaId ?? []).includes(buscaId)) &&
        (!soFavoritos || lead.favorito === true) &&
        matchesPresenca(temSite, lead, "site") &&
        matchesPresenca(temTelefone, lead, "telefone"),
    )
    // Descartados vão pro fim da lista (mas continuam visíveis/reversíveis).
    .sort(
      (a, b) =>
        Number(a.descartado === true) - Number(b.descartado === true) ||
        b.criadoEm.localeCompare(a.criadoEm),
    );
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

/** Notas/favorito/descartado editáveis direto no card, sem transição de status. */
export async function updateLeadExtras(
  db: AppDb,
  placeId: string,
  extras: { notas?: string; favorito?: boolean; descartado?: boolean },
  now: Date = new Date(),
): Promise<Lead> {
  const lead = await requireLead(db, placeId);
  const updated: Lead = {
    ...lead,
    ...(extras.notas !== undefined && { notas: extras.notas }),
    ...(extras.favorito !== undefined && { favorito: extras.favorito }),
    ...(extras.descartado !== undefined && { descartado: extras.descartado }),
    atualizadoEm: now.toISOString(),
  };
  await docRef(db, placeId).set(toDoc(updated));
  return updated;
}

/** Salva a configuração da demo do lead (Forja de Demos). */
export async function saveDemo(
  db: AppDb,
  placeId: string,
  demo: { skinId: string; themeId: string; dados: DemoDataPatch; tema?: TemaPatch },
  now: Date = new Date(),
): Promise<Lead> {
  const lead = await requireLead(db, placeId);
  const em = now.toISOString();
  const updated: Lead = {
    ...lead,
    demo: { ...demo, atualizadoEm: em },
    atualizadoEm: em,
  };
  await docRef(db, placeId).set(toDoc(updated));
  return updated;
}

/** Apaga a configuração da demo (o lead continua; /demo/{id} volta a 404). */
export async function deleteDemo(
  db: AppDb,
  placeId: string,
  now: Date = new Date(),
): Promise<Lead> {
  const lead = await requireLead(db, placeId);
  const semDemo = { ...lead };
  delete semDemo.demo;
  const updated: Lead = { ...semDemo, atualizadoEm: now.toISOString() };
  await docRef(db, placeId).set(toDoc(updated));
  return updated;
}

/**
 * Remove o override de imagem de um slot da demo salva (volta ao
 * placeholder do template). Sem demo salva ou sem override, é no-op —
 * a rota de imagens sempre pode apagar o arquivo do Storage sem medo.
 */
export async function removeDemoImagem(
  db: AppDb,
  placeId: string,
  slot: string,
  now: Date = new Date(),
): Promise<Lead> {
  const lead = await requireLead(db, placeId);
  if (!lead.demo?.dados.imagens?.[slot]) return lead;
  const imagens = { ...lead.demo.dados.imagens };
  delete imagens[slot];
  const updated: Lead = {
    ...lead,
    demo: { ...lead.demo, dados: { ...lead.demo.dados, imagens } },
    atualizadoEm: now.toISOString(),
  };
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
    // O enriquecimento também pediu websiteUri no mask → resposta definitiva.
    temSite: Boolean(detalhes.site),
    siteUrl: detalhes.site ?? lead.siteUrl,
    siteProprio: Boolean(detalhes.site) && isSiteProprio(detalhes.site ?? ""),
    atualizadoEm: em,
  };
  await docRef(db, placeId).set(toDoc(updated));
  return updated;
}
