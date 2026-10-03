import type { AppDb } from "@/lib/firestore-like";
import { conjuntoDoDoc, patchAvancoRotacao, refConjunto } from "@/lib/frases/repo";
import { aplicarSeloContato, aplicarTransicao, toDoc as leadToDoc } from "@/lib/leads/repo";
import { LEADS_COLLECTION, VALID_TRANSITIONS, type Lead } from "@/lib/leads/types";

import {
  FILA_CONTADORES_COLLECTION,
  contadorComEnvio,
  contadorComEnvioTardio,
  contadorComFalha,
  contadorComInvalido,
  diaOperacionalKey,
} from "./contadores";
import {
  cicloComEnvioTardio,
  cicloFechado,
  cicloRef,
  envioJaContado,
  gravarFechamentoTx,
  lerCicloTx,
  type CicloEnvio,
} from "./ciclos";
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
  /**
   * "enviado" de uma claim que JÁ NÃO ERA a atual, aceito mesmo assim (o
   * confirmar tardio — ver `confirmarEnvio`). Sempre presente na resposta da
   * rota: `false` em todo o resto.
   */
  foraDaClaim: boolean;
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
 * NADA é alterado — com UMA exceção, o **confirmar tardio**: "enviado" de
 * uma claim velha DESTE lead (há um ciclo dela em `filaEnvios/{lead}/ciclos`).
 * O caso: o operador liberou o lead da revisão, ele foi re-reservado, e só
 * então chegou o "enviado" antigo. A mensagem SAIU; recusar deixaria o lead
 * "novo", pronto para receber de novo. Então, na mesma transação:
 *
 * - lead `novo → contactado` (nunca rebaixa), selo + registro do aparelho na
 *   data da RESERVA velha (quando a mensagem de fato saiu);
 * - +1 em `enviados` no dia operacional de AGORA, sem tocar `envios`/
 *   `ultimoEventoEm` (`contadorComEnvioTardio` — o ritmo não viu esse envio
 *   e não pode passar a ver uma mensagem "de agora" que não saiu agora);
 * - a rotação NÃO gira (girar agora não muda o que já saiu, e pularia a
 *   frase da vez do próximo lead);
 * - o ciclo velho ganha `envioTardioEm` — e é isso que torna a repetição
 *   idempotente (`envioJaContado`), inclusive quando o operador já tinha
 *   marcado aquele envio como contactado na revisão;
 * - a claim ATUAL não é tocada.
 *
 * "falhou"/"invalido" de claim velha continuam recusados (a decisão sobre a
 * claim atual já é mais nova que eles), e claimId sem ciclo neste lead
 * também — não há como saber que ele existiu.
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
    if (!envio) throw new ClaimInvalidoError(leadId);
    if (envio.claimId !== claimId) {
      if (resultado !== "enviado") throw new ClaimInvalidoError(leadId);
      const cicloVelho = (await lerCicloTx(tx, db, leadId, claimId)) as CicloEnvio | undefined;
      if (!cicloVelho) throw new ClaimInvalidoError(leadId);
      const base = { estado: "enviado" as const, tentativas: envio.tentativas, parado: false, foraDaClaim: true };
      if (envioJaContado(cicloVelho)) return { ...base, repetida: true };

      const refLead = db.collection(LEADS_COLLECTION).doc(leadId);
      const lead = (await tx.get(refLead)).data() as Lead | undefined;
      const refContador = db
        .collection(FILA_CONTADORES_COLLECTION)
        .doc(diaOperacionalKey(now, opcoes.inicioDiaOperacionalHora));
      const contador = (await tx.get(refContador)).data();

      if (lead) tx.set(refLead, leadToDoc(leadComEnvioTardio(lead, cicloVelho, opcoes.userId, now)));
      tx.set(refContador, contadorComEnvioTardio(contador) as unknown as Record<string, unknown>);
      tx.set(cicloRef(db, leadId, claimId), { ...cicloComEnvioTardio(cicloVelho, detalhe, now) });
      return { ...base, repetida: false };
    }

    // Repetição da MESMA claim já confirmada: sucesso sem reescrever nada.
    if (envio.estado !== "reservado") {
      return {
        estado: envio.estado,
        repetida: true,
        tentativas: envio.tentativas,
        parado: envio.estado === "falhou" && envio.tentativas >= TENTATIVAS_MAX,
        foraDaClaim: false,
      };
    }

    // O ciclo desta claim fecha nesta MESMA transação (ver lib/fila/ciclos.ts).
    const ciclo = await lerCicloTx(tx, db, leadId, claimId);

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
    // Lido para os TRÊS resultados agora — não só "enviado": `falhas` e
    // `invalidos` vivem neste MESMO doc (ver `contadorComFalha`/
    // `contadorComInvalido`), incrementados na mesma transação, nunca um
    // segundo doc nem uma segunda escrita.
    const contador = (await tx.get(refContador)).data();

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

    // `semPrint` conta o envio que saiu com `detalhe` não vazio (texto saiu,
    // print não anexou — ver `detalheEnvio` no topo do arquivo): é o mesmo
    // sinal que a lista de pendência do painel já usa, só que contado por dia
    // em vez de varrido de `filaEnvios`.
    const proximoContador =
      resultado === "enviado"
        ? contadorComEnvio(contador, now, { semPrint: Boolean(detalhe) })
        : resultado === "falhou"
          ? contadorComFalha(contador)
          : contadorComInvalido(contador);
    tx.set(refContador, proximoContador as unknown as Record<string, unknown>);
    gravarFechamentoTx(tx, db, cicloFechado(ciclo, envio, resultado, detalhe, now));

    return {
      estado: resultado,
      repetida: false,
      tentativas,
      parado: resultado === "falhou" && tentativas >= TENTATIVAS_MAX,
      foraDaClaim: false,
    };
  });
}

/**
 * O lead depois de um confirmar TARDIO, puro: transição (nunca rebaixa),
 * selo e registro com a data da reserva velha — quando a mensagem saiu —,
 * escrita carimbada agora. Sem `origem`: é confirmação do aparelho, como no
 * caminho normal.
 */
function leadComEnvioTardio(lead: Lead, ciclo: CicloEnvio, userId: string, now: Date): Lead {
  const reservadoEm = Date.parse(ciclo.reservadoEm);
  const quando = Number.isFinite(reservadoEm) ? new Date(reservadoEm) : now;
  const comStatus = VALID_TRANSITIONS[lead.status].includes("contactado")
    ? aplicarTransicao(lead, "contactado", quando, userId)
    : lead;
  return { ...aplicarSeloContato(comStatus, userId, quando), atualizadoEm: now.toISOString() };
}
