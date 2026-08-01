import { randomUUID } from "node:crypto";

import type { EnvioCanal, EnvioDemo, LeadDemo } from "./types";

/** Nome do query param que carrega o token na URL pública da demo. */
export const TOKEN_QUERY_PARAM = "t";

/** Token opaco, curto o bastante pra URL mas sem colisão prática. */
export function gerarEnvioToken(): string {
  return randomUUID().replace(/-/g, "");
}

/**
 * Canal de um envio, com fallback pra entradas gravadas antes do campo
 * `canal` existir — tratadas como `"whatsapp"` (o único canal que de fato
 * usava token antes desta feature; ver EnvioDemo.canal).
 */
export function canalDoEnvio(envio: EnvioDemo): EnvioCanal {
  return envio.canal ?? "whatsapp";
}

/** Envio vigente (o mais recente) DE UM CANAL — undefined se nunca gerado. */
export function envioVigente(
  demo: Pick<LeadDemo, "envios"> | undefined,
  canal: EnvioCanal,
): EnvioDemo | undefined {
  return demo?.envios?.find((envio) => canalDoEnvio(envio) === canal);
}

/** Monta a URL pública da demo, com `?t=` do token vigente quando houver. */
export function demoUrlComToken(origin: string, leadId: string, token: string | undefined): string {
  const base = `${origin}/demo/${leadId}`;
  return token ? `${base}?${TOKEN_QUERY_PARAM}=${token}` : base;
}
