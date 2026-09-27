import { NextResponse } from "next/server";

import { autenticarAutomacao } from "@/lib/automacao/auth";
import { finalizar } from "@/lib/automacao/motor";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError, readJsonBody } from "@/lib/http";

/** Enfileira as capturas e recalcula o estoque — curto, mas o teto é o mesmo. */
export const maxDuration = 300;

function texto(valor: unknown): string | undefined {
  return typeof valor === "string" && valor.trim() ? valor.trim().slice(0, 2000) : undefined;
}

/**
 * POST /api/automacao/finalizar `{ execucaoId?, erro?, motivo?, disparo?,
 * runUrl? }` — fecha a execução: capturas em lotes de 60, estoque depois,
 * motivo de parada, trava liberada. Chamada SEMPRE pelo workflow, inclusive
 * quando o laço morreu: com `erro`, grava a falha — e sem `execucaoId`
 * (morreu antes do plano), grava uma execução falha mesmo assim.
 * Idempotente.
 */
export async function POST(req: Request) {
  const negado = autenticarAutomacao(req);
  if (negado) return negado;
  try {
    const body = await readJsonBody(req);
    const execucao = await finalizar(getDb(), {
      execucaoId: texto(body.execucaoId),
      erro: texto(body.erro),
      motivo: texto(body.motivo),
      disparo: texto(body.disparo),
      runUrl: texto(body.runUrl),
    });
    return NextResponse.json({ execucao });
  } catch (error) {
    return handleRouteError(error);
  }
}
