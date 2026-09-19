import { describe, expect, it } from "vitest";

import { ValidationError } from "@/lib/errors";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import {
  DEFAULT_CONTEXTO_COMERCIAL,
  loadContextoComercial,
  saveContextoComercial,
} from "../contextoComercial";

const DOC = "config/contextoComercial";

describe("loadContextoComercial", () => {
  it("doc ausente devolve texto vazio, nunca erro", async () => {
    const db = new FakeFirestore();
    expect(await loadContextoComercial(db)).toEqual(DEFAULT_CONTEXTO_COMERCIAL);
  });

  it("lê o texto persistido", async () => {
    const db = new FakeFirestore();
    db.seed(DOC, { texto: "Fazemos site a partir de R$1.500." });

    expect(await loadContextoComercial(db)).toEqual({ texto: "Fazemos site a partir de R$1.500." });
  });

  it("tipo errado no campo não derruba a leitura", async () => {
    const db = new FakeFirestore();
    db.seed(DOC, { texto: 123 });

    expect(await loadContextoComercial(db)).toEqual(DEFAULT_CONTEXTO_COMERCIAL);
  });
});

describe("saveContextoComercial", () => {
  it("valida, aplica e persiste o doc completo", async () => {
    const db = new FakeFirestore();

    const salvo = await saveContextoComercial(db, { texto: "Vendemos site institucional." });

    expect(salvo).toEqual({ texto: "Vendemos site institucional." });
    expect(db.getDoc(DOC)?.texto).toBe("Vendemos site institucional.");
  });

  it("apara espaço nas pontas, preserva quebra de linha interna", async () => {
    const db = new FakeFirestore();

    const salvo = await saveContextoComercial(db, { texto: "  Linha 1\nLinha 2  " });

    expect(salvo.texto).toBe("Linha 1\nLinha 2");
  });

  it("aceita string vazia — apagar o contexto é uma edição válida", async () => {
    const db = new FakeFirestore();
    await saveContextoComercial(db, { texto: "algo" });

    const salvo = await saveContextoComercial(db, { texto: "" });

    expect(salvo.texto).toBe("");
  });

  it("rejeita chave desconhecida", async () => {
    const db = new FakeFirestore();
    await expect(saveContextoComercial(db, { texto: "ok", outraCoisa: 1 })).rejects.toThrow(
      ValidationError,
    );
  });

  it("rejeita texto que não é string", async () => {
    const db = new FakeFirestore();
    await expect(saveContextoComercial(db, { texto: 123 })).rejects.toThrow(ValidationError);
  });

  it("rejeita corpo que não é objeto", async () => {
    const db = new FakeFirestore();
    await expect(saveContextoComercial(db, "texto")).rejects.toThrow(ValidationError);
  });
});
