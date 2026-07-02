/**
 * Sessão simples por senha única (decisão registrada no ARCHITECTURE.md):
 * o cookie guarda o SHA-256 da senha de APP_PASSWORD — trocar a senha
 * invalida todas as sessões. Sem expiração além do maxAge do cookie.
 *
 * Usa só Web Crypto para funcionar em qualquer runtime (Node ou Edge).
 */

export const SESSION_COOKIE = "radar_session";

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  maxAge: 60 * 60 * 24 * 30, // 30 dias
  secure: process.env.NODE_ENV === "production",
} as const;

export function appPassword(): string | undefined {
  return process.env.APP_PASSWORD || undefined;
}

export async function sessionTokenFor(password: string): Promise<string> {
  const data = new TextEncoder().encode(`radar-session:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
