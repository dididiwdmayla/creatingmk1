import { describe, expect, it } from "vitest";

import { configDemoInicial } from "../ConfigDemoCampos";
import { skinsDoNicho } from "@/lib/demos/nicho";
import { SKINS } from "@/lib/demos/registry";

describe("configDemoInicial", () => {
  it("abre na primeira skin que casa com o nicho do grupo, não em SKINS[0]", () => {
    // petshop não é a primeira skin do registro — se configDemoInicial
    // ainda usasse SKINS[0] cairia sempre em barbearia-editorial.
    const config = configDemoInicial("petshop");
    const esperada = skinsDoNicho("petshop")[0];
    expect(config.skinId).toBe(esperada.id);
    expect(config.themeId).toBe(esperada.themeDefault.id);
  });

  it("casa por sinônimo (lanchonete → primeira skin de lancheria)", () => {
    const config = configDemoInicial("lanchonete");
    const esperada = skinsDoNicho("lancheria")[0];
    expect(config.skinId).toBe(esperada.id);
  });

  it("sem skin nenhuma pro nicho, mantém o comportamento de sempre (SKINS[0])", () => {
    const config = configDemoInicial("dentista");
    expect(config.skinId).toBe(SKINS[0].id);
  });

  it("sem nicho (ex.: demo avulsa), mantém o comportamento de sempre (SKINS[0])", () => {
    const config = configDemoInicial();
    expect(config.skinId).toBe(SKINS[0].id);
  });
});
