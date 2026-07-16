import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_SKIN } from "@/lib/demos/registry";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { PUT } from "../leads/[id]/demo/route";

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

beforeEach(() => {
  db = new FakeFirestore();
  db.seed("leads/A", {
    placeId: "A",
    nome: "Barbearia do Zé",
    endereco: "Av. Brasil, 100",
    status: "novo",
    enriquecido: false,
    notas: "ligar depois das 18h",
    criadoEm: "2026-07-01T00:00:00.000Z",
    atualizadoEm: "2026-07-01T00:00:00.000Z",
  });
});

function put(id: string, body: unknown): Promise<Response> {
  return PUT(
    new Request(`http://localhost/api/leads/${id}/demo`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
}

const VALIDO = {
  skinId: DEFAULT_SKIN.id,
  themeId: DEFAULT_SKIN.themeDefault.id,
  dados: { slogan: "Tradição desde 1998.", horarios: "Seg a sáb, 9h às 21h" },
};

describe("PUT /api/leads/[id]/demo", () => {
  it("salva skin, tema e overrides no campo demo do lead", async () => {
    const res = await put("A", VALIDO);

    expect(res.status).toBe(200);
    const { lead } = await res.json();
    expect(lead.demo.skinId).toBe(DEFAULT_SKIN.id);
    expect(lead.demo.themeId).toBe(DEFAULT_SKIN.themeDefault.id);
    expect(lead.demo.dados).toEqual(VALIDO.dados);
    expect(lead.demo.atualizadoEm).toBeTruthy();
    // Nada mais do lead é tocado.
    expect(lead.notas).toBe("ligar depois das 18h");
    expect(lead.status).toBe("novo");
  });

  it("aceita dados vazio/ausente (demo só com defaults do template)", async () => {
    const res = await put("A", { skinId: VALIDO.skinId, themeId: VALIDO.themeId });

    expect(res.status).toBe(200);
    const { lead } = await res.json();
    expect(lead.demo.dados).toEqual({});
  });

  it("404 para lead inexistente", async () => {
    const res = await put("nao-existe", VALIDO);

    expect(res.status).toBe(404);
  });

  it("400 para skinId desconhecido", async () => {
    const res = await put("A", { ...VALIDO, skinId: "skin-fantasma" });

    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.problemas.join(" ")).toContain("skinId desconhecido");
  });

  it("400 para themeId fora dos presets da skin", async () => {
    const res = await put("A", { ...VALIDO, themeId: "tema-fantasma" });

    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.problemas.join(" ")).toContain("não é preset da skin");
  });

  it("400 para chave desconhecida em dados (pega typo)", async () => {
    const res = await put("A", { ...VALIDO, dados: { sloogan: "typo" } });

    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.problemas.join(" ")).toContain("dados.sloogan");
  });

  it("400 para depoimento com nota fora de 1–5", async () => {
    const res = await put("A", {
      ...VALIDO,
      dados: { depoimentos: [{ autor: "X", texto: "ok", nota: 9 }] },
    });

    expect(res.status).toBe(400);
  });

  it("regrava a demo por inteiro (PUT é substituição, não merge)", async () => {
    await put("A", VALIDO);
    const res = await put("A", {
      skinId: VALIDO.skinId,
      themeId: VALIDO.themeId,
      dados: { nome: "Zé Premium" },
    });

    const { lead } = await res.json();
    expect(lead.demo.dados).toEqual({ nome: "Zé Premium" });
  });
});
