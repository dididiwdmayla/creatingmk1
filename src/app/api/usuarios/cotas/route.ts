import { NextResponse } from "next/server";

import { getUsoUsuario } from "@/lib/costs";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError } from "@/lib/http";
import { listUsuarios, requireAdmin } from "@/lib/usuarios";

/**
 * Tabela do painel admin (/config): uso de hoje/semana/mês × limite, por
 * usuário, para os três tipos de cota individual (buscas/enriquecimentos/
 * gerações de IA). Admin nunca é bloqueado por esses limites — ainda assim
 * aparece na tabela (limites dele, se definidos, ficam só informativos).
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
        limites: usuario.limites ?? {},
        buscas: await getUsoUsuario(db, usuario.id, "buscas", usuario.limites, now),
        enriquecimentos: await getUsoUsuario(db, usuario.id, "enriquecimentos", usuario.limites, now),
        geracoesIA: await getUsoUsuario(db, usuario.id, "geracoesIA", usuario.limites, now),
      })),
    );

    return NextResponse.json({ usuarios: linhas });
  } catch (error) {
    return handleRouteError(error);
  }
}
