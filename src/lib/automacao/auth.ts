import type { NextResponse } from "next/server";

import { jsonError } from "@/lib/http";
import { compararEmTempoConstante } from "@/lib/seguranca";

/**
 * Autenticação das rotas `/api/automacao/{planejar,passo,finalizar}` — o
 * único chamador é o workflow do GitHub Actions (`automacao.yml`), sem
 * cookie nem sessão.
 *
 * Segredo PRÓPRIO, `AUTOMACAO_SECRET`. Nunca a `RADAR_DEVICE_KEY` (é a do
 * celular, que manda mensagem para negócio real) e nunca o `CRON_SECRET`:
 * este segredo mora TAMBÉM no GitHub, e precisa poder ser revogado sem
 * derrubar o cron da Vercel. Cada segredo, o seu raio de explosão.
 *
 * Fail-closed: sem a env, 503 e nada roda. Comparação em tempo constante,
 * como os outros segredos do app.
 */
export function autenticarAutomacao(req: Request): NextResponse | null {
  const segredo = process.env.AUTOMACAO_SECRET;
  if (!segredo) {
    return jsonError(
      503,
      "config_error",
      "AUTOMACAO_SECRET não configurada no servidor (ver .env.example).",
    );
  }
  const auth = req.headers.get("authorization") ?? "";
  if (!compararEmTempoConstante(auth, `Bearer ${segredo}`)) {
    return jsonError(401, "unauthorized", "AUTOMACAO_SECRET inválido ou ausente.");
  }
  return null;
}
