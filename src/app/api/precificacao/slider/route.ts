import { NextResponse } from "next/server";

import { UnauthorizedError, ValidationError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError, readJsonBody } from "@/lib/http";
import { SLIDER_MAX_BRL, SLIDER_MIN_BRL } from "@/lib/precificacao/calc";
import { salvarPrecoBaseSlider, usuarioDaRequest } from "@/lib/usuarios";

/**
 * Última posição do slider da calculadora de precificação — persistida por
 * usuário (não por lead/busca), lida ao abrir o card "Precificação" na
 * ficha e no grupo de busca. Self-service: qualquer sessão lê/grava a
 * PRÓPRIA posição, sem privilégio de admin envolvido.
 */
export async function GET(req: Request) {
  try {
    const db = getDb();
    const usuario = await usuarioDaRequest(db, req);
    if (!usuario) throw new UnauthorizedError();
    return NextResponse.json({ precoBase: usuario.ultimoPrecoBaseSlider ?? null });
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
    const precoBase = body.precoBase;
    if (
      typeof precoBase !== "number" ||
      !Number.isInteger(precoBase) ||
      precoBase < SLIDER_MIN_BRL ||
      precoBase > SLIDER_MAX_BRL
    ) {
      throw new ValidationError([
        `precoBase deve ser inteiro entre ${SLIDER_MIN_BRL} e ${SLIDER_MAX_BRL}`,
      ]);
    }

    await salvarPrecoBaseSlider(db, usuario.id, precoBase);
    return NextResponse.json({ precoBase });
  } catch (error) {
    return handleRouteError(error);
  }
}
