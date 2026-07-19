import { describe, expect, it } from "vitest";

import { ValidationError } from "@/lib/errors";
import { FakeDemoStorage } from "@/lib/testing/fake-storage";
import {
  VIDEO_MAX_BYTES,
  removerVideoDemo,
  salvarVideoDemo,
  validarSlotVideo,
  validarVideo,
} from "../videos";

const SLOTS = ["titulo"];

describe("validarSlotVideo", () => {
  it("aceita slot conhecido, rejeita desconhecido/malformado", () => {
    expect(validarSlotVideo("titulo", SLOTS)).toBe("titulo");
    expect(() => validarSlotVideo("mapa", SLOTS)).toThrow(ValidationError);
    expect(() => validarSlotVideo("../../x", SLOTS)).toThrow(ValidationError);
    expect(() => validarSlotVideo(42, SLOTS)).toThrow(ValidationError);
  });

  it("skin sem videoSlots (lista vazia) rejeita qualquer slot", () => {
    expect(() => validarSlotVideo("titulo", [])).toThrow(ValidationError);
  });
});

describe("validarVideo", () => {
  it("aceita mp4/webm até 15MB e devolve a extensão", () => {
    expect(validarVideo("video/mp4", 1024)).toBe("mp4");
    expect(validarVideo("video/webm", VIDEO_MAX_BYTES)).toBe("webm");
  });

  it("rejeita formato estranho, arquivo vazio e acima do teto", () => {
    expect(() => validarVideo("video/avi", 1024)).toThrow(ValidationError);
    expect(() => validarVideo("video/mp4", 0)).toThrow(ValidationError);
    expect(() => validarVideo("video/mp4", VIDEO_MAX_BYTES + 1)).toThrow(ValidationError);
  });
});

describe("salvarVideoDemo", () => {
  it("grava em demos/{lead}/video-{slot}-{ts}.{ext} e devolve URL pública", async () => {
    const storage = new FakeDemoStorage();
    const now = new Date("2026-07-19T12:00:00Z");
    const url = await salvarVideoDemo(
      storage,
      "A",
      "titulo",
      new Uint8Array([1, 2]),
      "video/mp4",
      now,
    );
    const path = `demos/A/video-titulo-${now.getTime()}.mp4`;
    expect(storage.paths()).toEqual([path]);
    expect(url).toBe(storage.publicUrl(path));
  });

  it("nunca colide com uma imagem do MESMO nome de slot", async () => {
    const storage = new FakeDemoStorage();
    await storage.save("demos/A/titulo-1.webp", new Uint8Array([1]), "image/webp");
    await salvarVideoDemo(storage, "A", "titulo", new Uint8Array([1]), "video/mp4", new Date(2));
    expect(storage.paths()).toEqual(["demos/A/titulo-1.webp", "demos/A/video-titulo-2.mp4"]);
  });

  it("troca apaga as versões anteriores do MESMO slot de vídeo", async () => {
    const storage = new FakeDemoStorage();
    await salvarVideoDemo(storage, "A", "titulo", new Uint8Array([1]), "video/mp4", new Date(1000));
    await salvarVideoDemo(storage, "A", "titulo", new Uint8Array([2]), "video/webm", new Date(2000));
    expect(storage.paths()).toEqual(["demos/A/video-titulo-2000.webm"]);
  });

  it("valida formato/tamanho antes de tocar no storage", async () => {
    const storage = new FakeDemoStorage();
    await expect(
      salvarVideoDemo(storage, "A", "titulo", new Uint8Array([1]), "video/avi"),
    ).rejects.toThrow(ValidationError);
    expect(storage.paths()).toEqual([]);
  });
});

describe("removerVideoDemo", () => {
  it("limpa só o vídeo do slot, preservando imagens e vídeos de outros leads/slots", async () => {
    const storage = new FakeDemoStorage();
    await salvarVideoDemo(storage, "A", "titulo", new Uint8Array([1]), "video/mp4", new Date(1));
    await storage.save("demos/A/hero-1.webp", new Uint8Array([1]), "image/webp");
    await salvarVideoDemo(storage, "B", "titulo", new Uint8Array([1]), "video/mp4", new Date(2));

    await removerVideoDemo(storage, "A", "titulo");
    expect(storage.paths()).toEqual(["demos/A/hero-1.webp", "demos/B/video-titulo-2.mp4"]);
  });
});
