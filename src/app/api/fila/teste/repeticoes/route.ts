import { NextResponse } from "next/server";

import { getDb } from "@/lib/firebase/admin";
import { cancelarRepeticoesTeste } from "@/lib/fila/teste";
import { handleRouteError } from "@/lib/http";
import { requireAdmin } from "@/lib/usuarios";

/**
 * `DELETE /api/fila/teste/repeticoes` — cancela as repetições que ainda
 * restam do disparo de teste, a qualquer momento (inclusive com uma tarefa
 * "em voo": ela segue o curso normal, só não rearma ao confirmar).
 *
 * DELETE pelo mesmo motivo de `DELETE /api/config/fila/retidos/{leadId}`: o
 * que se apaga é a CONTAGEM restante, não o teste em si, e a ação é de mão
 * única — não há "re-armar" por esta rota. Zera `repeticoesRestantes` sem
 * tocar em mais nada do doc (`lib/fila/teste.ts#cancelarRepeticoesTeste`).
 *
 * Admin, mesma checagem completa de sessão+papel das outras rotas de
 * `/api/fila/teste/*` (o prefixo que o proxy isenta de sessão para o
 * aparelho bater com `RADAR_DEVICE_KEY` — que não abre esta rota).
 */
export async function DELETE(req: Request) {
  try {
    const db = getDb();
    await requireAdmin(db, req);

    const atualizado = await cancelarRepeticoesTeste(db, new Date());
    if (!atualizado) {
      return NextResponse.json({ erro: "sem_teste" }, { status: 404 });
    }
    return NextResponse.json({ teste: atualizado });
  } catch (error) {
    return handleRouteError(error);
  }
}
