import { NextResponse } from "next/server";

import { getDb } from "@/lib/firebase/admin";
import { handleRouteError } from "@/lib/http";
import { getMetrics, getMetricsPorUsuario } from "@/lib/leads/metrics";
import { listUsuarios, usuarioDaRequest } from "@/lib/usuarios";

/**
 * Métricas de prospecção, escopadas por papel: membro recebe SÓ as ações
 * dele (contatos/demos carimbados com o userId); admin recebe o agregado
 * E a quebra `porUsuario` (buscas, demos, contatos por usuário, com nome).
 */
export async function GET(req: Request) {
  try {
    const db = getDb();
    const usuario = await usuarioDaRequest(db, req);

    if (usuario && usuario.papel !== "admin") {
      const metrics = await getMetrics(db, undefined, usuario.id);
      return NextResponse.json(metrics);
    }

    const metrics = await getMetrics(db);
    if (!usuario) {
      // Sem sessão identificável (o proxy já barrou anônimos): só o agregado.
      return NextResponse.json(metrics);
    }

    const rollup = await getMetricsPorUsuario(db);
    const nomes = new Map((await listUsuarios(db)).map((u) => [u.id, u.nome]));
    const porUsuario = Object.entries(rollup)
      .map(([userId, contadores]) => ({
        userId,
        nome: nomes.get(userId) ?? userId,
        ...contadores,
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
    return NextResponse.json({ ...metrics, porUsuario });
  } catch (error) {
    return handleRouteError(error);
  }
}
