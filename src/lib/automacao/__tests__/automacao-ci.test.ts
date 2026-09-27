import { execFile } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * O laço do workflow (`scripts/automacao-ci.mjs`) contra um Radar FALSO em
 * HTTP local — o processo de verdade, com as salvaguardas de verdade: teto
 * de iterações, três erros seguidos, timeout por requisição, e o finalizar
 * que sempre registra.
 */

const SCRIPT = path.resolve(__dirname, "../../../../scripts/automacao-ci.mjs");

type Resposta = { status: number; corpo?: unknown; atrasoMs?: number };
type Roteiro = Partial<Record<"planejar" | "passo" | "finalizar", Resposta[] | ((n: number) => Resposta)>>;

let servidor: http.Server;
let base: string;
let chamadas: Array<{ rota: string; corpo: Record<string, unknown>; auth?: string }>;
let roteiro: Roteiro;
let dir: string;

function responder(rota: keyof Roteiro, n: number): Resposta {
  const r = roteiro[rota];
  if (!r) return { status: 500, corpo: { error: "sem roteiro" } };
  if (typeof r === "function") return r(n);
  return r[Math.min(n, r.length - 1)];
}

beforeEach(async () => {
  chamadas = [];
  roteiro = {};
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "automacao-ci-"));
  servidor = http.createServer((req, res) => {
    let texto = "";
    req.on("data", (c) => (texto += c));
    req.on("end", () => {
      const rota = (req.url ?? "").replace("/api/automacao/", "") as keyof Roteiro;
      const n = chamadas.filter((c) => c.rota === rota).length;
      chamadas.push({ rota, corpo: texto ? JSON.parse(texto) : {}, auth: req.headers.authorization });
      const { status, corpo, atrasoMs } = responder(rota, n);
      setTimeout(() => {
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(corpo ?? {}));
      }, atrasoMs ?? 0);
    });
  });
  await new Promise<void>((resolve) => servidor.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}/`;
});

afterEach(async () => {
  servidor.closeAllConnections();
  await new Promise((resolve) => servidor.close(resolve));
  fs.rmSync(dir, { recursive: true, force: true });
});

function rodar(args: string[], env: Record<string, string> = {}): Promise<{ codigo: number; saida: string }> {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [SCRIPT, ...args, `--estado=${path.join(dir, "estado.json")}`],
      {
        env: {
          PATH: process.env.PATH ?? "",
          RADAR_URL: base,
          AUTOMACAO_SECRET: "s3gredo",
          DISPARO: "schedule",
          RUN_URL: "https://github.com/x/y/actions/runs/1",
          ...env,
        } as unknown as NodeJS.ProcessEnv,
        encoding: "utf8",
        timeout: 20_000,
      },
      (erro, stdout, stderr) => {
        const codigo = erro && typeof (erro as { code?: unknown }).code === "number" ? (erro as { code: number }).code : 0;
        resolve({ codigo, saida: stdout + stderr });
      },
    );
  });
}

const EXECUTAR = { status: 200, corpo: { acao: "executar", execucaoId: "exec-1", falta: 2, unidades: 2 } };
const FINALIZADA = { status: 200, corpo: { execucao: { estado: "concluida", demosCriadas: [], motivo: "ok" } } };

function corpoFinalizar() {
  return chamadas.find((c) => c.rota === "finalizar")?.corpo;
}

describe("scripts/automacao-ci.mjs", () => {
  it("planejar → passo até acabar → finalizar sem erro, com o Bearer do segredo", async () => {
    roteiro = {
      planejar: [EXECUTAR],
      passo: [
        { status: 200, corpo: { temTrabalho: true, unidade: { tipo: "demo", estado: "feita" } } },
        { status: 200, corpo: { temTrabalho: false, unidade: { tipo: "demo", estado: "feita" } } },
      ],
      finalizar: [FINALIZADA],
    };
    expect((await rodar(["laco"])).codigo).toBe(0);
    expect((await rodar(["finalizar", "--resultado=success"])).codigo).toBe(0);
    expect(chamadas.map((c) => c.rota)).toEqual(["planejar", "passo", "passo", "finalizar"]);
    expect(chamadas.every((c) => c.auth === "Bearer s3gredo")).toBe(true);
    expect(chamadas[0].corpo).toMatchObject({ disparo: "schedule", runUrl: expect.stringContaining("runs/1") });
    expect(corpoFinalizar()).toEqual({ execucaoId: "exec-1", disparo: "schedule", runUrl: expect.any(String) });
  });

  it("para depois de 3 erros seguidos, sai com erro e o finalizar grava a falha", async () => {
    roteiro = {
      planejar: [EXECUTAR],
      passo: [
        { status: 200, corpo: { temTrabalho: true } },
        { status: 500, corpo: { error: { code: "internal_error" } } },
      ],
      finalizar: [FINALIZADA],
    };
    expect((await rodar(["laco"])).codigo).toBe(1);
    expect(chamadas.filter((c) => c.rota === "passo")).toHaveLength(4);
    await rodar(["finalizar", "--resultado=failure"]);
    expect(corpoFinalizar()).toMatchObject({
      execucaoId: "exec-1",
      erro: expect.stringContaining("3 erros seguidos"),
    });
  });

  it("erro isolado não para o laço (o contador zera no sucesso)", async () => {
    roteiro = {
      planejar: [EXECUTAR],
      passo: (n) =>
        n === 4
          ? { status: 200, corpo: { temTrabalho: false } }
          : n % 2 === 0
            ? { status: 502, corpo: {} }
            : { status: 200, corpo: { temTrabalho: true } },
    };
    expect((await rodar(["laco"])).codigo).toBe(0);
  });

  it("timeout por requisição conta como erro", async () => {
    roteiro = { planejar: [EXECUTAR], passo: [{ status: 200, corpo: { temTrabalho: true }, atrasoMs: 1_000 }] };
    const { codigo } = await rodar(["laco"], { AUTOMACAO_TIMEOUT_MS: "150" });
    expect(codigo).toBe(1);
    roteiro.finalizar = [FINALIZADA];
    await rodar(["finalizar", "--resultado=failure"]);
    expect(corpoFinalizar()?.erro).toContain("timeout");
  });

  it("teto de iterações: para e registra o motivo", async () => {
    roteiro = { planejar: [EXECUTAR], passo: [{ status: 200, corpo: { temTrabalho: true } }], finalizar: [FINALIZADA] };
    expect((await rodar(["laco"], { AUTOMACAO_MAX_ITERACOES: "3" })).codigo).toBe(0);
    expect(chamadas.filter((c) => c.rota === "passo")).toHaveLength(3);
    await rodar(["finalizar", "--resultado=success"]);
    expect(corpoFinalizar()).toMatchObject({ motivo: "teto de 3 iterações" });
    expect(corpoFinalizar()?.erro).toBeUndefined();
  });

  it("perdeu a trava (409 no passo): para na hora, sem repetir", async () => {
    roteiro = { planejar: [EXECUTAR], passo: [{ status: 409, corpo: { error: { code: "conflict" } } }] };
    expect((await rodar(["laco"])).codigo).toBe(1);
    expect(chamadas.filter((c) => c.rota === "passo")).toHaveLength(1);
  });

  it("nada a fazer / recusada: o finalizar não chama nada", async () => {
    roteiro = { planejar: [{ status: 200, corpo: { acao: "nada", execucaoId: "e", motivo: "estoque 15 ≥ alvo 15" } }] };
    expect((await rodar(["laco"])).codigo).toBe(0);
    expect((await rodar(["finalizar", "--resultado=success"])).codigo).toBe(0);
    roteiro = { planejar: [{ status: 409, corpo: { error: { code: "conflict" } } }] };
    expect((await rodar(["laco"])).codigo).toBe(0);
    expect((await rodar(["finalizar", "--resultado=success"])).codigo).toBe(0);
    expect(chamadas.map((c) => c.rota)).toEqual(["planejar", "planejar"]);
  });

  it("planejar caiu: o finalizar grava a falha SEM execucaoId", async () => {
    roteiro = { planejar: [{ status: 500, corpo: {} }], finalizar: [FINALIZADA] };
    expect((await rodar(["laco"])).codigo).toBe(1);
    await rodar(["finalizar", "--resultado=failure"]);
    const corpo = corpoFinalizar();
    expect(corpo?.execucaoId).toBeUndefined();
    expect(corpo?.erro).toContain("planejar");
  });

  it("o laço morreu sem gravar nada (cancelado): o finalizar registra mesmo assim", async () => {
    roteiro = { finalizar: [FINALIZADA] };
    await rodar(["finalizar", "--resultado=cancelled"]);
    expect(corpoFinalizar()?.erro).toContain("cancelled");
  });

  it("laço cancelado DEPOIS do plano: finaliza a execução com o erro do resultado", async () => {
    fs.writeFileSync(path.join(dir, "estado.json"), JSON.stringify({ execucaoId: "exec-9" }));
    roteiro = { finalizar: [FINALIZADA] };
    await rodar(["finalizar", "--resultado=cancelled"]);
    expect(corpoFinalizar()).toMatchObject({ execucaoId: "exec-9", erro: expect.stringContaining("cancelled") });
  });
});
