/**
 * Laço de captura do EDITOR (não da rota pública): abre
 * /leads/{id}/demo/editar com um efeito ativo, DIGITA num campo de texto
 * enquanto captura, e reporta por efeito:
 *
 *   - a contagem de <style> do efeito no DOM do preview, antes e depois de
 *     digitar (a hipótese de acúmulo por remontagem);
 *   - os quadros por segundo do preview enquanto se digita (o travamento);
 *   - um PNG do editor inteiro tirado NO MEIO da digitação.
 *
 * Ao contrário de `qa-visual.mjs` (que mira `/interno/demo-qa` e não
 * precisa de banco), este laço abre o EDITOR de verdade, e o editor lê o
 * lead do Firestore. Como o repo não tem — nem quer — um caminho de banco
 * falso commitado (princípio 2: todo acesso ao Firestore é server-side via
 * firebase-admin, um único ponto de entrada), rodar isto exige um patch
 * TEMPORÁRIO, aplicado e revertido na mesma sessão:
 *
 *   1. em `src/lib/firebase/admin.ts`, no topo de `getDb()`:
 *
 *        if (process.env.RADAR_FAKE_DB === "1") {
 *          return require("@/lib/testing/qa-fake-db").getFakeDb();
 *        }
 *
 *   2. `src/lib/testing/qa-fake-db.ts`: um `FakeFirestore` (o fake dos
 *      testes, `lib/testing/fake-firestore.ts`) com o mapa de docs lido e
 *      gravado num JSON de /tmp a cada operação. Backed por ARQUIVO, e não
 *      um singleton em memória, porque o build de produção separa cada
 *      route handler no seu próprio bundle — um módulo em memória não é
 *      compartilhado entre rotas (mesma armadilha registrada na rodada do
 *      token de envio por canal).
 *
 *   3. `npx next build` e rodar isto. O script semeia o lead sozinho.
 *
 * Ver ARCHITECTURE.md, "Rodada efeitos travando o editor".
 */
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const PORTA = Number(process.env.QA_PORTA ?? 3190);
const BASE = `http://127.0.0.1:${PORTA}`;
const SEGREDO = "qa-secret";
const SAIDA = "qa-shots";
const EFEITOS = process.env.QA_EFEITOS?.split(",") ?? [
  "gradiente",
  "veios",
  "geometrico-pulsante",
  "aura",
  "grao",
];
const MARCA = process.env.QA_MARCA ? `-${process.env.QA_MARCA}` : "";

const tok = (p, s) => {
  const pl = `${p.userId}.${p.papel}.${p.versao}`;
  return `${pl}.${crypto.createHmac("sha256", `radar-session:${s}`).update(pl).digest("hex")}`;
};
async function esperar(u, ms = 120000) {
  const l = Date.now() + ms;
  while (Date.now() < l) {
    try {
      await fetch(u, { redirect: "manual" });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  throw new Error("servidor não subiu");
}
function semear(tema) {
  const a = new Date().toISOString();
  fs.writeFileSync(
    process.env.RADAR_FAKE_DB_FILE ?? "/tmp/radar-fake-db.json",
    JSON.stringify({
      "leads/lead-qa": {
        placeId: "lead-qa",
        nome: "Barbearia Norte",
        endereco: "Rua das Tesouras, 100 - Porto Alegre, RS, Brasil",
        status: "novo",
        enriquecido: false,
        telefone: "(51) 99999-0000",
        telefoneIntl: "5551999990000",
        criadoEm: a,
        atualizadoEm: a,
        demo: {
          skinId: "barbearia-editorial",
          themeId: "norte",
          dados: {},
          tema,
          criadoEm: a,
          atualizadoEm: a,
        },
      },
    }),
  );
}

const server = spawn("npx", ["next", "start", "-p", String(PORTA)], {
  cwd: process.cwd(),
  env: { ...process.env, RADAR_FAKE_DB: "1", APP_PASSWORD: SEGREDO, NODE_ENV: "production" },
  stdio: ["ignore", "ignore", "inherit"],
  detached: true,
});
let browser;
try {
  await esperar(BASE);
  fs.mkdirSync(SAIDA, { recursive: true });
  browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  await ctx.addCookies([
    {
      name: "radar_session",
      value: tok({ userId: "admin", papel: "admin", versao: 1 }, SEGREDO),
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
  const page = await ctx.newPage();
  const erros = [];
  page.on("pageerror", (e) => erros.push(String(e).slice(0, 160)));

  for (const efeito of EFEITOS) {
    semear({
      fundoEfeito: efeito,
      fundoEfeitoIntensidade: 3,
      efeitoCores: { modo: "arco-iris" },
      ledCores: { modo: "arco-iris" },
      led: "marcante",
      ledEstilo: "barra",
    });
    erros.length = 0;
    await page.goto(`${BASE}/leads/lead-qa/demo/editar`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2800);
    const frame = page.frames().find((f) => f.url().includes("/demo-preview"));

    const contar = () =>
      frame.evaluate(() => {
        const styles = [...document.querySelectorAll("style")];
        const conta = (re) => styles.filter((s) => re.test(s.textContent ?? "")).length;
        return {
          coresEfeito: conta(/@keyframes\s+d-cores-efeito/),
          propertyEfeito: conta(/@property\s+--d-efeito-c1/),
          efeitoProprio: conta(/@keyframes\s+d-efeito-/),
          coresLed: conta(/@keyframes\s+d-cores-led/),
          ledEdges: conta(/\.d-led-edges/),
          total: styles.length,
        };
      });

    const antes = await contar();
    await frame.evaluate(() => {
      window.__n = 0;
      window.__t0 = performance.now();
      const p = () => {
        window.__n++;
        window.__raf = requestAnimationFrame(p);
      };
      window.__raf = requestAnimationFrame(p);
    });

    // Digita num campo de texto do painel; a captura sai NO MEIO disso.
    const campo = page.locator("#campo-slogan");
    await campo.click();
    await campo.press("Control+a");
    await campo.type("Oficio, tesoura e navalha, ", { delay: 55 });
    await page.screenshot({ path: path.join(SAIDA, `editor-${efeito}${MARCA}.png`) });
    await campo.type("sem fila e sem pressa", { delay: 55 });

    const fps = await frame.evaluate(() => {
      cancelAnimationFrame(window.__raf);
      return +(window.__n / ((performance.now() - window.__t0) / 1000)).toFixed(1);
    });
    const depois = await contar();
    const chaves = Object.keys(antes);
    const acumulou = chaves.filter((k) => depois[k] > antes[k]);
    console.log(
      `${efeito.padEnd(20)} fps=${String(fps).padStart(5)}  ` +
        `<style> antes=${JSON.stringify(antes)} depois=${JSON.stringify(depois)}` +
        (acumulou.length ? `  ACUMULOU: ${acumulou}` : "  (nada acumulou)") +
        (erros.length ? `  ERROS: ${erros}` : ""),
    );
  }
} finally {
  if (browser) await browser.close();
  try {
    process.kill(-server.pid, "SIGKILL");
  } catch {}
}
