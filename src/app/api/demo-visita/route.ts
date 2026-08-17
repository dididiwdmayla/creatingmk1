import { NextResponse } from "next/server";

import { atualizarVisitaAvulsa } from "@/lib/demos/avulsas/repo";
import { deviceIdValido } from "@/lib/device";
import { ValidationError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError, readJsonBody } from "@/lib/http";
import { atualizarVisitaDemo } from "@/lib/leads/repo";

const DURACAO_MAX_SEGUNDOS = 24 * 60 * 60;

/**
 * POST /api/demo-visita — rota PÚBLICA (ver proxy.ts), chamada via
 * navigator.sendBeacon no unload da demo pública (VisitaTracker) pra
 * completar a visita já registrada no carregamento com duração e
 * profundidade de scroll. Best-effort: registro inexistente responde 204
 * do mesmo jeito (o beacon não lê a resposta).
 *
 * O corpo traz `leadId` OU `avulsaId` — as duas famílias de demo guardam a
 * visita no próprio doc, e é o campo presente que diz em qual coleção
 * procurar. Mandar os dois (ou nenhum) é 400: adivinhar qual vale seria
 * gravar no lugar errado em silêncio.
 */
export async function POST(req: Request) {
  try {
    const body = await readJsonBody(req);
    const { leadId, avulsaId, visitaId, duracaoSegundos, scrollPercent, deviceId } = body;

    const problemas: string[] = [];
    const temLead = typeof leadId === "string" && leadId !== "";
    const temAvulsa = typeof avulsaId === "string" && avulsaId !== "";
    if (temLead === temAvulsa) problemas.push("informe leadId OU avulsaId");
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

    const dados = {
      duracaoSegundos: duracaoSegundos as number | undefined,
      scrollPercent: scrollPercent as number | undefined,
      marcadorDispositivo: deviceIdValido(typeof deviceId === "string" ? deviceId : undefined),
    };
    if (temAvulsa) {
      await atualizarVisitaAvulsa(getDb(), avulsaId as string, visitaId as string, dados);
    } else {
      await atualizarVisitaDemo(getDb(), leadId as string, visitaId as string, dados);
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleRouteError(error);
  }
}
