import { NextResponse } from "next/server";

import { UnauthorizedError, ValidationError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError, readJsonBody } from "@/lib/http";
import {
  getProgressoMetaUsuario,
  salvarMetaFaixaMinimizada,
  usuarioDaRequest,
} from "@/lib/usuarios";

/**
 * Progresso da PRÓPRIA meta de prospecção (dia/semana) + estado da faixa
 * fixa de metas (topo do app) — leve o bastante para ser chamada em toda
 * navegação, ao contrário de /api/hoje (que carrega a fila inteira e
 * carimba a visita). Self-service: qualquer sessão lê/grava só do PRÓPRIO
 * usuário. Sem meta em nenhuma janela = a UI não mostra a faixa.
 */
export async function GET(req: Request) {
  try {
    const db = getDb();
    const usuario = await usuarioDaRequest(db, req);
    if (!usuario) throw new UnauthorizedError();

    const progresso = await getProgressoMetaUsuario(db, usuario.id, usuario.metas);
    return NextResponse.json({
      ...progresso,
      minimizada: usuario.metaFaixaMinimizada ?? false,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(req: Request) {
  try {
    const db = getDb();
    const usuario = await usuarioDaRequest(db, req);
    if (!usuario) throw new UnauthorizedError();

    const body = await readJsonBody(req);
    const minimizada = body.minimizada;
    if (typeof minimizada !== "boolean") {
      throw new ValidationError(["minimizada deve ser boolean"]);
    }

    await salvarMetaFaixaMinimizada(db, usuario.id, minimizada);
    return NextResponse.json({ minimizada });
  } catch (error) {
    return handleRouteError(error);
  }
}
