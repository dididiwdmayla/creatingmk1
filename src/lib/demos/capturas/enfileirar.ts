import { dispararCapturas } from "@/lib/github/dispatch";
import type { AppDb } from "@/lib/firestore-like";
import { LEADS_COLLECTION, type Lead } from "@/lib/leads/types";

import { emAndamento, type LeadCapturas } from "./estado";

/**
 * Enfileira a geração de capturas de um ou mais leads: marca o estado no
 * doc de cada um e dispara o workflow no GitHub Actions.
 *
 * A ordem importa. Marcar ANTES de disparar é o que faz o pedido existir
 * mesmo que o operador feche a aba no mesmo segundo — e é o que dá ao
 * workflow o `execucaoId` que ele vai carregar de volta. Se o disparo
 * falhar, o estado é desfeito para `falhou` com o motivo: um lead
 * "enfileirado" para um workflow que nunca foi chamado é exatamente o
 * estado que mente.
 */

export interface ResultadoEnfileiramento {
  execucaoId: string;
  /** Leads que entraram na fila. */
  enfileirados: string[];
  /** Leads ignorados por não terem demo salva (não há o que capturar). */
  pulados: Array<{ placeId: string; motivo: string }>;
}

/** Lead sem demo não tem o que capturar — /demo/{id} responde 404. */
function podeCapturar(lead: Lead | undefined): boolean {
  return Boolean(lead?.demo?.skinId);
}

async function lerLead(db: AppDb, placeId: string): Promise<Lead | undefined> {
  const snap = await db.collection(LEADS_COLLECTION).doc(placeId).get();
  return snap.exists ? (snap.data() as unknown as Lead) : undefined;
}

/**
 * Já existe uma geração em andamento para este lead? Usado para não
 * empilhar runs por clique repetido — "refazer" durante um run em
 * andamento é uma decisão explícita do operador (`forcar`), não um efeito
 * colateral de dois cliques.
 */
export function jaEstaGerando(capturas: LeadCapturas | undefined): boolean {
  return emAndamento(capturas?.estado);
}

export async function enfileirarCapturas(
  db: AppDb,
  placeIds: string[],
  opcoes: {
    userId?: string;
    /** Ignora um andamento em curso (o botão "Refazer"). */
    forcar?: boolean;
    agora?: () => string;
    novoId?: () => string;
  } = {},
): Promise<ResultadoEnfileiramento> {
  const agora = opcoes.agora ?? (() => new Date().toISOString());
  const novoId = opcoes.novoId ?? (() => crypto.randomUUID());
  const execucaoId = novoId();
  const pedidoEm = agora();

  const enfileirados: string[] = [];
  const pulados: ResultadoEnfileiramento["pulados"] = [];

  for (const placeId of placeIds) {
    const lead = await lerLead(db, placeId);
    if (!lead) {
      pulados.push({ placeId, motivo: "lead não encontrado" });
      continue;
    }
    if (!podeCapturar(lead)) {
      pulados.push({ placeId, motivo: "sem demo salva" });
      continue;
    }
    if (!opcoes.forcar && jaEstaGerando(lead.capturas)) {
      pulados.push({ placeId, motivo: "já está gerando" });
      continue;
    }

    const capturas: LeadCapturas = {
      estado: "enfileirado",
      execucaoId,
      pedidoEm,
      ...(opcoes.userId ? { pedidoPor: opcoes.userId } : {}),
      // As imagens da rodada anterior somem junto com o pedido novo: o
      // workflow apaga o prefixo do lead no Storage antes de subir as
      // novas, então manter as URLs velhas aqui deixaria a ficha exibindo
      // imagem que já não existe.
    };
    await db.collection(LEADS_COLLECTION).doc(placeId).set({ capturas, atualizadoEm: pedidoEm }, { merge: true });
    enfileirados.push(placeId);
  }

  if (enfileirados.length === 0) {
    return { execucaoId, enfileirados, pulados };
  }

  try {
    await dispararCapturas({ leads: enfileirados, execucao: execucaoId });
  } catch (erro) {
    // Desfaz: sem isto os leads ficariam "enfileirado" esperando um
    // workflow que ninguém chamou, até o limite de silêncio expirar.
    const motivo = erro instanceof Error ? erro.message : "falha ao disparar a geração";
    for (const placeId of enfileirados) {
      await db
        .collection(LEADS_COLLECTION)
        .doc(placeId)
        .set(
          {
            capturas: { estado: "falhou", execucaoId, pedidoEm, erro: motivo, geradoEm: agora() },
            atualizadoEm: agora(),
          },
          { merge: true },
        );
    }
    throw erro;
  }

  return { execucaoId, enfileirados, pulados };
}

/**
 * Estado das capturas de vários leads — a resposta do polling da ficha e
 * do lote. Devolve só o campo `capturas`, que é o que muda enquanto a
 * geração roda; carregar o lead inteiro a cada poucos segundos seria
 * pagar caro por um dado que não mudou.
 */
export async function estadoDasCapturas(
  db: AppDb,
  placeIds: string[],
): Promise<Record<string, LeadCapturas | null>> {
  const saida: Record<string, LeadCapturas | null> = {};
  for (const placeId of placeIds) {
    const lead = await lerLead(db, placeId);
    saida[placeId] = lead?.capturas ?? null;
  }
  return saida;
}
