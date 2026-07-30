import { NextResponse } from "next/server";

import { NIVEIS_IA, NIVEL_IA_PADRAO, nivelIaValido } from "@/lib/ai/nivel";
import { UnauthorizedError, ValidationError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError, readJsonBody } from "@/lib/http";
import { salvarNivelIA, usuarioDaRequest } from "@/lib/usuarios";

/**
 * Último nível de intervenção da IA na Forja escolhido pelo usuário
 * ("toque-leve" | "equilibrado" | "completo") — persistido por usuário
 * (não por lead/skin), lido ao abrir o passo de escolha de skin e o editor
 * para pré-selecionar a última escolha. Self-service: qualquer sessão
 * lê/grava o PRÓPRIO nível, sem privilégio de admin envolvido.
 */
export async function GET(req: Request) {
  try {
    const db = getDb();
    const usuario = await usuarioDaRequest(db, req);
    if (!usuario) throw new UnauthorizedError();
    return NextResponse.json({ nivel: usuario.ultimoNivelIA ?? NIVEL_IA_PADRAO });
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
    const nivel = body.nivel;
    if (!nivelIaValido(nivel)) {
      throw new ValidationError([`nivel deve ser um de: ${NIVEIS_IA.join(", ")}`]);
    }

    await salvarNivelIA(db, usuario.id, nivel);
    return NextResponse.json({ nivel });
  } catch (error) {
    return handleRouteError(error);
  }
}
