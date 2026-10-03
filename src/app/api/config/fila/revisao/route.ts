import { NextResponse } from "next/server";

import { listarRevisao } from "@/lib/fila/revisao";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError } from "@/lib/http";
import { requireAdmin } from "@/lib/usuarios";

/**
 * `GET /api/config/fila/revisao` — os leads EM REVISÃO: claim que venceu sem
 * o aparelho confirmar nada (ver `lib/fila/revisao.ts`), com a contagem que
 * o funil do painel mostra.
 *
 * Devolve `{ total, linhas }` da MESMA varredura: a contagem do funil e a
 * lista não podem discordar.
 *
 * Mora sob `/api/config/`, e NÃO sob `/api/fila/`: o proxy deixa todo o
 * prefixo `/api/fila/` passar sem sessão de usuário (é o celular com Bearer
 * RADAR_DEVICE_KEY — ver src/proxy.ts), e pendurar ali uma tela de admin a
 * tiraria da sessão junto.
 *
 * Restrita ao ADMIN, como todo o painel "Fila de envio": a fila é global e é
 * drenada por UM aparelho físico. 401 sem sessão, 403 para membro.
 */
export async function GET(req: Request) {
  try {
    const db = getDb();
    await requireAdmin(db, req);
    return NextResponse.json(await listarRevisao(db, new Date()));
  } catch (error) {
    return handleRouteError(error);
  }
}
