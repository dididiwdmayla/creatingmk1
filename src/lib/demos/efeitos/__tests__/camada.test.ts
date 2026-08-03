import { describe, expect, it } from "vitest";

import type { ThemePaleta } from "@/lib/demos/types";

import { FUMACA_COLORIDA } from "../aura/cores";
import { resolverCamadaEfeito } from "../camada";

const PALETA: ThemePaleta = {
  fundo: "#111111",
  fundoAlt: "#1c1c1c",
  fundoElevado: "#242424",
  destaque: "#c9a227",
  destaqueInk: "#111111",
  texto: "#f5f5f5",
  textoSuave: "#bbbbbb",
  borda: "rgba(255,255,255,0.1)",
  acentoSecundario: "#1b5e3b",
  acentoTerciario: "#7a0c0c",
};

describe("resolverCamadaEfeito", () => {
  it("sem modo de cor, a paleta do tema passa intacta", () => {
    const r = resolverCamadaEfeito({
      paleta: PALETA,
      efeitoId: "particulas",
      efeitoCores: undefined,
      auraCores: undefined,
    });
    expect(r.cores).toEqual(PALETA);
    expect(r.coresCss).toBe("");
    expect(r.coresAnimacao).toBeUndefined();
  });

  it("no modo do tema, a aura mantém o controle próprio de cores (compatibilidade)", () => {
    const r = resolverCamadaEfeito({
      paleta: PALETA,
      efeitoId: "aura",
      efeitoCores: { modo: "tema" },
      auraCores: "fumaca-colorida",
    });
    expect(r.cores.destaque).toBe(FUMACA_COLORIDA.primaria);
    expect(r.cores.acentoSecundario).toBe(FUMACA_COLORIDA.secundaria);
  });

  it("um modo de cor explícito VENCE o controle antigo da aura", () => {
    const r = resolverCamadaEfeito({
      paleta: PALETA,
      efeitoId: "aura",
      efeitoCores: { modo: "fixa", cores: ["#00ccff"] },
      auraCores: "fumaca-colorida",
    });
    expect(r.cores.destaque).toBe("#00ccff");
    expect(r.cores.acentoSecundario).toBe("#00ccff");
  });

  it("modo animado troca os três papéis por custom properties e devolve o CSS que as anima", () => {
    const r = resolverCamadaEfeito({
      paleta: PALETA,
      efeitoId: "veios",
      efeitoCores: { modo: "iridescente" },
      auraCores: undefined,
    });
    expect(r.cores.destaque).toBe("var(--d-efeito-c1, #c9a227)");
    expect(r.cores.acentoSecundario).toBe("var(--d-efeito-c2, #1b5e3b)");
    expect(r.cores.acentoTerciario).toBe("var(--d-efeito-c3, #7a0c0c)");
    // O resto da paleta (fundo, texto, borda) nunca é tocado pelo modo.
    expect(r.cores.fundo).toBe(PALETA.fundo);
    expect(r.cores.texto).toBe(PALETA.texto);
    expect(r.coresAnimacao?.nome).toBe("d-cores-efeito");
    expect(r.coresCss).toContain("@keyframes d-cores-efeito");
  });

  it("modo inválido cai no tema — e a aura volta a mandar nas cores dela", () => {
    const r = resolverCamadaEfeito({
      paleta: PALETA,
      efeitoId: "aura",
      // "fixa" sem cor escolhida não tem como ser resolvido.
      efeitoCores: { modo: "fixa", cores: [] },
      auraCores: { primaria: "#123456" },
    });
    expect(r.cores.destaque).toBe("#123456");
    expect(r.coresCss).toBe("");
  });
});
