import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_FILA_CONFIG } from "@/lib/fila/config";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";
import { PUT as putConfigFila } from "../config/fila/route";
import { POST } from "../fila/pausar/route";

/**
 * `POST /api/fila/pausar` — rota ESTREITA: o alcance da `RADAR_DEVICE_KEY`
 * (uma variável do MacroDroid, num celular que sai de casa) é liga/desliga,
 * nunca reconfiguração. O que estes testes protegem: escreve só `ativo`
 * (+ os dois campos de auditoria), é idempotente por VALOR (nunca toggle,
 * porque a macro pode reenviar o POST se a rede cair), e nunca estoura uma
 * edição concorrente do admin em outro campo.
 */

const CHAVE = "chave-do-celular";

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

beforeEach(() => {
  db = new FakeFirestore();
  vi.stubEnv("RADAR_DEVICE_KEY", CHAVE);
  vi.stubEnv("APP_PASSWORD", "segredo123");
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-03-10T10:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

function pausar(body: unknown, headers: Record<string, string> = { authorization: `Bearer ${CHAVE}` }) {
  return POST(
    new Request("http://localhost/api/fila/pausar", {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/fila/pausar — autenticação", () => {
  it("sem a chave correta devolve 401", async () => {
    const res = await pausar({ ativo: false }, { authorization: "Bearer errada" });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ erro: "nao_autorizado" });
  });

  it("sem header nenhum devolve 401", async () => {
    expect((await pausar({ ativo: false }, {})).status).toBe(401);
  });
});

describe("POST /api/fila/pausar — corpo", () => {
  it("exige o valor EXPLÍCITO — corpo vazio é 400", async () => {
    const res = await pausar({});
    expect(res.status).toBe(400);
    const corpo = await res.json();
    expect(corpo.erro).not.toBe("");
    expect(corpo.alterado).toBe(false);
  });

  it("ativo não booleano é 400", async () => {
    const res = await pausar({ ativo: "false" });
    expect(res.status).toBe(400);
  });

  it("400 não escreve nada em config/fila", async () => {
    await pausar({ ativo: "sim" });
    expect(db.getDoc("config/fila")).toBeUndefined();
  });
});

describe("POST /api/fila/pausar — liga/desliga", () => {
  it("desliga a fila ativa (default) e registra quem mudou", async () => {
    const res = await pausar({ ativo: false });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ativo: false, alterado: true, erro: "" });
    expect(db.getDoc("config/fila")).toMatchObject({
      ativo: false,
      ativoAlteradoPor: "dispositivo",
      ativoAlteradoEm: new Date("2026-03-10T10:00:00Z").toISOString(),
    });
  });

  it("religa a fila", async () => {
    db.seed("config/fila", { ativo: false });

    const res = await pausar({ ativo: true });

    expect(await res.json()).toEqual({ ativo: true, alterado: true, erro: "" });
    expect(db.getDoc("config/fila")).toMatchObject({ ativo: true, ativoAlteradoPor: "dispositivo" });
  });

  it("mandar o mesmo valor que já está NÃO escreve nada (alterado: false)", async () => {
    // ativo já é `true` por default — mandar `true` de novo é o reenvio da
    // macro depois de a rede cair, e não pode desligar o que já ligou.
    const res = await pausar({ ativo: true });

    expect(await res.json()).toEqual({ ativo: true, alterado: false, erro: "" });
    expect(db.getDoc("config/fila")).toBeUndefined();
  });

  it("reenviar o mesmo POST duas vezes: a segunda não altera nada", async () => {
    await pausar({ ativo: false });
    const antes = db.getDoc("config/fila");

    const segunda = await pausar({ ativo: false });

    expect(await segunda.json()).toEqual({ ativo: false, alterado: false, erro: "" });
    expect(db.getDoc("config/fila")).toEqual(antes);
  });
});

describe("POST /api/fila/pausar — nunca toca em nenhum outro campo", () => {
  it("não escreve meta, tetos, janela nem numeroTeste", async () => {
    db.seed("config/fila", {
      ativo: true,
      metaDiaria: 42,
      tetoPorHora: 7,
      exigirJanelaBoa: false,
      nichosPermitidos: ["tatuagem"],
      intervaloMinimoSegundos: 999,
      numeroTeste: "5511999999999",
    });

    await pausar({ ativo: false });

    expect(db.getDoc("config/fila")).toMatchObject({
      ativo: false,
      metaDiaria: 42,
      tetoPorHora: 7,
      exigirJanelaBoa: false,
      nichosPermitidos: ["tatuagem"],
      intervaloMinimoSegundos: 999,
      numeroTeste: "5511999999999",
    });
  });

  it("NUNCA reusa saveFilaConfig: um PUT de admin entre a leitura e a escrita não é estourado", async () => {
    // saveFilaConfig grava o doc INTEIRO com `set` — se pausar lesse a
    // config e regravasse por ali, uma edição do admin feita "ao lado"
    // (aqui, sequencialmente antes da escrita de pausar) seria perdida.
    // Como pausar faz merge dirigido a `ativo` só, a edição do admin
    // sobrevive.
    const cookie = await cookieDeSessao(db, { id: "admin-1", papel: "admin" });
    await putConfigFila(
      new Request("http://localhost/api/config/fila", {
        method: "PUT",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ metaDiaria: 77, nichosPermitidos: ["barbearia"] }),
      }),
    );

    await pausar({ ativo: false });

    expect(db.getDoc("config/fila")).toMatchObject({
      ativo: false,
      metaDiaria: 77,
      nichosPermitidos: ["barbearia"],
    });
  });
});

describe("POST /api/fila/pausar — forma da resposta", () => {
  it("as três chaves sempre presentes, mesmo no erro", async () => {
    const sucesso = await (await pausar({ ativo: false })).json();
    expect(Object.keys(sucesso).sort()).toEqual(["alterado", "ativo", "erro"]);

    const erro = await (await pausar({})).json();
    expect(Object.keys(erro).sort()).toEqual(["alterado", "ativo", "erro"]);
  });
});

describe("POST /api/fila/pausar — auditoria coerente com PUT /api/config/fila", () => {
  it("a rota de admin grava os mesmos dois campos, com o userId em vez de 'dispositivo'", async () => {
    const cookie = await cookieDeSessao(db, { id: "admin-1", papel: "admin" });
    await putConfigFila(
      new Request("http://localhost/api/config/fila", {
        method: "PUT",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ ativo: false }),
      }),
    );

    expect(db.getDoc("config/fila")).toMatchObject({
      ativo: false,
      ativoAlteradoPor: "admin-1",
    });

    // O dispositivo pausa de novo depois — o carimbo passa a ser dele.
    vi.setSystemTime(new Date("2026-03-10T11:00:00Z"));
    await pausar({ ativo: true });

    expect(db.getDoc("config/fila")).toMatchObject({
      ativo: true,
      ativoAlteradoPor: "dispositivo",
      ativoAlteradoEm: "2026-03-10T11:00:00.000Z",
    });
  });
});

describe("GET /api/config/fila — os defaults incluem os campos de auditoria", () => {
  it("nunca alterado ainda: ambos null", () => {
    expect(DEFAULT_FILA_CONFIG.ativoAlteradoPor).toBeNull();
    expect(DEFAULT_FILA_CONFIG.ativoAlteradoEm).toBeNull();
  });
});
