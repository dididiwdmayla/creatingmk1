import { NextResponse } from "next/server";

import { getDb } from "@/lib/firebase/admin";
import { handleRouteError } from "@/lib/http";
import { getProgressoMetaUsuario, listUsuarios, requireAdmin } from "@/lib/usuarios";

/**
 * Tabela do painel admin (/config): meta × progresso de prospecção (dia/
 * semana), por usuário. Mesma fonte de dados usada pela visão consolidada
 * do time no painel — ambas leem este endpoint. "Prospecção" reaproveita o
 * contador `buscas` de usage_users (ver src/lib/usuarios/metas.ts).
 */
export async function GET(req: Request) {
  try {
    const db = getDb();
    await requireAdmin(db, req);
    const usuarios = await listUsuarios(db);
    const now = new Date();

    const linhas = await Promise.all(
      usuarios.map(async (usuario) => ({
        id: usuario.id,
        nome: usuario.nome,
        papel: usuario.papel,
        ativo: usuario.ativo,
        metas: usuario.metas ?? {},
        prospeccao: await getProgressoMetaUsuario(db, usuario.id, usuario.metas, now),
      })),
    );

    return NextResponse.json({ usuarios: linhas });
  } catch (error) {
    return handleRouteError(error);
  }
}
