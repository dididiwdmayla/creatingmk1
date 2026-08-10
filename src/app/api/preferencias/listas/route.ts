import { NextResponse } from "next/server";

import { UnauthorizedError, ValidationError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError, readJsonBody } from "@/lib/http";
import {
  normalizaPreferenciasListas,
  salvarPreferenciasListas,
  usuarioDaRequest,
} from "@/lib/usuarios";

/**
 * Preferências das LISTAS longas (/leads e /buscas): grupos dobrados por
 * tela e o modo compacto dos leads — persistidas por USUÁRIO (não por
 * navegador nem por querystring), lidas ao abrir cada uma das duas telas.
 * Self-service: qualquer sessão lê/grava só as PRÓPRIAS preferências, sem
 * privilégio de admin envolvido (mesmo padrão de /api/ia/nivel e
 * /api/precificacao/slider).
 */
export async function GET(req: Request) {
  try {
    const db = getDb();
    const usuario = await usuarioDaRequest(db, req);
    if (!usuario) throw new UnauthorizedError();
    return NextResponse.json({
      preferencias: normalizaPreferenciasListas(usuario.preferenciasListas),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * O corpo é a preferência INTEIRA (não um patch): as duas telas mandam o
 * estado que já têm em mãos depois de alternar um grupo ou o modo, e a
 * normalização corta chave inválida e aplica o teto de chaves guardadas.
 */
export async function PUT(req: Request) {
  try {
    const db = getDb();
    const usuario = await usuarioDaRequest(db, req);
    if (!usuario) throw new UnauthorizedError();

    const body = await readJsonBody(req);
    const bruto = body.preferencias;
    if (typeof bruto !== "object" || bruto === null || Array.isArray(bruto)) {
      throw new ValidationError(["preferencias deve ser um objeto"]);
    }

    const preferencias = normalizaPreferenciasListas(bruto);
    await salvarPreferenciasListas(db, usuario.id, preferencias);
    return NextResponse.json({ preferencias });
  } catch (error) {
    return handleRouteError(error);
  }
}
