import { NextResponse } from "next/server";

import { AGENDA_ALVO_MAX, montarAgendaFila } from "@/lib/fila/agenda";
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
 * `?limite=N` (1 a `AGENDA_ALVO_MAX`) é o modo do BALÃO: só os N primeiros,
 * sobre o retrato persistido do pool, sem varrer `/leads` (ver
 * `montarAgendaFila`). Valor inválido é ignorado: vale a agenda inteira.
 *
 * Sob `/api/config/` e restrita ao admin, como todo o painel "Fila de
 * envio" e como o balão (que só existe para admin): 401 sem sessão, 403
 * para membro.
 */
export async function GET(req: Request) {
  try {
    const db = getDb();
    await requireAdmin(db, req);
    const limite = Number(new URL(req.url).searchParams.get("limite"));
    const valido = Number.isInteger(limite) && limite >= 1 && limite <= AGENDA_ALVO_MAX;
    return NextResponse.json(await montarAgendaFila(db, new Date(), valido ? { limite } : {}));
  } catch (error) {
    return handleRouteError(error);
  }
}
