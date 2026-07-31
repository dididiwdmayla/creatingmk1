import { randomUUID } from "node:crypto";

import type { EnvioDemo, LeadDemo } from "./types";

/** Nome do query param que carrega o token na URL pública da demo. */
export const TOKEN_QUERY_PARAM = "t";

/** Token opaco, curto o bastante pra URL mas sem colisão prática. */
export function gerarEnvioToken(): string {
  return randomUUID().replace(/-/g, "");
}

/** Envio vigente (o mais recente) — undefined se nunca gerado. */
export function envioVigente(demo: Pick<LeadDemo, "envios"> | undefined): EnvioDemo | undefined {
  return demo?.envios?.[0];
}

/** Monta a URL pública da demo, com `?t=` do token vigente quando houver. */
export function demoUrlComToken(origin: string, leadId: string, token: string | undefined): string {
  const base = `${origin}/demo/${leadId}`;
  return token ? `${base}?${TOKEN_QUERY_PARAM}=${token}` : base;
}
