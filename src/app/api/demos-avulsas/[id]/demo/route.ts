import { NextResponse } from "next/server";

import { saveDemoAvulsa } from "@/lib/demos/avulsas/repo";
import { validateLeadDemoInput } from "@/lib/demos/validate";
import { UnauthorizedError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError, readJsonBody } from "@/lib/http";
import { usuarioDaRequest } from "@/lib/usuarios";

/**
 * PUT /api/demos-avulsas/[id]/demo — salva a configuração da demo avulsa.
 *
 * Corpo e validação são os MESMOS do PUT da demo de lead
 * (`validateLeadDemoInput`): o campo `demo` de uma avulsa é o mesmo
 * `LeadDemo`, então o editor manda o mesmo corpo pros dois destinos e não
 * existe uma segunda regra de validação para divergir da primeira.
 *
 * Não existe DELETE aqui: apagar a demo de uma avulsa é apagar a avulsa
 * (ver DELETE /api/demos-avulsas/[id]).
 */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb();
    if (!(await usuarioDaRequest(db, req))) throw new UnauthorizedError();

    const { id } = await params;
    const demo = validateLeadDemoInput(await readJsonBody(req));
    return NextResponse.json({ avulsa: await saveDemoAvulsa(db, id, demo) });
  } catch (error) {
    return handleRouteError(error);
  }
}
