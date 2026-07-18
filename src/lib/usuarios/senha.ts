/**
 * Hash de senha com PBKDF2 (Web Crypto — roda em Node e Edge, sem
 * dependência nova). Formato armazenado: "pbkdf2:{iterações}:{salt}:{hash}"
 * (hex) — as iterações ficam no próprio hash, então dá para aumentá-las no
 * futuro sem invalidar senhas antigas.
 */

const ITERACOES = 100_000;

function hex(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Array.from(view)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function deHex(texto: string): Uint8Array {
  const out = new Uint8Array(texto.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(texto.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

async function derivar(senha: string, salt: Uint8Array, iteracoes: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(senha),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations: iteracoes },
    key,
    256,
  );
  return hex(bits);
}

export async function hashSenha(senha: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2:${ITERACOES}:${hex(salt)}:${await derivar(senha, salt, ITERACOES)}`;
}

/** Senha confere com o hash armazenado? Hash ausente/malformado → false. */
export async function verificarSenha(
  senha: string,
  senhaHash: string | undefined,
): Promise<boolean> {
  if (!senhaHash) return false;
  const partes = senhaHash.split(":");
  if (partes.length !== 4 || partes[0] !== "pbkdf2") return false;
  const iteracoes = Number(partes[1]);
  if (!Number.isInteger(iteracoes) || iteracoes < 1) return false;

  const esperado = partes[3];
  const obtido = await derivar(senha, deHex(partes[2]), iteracoes);
  if (obtido.length !== esperado.length) return false;
  let diff = 0;
  for (let i = 0; i < esperado.length; i++) {
    diff |= obtido.charCodeAt(i) ^ esperado.charCodeAt(i);
  }
  return diff === 0;
}
