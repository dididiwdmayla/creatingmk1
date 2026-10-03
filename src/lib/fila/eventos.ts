import { randomBytes } from "node:crypto";

import type { AppDb } from "@/lib/firestore-like";
import { getLead } from "@/lib/leads/repo";

import { autenticarDispositivo } from "./auth";
import { loadFilaConfig } from "./config";
import { diaOperacionalKey } from "./contadores";

/**
 * EVENTOS DA FILA — o rastro de toda resposta não-200 das rotas que o
 * aparelho chama (`/api/fila/proximo` e `/api/fila/confirmar`).
 *
 * **Por que existe.** Durante semanas TODO `POST /api/fila/confirmar` de
 * prospecção respondeu 503 (`RADAR_DEVICE_USER_ID` ausente — ver "Saúde da
 * fila"). O aparelho recebia o erro; o servidor não guardava nada; o painel
 * não mostrava nada. Um 409 de claim que não bate, um 400 de corpo
 * malformado pela macro, um 500 — todos somem do mesmo jeito. Agora cada um
 * vira um documento, e o painel mostra a contagem do dia e os últimos.
 *
 * **Onde mora**: `filaEventos/{dia operacional}` guarda o total do dia
 * (e por status), e `filaEventos/{dia}/itens/{id}` cada evento — rota,
 * status, leadId e claimId quando houver, motivo (o código de erro que a
 * resposta levou) e horário. Por dia porque a pergunta é sempre "o que deu
 * errado hoje/ontem", e o painel lê dois dias, nunca a coleção inteira.
 *
 * **Nunca muda a resposta.** A gravação acontece DEPOIS de a resposta estar
 * pronta, e qualquer falha nela vira `console.error` (que aparece no log da
 * Vercel) — a rota responde exatamente o que responderia sem isto.
 *
 * **401 não grava no banco.** Requisição sem a chave do aparelho não pode
 * ganhar o poder de escrever no Firestore — seria uma porta para encher a
 * coleção. O mesmo vale para o 503 de `RADAR_DEVICE_KEY` ausente (aí NENHUMA
 * requisição é autenticável). Os dois ficam só no log.
 */

export const FILA_EVENTOS_COLLECTION = "filaEventos";

export type RotaFila = "proximo" | "confirmar";

export interface EventoFila {
  rota: RotaFila;
  status: number;
  leadId: string | null;
  claimId: string | null;
  /** O código de erro da resposta (`claim_invalida`, `corpo_invalido`, `config_error`…). */
  motivo: string;
  /** ISO. */
  em: string;
}

/** Quantos eventos a lista do painel mostra. */
export const EVENTOS_PAINEL_MAX = 20;

function diaRef(db: AppDb, dia: string) {
  return db.collection(FILA_EVENTOS_COLLECTION).doc(dia);
}

function itensCol(db: AppDb, dia: string) {
  return db.collection(`${FILA_EVENTOS_COLLECTION}/${dia}/itens`);
}

/**
 * Grava UM evento e soma no total do dia, numa transação — o total é o
 * número do painel e não pode desencontrar dos itens por uma corrida entre
 * duas respostas de erro no mesmo segundo.
 */
export async function registrarEventoFila(db: AppDb, evento: EventoFila, now: Date): Promise<void> {
  const { inicioDiaOperacionalHora } = await loadFilaConfig(db);
  const dia = diaOperacionalKey(now, inicioDiaOperacionalHora);
  const ref = diaRef(db, dia);
  // Id ordenável pelo instante (e único): a leitura não depende disso, mas
  // quem abrir o console do Firestore vê os itens na ordem em que vieram.
  const itemRef = itensCol(db, dia).doc(`${now.getTime()}-${randomBytes(4).toString("hex")}`);
  await db.runTransaction(async (tx) => {
    const atual = (await tx.get(ref)).data() as { total?: number; porStatus?: Record<string, number> } | undefined;
    const porStatus = { ...(atual?.porStatus ?? {}) };
    porStatus[String(evento.status)] = (porStatus[String(evento.status)] ?? 0) + 1;
    tx.set(ref, { total: (atual?.total ?? 0) + 1, porStatus });
    tx.set(itemRef, { ...evento });
  });
}

/** Um evento como o painel o mostra: com o NOME do lead, nunca o id cru. */
export interface EventoPainel extends EventoFila {
  /** Nome do lead do evento; "" quando não há lead ou ele não existe mais. */
  nomeLead: string;
}

