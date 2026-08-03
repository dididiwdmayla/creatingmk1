import { NextResponse } from "next/server";

import { UnauthorizedError, ValidationError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError, readJsonBody } from "@/lib/http";
import {
  TEMAS_APP,
  TEMA_COOKIE,
  TEMA_COOKIE_OPTIONS,
  temaOuPadrao,
  temaValido,
} from "@/lib/tema";
import { salvarTemaUsuario, usuarioDaRequest } from "@/lib/usuarios";

/**
 * Tema da plataforma do PRÓPRIO usuário (ver lib/tema.ts). Self-service:
 * qualquer sessão lê/grava só o próprio doc, sem privilégio de admin —
 * mesmo padrão de /api/ia/nivel e /api/metas/proprio.
 *
 * As duas rotas reescrevem o cookie `radar_tema` a partir do DOC. É isso
 * que fecha o caso "troquei o tema no celular e o desktop continua com o
 * antigo": o cookie do desktop está velho até a primeira carga, o
 * TemaSeletor chama este GET, e a resposta corrige o cookie para o próximo
 * request — sem nunca deixar o cliente inventar o valor.
 */
export async function GET(req: Request) {
  try {
    const db = getDb();
    const usuario = await usuarioDaRequest(db, req);
    if (!usuario) throw new UnauthorizedError();

    const tema = temaOuPadrao(usuario.tema);
    const res = NextResponse.json({ tema });
    res.cookies.set(TEMA_COOKIE, tema, { ...TEMA_COOKIE_OPTIONS });
    return res;
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
    const tema = body.tema;
    if (!temaValido(tema)) {
      throw new ValidationError([`tema deve ser um de: ${TEMAS_APP.join(", ")}`]);
    }

    await salvarTemaUsuario(db, usuario.id, tema);
    const res = NextResponse.json({ tema });
    res.cookies.set(TEMA_COOKIE, tema, { ...TEMA_COOKIE_OPTIONS });
    return res;
  } catch (error) {
    return handleRouteError(error);
  }
}
