import { beforeEach, describe, expect, it, vi } from "vitest";

import { BUSCA_CORES } from "@/lib/buscas/types";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { PATCH } from "../buscas/[id]/route";

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

beforeEach(() => {
  db = new FakeFirestore();
  db.seed("buscas/b1", {
    id: "b1",
    nome: "dentista 01/07",
    nicho: "dentista",
    regiao: "Sarandi PR",
    cor: BUSCA_CORES[0],
    criadaEm: "2026-07-01T10:00:00.000Z",
    totalCriados: 1,
    totalExistentes: 0,
  });
});

function patchCor(id: string, body: unknown): Promise<Response> {
  return PATCH(
    new Request(`http://localhost/api/buscas/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
}

describe("PATCH /api/buscas/[id]", () => {
  it("troca a cor para outra da paleta", async () => {
    const res = await patchCor("b1", { cor: BUSCA_CORES[3] });

    expect(res.status).toBe(200);
    const { busca } = await res.json();
    expect(busca.cor).toBe(BUSCA_CORES[3]);
    expect(db.getDoc("buscas/b1")).toMatchObject({ cor: BUSCA_CORES[3] });
  });

  it("cor fora da paleta → 400", async () => {
    const res = await patchCor("b1", { cor: "#123456" });

    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe("validation_error");
    expect(db.getDoc("buscas/b1")).toMatchObject({ cor: BUSCA_CORES[0] });
  });

  it("busca inexistente → 404", async () => {
    const res = await patchCor("nao-existe", { cor: BUSCA_CORES[1] });

    expect(res.status).toBe(404);
  });

  it("define a mensagem padrão do grupo", async () => {
    const res = await patchCor("b1", { mensagemPadrao: "Oi {nome}! Vi sua clínica…" });

    expect(res.status).toBe(200);
    const { busca } = await res.json();
    expect(busca.mensagemPadrao).toBe("Oi {nome}! Vi sua clínica…");
    expect(db.getDoc("buscas/b1")).toMatchObject({
      mensagemPadrao: "Oi {nome}! Vi sua clínica…",
      cor: BUSCA_CORES[0], // cor intocada
    });
  });

  it("string vazia limpa a mensagem do grupo (volta ao fallback global)", async () => {
    await patchCor("b1", { mensagemPadrao: "própria" });

    const res = await patchCor("b1", { mensagemPadrao: "" });

    expect(res.status).toBe(200);
    const { busca } = await res.json();
    expect(busca.mensagemPadrao).toBeUndefined();
    expect(db.getDoc("buscas/b1")).not.toHaveProperty("mensagemPadrao");
  });

  it("cor e mensagem no mesmo PATCH", async () => {
    const res = await patchCor("b1", {
      cor: BUSCA_CORES[2],
      mensagemPadrao: "msg do grupo",
    });

    expect(res.status).toBe(200);
    expect(db.getDoc("buscas/b1")).toMatchObject({
      cor: BUSCA_CORES[2],
      mensagemPadrao: "msg do grupo",
    });
  });

  it("mensagem não-string → 400", async () => {
    expect((await patchCor("b1", { mensagemPadrao: 42 })).status).toBe(400);
  });

  it("mensagem longa demais (>1000) → 400", async () => {
    expect((await patchCor("b1", { mensagemPadrao: "x".repeat(1001) })).status).toBe(400);
  });

  it("corpo sem cor nem mensagem → 400", async () => {
    expect((await patchCor("b1", {})).status).toBe(400);
  });
});
