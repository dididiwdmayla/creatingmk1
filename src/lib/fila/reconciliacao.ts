import type { AppDb } from "@/lib/firestore-like";
import { aplicarSeloContato, aplicarTransicao, getLead, toDoc as leadToDoc } from "@/lib/leads/repo";
import { LEADS_COLLECTION, VALID_TRANSITIONS, type Lead } from "@/lib/leads/types";

import { FILA_ENVIOS_COLLECTION, type FilaEnvioDoc } from "./envios";
import type { LinhaReconciliacao } from "./estado";

export type { LinhaReconciliacao } from "./estado";

/**
 * A RECONCILIAÇÃO — o conserto do que a fila mandou e não registrou.
 *
 * **O estrago.** Enquanto `RADAR_DEVICE_USER_ID` faltava em produção (ver
 * "Saúde da fila" em ARCHITECTURE.md), todo `POST /api/fila/confirmar` de
 * prospecção respondeu 503 sem gravar nada. Todo lead que a fila de fato
 * mandou continuou "novo", sem selo nem registro — e voltou a receber a
 * mesma mensagem.
 *
 * **A regra: na dúvida, bloqueia — reservado conta como enviado.** Com o
 * 503, nenhum estado gravado em `filaEnvios` prova que nada saiu: "falhou"
 * e "inválido" também nunca chegaram a ser gravados por confirmação, e uma
 * claim devolvida pode ter sobrescrito o doc de um envio anterior (o doc é
 * um só por lead). Por isso a prévia lista TODO lead com doc na fila que
 * ainda está "novo", e mostra o estado só como informação. Marcar como
 * contactado quem não recebeu custa um envio; deixar "novo" quem recebeu
 * manda de novo.
 *
 * **O que o aplicar faz, por lead, numa transação**: relê lead e claim; se o
 * lead continua "novo", passa para "contactado" pela MESMA regra de
 * `VALID_TRANSITIONS` (nunca rebaixa) e grava selo + registro de envio com a
 * data da RESERVA (o instante provável do envio, não o do clique — a
 * análise por horário do registro não pode ganhar um pico falso na hora da
 * reconciliação), autor `RADAR_DEVICE_USER_ID` (o que a fila teria gravado)
 * e `origem: "reconciliacao"` nos dois. **Não toca** contador do dia (a meta
 * de hoje não pode ser gasta por envios de outros dias), rotação de frases
 * (girar agora não muda o que já saiu) nem `filaEnvios` (o doc é o rastro do
 * que houve).
 */

/**
 * Teto de ids por chamada do aplicar — mesmo motivo de
 * `SEM_VESTIGIO_LOTE_MAX`: um lote grande demais estoura o tempo da
 * serverless NO MEIO; a tela manda em levas sequenciais deste tamanho, e
 * cada leva que passou já está gravada.
 */
export const RECONCILIACAO_LOTE_MAX = 50;

export interface PreviaReconciliacao {
  linhas: LinhaReconciliacao[];
  total: number;
  /** Docs da fila cujo lead não existe mais — nada a marcar, só contados. */
  leadsExcluidos: number;
}

export type MotivoPuloReconciliacao = "nao_novo" | "sem_reserva" | "lead_excluido";

export interface ResultadoReconciliacao {
  reconciliados: string[];
  pulados: Array<{ leadId: string; motivo: MotivoPuloReconciliacao }>;
}

/**
 * A PRÉVIA: varre `filaEnvios` (o `AppDb` não tem query — aceitável aqui,
 * pelo mesmo motivo da lista de pendência: /config é admin e aberta
 * esporadicamente) e lê POR ID só os leads desses docs, nunca `/leads`
 * inteira. Somente leitura.
 */
