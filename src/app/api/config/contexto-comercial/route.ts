import { NextResponse } from "next/server";

import { loadContextoComercial, saveContextoComercial } from "@/lib/contextoComercial";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError, readJsonBody } from "@/lib/http";
import { requireAdmin } from "@/lib/usuarios";

/**
 * GET aberto a qualquer sessão, mesmo padrão de `/api/config` e `/api/frases`:
 * é contexto que molda o texto que sai em nome do time, e qualquer membro
 * prospectando se beneficia de ver o que já está declarado.
 */
export async function GET() {
  try {
    const contexto = await loadContextoComercial(getDb());
    return NextResponse.json({ contexto });
  } catch (error) {
    return handleRouteError(error);
  }
}

/** PUT restrito ao admin — o que a IA pode afirmar sobre preço e prazo é decisão de quem responde por ela. */
export async function PUT(req: Request) {
  try {
    const db = getDb();
    await requireAdmin(db, req);
    const patch = await readJsonBody(req);
    const contexto = await saveContextoComercial(db, patch);
    return NextResponse.json({ contexto });
  } catch (error) {
    return handleRouteError(error);
  }
}
