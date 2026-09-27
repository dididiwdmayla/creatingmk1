import { NextResponse } from "next/server";

import { autenticarAutomacao } from "@/lib/automacao/auth";
import { passo } from "@/lib/automacao/motor";
import { ValidationError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError, readJsonBody } from "@/lib/http";

/** Uma unidade por chamada — demo com IA ou uma busca, bem abaixo disto. */
export const maxDuration = 300;

/**
 * POST /api/automacao/passo `{ execucaoId }` — processa UMA unidade do
 * plano e devolve `{ temTrabalho, esperarSegundos?, unidade? }`. 409 se
 * outra execução está com a trava; 404 execução desconhecida.
 */
export async function POST(req: Request) {
  const negado = autenticarAutomacao(req);
  if (negado) return negado;
  try {
    const body = await readJsonBody(req);
    if (typeof body.execucaoId !== "string" || !body.execucaoId) {
      throw new ValidationError(["execucaoId é obrigatório"]);
    }
    return NextResponse.json(await passo(getDb(), body.execucaoId));
  } catch (error) {
    return handleRouteError(error);
  }
}
