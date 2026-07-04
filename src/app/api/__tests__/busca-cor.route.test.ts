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
});
