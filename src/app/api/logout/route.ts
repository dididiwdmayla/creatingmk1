import { NextResponse } from "next/server";

import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/auth";
import { TEMA_COOKIE, TEMA_COOKIE_OPTIONS } from "@/lib/tema";

/** Encerra a sessão limpando o cookie. Idempotente, sem corpo de entrada. */
export async function POST() {
  const res = new NextResponse(null, { status: 204 });
  res.cookies.set(SESSION_COOKIE, "", { ...SESSION_COOKIE_OPTIONS, maxAge: 0 });
  // O espelho do tema sai junto: ele pertence a QUEM estava logado. Deixá-lo
  // para trás faria a tela de login (e o próximo integrante, até o POST
  // /api/login reescrevê-lo) aparecer no tema de outra pessoa.
  res.cookies.set(TEMA_COOKIE, "", { ...TEMA_COOKIE_OPTIONS, maxAge: 0 });
  return res;
}
