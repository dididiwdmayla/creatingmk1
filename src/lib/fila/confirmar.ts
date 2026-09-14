import type { AppDb } from "@/lib/firestore-like";
import { conjuntoDoDoc, patchAvancoRotacao, refConjunto } from "@/lib/frases/repo";
import { aplicarSeloContato, aplicarTransicao, toDoc as leadToDoc } from "@/lib/leads/repo";
import { LEADS_COLLECTION, VALID_TRANSITIONS, type Lead } from "@/lib/leads/types";

import { FILA_CONTADORES_COLLECTION, contadorComEnvio, diaOperacionalKey } from "./contadores";
import {
  ClaimInvalidoError,
  FILA_ENVIOS_COLLECTION,
  TENTATIVAS_MAX,
  type FilaEnvioDoc,
  type FilaEnvioResultado,
} from "./envios";

/**
 * A CONFIRMAÇÃO DO ENVIO — o que o celular reporta depois de mandar (ou não
 * mandar) a mensagem.
 *
 * "enviado" move QUATRO docs em coleções diferentes: a claim, o lead (status
 * + selo + registro), a rotação de frases e o contador do dia. Ou os quatro,
 * ou nenhum — uma confirmação pela metade é contador que não bate com lead
 * que não bate com o que o negócio recebeu no WhatsApp. Por isso tudo isto
 * mora numa transação só, e por isso a lógica de status/selo/rotação foi
 * extraída em funções PURAS nos repositórios de origem (`aplicarTransicao`,
 * `aplicarSeloContato`, `patchAvancoRotacao`): as versões com I/O são
 * leitura-modificação-escrita sem transação por design, e duas cópias da
 * mesma regra é que não podia haver.
 *
 * **Todas as leituras antes de todas as escritas** — o Firestore real recusa
 * `get` depois de `set` dentro de uma transação, e o fake não recusaria.
 */

export interface ConfirmacaoResultado {
  /** Estado em que a claim ficou. */
  estado: FilaEnvioResultado;
  /**
   * A claim já estava confirmada e esta chamada não mudou NADA. O celular
   * pode reenviar o confirmar quando a rede cai depois do envio — repetir
   * não pode contar duas vezes.
   */
  repetida: boolean;
  tentativas: number;
  /** Tentativas esgotadas: o lead para para inspeção manual. */
  parado: boolean;
}

function envioRef(db: AppDb, leadId: string) {
  return db.collection(FILA_ENVIOS_COLLECTION).doc(leadId);
}

/**
 * Confirma a claim e aplica tudo que o resultado implica, atomicamente.
 *
 * - **enviado**: claim carimbada, lead `novo → contactado` (nunca rebaixa:
 *   lead que já avançou mantém o status), selo + registro de envio com o
 *   usuário do dispositivo, rotação COMPARTILHADA girada e contador do dia
 *   operacional incrementado. O `detalhe` que vier junto é gravado em
 *   `detalheEnvio` — é o caso do texto que saiu SEM o print anexado, que o
 *   celular reporta como "enviado" de propósito (reportar falha devolveria
 *   o lead à fila e mandaria a mesma mensagem duas vezes).
 * - **invalido**: claim encerrada e o lead marcado com `telefoneInvalido` —
 *   número sem WhatsApp não volta à fila nunca mais (mas o lead continua na
 *   base, porque o número pode ser corrigido depois).
 * - **falhou**: `tentativas + 1` e a claim devolvida à fila; a partir de
 *   `TENTATIVAS_MAX` o lead para — não é excluído nem marcado como inválido,
 *   só deixa de ser elegível, e a ficha mostra por quê.
 *
 * `claimId` que não bate com o ATUAL é rejeitado com `ClaimInvalidoError` e
 * NADA é alterado.
 */
