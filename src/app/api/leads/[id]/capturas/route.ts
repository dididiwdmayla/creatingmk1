import { NextResponse } from "next/server";

import { enfileirarCapturas } from "@/lib/demos/capturas/enfileirar";
import { UnauthorizedError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError, readJsonBody } from "@/lib/http";
import { usuarioDaRequest } from "@/lib/usuarios";

/**
 * POST /api/leads/[id]/capturas — enfileira a geração de capturas da demo
 * deste lead e dispara o workflow no GitHub Actions.
 *
 * RESTRITA A USUÁRIO LOGADO (qualquer papel: gerar print é trabalho de
 * prospecção, não de administração). O proxy já barra anônimo em /api/*;
 * a checagem aqui é a segunda camada, a mesma das rotas que atribuem ação
 * a um usuário — e é ela que carimba `pedidoPor`.
 *
 * O token do GitHub NUNCA passa por aqui de fora: ele vem de variável de
 * ambiente do servidor, dentro de `lib/github/dispatch.ts`. O corpo aceita
 * apenas `{ forcar }` — o "Refazer", que autoriza atropelar uma geração já
 * em andamento.
 *
 * Nenhuma chamada paga: a geração lê Firestore e escreve no Storage.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDb();
    const usuario = await usuarioDaRequest(db, req);
    if (!usuario) throw new UnauthorizedError();

    const body = (await readJsonBody(req).catch(() => ({}))) as { forcar?: unknown };
    const resultado = await enfileirarCapturas(db, [id], {
      userId: usuario.id,
      forcar: body?.forcar === true,
    });

    return NextResponse.json(resultado);
  } catch (error) {
    return handleRouteError(error);
  }
}
