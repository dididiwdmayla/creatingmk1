import { NextResponse } from "next/server";

import { decidirAprovacaoLote, validarLote } from "@/lib/automacao/aprovacaoLote";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError, readJsonBody } from "@/lib/http";
import { requireAdmin } from "@/lib/usuarios";

/**
 * POST /api/config/automacao/aprovacao `{ leadIds, aprovacao }` — a fila de
 * aprovação do painel "Automação": aprovar ou reprovar, um ou vários (ver
 * `lib/automacao/aprovacaoLote.ts`). Admin, como todo o painel; a rota por
 * lead (`/api/leads/[id]/demo/aprovacao`, qualquer sessão) continua
 * existindo para a ficha.
 *
 * 200 `{ resultados: [{ leadId, ok, erro? }] }` — erro de um lead não
 * derruba o lote.
 */
export async function POST(req: Request) {
  try {
    const db = getDb();
    const usuario = await requireAdmin(db, req);
    const { leadIds, aprovacao } = validarLote(await readJsonBody(req));
    const resultados = await decidirAprovacaoLote(db, leadIds, aprovacao, usuario.id);
    return NextResponse.json({ resultados });
  } catch (error) {
    return handleRouteError(error);
  }
}
