import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { criarDemoAvulsa, getDemoAvulsa } from "@/lib/demos/avulsas/repo";
import { DEFAULT_SKIN } from "@/lib/demos/registry";
import { FakeFirestore } from "@/lib/testing/fake-firestore";

import { enfileirarCapturas, estadoDasCapturas } from "../enfileirar";

/**
 * A fila de capturas serve as duas famílias de demo. O que este arquivo
 * garante é que o alvo prefixado leva o estado para o doc CERTO — e que
 * um lote misto (lead + avulsa) não escreve um por cima do outro.
 */

let db: FakeFirestore;
const dispatches: Array<{ leads: string[]; execucao: string }> = [];

vi.mock("@/lib/github/dispatch", () => ({
  dispararCapturas: vi.fn(async (payload: { leads: string[]; execucao: string }) => {
    dispatches.push(payload);
  }),
}));

const CONFIG = { skinId: DEFAULT_SKIN.id, themeId: DEFAULT_SKIN.themeDefault.id };

beforeEach(() => {
  db = new FakeFirestore();
  dispatches.length = 0;
  db.seed("leads/A", {
    placeId: "A",
    nome: "Lead com demo",
    status: "novo",
    enriquecido: false,
    demo: { ...CONFIG, dados: {}, criadoEm: "2026-08-01T00:00:00.000Z", atualizadoEm: "2026-08-01T00:00:00.000Z" },
    criadoEm: "2026-08-01T00:00:00.000Z",
    atualizadoEm: "2026-08-01T00:00:00.000Z",
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

async function criarAvulsa() {
  return criarDemoAvulsa(db, { nome: "Barbearia Avulsa" }, CONFIG);
}

describe("enfileirarCapturas com alvo de demo avulsa", () => {
  it("marca o estado no doc da avulsa, não em /leads", async () => {
    const avulsa = await criarAvulsa();

    const resultado = await enfileirarCapturas(db, [`avulsa:${avulsa.id}`], { userId: "u1" });

    expect(resultado.enfileirados).toEqual([`avulsa:${avulsa.id}`]);
    const depois = (await getDemoAvulsa(db, avulsa.id))!;
    expect(depois.capturas).toMatchObject({ estado: "enfileirado", pedidoPor: "u1" });
    expect(db.getDoc("leads/A")?.capturas).toBeUndefined();
  });

  it("dispara o workflow com o alvo prefixado", async () => {
    const avulsa = await criarAvulsa();
    await enfileirarCapturas(db, [`avulsa:${avulsa.id}`]);
    expect(dispatches[0].leads).toEqual([`avulsa:${avulsa.id}`]);
  });

  it("lote misto marca cada doc na sua coleção", async () => {
    const avulsa = await criarAvulsa();

    await enfileirarCapturas(db, ["A", `avulsa:${avulsa.id}`]);

    expect(db.getDoc("leads/A")?.capturas).toMatchObject({ estado: "enfileirado" });
    expect((await getDemoAvulsa(db, avulsa.id))!.capturas).toMatchObject({
      estado: "enfileirado",
    });
  });

  it("avulsa inexistente é pulada, não derruba o resto do lote", async () => {
    const resultado = await enfileirarCapturas(db, ["avulsa:nao-existe", "A"]);
    expect(resultado.pulados).toEqual([{ placeId: "avulsa:nao-existe", motivo: "não encontrado" }]);
    expect(resultado.enfileirados).toEqual(["A"]);
  });

  it("alvo malformado é pulado com motivo próprio", async () => {
    const resultado = await enfileirarCapturas(db, ["avulsa:", "A"]);
    expect(resultado.pulados).toEqual([{ placeId: "avulsa:", motivo: "id inválido" }]);
  });

  it("já gerando é pulado, e --forcar atropela", async () => {
    const avulsa = await criarAvulsa();
    await enfileirarCapturas(db, [`avulsa:${avulsa.id}`]);

    const semForcar = await enfileirarCapturas(db, [`avulsa:${avulsa.id}`]);
    expect(semForcar.pulados[0].motivo).toBe("já está gerando");

    const comForcar = await enfileirarCapturas(db, [`avulsa:${avulsa.id}`], { forcar: true });
    expect(comForcar.enfileirados).toHaveLength(1);
  });

  it("falha no disparo desfaz o estado da avulsa", async () => {
    const { dispararCapturas } = await import("@/lib/github/dispatch");
    vi.mocked(dispararCapturas).mockRejectedValueOnce(new Error("token venceu"));
    const avulsa = await criarAvulsa();

    await expect(enfileirarCapturas(db, [`avulsa:${avulsa.id}`])).rejects.toThrow("token venceu");

    expect((await getDemoAvulsa(db, avulsa.id))!.capturas).toMatchObject({
      estado: "falhou",
      erro: "token venceu",
    });
  });
});

describe("estadoDasCapturas", () => {
  it("responde na chave do alvo COMO VEIO, com prefixo e tudo", async () => {
    const avulsa = await criarAvulsa();
    await enfileirarCapturas(db, ["A", `avulsa:${avulsa.id}`]);

    const estado = await estadoDasCapturas(db, ["A", `avulsa:${avulsa.id}`]);
    expect(Object.keys(estado).sort()).toEqual(["A", `avulsa:${avulsa.id}`].sort());
    expect(estado[`avulsa:${avulsa.id}`]).toMatchObject({ estado: "enfileirado" });
  });

  it("alvo sem geração devolve null", async () => {
    expect(await estadoDasCapturas(db, ["avulsa:nao-existe"])).toEqual({
      "avulsa:nao-existe": null,
    });
  });
});
