import { NextResponse } from "next/server";

import { montarAgendaFila } from "@/lib/fila/agenda";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError } from "@/lib/http";
import { requireAdmin } from "@/lib/usuarios";

/**
 * `GET /api/config/fila/agenda` — a AGENDA da fila: os próximos leads na
 * ordem em que vão sair, a partir de quando cada um sai, quem vai ser
 * barrado e quem perde a demo antes da vez (ver `lib/fila/agenda.ts`).
 *
 * SOMENTE LEITURA: uma simulação com as funções de `/api/fila/proximo`,
 * em memória — nunca reserva, nunca grava, nunca chama API paga.
 *
 * Sob `/api/config/` e restrita ao admin, como todo o painel "Fila de
 * envio": 401 sem sessão, 403 para membro.
 */
export async function GET(req: Request) {
  try {
    const db = getDb();
    await requireAdmin(db, req);
    return NextResponse.json(await montarAgendaFila(db, new Date()));
  } catch (error) {
    return handleRouteError(error);
  }
}
