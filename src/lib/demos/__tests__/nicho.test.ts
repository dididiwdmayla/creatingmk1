import { describe, expect, it } from "vitest";

import { normalizaNichoExato, skinsDoNicho } from "../nicho";
import { SKINS } from "../registry";

describe("normalizaNichoExato", () => {
  it("remove acento, maiúscula e espaço/hífen", () => {
    expect(normalizaNichoExato("Imobiliária")).toBe("imobiliaria");
    expect(normalizaNichoExato("imobiliaria")).toBe("imobiliaria");
    expect(normalizaNichoExato("Pet Shop")).toBe("petshop");
    expect(normalizaNichoExato("pet-shop")).toBe("petshop");
    expect(normalizaNichoExato("petshop")).toBe("petshop");
  });
});

describe("skinsDoNicho", () => {
  it("casa nicho de busca com sinônimo (lanchonete → lancheria)", () => {
    const skins = skinsDoNicho("lanchonete");
    expect(skins.length).toBeGreaterThan(0);
    for (const skin of skins) expect(skin.nicho).toBe("lancheria");
  });

  it("nunca casa por substring (bar não é barbearia)", () => {
    expect(skinsDoNicho("bar")).toEqual([]);
  });

  it("acento e espaço não impedem o casamento", () => {
    expect(skinsDoNicho("Imobiliária").length).toBeGreaterThan(0);
    expect(skinsDoNicho("pet shop").length).toBeGreaterThan(0);
  });

  it("nicho sem skin nenhuma devolve lista vazia", () => {
    expect(skinsDoNicho("dentista")).toEqual([]);
  });
});

describe("contrato de sinônimos do registro", () => {
  it("toda skin declara nicho", () => {
    for (const skin of SKINS) expect(skin.nicho).toBeTruthy();
  });

  it("nenhum sinônimo normalizado colide entre skins de nichos DIFERENTES", () => {
    for (const a of SKINS) {
      const nichoA = normalizaNichoExato(a.nicho);
      const chavesA = new Set([nichoA, ...a.sinonimos.map(normalizaNichoExato)]);
      for (const b of SKINS) {
        const nichoB = normalizaNichoExato(b.nicho);
        if (nichoA === nichoB) continue; // mesmo nicho: compartilhar é esperado
        const chavesB = new Set([nichoB, ...b.sinonimos.map(normalizaNichoExato)]);
        for (const chave of chavesA) {
          expect(
            chavesB.has(chave),
            `"${chave}" (de ${a.id}, nicho "${a.nicho}") colide com ${b.id} (nicho "${b.nicho}")`,
          ).toBe(false);
        }
      }
    }
  });

  it("skins do mesmo nicho podem compartilhar sinônimos", () => {
    const barbearias = SKINS.filter((skin) => skin.nicho === "barbearia");
    expect(barbearias.length).toBeGreaterThan(1);
    const [primeira, ...resto] = barbearias;
    for (const skin of resto) {
      expect(skin.sinonimos).toEqual(primeira.sinonimos);
    }
  });
});
