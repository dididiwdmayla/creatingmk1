import { describe, expect, it } from "vitest";

import { TATUAGEM2_THEME_PRESETS } from "@/components/demos/tatuagem2/themes";

const porId = Object.fromEntries(TATUAGEM2_THEME_PRESETS.map((tema) => [tema.id, tema]));

describe("Pigmento Vivo — tema próprio por variante", () => {
  it.each([
    ["aquarela", "4px", "arejada", "marcante", "lift", "pressao", "grao", "desligado", "barra"],
    ["boreal", "0px", "confortavel", "sutil", "brilho", "nenhum", "varredura-de-luz", "desligado", "barra"],
    ["meia-noite", "12px", "compacta", "marcante", "zoom", "pulso", "aura", "sutil", "dissipado"],
    ["terra", "24px", "arejada", "sutil", "lift", "nenhum", "grao", "sutil", "moldura"],
  ] as const)(
    "%s aplica raio, densidade, movimento, interação, efeito e LED do plano",
    (id, raio, densidade, animacao, hover, clique, fundoEfeito, led, ledEstilo) => {
      expect(porId[id]).toMatchObject({
        raio,
        densidade,
        animacao,
        intro: false,
        hover,
        clique,
        fundoEfeito,
        led,
        ledEstilo,
      });
    },
  );

  it("usa as três tintas legíveis no LED da Meia-noite", () => {
    expect(porId["meia-noite"].ledCores).toEqual({
      modo: "transicao",
      cores: ["#3FD0EE", "#FF6CC4", "#FFA86A"],
    });
  });
});
