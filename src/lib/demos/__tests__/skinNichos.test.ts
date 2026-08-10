import { describe, expect, it } from "vitest";

import { SKINS } from "@/lib/demos/registry";
import { NICHO_POR_SKIN, nichoDaSkin } from "@/lib/demos/skinNichos";

describe("NICHO_POR_SKIN", () => {
  it("bate exatamente com o registro de skins (skin nova não pode ficar de fora)", () => {
    expect(NICHO_POR_SKIN).toEqual(
      Object.fromEntries(SKINS.map((skin) => [skin.id, skin.nicho])),
    );
  });

  it("skin ausente ou desconhecida não inventa nicho", () => {
    expect(nichoDaSkin(undefined)).toBeUndefined();
    expect(nichoDaSkin("skin-que-nao-existe")).toBeUndefined();
  });

  it("resolve o nicho da skin da demo", () => {
    expect(nichoDaSkin("petshop-focinho-feliz")).toBe("petshop");
  });
});
