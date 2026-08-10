import { randomUUID } from "node:crypto";

import type { FiltroPresenca } from "@/lib/config";
import { canalDoEnvio, envioVigente, gerarEnvioToken } from "@/lib/demos/envio";
import { ENVIO_CANAIS, type DemoDataPatch, type EnvioDemo, type TemaPatch } from "@/lib/demos/types";
import { InvalidTransitionError, NotFoundError, ValidationError } from "@/lib/errors";
import type { AppDb } from "@/lib/firestore-like";
import type { DetalhesLugar, HorariosLugar, PlaceBasico } from "@/lib/places/client";
import { isSiteProprio } from "@/lib/site-proprio";
import { horarioLocalNoDisparo } from "./janelaContato";
import {
  LEADS_COLLECTION,
  LEAD_STATUSES,
  VALID_TRANSITIONS,
  type DemoVisita,
  type Lead,
  type LeadStatus,
  type RegistroEnvioContato,
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
  busca: { nicho: string; subNicho?: string; regiao: string; idioma?: string },
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

/**
 * Carimbo de QUEM fez a transição-chave (métricas por usuário): quem
 * contactou primeiro e quem fechou (vendedor — ver "Fechamentos do mês").
 */
const STATUS_POR_STAMPS: Partial<Record<LeadStatus, keyof NonNullable<Lead["contato"]>>> = {
  contactado: "primeiroContatoPor",
  fechado: "fechadoPor",
};

export async function changeStatus(
  db: AppDb,
  placeId: string,
  para: LeadStatus,
  now: Date = new Date(),
  userId?: string,
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
    const porStamp = STATUS_POR_STAMPS[para];
    if (porStamp && userId) {
      contato[porStamp] = userId;
    }
  }

  const updated: Lead = { ...lead, status: para, contato, atualizadoEm: em };
  await docRef(db, placeId).set(toDoc(updated));
  return updated;
}

/**
 * Selo "já contatou este lead" + registro do disparo: chamado a cada clique
 * no botão WhatsApp (ficha e /hoje). O selo carimba só uma vez (primeiro
 * clique prevalece — cliques seguintes, do mesmo usuário ou de outro após
 * confirmar o modal, são no-op nele); `registrosEnvio` cresce em TODOS os
 * cliques, com a hora local do lead naquele instante — só o registro por
 * enquanto, para comparar taxa de resposta por janela no futuro (ver
 * `Lead.registrosEnvio`).
 */
export async function registrarSeloContato(
  db: AppDb,
  placeId: string,
  userId: string,
  now: Date = new Date(),
): Promise<Lead> {
  const lead = await requireLead(db, placeId);
  const em = now.toISOString();
  const registro: RegistroEnvioContato = { em, ...horarioLocalNoDisparo(lead, now) };
  const updated: Lead = {
    ...lead,
    ...(lead.seloContato ? {} : { seloContato: { userId, em } }),
    registrosEnvio: [...(lead.registrosEnvio ?? []), registro],
    atualizadoEm: em,
  };
  await docRef(db, placeId).set(toDoc(updated));
  return updated;
}

/**
 * Ajuste do vendedor do fechamento pelo admin (default é quem marcou
 * "fechado" — ver STATUS_STAMPS/changeStatus). Só faz sentido em lead já
 * fechado; chamador (rota) garante isso e a permissão de admin.
 */
