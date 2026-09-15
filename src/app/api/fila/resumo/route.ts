import { NextResponse } from "next/server";

import { autenticarDispositivo } from "@/lib/fila/auth";
import { montarResumoFila } from "@/lib/fila/resumo";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError } from "@/lib/http";

/**
 * `GET /api/fila/resumo` — o retrato da fila para a macro PEQUENA e
 * SEPARADA que dispara no desbloqueio do celular (dezenas de vezes por dia,
 * é o celular pessoal do operador). Autenticação de DISPOSITIVO
 * (`RADAR_DEVICE_KEY`), mesmos cabeçalhos de `/proximo` e `/confirmar` — ver
 * `lib/fila/auth.ts`.
 *
 * Ver `montarResumoFila` (lib/fila/resumo.ts) para o cálculo: esta rota é só
 * o wrapper HTTP.
 */
export async function GET(req: Request) {
  const barrado = autenticarDispositivo(req);
  if (barrado) return barrado;

  try {
    const db = getDb();
    const resumo = await montarResumoFila(db, new Date());
    return NextResponse.json(resumo);
  } catch (error) {
    return handleRouteError(error);
  }
}
