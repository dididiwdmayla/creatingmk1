import { describe, expect, it } from "vitest";

import { ValidationError } from "@/lib/errors";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { DEFAULT_FILA_CONFIG, loadFilaConfig, saveFilaConfig } from "../config";

const DOC = "config/fila";

describe("loadFilaConfig", () => {
  it("retorna os defaults quando o doc não existe (nunca erro, nunca envio irrestrito)", async () => {
    const db = new FakeFirestore();
    expect(await loadFilaConfig(db)).toEqual(DEFAULT_FILA_CONFIG);
  });

  it("mescla doc parcial sobre os defaults", async () => {
    const db = new FakeFirestore();
    db.seed(DOC, { metaDiaria: 30, ativo: false });

    const config = await loadFilaConfig(db);

    expect(config.metaDiaria).toBe(30);
    expect(config.ativo).toBe(false);
    expect(config.tetoPorHora).toBe(DEFAULT_FILA_CONFIG.tetoPorHora);
  });
});

describe("saveFilaConfig", () => {
  it("valida, mescla e persiste o doc completo", async () => {
    const db = new FakeFirestore();

    const salvo = await saveFilaConfig(db, { ativo: false, nichosPermitidos: ["dentista"] });

    expect(salvo.ativo).toBe(false);
    expect(salvo.nichosPermitidos).toEqual(["dentista"]);
    expect(salvo.metaDiaria).toBe(DEFAULT_FILA_CONFIG.metaDiaria);
    expect(db.getDoc(DOC)?.ativo).toBe(false);
  });

  it("substitui nichosPermitidos por inteiro (não é merge por item)", async () => {
    const db = new FakeFirestore();
    await saveFilaConfig(db, { nichosPermitidos: ["dentista", "barbearia"] });

    const salvo = await saveFilaConfig(db, { nichosPermitidos: [] });

    expect(salvo.nichosPermitidos).toEqual([]);
  });

  it("rejeita chave desconhecida", async () => {
    const db = new FakeFirestore();
    await expect(saveFilaConfig(db, { metaDiariaa: 10 })).rejects.toThrow(ValidationError);
  });

  it("rejeita metaDiaria negativa ou não inteira", async () => {
    const db = new FakeFirestore();
    await expect(saveFilaConfig(db, { metaDiaria: -1 })).rejects.toThrow(ValidationError);
    await expect(saveFilaConfig(db, { metaDiaria: 1.5 })).rejects.toThrow(ValidationError);
  });

  it("rejeita inicioDiaOperacionalHora fora de 0-23", async () => {
    const db = new FakeFirestore();
    await expect(saveFilaConfig(db, { inicioDiaOperacionalHora: 24 })).rejects.toThrow(
      ValidationError,
    );
    await expect(saveFilaConfig(db, { inicioDiaOperacionalHora: -1 })).rejects.toThrow(
      ValidationError,
    );
  });

  it("rejeita nichosPermitidos que não é lista de strings", async () => {
    const db = new FakeFirestore();
    await expect(saveFilaConfig(db, { nichosPermitidos: [1, 2] })).rejects.toThrow(
      ValidationError,
    );
  });
});
