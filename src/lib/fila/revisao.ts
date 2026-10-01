import { NotFoundError } from "@/lib/errors";
import type { AppDb } from "@/lib/firestore-like";
import { getLead, toDoc as leadToDoc } from "@/lib/leads/repo";
import { LEADS_COLLECTION, type Lead } from "@/lib/leads/types";

import { FILA_CONTADORES_COLLECTION, contadorComEnvioTardio, diaOperacionalKey } from "./contadores";
import { EPOCH_ISO, FILA_ENVIOS_COLLECTION, emRevisao, type FilaEnvioDoc } from "./envios";
import { claimAtiva, type LinhaRevisao } from "./estado";
import { instanteDaReserva, leadComEnvioProvavel } from "./reconciliacao";

/**
 * A REVISÃO — a vitrine e as duas saídas da claim que venceu sem o aparelho
 * dizer nada (ver o bloco da revisão em `estado.ts`).
 *
 * A revisão tira o lead da fila sem que nada no lead mude: o doc continua
 * `status: "novo"`, com demo, com print, elegível a olho nu. Sem esta lista
 * ele pararia EM SILÊNCIO — e para sempre, porque a revisão não tem prazo.
 *
 * **Duas saídas, as duas por decisão humana**, porque só quem tem o aparelho
 * na mão consegue conferir no WhatsApp o que de fato aconteceu:
 *
 * - **Liberar** (`liberarRevisao`): "conferi, NÃO saiu" — a claim é
 *   devolvida (`expiraEm` no `EPOCH_ISO`, a mesma semântica de
 *   `liberarClaim`) e o lead volta à fila.
 * - **Marcar como contactado** (`marcarContactadoRevisao`): "conferi, SAIU" —
 *   a claim fecha como enviada, o lead vira contactado, e o envio entra no
 *   contador do dia.
 *
 * A terceira saída não é humana: o próprio aparelho confirmando com a claim
 * ATUAL (o confirmar não olha `expiraEm`), que segue o caminho normal.
 *
 * **Por que aqui e não em `/api/fila/diagnostico`.** Aquela rota é
 * declaradamente sem varredura (um doc, o pool), e o lead em revisão está
 * exatamente FORA do pool. Achá-lo exige varrer `filaEnvios`; está tudo bem
 * aqui, como na lista de pendência: /config é admin, aberta esporadicamente.
 * A varredura NÃO lê `/leads` inteira atrás de nomes: filtra primeiro e só
 * então lê, POR ID, os poucos docs que sobraram.
 *
 * **Uma varredura, uma verdade.** A contagem do funil e as linhas saem da
 * MESMA chamada, e por isso não têm como discordar. **Sem teto na lista**:
 * o volume é limitado pela própria fila, e um teto esconderia justamente o
 * lead sobre o qual o operador quer decidir.
 */

export type { LinhaRevisao } from "./estado";

function envioRef(db: AppDb, leadId: string) {
  return db.collection(FILA_ENVIOS_COLLECTION).doc(leadId);
}

/** O que a lista e a contagem do funil devolvem juntas — ver o cabeçalho. */
export interface RevisaoFila {
  /** Quantos leads estão em revisão AGORA — sempre `linhas.length`. */
  total: number;
  linhas: LinhaRevisao[];
}

/**
 * Os leads em revisão agora, do mais RECENTE para o mais antigo: a conversa
 * mais nova é a que o operador ainda acha no topo do WhatsApp.
 *
 * Fora da lista, de propósito: lead que já não está em "novo" (reconciliado,
 * contactado à mão — a fila nunca o entregaria de novo, não há o que
 * decidir) e lead excluído (idem: o pool lê `/leads`).
 */
export async function listarRevisao(db: AppDb, now: Date): Promise<RevisaoFila> {
  const snap = await db.collection(FILA_ENVIOS_COLLECTION).get();
  const silenciosas = snap.docs
    .map((d) => ({ leadId: d.id, doc: d.data() as unknown as FilaEnvioDoc }))
    .filter(({ doc }) => emRevisao(doc, now));

  // Só agora, e só destes: um por id, nunca uma varredura de /leads.
  const leads = await Promise.all(silenciosas.map(({ leadId }) => getLead(db, leadId)));
  const linhas: LinhaRevisao[] = [];
  silenciosas.forEach(({ leadId, doc }, i) => {
    const lead = leads[i];
    if (!lead || lead.status !== "novo") return;
    linhas.push({
      leadId,
      nome: lead.nome ?? "",
      reservadoEm: doc.reservadoEm,
      reservas: typeof doc.reservas === "number" ? doc.reservas : null,
      dispositivo: doc.dispositivo,
    });
  });

  linhas.sort(
    // Desempate por leadId: a ordem não pode depender de em que ordem o
    // Firestore devolveu os docs (mesma regra da seleção da fila).
    (a, b) => b.reservadoEm.localeCompare(a.reservadoEm) || a.leadId.localeCompare(b.leadId),
  );
  return { total: linhas.length, linhas };
}