export async function ajustarVendidoPor(
  db: AppDb,
  placeId: string,
  vendidoPor: string,
  now: Date = new Date(),
): Promise<Lead> {
  const lead = await requireLead(db, placeId);
  const updated: Lead = {
    ...lead,
    contato: { ...lead.contato, fechadoPor: vendidoPor },
    atualizadoEm: now.toISOString(),
  };
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

/**
 * Garante um token vigente para CADA canal (link/whatsapp) — gera só os que
 * faltarem, preserva os já existentes (self-heal incremental; idempotente).
 * Entradas antigas sem `canal` contam como "whatsapp" (ver canalDoEnvio).
 */
function garantirEnviosCanais(envios: EnvioDemo[], geradoEm: string): EnvioDemo[] {
  const faltando = ENVIO_CANAIS.filter(
    (canal) => !envios.some((envio) => canalDoEnvio(envio) === canal),
  );
  if (faltando.length === 0) return envios;
  const novos = faltando.map((canal) => ({ token: gerarEnvioToken(), geradoEm, canal }));
  return [...novos, ...envios];
}

/** True quando falta o token vigente de algum canal — dispara self-heal na leitura. */
export function envioTokenIncompleto(lead: Lead): boolean {
  if (!lead.demo) return false;
  const envios = lead.demo.envios ?? [];
  return ENVIO_CANAIS.some((canal) => !envios.some((envio) => canalDoEnvio(envio) === canal));
}

/** Salva a configuração da demo do lead (Forja de Demos). */
export async function saveDemo(
  db: AppDb,
  placeId: string,
  demo: {
    skinId: string;
    themeId: string;
    dados: DemoDataPatch;
    tema?: TemaPatch;
    idioma?: string;
  },
  now: Date = new Date(),
  userId?: string,
): Promise<Lead> {
  const lead = await requireLead(db, placeId);
  const em = now.toISOString();
  // criadoEm/criadoPor são do PRIMEIRO save; edições seguintes preservam.
  const criadoPor = lead.demo?.criadoEm ? lead.demo.criadoPor : userId;
  // Os tokens de envio (um por canal) nascem junto da demo (self-heal se
  // por algum motivo uma demo antiga chegasse aqui sem algum — ver envio.ts).
  const envios = garantirEnviosCanais(lead.demo?.envios ?? [], em);
  const updated: Lead = {
    ...lead,
    demo: {
      ...demo,
      criadoEm: lead.demo?.criadoEm ?? em,
      ...(criadoPor && { criadoPor }),
      envios,
      atualizadoEm: em,
    },
    atualizadoEm: em,
  };
  await docRef(db, placeId).set(toDoc(updated));
  return updated;
}

/**
 * Garante que o lead com demo tenha um token vigente de CADA canal
 * (self-heal para demos salvas antes desta feature, ou de antes do canal
 * "link" existir) — chamado no GET da ficha/fila/lista, nunca no clique: o
 * valor precisa já estar pronto quando a página monta o link do WhatsApp
 * ou o de "Copiar link" (bloqueio de popup em fetch-no-clique para o
 * primeiro; consistência simples para o segundo).
 */
export async function garantirEnvioToken(
  db: AppDb,
  placeId: string,
  now: Date = new Date(),
): Promise<Lead> {
  const lead = await requireLead(db, placeId);
  if (!lead.demo || !envioTokenIncompleto(lead)) return lead;
  const updated: Lead = {
    ...lead,
    demo: {
      ...lead.demo,
      envios: garantirEnviosCanais(lead.demo.envios ?? [], now.toISOString()),
    },
  };
  await docRef(db, placeId).set(toDoc(updated));
  return updated;
}

/**
 * Registra uma visita à demo pública (rota /demo/{leadId}, chamada pelo
 * Server Component a cada carregamento COM `?t=` na URL — sem token, é o
 * "Abrir demo" do EDITOR (preview durante a edição) e não vira visita). Se
 * o token bater o envio VIGENTE **do mesmo canal** e a visita não for
 * interna, consome o envio: gera o próximo token DAQUELE canal, empurrado
 * para o início de `envios` (o antigo continua no histórico, então
 * revisitas do mesmo link antigo ainda resolvem o envio e o canal
 * corretos). QA interno (cookie de sessão válido no navegador ou marcador
 * de dispositivo — ver classificarVisitaInterna) nunca consome o token
 * vigente — não queima o envio real antes do lead abrir.
 */
export async function registrarVisitaDemo(
  db: AppDb,
  placeId: string,
  opts: {
    token?: string;
    interna: boolean;
    /** Geolocalização por IP, só informativa — ver DemoVisita.geo. */
    geo?: { pais?: string; regiao?: string; cidade?: string };
  },
  now: Date = new Date(),
): Promise<{ lead: Lead; visitaId?: string }> {
  const lead = await requireLead(db, placeId);
  if (!lead.demo || !opts.token) return { lead };

  const em = now.toISOString();
  const envios = lead.demo.envios ?? [];
  const envioCorrespondente = envios.find((envio) => envio.token === opts.token);
  const canalCorrespondente = envioCorrespondente ? canalDoEnvio(envioCorrespondente) : undefined;
  const visita: DemoVisita = {
    id: randomUUID(),
    em,
    interna: opts.interna,
    ...(envioCorrespondente && { envioEm: envioCorrespondente.geradoEm }),
    ...(canalCorrespondente && { canal: canalCorrespondente }),
    ...(opts.geo && { geo: opts.geo }),
  };

  // Vigente é POR CANAL: um link copiado não queima o token do WhatsApp e
  // vice-versa (ver EnvioDemo.canal em lib/demos/types.ts).
  const vigenteDoCanal = canalCorrespondente
    ? envioVigente({ envios }, canalCorrespondente)
    : undefined;
  const consome = !opts.interna && vigenteDoCanal !== undefined && vigenteDoCanal.token === opts.token;
  const novosEnvios = consome
    ? [{ token: gerarEnvioToken(), geradoEm: em, canal: canalCorrespondente! }, ...envios]
    : envios;

  const updated: Lead = {
    ...lead,
    demo: { ...lead.demo, envios: novosEnvios },
    demoVisitas: [...(lead.demoVisitas ?? []), visita],
  };
  await docRef(db, placeId).set(toDoc(updated));
  return { lead: updated, visitaId: visita.id };
}

/**
 * Atualiza duração/scroll de uma visita já registrada — chamado pelo
 * beacon disparado no unload da página pública da demo. Visita/lead
 * inexistente é no-op silencioso (o beacon é best-effort, sem retorno pro
 * cliente que importe). `marcadorDispositivo` promove a visita pra interna
 * quando o beacon manda o marcador de dispositivo válido (ver
 * lib/device.ts) — só PARA CIMA, nunca derruba uma visita já marcada
 * interna pela sessão no carregamento (ver registrarVisitaDemo).
 */
export async function atualizarVisitaDemo(
  db: AppDb,
  placeId: string,
  visitaId: string,
  dados: { duracaoSegundos?: number; scrollPercent?: number; marcadorDispositivo?: boolean },
): Promise<Lead | undefined> {
  const lead = await getLead(db, placeId);
  const idx = lead?.demoVisitas?.findIndex((visita) => visita.id === visitaId) ?? -1;
  if (!lead?.demoVisitas || idx === -1) return lead;

  const visitas = [...lead.demoVisitas];
  visitas[idx] = {
    ...visitas[idx],
    ...(dados.duracaoSegundos !== undefined && { duracaoSegundos: dados.duracaoSegundos }),
    ...(dados.scrollPercent !== undefined && { scrollPercent: dados.scrollPercent }),
    ...(dados.marcadorDispositivo && { interna: true }),
  };
  const updated: Lead = { ...lead, demoVisitas: visitas };
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

/** Mesma lógica de removeDemoImagem, pro override de dados.videos[slot]. */
export async function removeDemoVideo(
  db: AppDb,
  placeId: string,
  slot: string,
  now: Date = new Date(),
): Promise<Lead> {
  const lead = await requireLead(db, placeId);
  if (!lead.demo?.dados.videos?.[slot]) return lead;
  const videos = { ...lead.demo.dados.videos };
  delete videos[slot];
  const updated: Lead = {
    ...lead,
    demo: { ...lead.demo, dados: { ...lead.demo.dados, videos } },
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
  userId?: string,
): Promise<Lead> {
  const lead = await requireLead(db, placeId);
  const em = now.toISOString();
  const updated: Lead = {
    ...lead,
    enriquecido: true,
    detalhes: { ...detalhes, enriquecidoEm: em, ...(userId && { enriquecidoPor: userId }) },
    // O enriquecimento também pediu websiteUri no mask → resposta definitiva.
    temSite: Boolean(detalhes.site),
    siteUrl: detalhes.site ?? lead.siteUrl,
    siteProprio: Boolean(detalhes.site) && isSiteProprio(detalhes.site ?? ""),
    atualizadoEm: em,
  };
  await docRef(db, placeId).set(toDoc(updated));
  return updated;
}

/**
 * Persiste o horário de funcionamento (SKU detailsProHours, próprio e
 * separado de `detalhes`). Usado tanto pelo enriquecimento (chamado junto)
 * quanto pelo botão dedicado "buscar horários" de leads já enriquecidos.
 */
export async function saveHorarios(
  db: AppDb,
  placeId: string,
  horarios: HorariosLugar,
  now: Date = new Date(),
): Promise<Lead> {
  const lead = await requireLead(db, placeId);
  const em = now.toISOString();
  const updated: Lead = {
    ...lead,
    horarios: { ...horarios, obtidoEm: em },
    atualizadoEm: em,
  };
  await docRef(db, placeId).set(toDoc(updated));
  return updated;
}
