import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { jsonError } from "@/lib/http";

/**
 * Autenticação das rotas /api/fila/* (o celular Android com MacroDroid,
 * único chamador — sem cookie, sem sessão). Segredo PRÓPRIO
 * (`RADAR_DEVICE_KEY`), nunca o `CRON_SECRET`: raios de explosão
 * diferentes — o cron dispara buscas pagas, o celular dispara mensagens de
 * WhatsApp para negócios reais.
 *
 * Comparação em tempo constante: o header errado por 1 caractere não pode
 * responder mais rápido que o certo. Corpo do 401 é `{ erro: "..." }` —
 * formato próprio desta fila, não o `{ error: { code, message } }` do
 * resto do app (o executor no celular só precisa checar uma chave).
 */

function compararEmTempoConstante(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Gasta o tempo de uma comparação mesmo assim — não vaza o tamanho da
    // chave por timing.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/**
 * Confere o header `Authorization: Bearer ${RADAR_DEVICE_KEY}`. Devolve
 * `null` quando autenticado; caso contrário já devolve a `NextResponse`
 * pronta para a rota retornar (fail-closed: sem a env configurada, 503).
 */
export function autenticarDispositivo(req: Request): NextResponse | null {
  const chave = process.env.RADAR_DEVICE_KEY;
  if (!chave) {
    return jsonError(
      503,
      "config_error",
      "RADAR_DEVICE_KEY não configurada no servidor (ver .env.example).",
    );
  }

  const auth = req.headers.get("authorization") ?? "";
  if (!compararEmTempoConstante(auth, `Bearer ${chave}`)) {
    return NextResponse.json({ erro: "nao_autorizado" }, { status: 401 });
  }

  return null;
}
