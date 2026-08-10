import { describe, expect, it } from "vitest";

import { utcOffsetDoPais } from "../utcOffsetPais";

describe("utcOffsetDoPais — mapa país→deslocamento UTC determinístico, sem IA", () => {
  it("país ausente/desconhecido → undefined (nunca mostra hora errada)", () => {
    expect(utcOffsetDoPais(undefined)).toBeUndefined();
    expect(utcOffsetDoPais("nárnia")).toBeUndefined();
  });

  it("Brasil → -180 (horário de Brasília)", () => {
    expect(utcOffsetDoPais("brasil")).toBe(-180);
    expect(utcOffsetDoPais("Brasil")).toBe(-180);
    expect(utcOffsetDoPais(" BRASIL ")).toBe(-180);
  });

  it("outros países mapeados", () => {
    expect(utcOffsetDoPais("portugal")).toBe(0);
    expect(utcOffsetDoPais("estados unidos")).toBe(-300);
    expect(utcOffsetDoPais("japão")).toBeUndefined(); // não está no mapa (nichos improváveis)
  });
});
