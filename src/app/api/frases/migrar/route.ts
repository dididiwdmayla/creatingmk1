import { NextResponse } from "next/server";

import { getDb } from "@/lib/firebase/admin";
import { listConjuntos } from "@/lib/frases";
import { descartarLegados, listarLegados, migrarLegados, planejarMigracao } from "@/lib/frases/migracao";
import { handleRouteError } from "@/lib/http";
import { requireAdmin } from "@/lib/usuarios";

/**
 * Migração das frases antigas (chaveadas pelo TEXTO do nicho da busca) para
 * as chaveadas pela SKIN registrada — ver `lib/frases/migracao.ts`. Restrita
 * ao admin, como o resto da edição das frases.
 *
 * GET  = prévia, sem escrever nada: o que seria migrado e o que ficaria
 *        pendente (com o texto junto, para copiar à mão).
 * POST = executa e devolve o MESMO relatório, agora com as escritas feitas.
 * DELETE = apaga as entradas legadas que sobraram (o "já copiei, pode
 *        limpar") — nunca é chamado pelo POST.
 */
export async function GET(req: Request) {
  try {
    const db = getDb();
    await requireAdmin(db, req);
    const [legados, salvos] = await Promise.all([listarLegados(db), listConjuntos(db)]);
    const { relatorio } = planejarMigracao(legados, salvos);
    // Na prévia, `feitas` é o que ACONTECERIA — o POST é que grava.
    return NextResponse.json({ legados: legados.length, relatorio });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(req: Request) {
  try {
    const db = getDb();
    await requireAdmin(db, req);
    const [legados, salvos] = await Promise.all([listarLegados(db), listConjuntos(db)]);
    const relatorio = await migrarLegados(db, legados, salvos);
    return NextResponse.json({ relatorio });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(req: Request) {
  try {
    const db = getDb();
    await requireAdmin(db, req);
    const apagadas = await descartarLegados(db);
    return NextResponse.json({ apagadas });
  } catch (error) {
    return handleRouteError(error);
  }
}
