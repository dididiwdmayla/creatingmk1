import { NextResponse } from "next/server";

import { loadFilaConfig } from "@/lib/fila/config";
import { listarRevisao, marcarContactadoRevisao } from "@/lib/fila/revisao";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError, jsonError } from "@/lib/http";
import { requireAdmin } from "@/lib/usuarios";

/**
 * `POST /api/config/fila/revisao/{leadId}/contactado` — MARCAR COMO
 * CONTACTADO: o operador conferiu no WhatsApp que a mensagem SAIU (ver
 * `marcarContactadoRevisao`). A claim fecha como enviada, o lead vira
 * contactado com a data da reserva, o contador do dia soma 1 e a rotação NÃO
 * gira.
 *
 * O autor gravado é `RADAR_DEVICE_USER_ID` — quem de fato mandou foi o
 * aparelho, e é o que a confirmação dele teria gravado. Sem ela, 503 em vez
 * de inventar um autor. Mesmas guardas do liberar: 409 `claim_ativa`, 404
 * fora da revisão. Restrito ao admin: 401 sem sessão, 403 para membro.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
  try {
    const db = getDb();
    await requireAdmin(db, req);
    const { leadId } = await params;

    const userId = process.env.RADAR_DEVICE_USER_ID?.trim();
    if (!userId) {
      return jsonError(
        503,
        "config_error",
        "RADAR_DEVICE_USER_ID não configurada no servidor — é o autor do contato que esta ação grava (ver .env.example).",
      );
    }

    const now = new Date();
    const config = await loadFilaConfig(db);
    const resultado = await marcarContactadoRevisao(db, leadId, {
      userId,
      inicioDiaOperacionalHora: config.inicioDiaOperacionalHora,
      now,
    });
    if (!resultado.ok) {
      return jsonError(
        409,
        resultado.motivo,
        "O aparelho está com esse lead reservado agora — a confirmação dele pode chegar a qualquer momento. " +
          "Espere a reserva morrer e confira de novo.",
        { expiraEm: resultado.expiraEm },
      );
    }

    return NextResponse.json(await listarRevisao(db, now));
  } catch (error) {
    return handleRouteError(error);
  }
}
