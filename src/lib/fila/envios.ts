import { randomBytes } from "node:crypto";

import type { AppDb } from "@/lib/firestore-like";

import { retidoPorEnvio, type FilaEnvioDoc, type FilaEnvioResultado } from "./estado";

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

/**
 * Janela de uma reserva antes de virar livre de novo sozinha. Exportada
 * porque a tarefa de TESTE devolve um `expiraEm` com a mesma duração: a
 * resposta ao aparelho tem que significar a mesma coisa nos dois caminhos.
 */
export const RESERVA_DURACAO_MS = 5 * 60 * 1000;

/**
 * Sempre "no passado" pra qualquer `now` real — usado por `liberarClaim`.
 *
 * Exportado porque virou INVARIANTE observável: `expiraEm <= reservadoEm` é
 * o que distingue claim devolvida de propósito (nada saiu) de claim morta em
 * silêncio (provavelmente saiu) — ver `claimExpiradaSemConfirmacao` em
 * `estado.ts`. O teste da retenção precisa poder pinar este valor contra o
 * doc que `liberarClaim` de fato grava.
 */
export const EPOCH_ISO = new Date(0).toISOString();

export type { FilaEnvioDoc, FilaEnvioEstado, FilaEnvioResultado, LinhaRetido } from "./estado";
export {
  TENTATIVAS_MAX,
  claimExpiradaSemConfirmacao,
  filaParado,
  retencaoMsDeHoras,
  retencaoVenceEm,
  retidoPorEnvio,
} from "./estado";

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
 * `retencaoMs` é a RETENÇÃO POR CLAIM NÃO CONFIRMADA (ver o bloco em
 * `estado.ts`), explícita no chamador pelo mesmo motivo — 0, o default,
 * mantém a regra antiga ("reservado expirado = livre") intacta.
 *
 * **Este é o portão que de fato impede a mensagem repetida**, e não o
 * pré-filtro do pool. O pool dura `POOL_TTL_MS` (10 min) e a claim dura
 * `RESERVA_DURACAO_MS` (5 min): um pool construído antes da expiração
 * continua OFERECENDO o lead por até ~4 minutos depois de ela acontecer, e
 * quem é consultado nesse intervalo é esta função — transacional, sobre o
 * doc fresco. Filtrar só na construção do pool deixaria a janela aberta em
 * TODA expiração, que é exatamente o caso que a retenção existe para matar.
 *
 * `enviado` e `invalido` são terminais em qualquer política: um já foi, o
 * outro é número que não existe.
 */
export function leadDisponivel(
  doc: FilaEnvioDoc | undefined,
  now: Date,
  tentativasMax = 0,
  retencaoMs = 0,
): boolean {
  if (!doc) return true;
  if (doc.estado === "reservado") {
    if (retidoPorEnvio(doc, now, retencaoMs)) return false;
    return reservaExpirada(doc, now);
  }
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
 * **`opcoes.retencaoMs` INVERTE essa regra central**, de propósito: com ela,
 * a claim que expirou SEM CONFIRMAÇÃO prende o lead pela janela configurada
 * em vez de devolvê-lo livre. A regra antiga existia para o lead não ficar
 * preso quando o celular trava; a retenção existe porque "o aparelho pegou e
 * não disse o que houve" é mais provavelmente "mandou" do que "não mandou",
 * e mandar duas vezes não tem volta. Ver o bloco da retenção em `estado.ts`
 * para a assimetria inteira. Sem a opção (default 0), nada muda.
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
  opcoes: { tentativasMax?: number; retencaoMs?: number } = {},
): Promise<FilaReserva | null> {
  return db.runTransaction(async (tx) => {
    const ref = docRef(db, leadId);
    const atual = asDoc((await tx.get(ref)).data());

    if (!leadDisponivel(atual, now, opcoes.tentativasMax ?? 0, opcoes.retencaoMs ?? 0)) {
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

/**
 * O doc da fila para um lead, ou `undefined` se ele nunca passou por ela.
 * Leitura pura, para a ficha mostrar tentativas e último erro de um lead
 * parado — um lead que some da fila sem explicação é um estado que mente.
 */
export async function lerEnvioDoLead(
  db: AppDb,
  leadId: string,
): Promise<FilaEnvioDoc | undefined> {
  const snap = await docRef(db, leadId).get();
  return snap.exists ? asDoc(snap.data()) : undefined;
}
