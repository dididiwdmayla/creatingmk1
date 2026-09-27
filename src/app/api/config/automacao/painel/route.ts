import { NextResponse } from "next/server";

import { montarPainelAutomacao } from "@/lib/automacao/painel";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError } from "@/lib/http";
import { requireAdmin } from "@/lib/usuarios";

/**
 * GET /api/config/automacao/painel — tudo o que o painel "Automação" da
 * /config mostra, numa resposta: config, estoque (retrato do pool), última
 * execução resumida, execução ativa e a fila de aprovação (ver
 * `lib/automacao/painel.ts`, inclusive o porquê de não varrer `/leads`
 * aqui).
 *
 * Admin, sessão — a `AUTOMACAO_SECRET` só abre as três rotas do laço; esta
 * mora sob `/api/config/` de propósito, atrás do proxy de sessão.
 */
export async function GET(req: Request) {
  try {
    const db = getDb();
    await requireAdmin(db, req);
    return NextResponse.json(await montarPainelAutomacao(db));
  } catch (error) {
    return handleRouteError(error);
  }
}
