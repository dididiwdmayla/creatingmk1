import type { FiltroPresenca } from "@/lib/config";
import { enviosIncompletos, garantirEnviosCanais } from "@/lib/demos/envio";
import { aplicarVisita, completarVisita } from "@/lib/demos/visitas";
import type { AprovacaoDemo, DemoDataPatch, LeadDemo, TemaPatch } from "@/lib/demos/types";
import { InvalidTransitionError, NotFoundError, ValidationError } from "@/lib/errors";
import type { AppDb } from "@/lib/firestore-like";
import type { DetalhesLugar, HorariosLugar, PlaceBasico } from "@/lib/places/client";
import { isSiteProprio } from "@/lib/site-proprio";
import { horarioLocalNoDisparo } from "./janelaContato";
import {
  LEADS_COLLECTION,
  LEAD_STATUSES,
  VALID_TRANSITIONS,
  type Lead,
  type LeadStatus,
  type RegistroEnvioContato,
} from "./types";

/**
 * Repositório de /leads. Filtros em memória — centenas de docs, não milhões.
 * Docs completos são sempre reescritos por inteiro, nunca via merge do
 * Firestore, para o comportamento ser idêntico no fake dos testes.
 *
 * **Toda escrita que regrava o doc inteiro é TRANSACIONAL** (`modificarLead`):
 * lê e grava o lead na mesma transação. Antes era leitura-modificação-escrita
 * simples, e uma escrita concorrente entre a leitura e a gravação — o
 * confirmar da fila movendo o lead para "contactado" com selo e registro,
 * por exemplo — era APAGADA pela gravação do doc velho: o lead voltava a
 * "novo" e a fila podia mandar de novo. Ver "Escritas transacionais no lead"
 * em ARCHITECTURE.md.
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
// essas chaves (todos os campos de Lead são JSON-safe). Exportado porque a
// transação da fila grava o doc do lead sem passar por este repositório.
export function toDoc(lead: Lead): Record<string, unknown> {
  return JSON.parse(JSON.stringify(lead)) as Record<string, unknown>;
}

export async function getLead(db: AppDb, placeId: string): Promise<Lead | undefined> {
  const snap = await docRef(db, placeId).get();
  const data = snap.exists ? snap.data() : undefined;
  return data ? asLead(data) : undefined;
}

/**
 * O NÚCLEO de toda escrita deste repositório: lê o lead DENTRO de uma
 * transação, aplica `modificar` (PURA — nada de I/O aqui dentro, porque a
 * transação pode rodar de novo) e grava o doc inteiro na mesma transação.
 * Se outra escrita tocar o lead entre a leitura e o commit, o Firestore roda
 * `modificar` de novo sobre o doc novo — nenhuma atualização se perde.
 *
 * `modificar` devolve `undefined` quando não há o que gravar (e aí volta o
 * lead lido, sem escrita nenhuma). Lead ausente: `NotFoundError`, ou
 * `undefined` com `{ opcional: true }`.
 */
export async function modificarLead(
  db: AppDb,
  placeId: string,
  modificar: (lead: Lead) => Lead | undefined,
): Promise<Lead>;
export async function modificarLead(
  db: AppDb,
  placeId: string,
  modificar: (lead: Lead) => Lead | undefined,
  opcoes: { opcional: true },
): Promise<Lead | undefined>;
export async function modificarLead(
  db: AppDb,
  placeId: string,
  modificar: (lead: Lead) => Lead | undefined,
  opcoes: { opcional?: boolean } = {},
): Promise<Lead | undefined> {
  return db.runTransaction(async (tx) => {
    const ref = docRef(db, placeId);
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : undefined;
    if (!data) {
      if (opcoes.opcional) return undefined;
      throw new NotFoundError(`Lead "${placeId}" não encontrado.`);
    }
    const lead = asLead(data);
    const atualizado = modificar(lead);
    if (!atualizado) return lead;
    tx.set(ref, toDoc(atualizado));
    return atualizado;
  });
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
    // Um lead por transação: o que já existe é relido e regravado
    // atomicamente — o upsert de uma busca rodando junto da fila não pode
    // devolver a "novo" um lead que acabou de ser contactado.
    const { lead, existia } = await db.runTransaction(async (tx) => {
      const ref = docRef(db, place.placeId);
      const snap = await tx.get(ref);
      const data = snap.exists ? snap.data() : undefined;
      const existing = data ? asLead(data) : undefined;
      const gravado = existing
        ? leadAtualizadoPelaBusca(existing, place, busca, buscaId, em)
        : leadNovoDaBusca(place, busca, buscaId, em);
      tx.set(ref, toDoc(gravado));
      return { lead: gravado, existia: existing !== undefined };
    });
    if (existia) result.existentes += 1;
    else result.criados += 1;
    result.leads.push(lead);
  }

  return result;
}

