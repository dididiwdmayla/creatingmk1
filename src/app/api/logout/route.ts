import { NextResponse } from "next/server";

import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/auth";

/** Encerra a sessão limpando o cookie. Idempotente, sem corpo de entrada. */
export async function POST() {
  const res = new NextResponse(null, { status: 204 });
  res.cookies.set(SESSION_COOKIE, "", { ...SESSION_COOKIE_OPTIONS, maxAge: 0 });
  return res;
}
