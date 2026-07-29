import { NextResponse } from "next/server";

import { UnauthorizedError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError } from "@/lib/http";
import { listUsuarios, usuarioDaRequest } from "@/lib/usuarios";

/**
 * Resolução mínima de nomes (id → nome), para QUALQUER sessão válida — ao
 * contrário de GET /api/usuarios (admin), esta rota só serve pra resolver
 * "quem é" em selos/badges (ex.: selo de contato do WhatsApp) sem expor
 * papel/limites. Usuário excluído (doc apagado) simplesmente não aparece
 * na lista — a UI mostra "usuário removido" quando o id não bate com nada.
 */
export async function GET(req: Request) {
  try {
    const db = getDb();
    const usuario = await usuarioDaRequest(db, req);
    if (!usuario) throw new UnauthorizedError();

    const usuarios = await listUsuarios(db);
    return NextResponse.json({
      usuarios: usuarios.map((u) => ({ id: u.id, nome: u.nome })),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
