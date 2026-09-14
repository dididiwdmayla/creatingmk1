import { describe, expect, it } from "vitest";

import { SKINS } from "@/lib/demos/registry";

import { VARIANTES_POR_SKIN } from "../variantes.mjs";

/**
 * Contrato entre o registro (TypeScript) e a cópia em dado puro que os
 * laços de verificação leem (.mjs — eles não compilam TS). Sem este teste,
 * uma variante nova entraria no registro e sairia calada da matriz visual
 * e do portão de fps.
 */
describe("VARIANTES_POR_SKIN (dado puro para os laços)", () => {
  it("cobre exatamente as skins do registro que têm variantes", () => {
    const comVariantes = SKINS.filter((s) => s.variantes?.length).map((s) => s.id);
    expect(Object.keys(VARIANTES_POR_SKIN).sort()).toEqual(comVariantes.sort());
  });

  it("lista as mesmas variantes, na mesma ordem", () => {
    for (const skin of SKINS) {
      if (!skin.variantes?.length) continue;
      expect(VARIANTES_POR_SKIN[skin.id], skin.id).toEqual(skin.variantes.map((v) => v.id));
    }
  });
});
