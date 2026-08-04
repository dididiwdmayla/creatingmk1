import { afterEach, describe, expect, it } from "vitest";

import { SLOTS_SEM_FOTO, baseImagemSlot, caminhoFotoDoSlot } from "../imagens-modo";

describe("caminhoFotoDoSlot", () => {
  it("deriva /demos/<pasta>/foto/<slot>.webp a partir do SVG do exemplo", () => {
    expect(caminhoFotoDoSlot("/demos/barbearia/hero.svg")).toBe(
      "/demos/barbearia/foto/hero.webp",
    );
    expect(caminhoFotoDoSlot("/demos/barbearia/agendamento-rapido.svg")).toBe(
      "/demos/barbearia/foto/agendamento-rapido.webp",
    );
  });

  it("undefined quando o caminho não segue a convenção /demos/<pasta>/<slot>.svg", () => {
    expect(caminhoFotoDoSlot("/demos/barbearia/hero.png")).toBeUndefined();
    expect(caminhoFotoDoSlot("hero.svg")).toBeUndefined();
    expect(caminhoFotoDoSlot("https://storage.example/lead/hero-123.jpg")).toBeUndefined();
  });
});

describe("baseImagemSlot", () => {
  afterEach(() => {
    delete SLOTS_SEM_FOTO["skin-teste-sem-foto"];
  });

  it('modo "grafico" sempre devolve o SVG, independente de foto existir', () => {
    expect(baseImagemSlot(undefined, "hero", "/demos/barbearia/hero.svg", "grafico")).toBe(
      "/demos/barbearia/hero.svg",
    );
  });

  it('modo "foto" devolve foto/<slot>.webp quando o slot não está em SLOTS_SEM_FOTO', () => {
    expect(baseImagemSlot("barbearia-editorial", "hero", "/demos/barbearia/hero.svg", "foto")).toBe(
      "/demos/barbearia/foto/hero.webp",
    );
  });

  it("slot listado em SLOTS_SEM_FOTO da skin cai no SVG mesmo em modo foto", () => {
    SLOTS_SEM_FOTO["skin-teste-sem-foto"] = ["hero"];
    expect(baseImagemSlot("skin-teste-sem-foto", "hero", "/demos/x/hero.svg", "foto")).toBe(
      "/demos/x/hero.svg",
    );
    // Outro slot da MESMA skin, fora da lista, continua resolvendo pra foto.
    expect(baseImagemSlot("skin-teste-sem-foto", "equipe", "/demos/x/equipe.svg", "foto")).toBe(
      "/demos/x/foto/equipe.webp",
    );
  });

  it("svgPath fora da convenção cai nele mesmo em modo foto (fallback seguro)", () => {
    expect(baseImagemSlot(undefined, "hero", "https://storage.example/lead/hero.jpg", "foto")).toBe(
      "https://storage.example/lead/hero.jpg",
    );
  });

  it("sem skinId (fixture avulsa) ainda resolve pela convenção do caminho", () => {
    expect(baseImagemSlot(undefined, "hero", "/demos/x/hero.svg", "foto")).toBe(
      "/demos/x/foto/hero.webp",
    );
  });
});