export interface PainelEventos {
  diaOperacional: string;
  /** Quantas respostas de erro HOJE (dia operacional). */
  totalHoje: number;
  /** Os últimos, mais recente primeiro — de hoje e de ontem, no máximo `EVENTOS_PAINEL_MAX`. */
  eventos: EventoPainel[];
}

/**
 * O que o painel mostra: o total de hoje (do doc do dia, não contado dos
 * itens — a lista tem teto, o número não) e os últimos eventos de hoje e de
 * ontem. Duas varreduras PEQUENAS (os itens de dois dias), nunca a coleção;
 * os nomes saem POR ID, só dos leads que estão na lista (o placeId não
 * aparece cru na /config — ver "O id, onde ele PODE aparecer").
 */
export async function lerEventosDoPainel(db: AppDb, now: Date): Promise<PainelEventos> {
  const { inicioDiaOperacionalHora } = await loadFilaConfig(db);
  const hoje = diaOperacionalKey(now, inicioDiaOperacionalHora);
  const ontem = diaOperacionalKey(new Date(now.getTime() - 24 * 60 * 60 * 1000), inicioDiaOperacionalHora);

  const [docHoje, itensHoje, itensOntem] = await Promise.all([
    diaRef(db, hoje).get(),
    itensCol(db, hoje).get(),
    itensCol(db, ontem).get(),
  ]);
  const eventos = [...itensHoje.docs, ...itensOntem.docs]
    .map((d) => d.data() as unknown as EventoFila)
    .sort((a, b) => b.em.localeCompare(a.em))
    .slice(0, EVENTOS_PAINEL_MAX);
  const total = (docHoje.data() as { total?: number } | undefined)?.total ?? 0;

  const ids = [...new Set(eventos.map((e) => e.leadId).filter((id): id is string => Boolean(id)))];
  const leads = await Promise.all(ids.map((id) => getLead(db, id)));
  const nomes = new Map(ids.map((id, i) => [id, leads[i]?.nome ?? ""]));
  return {
    diaOperacional: hoje,
    totalHoje: total,
    eventos: eventos.map((e) => ({ ...e, nomeLead: e.leadId ? (nomes.get(e.leadId) ?? "") : "" })),
  };
}

/** Lê com segurança um campo string de um objeto qualquer. */
function texto(obj: unknown, chave: string): string | null {
  if (!obj || typeof obj !== "object") return null;
  const valor = (obj as Record<string, unknown>)[chave];
  return typeof valor === "string" && valor.trim() !== "" ? valor : null;
}

/** O código de erro que a resposta levou — os dois formatos que estas rotas usam. */
function motivoDaResposta(corpo: unknown): string {
  return (
    texto(corpo, "erro") ??
    texto((corpo as { error?: unknown } | null)?.error, "code") ??
    "desconhecido"
  );
}

/**
 * O EMBRULHO das duas rotas do aparelho: roda o handler e, se a resposta
 * não for 200, grava o evento — sem mudar nada do que volta.
 *
 * - `leadId`/`claimId` saem do CORPO da requisição (o confirmar manda os
 *   dois; o próximo é GET e não tem), lido de um clone feito ANTES do
 *   handler consumir o original.
 * - O motivo sai do corpo da RESPOSTA, também de um clone.
 * - Só grava se a requisição passou na autenticação do aparelho (ver o
 *   cabeçalho do arquivo): 401 e o 503 de chave ausente ficam só no log.
 */
export async function comRastroFila(
  rota: RotaFila,
  req: Request,
  handler: (req: Request) => Promise<Response>,
  getDb: () => AppDb,
): Promise<Response> {
  const copiaReq = req.method === "GET" ? undefined : req.clone();
  const res = await handler(req);
  if (res.status === 200) return res;

  const now = new Date();
  if (autenticarDispositivo(req) !== null) {
    console.warn(`[fila] ${rota} respondeu ${res.status} a uma requisição não autenticada — sem evento no banco`);
    return res;
  }

  try {
    const corpoReq = copiaReq ? await copiaReq.json().catch(() => null) : null;
    const corpoRes = await res.clone().json().catch(() => null);
    await registrarEventoFila(
      getDb(),
      {
        rota,
        status: res.status,
        leadId: texto(corpoReq, "leadId"),
        claimId: texto(corpoReq, "id"),
        motivo: motivoDaResposta(corpoRes),
        em: now.toISOString(),
      },
      now,
    );
  } catch (error) {
    console.error(`[fila] falha ao gravar o evento de ${rota} ${res.status}:`, error);
  }
  return res;
}
