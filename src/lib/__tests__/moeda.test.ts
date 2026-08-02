import { describe, expect, it } from "vitest";

import { moedaDoPais, MOEDA_PADRAO } from "../moeda";

describe("moedaDoPais — mapa país→moeda determinístico, sem IA", () => {
  it("Brasil e país ausente/desconhecido caem no default BRL", () => {
    expect(MOEDA_PADRAO).toBe("BRL");
    expect(moedaDoPais(undefined)).toBe("BRL");
    expect(moedaDoPais("brasil")).toBe("BRL");
    expect(moedaDoPais("nárnia")).toBe("BRL");
  });

  it("Suíça (de-CH/fr-CH) sempre cai em CHF, independente do idioma", () => {
    expect(moedaDoPais("suíça")).toBe("CHF");
    expect(moedaDoPais("Suíça")).toBe("CHF");
    expect(moedaDoPais(" SUÍÇA ")).toBe("CHF");
  });

  it("outros países mapeados", () => {
    expect(moedaDoPais("portugal")).toBe("EUR");
    expect(moedaDoPais("estados unidos")).toBe("USD");
    expect(moedaDoPais("frança")).toBe("EUR");
  });
});
