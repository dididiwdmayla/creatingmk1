import { describe, expect, it } from "vitest";

import { ValidationError } from "@/lib/errors";
import { FakeDemoStorage } from "@/lib/testing/fake-storage";
import {
  IMAGEM_MAX_BYTES,
  removerImagemDemo,
  removerImagensDoLead,
  salvarImagemDemo,
  validarImagem,
  validarSlot,
} from "../imagens";

const SLOTS = ["hero", "equipe-1"];

describe("validarSlot", () => {
  it("aceita slot conhecido, rejeita desconhecido/malformado", () => {
    expect(validarSlot("hero", SLOTS)).toBe("hero");
    expect(() => validarSlot("mapa", SLOTS)).toThrow(ValidationError);
    expect(() => validarSlot("../../x", SLOTS)).toThrow(ValidationError);
    expect(() => validarSlot(42, SLOTS)).toThrow(ValidationError);
  });
});

describe("validarImagem", () => {
  it("aceita jpg/png/webp até 2MB e devolve a extensão", () => {
    expect(validarImagem("image/jpeg", 1024)).toBe("jpg");
    expect(validarImagem("image/png", IMAGEM_MAX_BYTES)).toBe("png");
    expect(validarImagem("image/webp", 1024)).toBe("webp");
  });

  it("rejeita formato estranho, arquivo vazio e acima do teto", () => {
    expect(() => validarImagem("image/gif", 1024)).toThrow(ValidationError);
    expect(() => validarImagem("image/jpeg", 0)).toThrow(ValidationError);
    expect(() => validarImagem("image/jpeg", IMAGEM_MAX_BYTES + 1)).toThrow(ValidationError);
  });
});

describe("salvarImagemDemo", () => {
  it("grava em demos/{lead}/{slot}-{ts}.{ext} e devolve URL pública", async () => {
    const storage = new FakeDemoStorage();
    const now = new Date("2026-07-16T12:00:00Z");
    const url = await salvarImagemDemo(
      storage,
      "A",
      "hero",
      new Uint8Array([1, 2]),
      "image/webp",
      now,
    );
    const path = `demos/A/hero-${now.getTime()}.webp`;
    expect(storage.paths()).toEqual([path]);
    expect(url).toBe(storage.publicUrl(path));
  });

  it("troca apaga as versões anteriores do MESMO slot (nada de órfão)", async () => {
    const storage = new FakeDemoStorage();
    await salvarImagemDemo(storage, "A", "hero", new Uint8Array([1]), "image/png", new Date(1000));
    await salvarImagemDemo(storage, "A", "equipe-1", new Uint8Array([1]), "image/png", new Date(2000));
    await salvarImagemDemo(storage, "A", "hero", new Uint8Array([2]), "image/webp", new Date(3000));
    expect(storage.paths()).toEqual(["demos/A/equipe-1-2000.png", "demos/A/hero-3000.webp"]);
  });

  it("valida formato/tamanho antes de tocar no storage", async () => {
    const storage = new FakeDemoStorage();
    await expect(
      salvarImagemDemo(storage, "A", "hero", new Uint8Array([1]), "image/gif"),
    ).rejects.toThrow(ValidationError);
    expect(storage.paths()).toEqual([]);
  });
});

describe("remoções", () => {
  it("removerImagemDemo limpa só o slot; removerImagensDoLead limpa o lead inteiro", async () => {
    const storage = new FakeDemoStorage();
    await salvarImagemDemo(storage, "A", "hero", new Uint8Array([1]), "image/png", new Date(1));
    await salvarImagemDemo(storage, "A", "equipe-1", new Uint8Array([1]), "image/png", new Date(2));
    await salvarImagemDemo(storage, "B", "hero", new Uint8Array([1]), "image/png", new Date(3));

    await removerImagemDemo(storage, "A", "hero");
    expect(storage.paths()).toEqual(["demos/A/equipe-1-2.png", "demos/B/hero-3.png"]);

    await removerImagensDoLead(storage, "A");
    expect(storage.paths()).toEqual(["demos/B/hero-3.png"]);
  });
});
