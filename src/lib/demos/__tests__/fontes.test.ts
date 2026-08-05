import { describe, expect, it } from "vitest";

import { DEMO_FONTES, fontesEscolhidas, getFonte } from "../fontes";
import type { TemaPatch } from "../types";

/**
 * `fontesEscolhidas` é a lista que a rota pública, o preview do editor e o
 * harness de QA passam para `resolveExtraFontClassNames` — é ela que
 * decide quais fontes curadas viram `--font-demo-*` na página.
 *
 * Existe porque os três repetiam a lista e os três esqueciam
 * `heroTitulo.fonte`: escolher uma fonte só pro título hero não carregava
 * nada, a var ficava indefinida e a `font-family` inteira era descartada
 * pelo navegador (o título caía na fonte herdada). Um controle de fonte
 * que não estiver aqui volta a ter esse defeito, então o teste amarra a
 * lista aos controles que existem.
 */
describe("fontesEscolhidas", () => {
  it("cobre TODOS os controles de fonte do tema (display, corpo e título hero)", () => {
    const tema: TemaPatch = {
      fonteDisplay: "bebas",
      fonteCorpo: "inter",
      heroTitulo: { fonte: "cinzel" },
    };
    expect(fontesEscolhidas(tema)).toEqual(["bebas", "inter", "cinzel"]);
  });

  it("a fonte do título hero entra mesmo sem display/corpo escolhidos", () => {
    expect(fontesEscolhidas({ heroTitulo: { fonte: "abril" } })).toContain("abril");
  });

  it("tema ausente ou sem escolha nenhuma não pede fonte nenhuma", () => {
    expect(fontesEscolhidas(undefined).filter(Boolean)).toEqual([]);
    expect(fontesEscolhidas({}).filter(Boolean)).toEqual([]);
    expect(fontesEscolhidas({ heroTitulo: { escala: 1.2 } }).filter(Boolean)).toEqual([]);
  });

  it("os ids que ela devolve são da lista curada (resolvíveis por getFonte)", () => {
    const ids = fontesEscolhidas({
      fonteDisplay: DEMO_FONTES[0].id,
      fonteCorpo: DEMO_FONTES[5].id,
      heroTitulo: { fonte: "cinzel" },
    });
    for (const id of ids) expect(getFonte(id)).toBeDefined();
  });
});
