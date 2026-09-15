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

describe("numeroTeste — o destino do disparo de teste", () => {
  it("vem preenchido por default", () => {
    expect(DEFAULT_FILA_CONFIG.numeroTeste).toBe("5544984570105");
  });

  it("aceita dígitos com DDI e guarda sem espaço", async () => {
    const db = new FakeFirestore();
    const salvo = await saveFilaConfig(db, { numeroTeste: " 5544991543803 " });
    expect(salvo.numeroTeste).toBe("5544991543803");
  });

  it("aceita vazio — é o disparo de teste desligado, não um erro", async () => {
    const db = new FakeFirestore();
    const salvo = await saveFilaConfig(db, { numeroTeste: "" });
    expect(salvo.numeroTeste).toBe("");
  });

  it("recusa número com máscara: o WhatsApp do celular não resolve parêntese nem traço", async () => {
    const db = new FakeFirestore();
    await expect(saveFilaConfig(db, { numeroTeste: "(44) 99154-3803" })).rejects.toThrow(
      ValidationError,
    );
  });

  it("recusa curto demais e comprido demais", async () => {
    const db = new FakeFirestore();
    await expect(saveFilaConfig(db, { numeroTeste: "123" })).rejects.toThrow(ValidationError);
    await expect(saveFilaConfig(db, { numeroTeste: "1".repeat(16) })).rejects.toThrow(
      ValidationError,
    );
  });

  it("doc com tipo errado no campo não derruba a leitura (o celular bate nela a noite toda)", async () => {
    const db = new FakeFirestore();
    db.seed(DOC, { numeroTeste: 5544984570105 });

    const config = await loadFilaConfig(db);

    expect(config.numeroTeste).toBe(DEFAULT_FILA_CONFIG.numeroTeste);
  });
});