export async function previaReconciliacao(db: AppDb): Promise<PreviaReconciliacao> {
  const snap = await db.collection(FILA_ENVIOS_COLLECTION).get();
  const docs = snap.docs.map((d) => ({ leadId: d.id, doc: d.data() as unknown as FilaEnvioDoc }));

  let leadsExcluidos = 0;
  const linhas: LinhaReconciliacao[] = [];
  const leads = await Promise.all(docs.map(({ leadId }) => getLead(db, leadId)));
  docs.forEach(({ leadId, doc }, i) => {
    const lead = leads[i];
    if (!lead) {
      leadsExcluidos += 1;
      return;
    }
    if (lead.status !== "novo" || lead.leadDeTeste === true) return;
    linhas.push({
      leadId,
      nome: lead.nome ?? "",
      reservadoEm: doc.reservadoEm,
      estado: doc.estado,
      tentativas: doc.tentativas ?? 0,
    });
  });

  // Mais recente primeiro: é a conversa que ainda está no topo do WhatsApp,
  // a primeira que o operador vai querer conferir. Desempate por id, para a
  // ordem não depender de em que ordem o Firestore devolveu os docs.
  linhas.sort((a, b) => b.reservadoEm.localeCompare(a.reservadoEm) || a.leadId.localeCompare(b.leadId));
  return { linhas, total: linhas.length, leadsExcluidos };
}

/** A data do contato: `reservadoEm` quando é uma data válida, senão `now`. */
export function instanteDaReserva(envio: FilaEnvioDoc, now: Date): Date {
  const reservado = new Date(envio.reservadoEm);
  return Number.isNaN(reservado.getTime()) ? now : reservado;
}

/**
 * O lead marcado como CONTACTADO POR UM ENVIO PROVÁVEL, puro: transição +
 * selo + registro com a data da reserva e a origem marcada. O selo que já
 * existia (um clique manual anterior) prevalece, como em
 * `aplicarSeloContato`; o registro é somado. Transição só de quem ainda está
 * em "novo" (nunca rebaixa). Dois chamadores: a reconciliação (aqui) e a
 * revisão marcada como contactado (`revisao.ts`).
 */
export function leadComEnvioProvavel(
  lead: Lead,
  envio: FilaEnvioDoc,
  userId: string,
  now: Date,
  origem: "reconciliacao" | "revisao",
): Lead {
  const quando = instanteDaReserva(envio, now);
  const comStatus = VALID_TRANSITIONS[lead.status].includes("contactado")
    ? aplicarTransicao(lead, "contactado", quando, userId)
    : lead;
  const comSelo = aplicarSeloContato(comStatus, userId, quando);
  const registros = [...(comSelo.registrosEnvio ?? [])];
  const ultimo = registros.length - 1;
  registros[ultimo] = { ...registros[ultimo], origem };
  return {
    ...comSelo,
    ...(lead.seloContato ? {} : { seloContato: { userId, em: quando.toISOString(), origem } }),
    registrosEnvio: registros,
    // A ESCRITA é agora; a data do contato é a da reserva.
    atualizadoEm: now.toISOString(),
  };
}

/**
 * Aplica a reconciliação aos `leadIds` (vindos da prévia), uma transação por
 * lead: a decisão é tomada sobre o doc RELIDO, não sobre a prévia — entre a
 * tela e o clique o lead pode ter avançado (aí é pulado, nunca rebaixado).
 * Idempotente: rodar de novo só pula.
 */
export async function aplicarReconciliacao(
  db: AppDb,
  leadIds: string[],
  userId: string,
  now: Date = new Date(),
): Promise<ResultadoReconciliacao> {
  const resultado: ResultadoReconciliacao = { reconciliados: [], pulados: [] };

  for (const leadId of leadIds) {
    const motivo = await db.runTransaction(async (tx): Promise<MotivoPuloReconciliacao | undefined> => {
      const refLead = db.collection(LEADS_COLLECTION).doc(leadId);
      const refEnvio = db.collection(FILA_ENVIOS_COLLECTION).doc(leadId);
      const lead = (await tx.get(refLead)).data() as Lead | undefined;
      const envio = (await tx.get(refEnvio)).data() as FilaEnvioDoc | undefined;

      if (!lead) return "lead_excluido";
      if (!envio) return "sem_reserva";
      if (lead.status !== "novo" || !VALID_TRANSITIONS[lead.status].includes("contactado")) {
        return "nao_novo";
      }

      tx.set(refLead, leadToDoc(leadComEnvioProvavel(lead, envio, userId, now, "reconciliacao")));
      return undefined;
    });

    if (motivo) resultado.pulados.push({ leadId, motivo });
    else resultado.reconciliados.push(leadId);
  }

  return resultado;
}
