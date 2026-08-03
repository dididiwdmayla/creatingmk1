/**
 * Sobe o app REAL (`next build && next start`) com um APP_PASSWORD efêmero
 * e devolve o cookie de sessão assinado com esse mesmo segredo — o proxy
 * (Edge) só verifica a assinatura HMAC, nunca o Firestore (ver
 * src/lib/auth.ts + src/proxy.ts), então as rotas-harness /interno/* abrem
 * sem banco, sem lead e sem demo salva.
 *
 * Extraído de qa-visual.mjs quando qa-aura.mjs passou a precisar do mesmo
 * arranque: dois laços com a mesma cunhagem de cookie divergiriam no dia em
 * que o esquema de assinatura mudasse, e a guarda de "sessão recusada"
 * (capturas que viram tela de login sem ninguém perceber) vale pros dois.
 */
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const SAIDA = path.join(RAIZ, "qa-shots");
/** Chromium do ambiente: a versão que o playwright-core espera não é a instalada. */
export const CHROMIUM = process.env.QA_CHROMIUM ?? "/opt/pw-browsers/chromium";

/** Mesmo esquema de assinatura de src/lib/auth.ts#criarSessaoToken. */
export function criarSessaoToken({ userId, papel, versao }, secret) {
  const payload = `${userId}.${papel}.${versao}`;
  const sig = crypto
    .createHmac("sha256", `radar-session:${secret}`)
    .update(payload)
    .digest("hex");
  return `${payload}.${sig}`;
}

function executar(comando, argumentos, env) {
  return new Promise((resolve, reject) => {
    const p = spawn(comando, argumentos, { cwd: RAIZ, env, stdio: "inherit" });
    p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${comando} saiu com ${code}`))));
    p.on("error", reject);
  });
}

/**
 * O segredo de sessão é sorteado a cada rodada: um servidor sobrando de uma
 * rodada anterior ainda ocupando a porta aceitaria a conexão e recusaria o
 * cookie novo — capturas viram tela de login. Falha aqui, antes de subir.
 */
async function exigirPortaLivre(base, porta) {
  try {
    await fetch(base, { redirect: "manual" });
  } catch {
    return;
  }
  throw new Error(
    `porta ${porta} já ocupada (servidor de uma rodada anterior?). Encerre-o ou use QA_PORTA=<outra>.`,
  );
}

async function esperarServidor(url, timeoutMs = 120000) {
  const limite = Date.now() + timeoutMs;
  while (Date.now() < limite) {
    try {
      // Qualquer resposta HTTP serve: 307 pro /login já prova que o Next subiu.
      await fetch(url, { redirect: "manual" });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`servidor não respondeu em ${url}`);
}

/**
 * Sobe o servidor e devolve `{ base, secret, cookie, encerrar }`. `encerrar`
 * já está registrado em `process.on("exit")`/SIGINT — chamar de novo no
 * `finally` do laço é idempotente.
 */
export async function subirServidor({ porta = Number(process.env.QA_PORTA ?? 3123), build = true } = {}) {
  const base = `http://127.0.0.1:${porta}`;
  const secret = crypto.randomBytes(16).toString("hex");
  const env = { ...process.env, APP_PASSWORD: secret, PORT: String(porta), NODE_ENV: undefined };

  await exigirPortaLivre(base, porta);
  if (build) await executar("npx", ["next", "build"], env);

  const servidor = spawn("npx", ["next", "start", "-p", String(porta)], {
    cwd: RAIZ,
    env,
    stdio: ["ignore", "inherit", "inherit"],
    detached: true, // grupo próprio, pra `encerrar` levar o filho junto
  });
  // `next start` deixa um filho (o servidor de verdade) que sobrevive ao
  // SIGTERM do wrapper — mata o grupo inteiro, senão a porta fica presa.
  const encerrar = () => {
    try {
      process.kill(-servidor.pid, "SIGTERM");
    } catch {
      servidor.kill("SIGTERM");
    }
  };
  process.on("exit", encerrar);
  process.on("SIGINT", () => {
    encerrar();
    process.exit(130);
  });

  await esperarServidor(base);
  return {
    base,
    secret,
    encerrar,
    cookie: {
      name: "radar_session",
      value: criarSessaoToken({ userId: "qa", papel: "admin", versao: 1 }, secret),
      url: base,
    },
  };
}
