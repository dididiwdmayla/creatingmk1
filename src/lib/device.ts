import { appPassword, lerSessaoToken } from "@/lib/auth";

/**
 * Marcador de dispositivo: id opaco persistido em cookie de primeira parte
 * NÃO-httpOnly (precisa ser lido pelo JS do login pra espelhar em
 * localStorage, e pelo VisitaTracker da demo pública pra ir no beacon) +
 * localStorage (mesma chave, ver DEVICE_STORAGE_KEY). Gravado no login do
 * Radar — sobrevive à sessão expirar/trocar de usuário no mesmo navegador,
 * então serve de sinal de "é um dispositivo do time" mesmo sem sessão
 * válida (ver classificarVisitaInterna abaixo e ARCHITECTURE.md).
 */
export const DEVICE_COOKIE = "radar_device";

export const DEVICE_COOKIE_OPTIONS = {
  httpOnly: false,
  sameSite: "lax",
  path: "/",
  maxAge: 60 * 60 * 24 * 365 * 5, // 5 anos — bem além de qualquer sessão
  secure: process.env.NODE_ENV === "production",
} as const;

/** Mesma chave nos dois lados (cookie e localStorage) — ver login/page.tsx. */
export const DEVICE_STORAGE_KEY = "radar:device";

/**
 * Mesmo formato opaco de gerarEnvioToken (./demos/envio.ts): 32 hex. Usa a
 * Web Crypto global (não `node:crypto`) — este módulo é importado tanto no
 * cliente (login/page.tsx, VisitaTracker.tsx) quanto no servidor.
 */
export function gerarDeviceId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

export function deviceIdValido(valor: string | null | undefined): valor is string {
  return typeof valor === "string" && /^[a-f0-9]{32}$/.test(valor);
}

/** Lê um cookie do header `Cookie` de um Request cru (Route Handlers não têm `request.cookies`). */
export function lerCookieDoRequest(req: Request, nome: string): string | undefined {
  const header = req.headers.get("cookie");
  if (!header) return undefined;
  for (const parte of header.split(";")) {
    const idx = parte.indexOf("=");
    if (idx === -1) continue;
    if (parte.slice(0, idx).trim() === nome) {
      return decodeURIComponent(parte.slice(idx + 1).trim());
    }
  }
  return undefined;
}

/**
 * Classificação de "interna" de uma visita à demo pública: sessão válida
 * (mesmo critério de sempre) OU marcador de dispositivo presente e com o
 * formato esperado — este último cobre exatamente o caso que motivou a
 * feature: sessão ausente/expirada/em outro navegador do mesmo dispositivo,
 * mas o marcador (de vida bem mais longa que a sessão) ainda está lá. Pura
 * o bastante pra testar sem tocar em `next/headers`.
 */
export async function classificarVisitaInterna(opts: {
  sessionCookie: string | undefined;
  deviceCookie: string | undefined;
}): Promise<boolean> {
  const secret = appPassword();
  if (secret) {
    const sessao = await lerSessaoToken(opts.sessionCookie, secret);
    if (sessao !== null) return true;
  }
  return deviceIdValido(opts.deviceCookie);
}
