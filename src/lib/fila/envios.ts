import { randomBytes } from "node:crypto";

import type { AppDb } from "@/lib/firestore-like";

/**
 * `/filaEnvios/{leadId}` — um doc por LEAD (mesmo id do doc em `/leads`,
 * o placeId), mas numa coleção PRÓPRIA, de propósito: `leads/repo.ts` é
 * leitura-modificação-escrita simples por design (sem transação — ver
 * cabeçalho do arquivo), e reservar/confirmar claim da fila precisa de
 * transação de verdade (duas reservas concorrentes do mesmo lead não podem
 * as duas "ganhar"). Separar a coleção evita meter transação dentro do
 * repo do lead só por causa da fila.
 */
export const FILA_ENVIOS_COLLECTION = "filaEnvios";

/** Janela de uma reserva antes de virar livre de novo sozinha. */
const RESERVA_DURACAO_MS = 5 * 60 * 1000;

/** Sempre "no passado" pra qualquer `now` real — usado por `liberarClaim`. */
const EPOCH_ISO = new Date(0).toISOString();

export type FilaEnvioEstado = "reservado" | "enviado" | "invalido" | "falhou";
/** O que `confirmarClaim` aceita — "reservado" é só o estado de trânsito. */
export type FilaEnvioResultado = Exclude<FilaEnvioEstado, "reservado">;

export interface FilaEnvioDoc {
  leadId: string;
  estado: FilaEnvioEstado;
  claimId: string;
  reservadoEm: string;
  expiraEm: string;
  dispositivo: string;
  tentativas: number;
  ultimoErro: string | null;
  enviadoEm: string | null;
  /**
   * Skin cuja frase de fato saiu nesta reserva (`MensagemResolvida.rotacao`),
   * ou `null` quando a mensagem veio do grupo/global — que não têm rotação.
   * Fica gravado na CLAIM, e não é re-resolvido na confirmação, porque entre
   * entregar a tarefa e o celular confirmar o envio a config pode mudar: o
   * contador que gira tem que ser o da frase que o lead recebeu, não o da
   * frase que estaria valendo agora.
   */
  rotacaoSkinId?: string | null;
}

/**
 * Política de reenvio de lead que já falhou — ver `reservarLead`. A partir
 * de `TENTATIVAS_MAX` o lead PARA, para inspeção manual: não é excluído nem
 * marcado como inválido, só deixa de ser elegível (e a ficha mostra por quê).
 */
export const TENTATIVAS_MAX = 3;

/** Resultado de uma reserva bem-sucedida. */
export interface FilaReserva {
  claimId: string;
  /** Instante em que a claim morre sozinha — vai na resposta ao celular. */
  expiraEm: string;
}

/**
 * `claimId` do chamador não bate com o `claimId` ATUAL do doc — REJEITADO,
 * nunca ignorado em silêncio. Cenário real que isto impede: o celular
 * trava, a claim expira, o lead é re-reservado (novo claimId) e só então o
 * celular volta e tenta confirmar/liberar a claim velha — sem esta
 * checagem isso vira envio duplicado ou contador errado.
 */
export class ClaimInvalidoError extends Error {
  constructor(leadId: string) {
    super(`Claim inválida ou expirada para o lead "${leadId}".`);
    this.name = "ClaimInvalidoError";
  }
}

function gerarClaimId(): string {
  return randomBytes(9).toString("base64url");
}

function docRef(db: AppDb, leadId: string) {
  return db.collection(FILA_ENVIOS_COLLECTION).doc(leadId);
}

function asDoc(data: Record<string, unknown> | undefined): FilaEnvioDoc | undefined {
  return data as FilaEnvioDoc | undefined;
}

/** Mesmo truque de leads/repo.ts#toDoc: `set()` pede Record<string, unknown>. */
function toDoc(doc: FilaEnvioDoc): Record<string, unknown> {
  return { ...doc };
}

/** "reservado" com `expiraEm` no passado é tratado como LIVRE, e só isso. */
function reservaExpirada(doc: FilaEnvioDoc, now: Date): boolean {
  return doc.estado === "reservado" && new Date(doc.expiraEm).getTime() <= now.getTime();
}

/**
 * Este doc libera o lead para uma reserva nova?
 *
 * `tentativasMax` é a POLÍTICA DE REENVIO, explícita no chamador porque a
 * fundação não a define (ver o cabeçalho de `reservarLead`): 0 — o default —
 * mantém `falhou` terminal, e é o que vale para quem só quer reservar um lead
 * virgem; a rota `/api/fila/proximo` passa `TENTATIVAS_MAX` e com isso um
 * lead que falhou volta à fila até esgotar as tentativas.
 *
 * `enviado` e `invalido` são terminais em qualquer política: um já foi, o
 * outro é número que não existe.
 */
export function leadDisponivel(
  doc: FilaEnvioDoc | undefined,
  now: Date,
  tentativasMax = 0,
): boolean {
  if (!doc) return true;
  if (doc.estado === "reservado") return reservaExpirada(doc, now);
  if (doc.estado === "falhou") return doc.tentativas < tentativasMax;
  return false;
}