/** Por que uma ação da revisão foi RECUSADA (e não "não encontrada"). */
export type RecusaRevisao = "claim_ativa";

export type AcaoRevisao =
  | { ok: true }
  | {
      ok: false;
      motivo: RecusaRevisao;
      /** Instante em que a claim viva morre sozinha — a tela mostra a hora. */
      expiraEm: string;
    };

/**
 * As duas guardas comuns às duas ações, DENTRO da transação (entre a lista e
 * o clique, o aparelho pode ter re-reservado o lead):
 *
 * - **claim ATIVA → recusa** (`claim_ativa`): o aparelho pode estar com o
 *   WhatsApp aberto neste segundo, e nenhuma das duas ações cancela um envio
 *   em andamento. Mesma pergunta, mesma função que o balão faz.
 * - **fora da revisão → 404**, sem criar doc (`set` cria o ausente; um id
 *   errado não pode plantar lixo em `filaEnvios`).
 */
function guardar(atual: FilaEnvioDoc | undefined, leadId: string, now: Date): AcaoRevisao | undefined {
  if (claimAtiva(atual, now)) {
    return { ok: false, motivo: "claim_ativa", expiraEm: (atual as FilaEnvioDoc).expiraEm };
  }
  if (!atual || !emRevisao(atual, now)) {
    throw new NotFoundError(`Lead "${leadId}" não está em revisão.`);
  }
  return undefined;
}

/**
 * LIBERAR: o operador conferiu que a mensagem NÃO saiu. A claim é devolvida
 * (`expiraEm` no EPOCH — a invariante que já significa "devolvida de
 * propósito, nada saiu") e o lead volta à fila. `reservadoEm` e `reservas`
 * ficam intactos: são o rastro do que houve.
 */
export async function liberarRevisao(db: AppDb, leadId: string, now: Date): Promise<AcaoRevisao> {
  return db.runTransaction(async (tx) => {
    const ref = envioRef(db, leadId);
    const atual = (await tx.get(ref)).data() as unknown as FilaEnvioDoc | undefined;
    const recusa = guardar(atual, leadId, now);
    if (recusa) return recusa;

    tx.set(ref, { ...(atual as FilaEnvioDoc), expiraEm: EPOCH_ISO } as unknown as Record<string, unknown>);
    return { ok: true };
  });
}

/**
 * MARCAR COMO CONTACTADO: o operador conferiu que a mensagem SAIU. Numa
 * transação só (todas as leituras antes de todas as escritas):
 *
 * - a claim fecha como `"enviado"`, com `enviadoEm` = `reservadoEm` (o envio
 *   provável, não o clique);
 * - o lead vai de "novo" para "contactado" pela regra de `VALID_TRANSITIONS`
 *   (nunca rebaixa), com selo e registro de envio na data da reserva, autor
 *   `userId` (o do aparelho, `RADAR_DEVICE_USER_ID` — quem de fato mandou) e
 *   `origem: "revisao"`;
 * - o contador do dia operacional ATUAL soma 1 em `enviados` (o envio saiu e
 *   nunca foi contado), sem tocar `envios`/`ultimoEventoEm` — ver
 *   `contadorComEnvioTardio`;
 * - a rotação de frases NÃO gira: girar agora não muda o que já saiu, e
 *   pularia a frase da vez do próximo lead.
 */
export async function marcarContactadoRevisao(
  db: AppDb,
  leadId: string,
  opcoes: { userId: string; inicioDiaOperacionalHora: number; now: Date },
): Promise<AcaoRevisao> {
  const { userId, now } = opcoes;
  return db.runTransaction(async (tx) => {
    // ── Leituras ──────────────────────────────────────────────────────────
    const refEnvio = envioRef(db, leadId);
    const atual = (await tx.get(refEnvio)).data() as unknown as FilaEnvioDoc | undefined;
    const recusa = guardar(atual, leadId, now);
    if (recusa) return recusa;
    const envio = atual as FilaEnvioDoc;

    const refLead = db.collection(LEADS_COLLECTION).doc(leadId);
    const lead = (await tx.get(refLead)).data() as Lead | undefined;
    if (!lead) throw new NotFoundError(`Lead "${leadId}" não existe mais.`);

    const refContador = db
      .collection(FILA_CONTADORES_COLLECTION)
      .doc(diaOperacionalKey(now, opcoes.inicioDiaOperacionalHora));
    const contador = (await tx.get(refContador)).data();

    // ── Escritas ──────────────────────────────────────────────────────────
    tx.set(refEnvio, {
      ...envio,
      estado: "enviado",
      ultimoErro: null,
      enviadoEm: instanteDaReserva(envio, now).toISOString(),
    } as unknown as Record<string, unknown>);
    tx.set(refLead, leadToDoc(leadComEnvioProvavel(lead, envio, userId, now, "revisao")));
    tx.set(refContador, contadorComEnvioTardio(contador) as unknown as Record<string, unknown>);
    return { ok: true };
  });
}
