import { NextResponse } from "next/server";

import { autenticarAutomacao } from "@/lib/automacao/auth";
import { planejar } from "@/lib/automacao/motor";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError, jsonError, readJsonBody } from "@/lib/http";

/** Uma chamada curta; o teto é o do plano Hobby da Vercel. */
export const maxDuration = 300;

/**
 * POST /api/automacao/planejar `{ disparo?, runUrl? }` — primeiro ato da
 * automação do estoque (ver `lib/automacao/motor.ts`). Fora da sessão
 * (exceção no proxy), protegida por `AUTOMACAO_SECRET`.
 *
 * 200 `{ acao: "executar", execucaoId, falta, unidades }` · 200 `{ acao:
 * "nada", motivo }` (desligada, ou estoque já no alvo — registrado) · 409
 * `conflict` (outra execução com a trava — registrada como recusada).
 */
export async function POST(req: Request) {
  const negado = autenticarAutomacao(req);
  if (negado) return negado;
  try {
    const body = await readJsonBody(req);
    const resultado = await planejar(getDb(), {
      disparo: typeof body.disparo === "string" ? body.disparo : undefined,
      runUrl: typeof body.runUrl === "string" ? body.runUrl : undefined,
    });
    if (resultado.acao === "recusada") {
      return jsonError(409, "conflict", resultado.motivo ?? "execução ativa", {
        execucaoId: resultado.execucaoId,
        execucaoAtiva: resultado.execucaoAtiva,
      });
    }
    return NextResponse.json(resultado);
  } catch (error) {
    return handleRouteError(error);
  }
}