/**
 * Reserva um lead para `dispositivo`. Sucede quando o lead nunca foi
 * reservado OU a reserva anterior já expirou (regra central: reserva
 * "reservado" com `expiraEm` no passado é livre — é o que devolve o lead à
 * fila sozinho quando o celular trava ou a execução morre no meio).
 * Devolve `{ claimId, expiraEm }` novos, ou `null` quando o lead está com
 * reserva viva de outro ciclo ou num estado que a política em vigor trata
 * como terminal — ver `leadDisponivel`.
 *
 * O `expiraEm` volta daqui em vez de ser recalculado por quem chama porque a
 * resposta ao celular carrega esse instante: recomputá-lo do lado de fora
 * criaria duas fontes para a mesma data.
 */
export async function reservarLead(
  db: AppDb,
  leadId: string,
  dispositivo: string,
  now: Date = new Date(),
  opcoes: { tentativasMax?: number } = {},
): Promise<FilaReserva | null> {
  return db.runTransaction(async (tx) => {
    const ref = docRef(db, leadId);
    const atual = asDoc((await tx.get(ref)).data());

    if (!leadDisponivel(atual, now, opcoes.tentativasMax ?? 0)) {
      return null;
    }

    const claimId = gerarClaimId();
    const expiraEm = new Date(now.getTime() + RESERVA_DURACAO_MS).toISOString();
    const doc: FilaEnvioDoc = {
      leadId,
      estado: "reservado",
      claimId,
      reservadoEm: now.toISOString(),
      expiraEm,
      dispositivo,
      // Sobrevive à re-reserva: é o histórico de tentativas DO LEAD, não da claim.
      tentativas: atual?.tentativas ?? 0,
      ultimoErro: atual?.ultimoErro ?? null,
      enviadoEm: null,
      rotacaoSkinId: null,
    };
    tx.set(ref, toDoc(doc));
    return { claimId, expiraEm };
  });
}

/**
 * Confirma o resultado de uma reserva. `claimId` precisa bater com o atual
 * do doc (ver `ClaimInvalidoError`). `tentativas` só incrementa em
 * "falhou" — "invalido" é lead descartado (número errado etc.), não uma
 * tentativa que pode ter sucesso depois.
 */
export async function confirmarClaim(
  db: AppDb,
  leadId: string,
  claimId: string,
  resultado: FilaEnvioResultado,
  detalhe: string | null = null,
  now: Date = new Date(),
): Promise<void> {
  await db.runTransaction(async (tx) => {
    const ref = docRef(db, leadId);
    const atual = asDoc((await tx.get(ref)).data());
    if (!atual || atual.claimId !== claimId) {
      throw new ClaimInvalidoError(leadId);
    }

    const doc: FilaEnvioDoc = {
      ...atual,
      estado: resultado,
      ultimoErro: resultado === "enviado" ? null : detalhe,
      tentativas: resultado === "falhou" ? atual.tentativas + 1 : atual.tentativas,
      enviadoEm: resultado === "enviado" ? now.toISOString() : atual.enviadoEm,
    };
    tx.set(ref, toDoc(doc));
  });
}

/**
 * Libera a claim ANTES de expirar (o dispositivo desiste sem confirmar
 * envio/falha) — devolve o lead à fila na hora, sem esperar os 5min.
 * Reaproveita a mesma regra de "reservado expirado = livre" (marca
 * `expiraEm` bem no passado) em vez de inventar um terceiro estado de
 * disponibilidade. Mesma checagem de `claimId` de `confirmarClaim`, pelo
 * mesmo motivo: liberar com uma claim velha não pode derrubar a reserva
 * NOVA de outro ciclo.
 */
export async function liberarClaim(db: AppDb, leadId: string, claimId: string): Promise<void> {
  await db.runTransaction(async (tx) => {
    const ref = docRef(db, leadId);
    const atual = asDoc((await tx.get(ref)).data());
    if (!atual || atual.claimId !== claimId) {
      throw new ClaimInvalidoError(leadId);
    }

    tx.set(ref, { ...atual, expiraEm: EPOCH_ISO });
  });
}

/**
 * Carimba na claim a skin cuja frase de fato saiu (ver `rotacaoSkinId`).
 * Acontece DEPOIS da reserva porque a ordem é deliberada: a claim trava o
 * lead primeiro, e só então a mensagem é montada — assim nenhum trabalho é
 * feito sobre um lead que outro ciclo já levou. Mesma checagem de `claimId`
 * das outras escritas, pelo mesmo motivo.
 */
export async function anotarRotacao(
  db: AppDb,
  leadId: string,
  claimId: string,
  rotacaoSkinId: string | null,
): Promise<void> {
  await db.runTransaction(async (tx) => {
    const ref = docRef(db, leadId);
    const atual = asDoc((await tx.get(ref)).data());
    if (!atual || atual.claimId !== claimId) {
      throw new ClaimInvalidoError(leadId);
    }
    tx.set(ref, toDoc({ ...atual, rotacaoSkinId }));
  });
}
