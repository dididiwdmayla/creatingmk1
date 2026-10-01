import { NextResponse } from "next/server";

import {
  RECONCILIACAO_LOTE_MAX,
  aplicarReconciliacao,
  previaReconciliacao,
} from "@/lib/fila/reconciliacao";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError, jsonError, readJsonBody } from "@/lib/http";
import { requireAdmin } from "@/lib/usuarios";

/**
 * A RECONCILIAÇÃO do painel "Fila de envio" (ver `lib/fila/reconciliacao.ts`):
 * marca como contactado todo lead que a fila reservou e que continua "novo"
 * — o estrago de quando `/confirmar` respondia 503.
 *
 * - `GET` — a PRÉVIA, somente leitura.
 * - `POST { leadIds, confirmar: true }` — aplica, em lotes de até
 *   `RECONCILIACAO_LOTE_MAX`. `confirmar` tem que ser literalmente `true`:
 *   é a confirmação explícita que a tela pede antes de mandar.
 *
 * Admin only e sob `/api/config/`, como o resto do painel. O autor gravado é
 * `RADAR_DEVICE_USER_ID` — o mesmo que a fila teria gravado se o confirmar
 * tivesse passado; sem ela, o POST responde 503 em vez de inventar um autor.
 */

function autor(): string | undefined {
  const userId = process.env.RADAR_DEVICE_USER_ID?.trim();
  return userId || undefined;
}

export async function GET(req: Request) {
  try {
    const db = getDb();
    await requireAdmin(db, req);
    const previa = await previaReconciliacao(db);
    // `autorPresente` viaja junto para a tela desabilitar o botão e dizer por
    // quê, em vez de deixar o clique bater num 503.
    return NextResponse.json({ ...previa, autorPresente: autor() !== undefined, loteMax: RECONCILIACAO_LOTE_MAX });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(req: Request) {
  try {
    const db = getDb();
    await requireAdmin(db, req);

    const corpo = await readJsonBody(req);
    const { leadIds, confirmar } = corpo as { leadIds?: unknown; confirmar?: unknown };
    const problemas: string[] = [];
    if (confirmar !== true) problemas.push("confirmar deve ser true — a reconciliação exige confirmação explícita");
    if (
      !Array.isArray(leadIds) ||
      leadIds.length === 0 ||
      leadIds.length > RECONCILIACAO_LOTE_MAX ||
      !leadIds.every((id) => typeof id === "string" && id.trim() !== "")
    ) {
      problemas.push(`leadIds deve ser uma lista de 1 a ${RECONCILIACAO_LOTE_MAX} ids`);
    }
    if (problemas.length > 0) {
      return jsonError(400, "validation_error", problemas.join("; "));
    }

    const userId = autor();
    if (!userId) {
      return jsonError(
        503,
        "config_error",
        "RADAR_DEVICE_USER_ID não configurada no servidor — a reconciliação grava esse autor (ver .env.example).",
      );
    }

    const resultado = await aplicarReconciliacao(db, leadIds as string[], userId);
    return NextResponse.json(resultado);
  } catch (error) {
    return handleRouteError(error);
  }
}
