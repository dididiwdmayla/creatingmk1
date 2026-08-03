import { describe, expect, it } from "vitest";

import type { ThemePaleta } from "@/lib/demos/types";

import { FUMACA_COLORIDA } from "../aura/cores";
import { resolverCamadaEfeito } from "../camada";
import { EFEITOS, modoDeCorPermitido } from "../registry";

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
      efeitoId: "particulas",
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

/**
 * MODO DE COR REPROVADO no portão de fps para um efeito específico (ver
 * `EfeitoDefinition.modosDeCorReprovados` e a tabela em ARCHITECTURE.md).
 * A regra é aplicada na RESOLUÇÃO, nunca na validação: a demo publicada
 * com esse par continua válida e continua abrindo no editor — ela só deixa
 * de animar a cor, caindo em "tema".
 */
describe("modo de cor reprovado por efeito", () => {
  const comReprovacao = EFEITOS.filter((e) => e.modosDeCorReprovados?.length);

  it("todo efeito com reprovação declara o motivo, e nunca reprova o modo tema", () => {
    for (const efeito of comReprovacao) {
      expect(efeito.motivoModosReprovados, `"${efeito.id}" reprova modo sem motivo`).toBeTruthy();
      expect(efeito.modosDeCorReprovados).not.toContain("tema");
    }
  });

  it("o modo reprovado cai em tema, sem CSS de animação e sem quebrar", () => {
    for (const efeito of comReprovacao) {
      for (const modo of efeito.modosDeCorReprovados!) {
        expect(modoDeCorPermitido(efeito.id, modo)).toBe(false);
        const r = resolverCamadaEfeito({
          paleta: PALETA,
          efeitoId: efeito.id,
          efeitoCores: { modo, cores: ["#00c2ff", "#ff2e88"] },
          auraCores: undefined,
        });
        expect(r.coresCss).toBe("");
        expect(r.coresAnimacao).toBeUndefined();
        expect(r.cores.destaque).toBe(PALETA.destaque);
      }
    }
  });

  it("efeito sem reprovação nenhuma continua aceitando os cinco modos", () => {
    const livre = EFEITOS.find((e) => !e.modosDeCorReprovados?.length)!;
    for (const modo of ["fixa", "transicao", "iridescente", "arco-iris"] as const) {
      expect(modoDeCorPermitido(livre.id, modo)).toBe(true);
    }
    const r = resolverCamadaEfeito({
      paleta: PALETA,
      efeitoId: livre.id,
      efeitoCores: { modo: "arco-iris" },
      auraCores: undefined,
    });
    expect(r.coresAnimacao?.nome).toBe("d-cores-efeito");
  });
});
