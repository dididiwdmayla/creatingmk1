import { NextResponse } from "next/server";

import { ValidationError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError, readJsonBody } from "@/lib/http";
import { atualizarVisitaDemo } from "@/lib/leads/repo";

const DURACAO_MAX_SEGUNDOS = 24 * 60 * 60;

/**
 * POST /api/demo-visita — rota PÚBLICA (ver proxy.ts), chamada via
 * navigator.sendBeacon no unload da demo pública (VisitaTracker) pra
 * completar a visita já registrada no carregamento (ver registrarVisitaDemo
 * em lib/leads/repo.ts) com duração e profundidade de scroll. Best-effort:
 * lead/visita inexistente responde 204 do mesmo jeito (o beacon não lê a
 * resposta).
 */
export async function POST(req: Request) {
  try {
    const body = await readJsonBody(req);
    const { leadId, visitaId, duracaoSegundos, scrollPercent } = body;

    const problemas: string[] = [];
    if (typeof leadId !== "string" || !leadId) problemas.push("leadId deve ser string");
    if (typeof visitaId !== "string" || !visitaId) problemas.push("visitaId deve ser string");
    if (
      duracaoSegundos !== undefined &&
      (typeof duracaoSegundos !== "number" ||
        !Number.isFinite(duracaoSegundos) ||
        duracaoSegundos < 0 ||
        duracaoSegundos > DURACAO_MAX_SEGUNDOS)
    ) {
      problemas.push(`duracaoSegundos deve ser número entre 0 e ${DURACAO_MAX_SEGUNDOS}`);
    }
    if (
      scrollPercent !== undefined &&
      (typeof scrollPercent !== "number" || scrollPercent < 0 || scrollPercent > 100)
    ) {
      problemas.push("scrollPercent deve ser número entre 0 e 100");
    }
    if (problemas.length > 0) throw new ValidationError(problemas);

    await atualizarVisitaDemo(getDb(), leadId as string, visitaId as string, {
      duracaoSegundos: duracaoSegundos as number | undefined,
      scrollPercent: scrollPercent as number | undefined,
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleRouteError(error);
  }
}
