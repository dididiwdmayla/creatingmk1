import { randomUUID } from "node:crypto";

import { ENVIO_CANAIS, type EnvioCanal, type EnvioDemo, type LeadDemo } from "./types";

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

/**
 * Garante um token vigente para CADA canal (link/whatsapp) — gera só os que
 * faltarem, preserva os já existentes (self-heal incremental; idempotente).
 * Entradas antigas sem `canal` contam como "whatsapp" (ver canalDoEnvio).
 *
 * Puro e compartilhado pelas duas famílias de demo (a do lead, em
 * `lib/leads/repo.ts`, e a avulsa, em `lib/demos/avulsas/repo.ts`): o
 * histórico de envio é do CAMPO `demo`, não de quem o hospeda.
 */
export function garantirEnviosCanais(envios: EnvioDemo[], geradoEm: string): EnvioDemo[] {
  const faltando = ENVIO_CANAIS.filter(
    (canal) => !envios.some((envio) => canalDoEnvio(envio) === canal),
  );
  if (faltando.length === 0) return envios;
  const novos = faltando.map((canal) => ({ token: gerarEnvioToken(), geradoEm, canal }));
  return [...novos, ...envios];
}

/** Falta o token vigente de algum canal? Dispara o self-heal na leitura. */
export function enviosIncompletos(demo: Pick<LeadDemo, "envios"> | undefined): boolean {
  if (!demo) return false;
  const envios = demo.envios ?? [];
  return ENVIO_CANAIS.some((canal) => !envios.some((envio) => canalDoEnvio(envio) === canal));
}

/**
 * Caminho público de uma demo — `/demo/{placeId}` para a do lead,
 * `/demo/avulsa/{id}` para a avulsa. Uma função só porque todo lugar que
 * monta link (listagem, editor, motor de capturas, `{demo}` da mensagem)
 * precisa acertar os dois casos, e um `if` espalhado por cinco arquivos é
 * como um deles fica pra trás.
 */
export function caminhoDemo(id: string, avulsa = false): string {
  return avulsa ? `/demo/avulsa/${encodeURIComponent(id)}` : `/demo/${encodeURIComponent(id)}`;
}

/** Monta a URL pública da demo, com `?t=` do token vigente quando houver. */
export function demoUrlComToken(
  origin: string,
  id: string,
  token: string | undefined,
  avulsa = false,
): string {
  const base = `${origin}${caminhoDemo(id, avulsa)}`;
  return token ? `${base}?${TOKEN_QUERY_PARAM}=${token}` : base;
}
