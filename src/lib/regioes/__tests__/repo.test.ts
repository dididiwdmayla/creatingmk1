import { describe, expect, it } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";
import type { IndiceGerado } from "../ia";
import { getRegiaoIndice, salvarRegiaoIndice, setIndiceAjustado } from "../repo";

const GERADO: IndiceGerado = {
  indice: 3.2,
  moedaLocal: "CHF",
  cambioAproxBRL: 6.1,
  faixaMercadoLocal: "300–800 CHF",
  justificativa: "Zurique tem alto custo de vida.",
  confianca: "alta",
};

describe("salvarRegiaoIndice / getRegiaoIndice", () => {
  it("grava e lê o índice pelo slug", async () => {
    const db = new FakeFirestore();
    const salva = await salvarRegiaoIndice(
      db,
      "zurique",
      { regiaoTexto: "Zurique", cidade: "Zürich", pais: "Suíça" },
      GERADO,
      new Date("2026-07-01T00:00:00.000Z"),
    );

    expect(salva).toMatchObject({ slug: "zurique", cidade: "Zürich", indice: 3.2 });
    expect(salva.geradoEm).toBe("2026-07-01T00:00:00.000Z");

    const lida = await getRegiaoIndice(db, "zurique");
    expect(lida).toMatchObject({ slug: "zurique", indice: 3.2, moedaLocal: "CHF" });
  });

  it("região inexistente → undefined", async () => {
    const db = new FakeFirestore();
    expect(await getRegiaoIndice(db, "nada")).toBeUndefined();
  });

  it("regenerar preserva o indiceAjustado existente", async () => {
    const db = new FakeFirestore();
    await salvarRegiaoIndice(
      db,
      "zurique",
      { regiaoTexto: "Zurique", cidade: "Zürich", pais: "Suíça" },
      GERADO,
    );
    await setIndiceAjustado(db, "zurique", 2.5);

    const regenerada = await salvarRegiaoIndice(
      db,
      "zurique",
      { regiaoTexto: "Zurique", cidade: "Zürich", pais: "Suíça" },
      { ...GERADO, indice: 4.0 },
    );

    expect(regenerada.indice).toBe(4.0);
    expect(regenerada.indiceAjustado).toBe(2.5);
  });
});

describe("setIndiceAjustado", () => {
  it("seta o ajuste do admin, que passa a valer no doc", async () => {
    const db = new FakeFirestore();
    await salvarRegiaoIndice(
      db,
      "zurique",
      { regiaoTexto: "Zurique", cidade: "Zürich", pais: "Suíça" },
      GERADO,
    );

    const atualizada = await setIndiceAjustado(db, "zurique", 2.5);
    expect(atualizada.indiceAjustado).toBe(2.5);
    expect(atualizada.indice).toBe(3.2);
    expect(await getRegiaoIndice(db, "zurique")).toMatchObject({ indiceAjustado: 2.5 });
  });

  it("null limpa o ajuste (volta a valer o gerado)", async () => {
    const db = new FakeFirestore();
    await salvarRegiaoIndice(
      db,
      "zurique",
      { regiaoTexto: "Zurique", cidade: "Zürich", pais: "Suíça" },
      GERADO,
    );
    await setIndiceAjustado(db, "zurique", 2.5);

    const limpa = await setIndiceAjustado(db, "zurique", null);
    expect(limpa.indiceAjustado).toBeUndefined();
    expect(await getRegiaoIndice(db, "zurique")).not.toHaveProperty("indiceAjustado");
  });

  it("região sem índice gerado ainda → NotFoundError", async () => {
    const db = new FakeFirestore();
    await expect(setIndiceAjustado(db, "fantasma", 2)).rejects.toThrow(/não tem índice gerado/);
  });
});