/** Lead que a busca reencontrou: só nome/endereço/location/busca e o que é fresco. */
function leadAtualizadoPelaBusca(
  existing: Lead,
  place: PlaceBasico,
  busca: { nicho: string; subNicho?: string; regiao: string; idioma?: string },
  buscaId: string,
  em: string,
): Lead {
  return {
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
}

/** Lead que a busca encontrou pela primeira vez. */
function leadNovoDaBusca(
  place: PlaceBasico,
  busca: { nicho: string; subNicho?: string; regiao: string; idioma?: string },
  buscaId: string,
  em: string,
): Lead {
  return {
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
        // O lead fixo de teste não é negócio nenhum: fica fora de TODA
        // listagem e de todo agregado derivado desta varredura — /leads,
        // /demos, /hoje, /mundo, a análise de grupo por IA e a penetração
        // de site por nicho+cidade. Excluir na origem é o que impede o
        // vazamento silencioso; ver `lib/fila/leadTeste.ts`.
        lead.leadDeTeste !== true &&
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

/**
 * A TRANSIÇÃO DE STATUS, pura: o lead que entra, o lead que sai. Transição
 * inválida é erro, nunca silêncio — e nunca rebaixa status.
 *
 * Separada da escrita porque a fila de envio precisa desta MESMA regra
 * dentro de uma transação (confirmar um envio move o lead de "novo" para
 * "contactado" junto com mais três docs, tudo ou nada — ver
 * `lib/fila/confirmar.ts`), e `changeStatus` é leitura-modificação-escrita
 * sem transação por design. Duas cópias da regra é que não podia haver.
 */
export function aplicarTransicao(
  lead: Lead,
  para: LeadStatus,
  now: Date,
  userId?: string,
): Lead {
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

  return { ...lead, status: para, contato, atualizadoEm: em };
}

export async function changeStatus(
  db: AppDb,
  placeId: string,
  para: LeadStatus,
  now: Date = new Date(),
  userId?: string,
): Promise<Lead> {
  return modificarLead(db, placeId, (lead) => {
    const updated = aplicarTransicao(lead, para, now, userId);
    return updated;
  });
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
/**
 * O SELO E O REGISTRO, puros — mesma separação e mesmo motivo de
 * `aplicarTransicao`: a fila de envio carimba isto dentro da transação que
 * confirma o disparo, com o userId do dispositivo.
 */
export function aplicarSeloContato(lead: Lead, userId: string, now: Date): Lead {
  const em = now.toISOString();
  const registro: RegistroEnvioContato = { em, ...horarioLocalNoDisparo(lead, now) };
  return {
    ...lead,
    ...(lead.seloContato ? {} : { seloContato: { userId, em } }),
    registrosEnvio: [...(lead.registrosEnvio ?? []), registro],
    atualizadoEm: em,
  };
}

export async function registrarSeloContato(
  db: AppDb,
  placeId: string,
  userId: string,
  now: Date = new Date(),
): Promise<Lead> {
  return modificarLead(db, placeId, (lead) => {
    const updated = aplicarSeloContato(lead, userId, now);
    return updated;
  });
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
  return modificarLead(db, placeId, (lead) => {
    const updated: Lead = {
      ...lead,
      contato: { ...lead.contato, fechadoPor: vendidoPor },
      atualizadoEm: now.toISOString(),
    };
    return updated;
  });
}

/**
 * Notas/favorito/descartado/telefoneInvalido editáveis sem transição de
 * status. `telefoneInvalido` entra aqui, e não num caminho próprio, porque é
 * a mesma natureza dos outros: marca do operador sobre o lead, reversível
 * pela mesma tela que a criou — a fila também o escreve (ao confirmar
 * `invalido`), mas quem marca errado precisa poder desmarcar.
 */
export async function updateLeadExtras(
  db: AppDb,
  placeId: string,
  extras: {
    notas?: string;
    favorito?: boolean;
    descartado?: boolean;
    telefoneInvalido?: boolean;
    filaManual?: boolean;
  },
  now: Date = new Date(),
): Promise<Lead> {
  return modificarLead(db, placeId, (lead) => {
    const updated: Lead = {
      ...lead,
      ...(extras.notas !== undefined && { notas: extras.notas }),
      ...(extras.favorito !== undefined && { favorito: extras.favorito }),
      ...(extras.descartado !== undefined && { descartado: extras.descartado }),
      ...(extras.telefoneInvalido !== undefined && { telefoneInvalido: extras.telefoneInvalido }),
      ...(extras.filaManual !== undefined && { filaManual: extras.filaManual }),
      atualizadoEm: now.toISOString(),
    };
    return updated;
  });
}

/** True quando falta o token vigente de algum canal — dispara self-heal na leitura. */
export function envioTokenIncompleto(lead: Lead): boolean {
  return enviosIncompletos(lead.demo);
}

/**
 * Metadados da demo que NÃO vêm do editor: origem, aprovação e a execução
 * da automação que a criou. Só a automação (`lib/automacao`) passa isto na
 * criação; o PUT do editor nunca — `validateLeadDemoInput` recusa as chaves.
 */
export type MetaDemo = Pick<LeadDemo, "origem" | "aprovacao" | "execucaoAutomacao">;

/**
 * Os campos que um save PRESERVA de uma demo já existente, além de
 * `criadoEm`/`criadoPor`. O PUT do editor reescreve a demo inteira a
 * partir do corpo; sem esta cópia, editar uma demo automática pendente a
 * transformaria em "manual" — e o portão de aprovação da fila
 * (`motivoEstrutural`, `aguardandoAprovacao`) seria furado pela porta do
 * editor.
 */
function metaPreservada(demo: LeadDemo | undefined): Partial<LeadDemo> {
  if (!demo) return {};
  return {
    ...(demo.origem !== undefined && { origem: demo.origem }),
    ...(demo.aprovacao !== undefined && { aprovacao: demo.aprovacao }),
    ...(demo.aprovacaoEm !== undefined && { aprovacaoEm: demo.aprovacaoEm }),
    ...(demo.aprovacaoPor !== undefined && { aprovacaoPor: demo.aprovacaoPor }),
    ...(demo.execucaoAutomacao !== undefined && { execucaoAutomacao: demo.execucaoAutomacao }),
  };
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
  meta: MetaDemo = {},
): Promise<Lead> {
  return modificarLead(db, placeId, (lead) => {
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
        ...metaPreservada(lead.demo),
        ...meta,
        atualizadoEm: em,
      },
      atualizadoEm: em,
    };
    return updated;
  });
}

/**
 * Decide a aprovação de uma demo AUTOMÁTICA (aprovar/reprovar à mão, ou a
 * aprovação automática da própria automação). Só existe para demo de
 * origem automação: demo manual não passa por aprovação nenhuma, e
 * aprová-la seria uma decisão sem efeito — recusada em vez de ignorada.
 *
 * REPROVAR também marca o LEAD (`automacaoReprovada`): o planejador lê o
 * lead, não a demo, então apagar a demo depois não devolve o lead à
 * automação — sem isto ela refaria a mesma demo toda noite. A demo não é
 * apagada: o operador pode editá-la e aprovar depois, e aprovar não limpa a
 * marca do lead (a automação não volta a mexer nele).
 */
export async function decidirAprovacaoDemo(
  db: AppDb,
  placeId: string,
  aprovacao: AprovacaoDemo,
  por: string | undefined,
  now: Date = new Date(),
): Promise<Lead> {
  return modificarLead(db, placeId, (lead) => {
    if (lead.demo?.origem !== "automacao") {
      throw new ValidationError(["só demo criada pela automação passa por aprovação"]);
    }
    const em = now.toISOString();
    const updated: Lead = {
      ...lead,
      demo: {
        ...lead.demo,
        aprovacao,
        aprovacaoEm: em,
        ...(por ? { aprovacaoPor: por } : {}),
      },
      ...(aprovacao === "reprovada" &&
        !lead.automacaoReprovada && {
          automacaoReprovada: { em, ...(por ? { por } : {}) },
        }),
      atualizadoEm: em,
    };
    return updated;
  });
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
  return modificarLead(db, placeId, (lead) => {
    if (!lead.demo || !envioTokenIncompleto(lead)) return undefined;
    const updated: Lead = {
      ...lead,
      demo: {
        ...lead.demo,
        envios: garantirEnviosCanais(lead.demo.envios ?? [], now.toISOString()),
      },
    };
    return updated;
  });
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
  // A transação pode rodar `modificar` mais de uma vez: vale o id da última.
  let visitaId: string | undefined;
  const lead = await modificarLead(db, placeId, (atual) => {
    visitaId = undefined;
    if (!atual.demo || !opts.token) return undefined;
    // A regra (montar a entrada, decidir se o token vigente é consumido) é a
    // mesma da demo avulsa e vive em lib/demos/visitas.ts — aqui fica só a
    // leitura-escrita do doc do lead.
    const { envios, visita } = aplicarVisita(atual.demo, opts, now.toISOString());
    visitaId = visita.id;
    return {
      ...atual,
      demo: { ...atual.demo, envios },
      demoVisitas: [...(atual.demoVisitas ?? []), visita],
    };
  });
  return visitaId ? { lead, visitaId } : { lead };
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
  return modificarLead(
    db,
    placeId,
    (lead) => {
      if (!lead.demoVisitas) return undefined;
      const visitas = completarVisita(lead.demoVisitas, visitaId, dados);
      if (visitas === lead.demoVisitas) return undefined;
      return { ...lead, demoVisitas: visitas };
    },
    { opcional: true },
  );
}

/** Apaga a configuração da demo (o lead continua; /demo/{id} volta a 404). */
export async function deleteDemo(
  db: AppDb,
  placeId: string,
  now: Date = new Date(),
): Promise<Lead> {
  return modificarLead(db, placeId, (lead) => {
    const semDemo = { ...lead };
    delete semDemo.demo;
    const updated: Lead = { ...semDemo, atualizadoEm: now.toISOString() };
    return updated;
  });
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
  return modificarLead(db, placeId, (lead) => {
    if (!lead.demo?.dados.imagens?.[slot]) return undefined;
    const imagens = { ...lead.demo.dados.imagens };
    delete imagens[slot];
    const updated: Lead = {
      ...lead,
      demo: { ...lead.demo, dados: { ...lead.demo.dados, imagens } },
      atualizadoEm: now.toISOString(),
    };
    return updated;
  });
}

/** Mesma lógica de removeDemoImagem, pro override de dados.videos[slot]. */
export async function removeDemoVideo(
  db: AppDb,
  placeId: string,
  slot: string,
  now: Date = new Date(),
): Promise<Lead> {
  return modificarLead(db, placeId, (lead) => {
    if (!lead.demo?.dados.videos?.[slot]) return undefined;
    const videos = { ...lead.demo.dados.videos };
    delete videos[slot];
    const updated: Lead = {
      ...lead,
      demo: { ...lead.demo, dados: { ...lead.demo.dados, videos } },
      atualizadoEm: now.toISOString(),
    };
    return updated;
  });
}

export async function saveDetails(
  db: AppDb,
  placeId: string,
  detalhes: DetalhesLugar,
  now: Date = new Date(),
  userId?: string,
): Promise<Lead> {
  return modificarLead(db, placeId, (lead) => {
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
    return updated;
  });
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
  return modificarLead(db, placeId, (lead) => {
    const em = now.toISOString();
    const updated: Lead = {
      ...lead,
      horarios: { ...horarios, obtidoEm: em },
      atualizadoEm: em,
    };
    return updated;
  });
}
