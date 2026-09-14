import { NextResponse } from "next/server";

import { ValidationError } from "@/lib/errors";
import { marcarPendenciaResolvida } from "@/lib/fila/pendencias";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError, readJsonBody } from "@/lib/http";
import { requireAdmin } from "@/lib/usuarios";

/**
 * `PATCH /api/config/fila/pendencias/{leadId}` — corpo `{ resolvido }`: o
 * operador anexou o print à mão e fecha a pendência (ou reabre uma marcada
 * por engano). Restrito ao admin, mesma divisão do `PUT /api/config/fila`.
 *
 * Um alternador por linha, e nada mais: sem ação em massa e sem botão de
 * reenvio — reenviar é justamente o que produziria a mensagem duplicada
 * que a escolha de reportar "enviado" existe para evitar.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
  try {
    const db = getDb();
    await requireAdmin(db, req);
    const { leadId } = await params;
    const { resolvido } = await readJsonBody(req);
    if (typeof resolvido !== "boolean") {
      throw new ValidationError(["resolvido deve ser booleano"]);
    }

    const pendencia = await marcarPendenciaResolvida(db, leadId, resolvido);
    return NextResponse.json({ pendencia });
  } catch (error) {
    return handleRouteError(error);
  }
}