export async function confirmarEnvio(
  db: AppDb,
  leadId: string,
  claimId: string,
  resultado: FilaEnvioResultado,
  opcoes: {
    detalhe?: string | null;
    userId: string;
    inicioDiaOperacionalHora: number;
    now?: Date;
  },
): Promise<ConfirmacaoResultado> {
  const now = opcoes.now ?? new Date();
  const detalhe = opcoes.detalhe ?? null;

  return db.runTransaction(async (tx) => {
    // ── Leituras ──────────────────────────────────────────────────────────
    const refEnvio = envioRef(db, leadId);
    const envio = (await tx.get(refEnvio)).data() as FilaEnvioDoc | undefined;
    if (!envio || envio.claimId !== claimId) {
      throw new ClaimInvalidoError(leadId);
    }

    // Repetição da MESMA claim já confirmada: sucesso sem reescrever nada.
    if (envio.estado !== "reservado") {
      return {
        estado: envio.estado,
        repetida: true,
        tentativas: envio.tentativas,
        parado: envio.estado === "falhou" && envio.tentativas >= TENTATIVAS_MAX,
      };
    }

    const refLead = db.collection(LEADS_COLLECTION).doc(leadId);
    const precisaDoLead = resultado === "enviado" || resultado === "invalido";
    const lead = precisaDoLead
      ? ((await tx.get(refLead)).data() as Lead | undefined)
      : undefined;

    const skinId = resultado === "enviado" ? (envio.rotacaoSkinId ?? null) : null;
    const refFrases = skinId ? refConjunto(db, skinId) : undefined;
    const conjunto =
      refFrases && skinId ? conjuntoDoDoc(skinId, (await tx.get(refFrases)).data()) : undefined;

    const chaveDia = diaOperacionalKey(now, opcoes.inicioDiaOperacionalHora);
    const refContador = db.collection(FILA_CONTADORES_COLLECTION).doc(chaveDia);
    const contador =
      resultado === "enviado" ? (await tx.get(refContador)).data() : undefined;

    // ── Escritas ──────────────────────────────────────────────────────────
    const tentativas = resultado === "falhou" ? envio.tentativas + 1 : envio.tentativas;
    tx.set(refEnvio, {
      ...envio,
      estado: resultado,
      ultimoErro: resultado === "enviado" ? null : detalhe,
      // O detalhe de um envio que DEU CERTO tem campo próprio (ver
      // `detalheEnvio` em estado.ts): sobrescrever `ultimoErro` com ele
      // confundiria falha e sucesso justamente no diagnóstico. Vai DENTRO
      // desta transação, junto do resto do caminho "enviado" — gravá-lo
      // depois abriria a janela em que o lead conta como enviado e a
      // pendência do print não existe em lugar nenhum.
      detalheEnvio: resultado === "enviado" ? detalhe ?? "" : envio.detalheEnvio ?? "",
      tentativas,
      enviadoEm: resultado === "enviado" ? now.toISOString() : envio.enviadoEm,
    });

    if (resultado === "enviado" && lead) {
      // Nunca rebaixa: só move quem ainda está em "novo". Lead que o time já
      // avançou à mão (respondeu, fechado) mantém o status — o que importa
      // registrar aqui é o disparo, e isso é o selo.
      const comStatus = VALID_TRANSITIONS[lead.status].includes("contactado")
        ? aplicarTransicao(lead, "contactado", now, opcoes.userId)
        : lead;
      tx.set(refLead, leadToDoc(aplicarSeloContato(comStatus, opcoes.userId, now)));
    }

    if (resultado === "invalido" && lead) {
      tx.set(refLead, leadToDoc({ ...lead, telefoneInvalido: true, atualizadoEm: now.toISOString() }));
    }

    if (refFrases) {
      const avanco = patchAvancoRotacao(conjunto, now);
      // Merge: girar o contador nunca pode pisar nos textos que o admin possa
      // estar salvando no mesmo segundo (ver lib/frases/repo.ts).
      if (avanco) tx.set(refFrases, avanco.patch, { merge: true });
    }

    if (resultado === "enviado") {
      tx.set(refContador, contadorComEnvio(contador, now) as unknown as Record<string, unknown>);
    }

    return {
      estado: resultado,
      repetida: false,
      tentativas,
      parado: resultado === "falhou" && tentativas >= TENTATIVAS_MAX,
    };
  });
}
