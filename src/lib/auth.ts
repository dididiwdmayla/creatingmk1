/**
 * Sessão multiusuário por cookie ASSINADO (sem estado no banco): o valor
 * carrega `userId.papel.versao` + HMAC-SHA256 com APP_PASSWORD como
 * segredo — o proxy (Edge) verifica a assinatura sem tocar no Firestore,
 * e as rotas API ainda conferem o doc do usuário (ativo + versão de
 * sessão) antes de atribuir ações. Trocar APP_PASSWORD invalida todas as
 * sessões; redefinir a senha/desativar um usuário incrementa a `versao`
 * dele e derruba só as sessões dele.
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

/** Papéis possíveis dentro do token (espelha lib/usuarios/types.ts). */
export type SessaoPapel = "admin" | "membro";

export interface Sessao {
  userId: string;
  papel: SessaoPapel;
  /** Versão de sessão do usuário no momento do login (revogação barata). */
  versao: number;
}

export function appPassword(): string | undefined {
  return process.env.APP_PASSWORD || undefined;
}

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function assinar(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`radar-session:${secret}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
}

/**
 * Token: `{userId}.{papel}.{versao}.{assinatura}`. IDs de usuário nunca
 * contêm "." (são "admin"/"membro-N" do seed ou UUIDs) — o parse por
 * split é seguro.
 */
export async function criarSessaoToken(sessao: Sessao, secret: string): Promise<string> {
  const payload = `${sessao.userId}.${sessao.papel}.${sessao.versao}`;
  return `${payload}.${await assinar(payload, secret)}`;
}

/** Verifica e decodifica o token; qualquer defeito (inclusive cookies do formato antigo) → null. */
export async function lerSessaoToken(
  token: string | undefined,
  secret: string,
): Promise<Sessao | null> {
  if (!token) return null;
  const partes = token.split(".");
  if (partes.length !== 4) return null;
  const [userId, papel, versaoRaw, sig] = partes;
  if (!userId || (papel !== "admin" && papel !== "membro")) return null;
  const versao = Number(versaoRaw);
  if (!Number.isInteger(versao) || versao < 0) return null;

  const esperado = await assinar(`${userId}.${papel}.${versaoRaw}`, secret);
  if (sig.length !== esperado.length) return null;
  // Comparação sem curto-circuito (evita vazar prefixo por timing).
  let diff = 0;
  for (let i = 0; i < esperado.length; i++) {
    diff |= sig.charCodeAt(i) ^ esperado.charCodeAt(i);
  }
  if (diff !== 0) return null;

  return { userId, papel, versao };
}
