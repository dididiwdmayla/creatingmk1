import { describe, expect, it } from "vitest";

import type { Lead } from "@/lib/leads/types";
import { criterioAprovacaoAutomatica, origemDaDemo, passaCriterioAprovacaoAutomatica } from "../aprovacao";
import { pendenciasProntidao } from "../prontidao";
import { DEFAULT_SKIN } from "../registry";

const SKIN = DEFAULT_SKIN;
const HORARIOS: Lead["horarios"] = {
  faixas: [{ diaAbre: 1, horaAbre: 9, minAbre: 0, diaFecha: 1, horaFecha: 18, minFecha: 0 }],
  obtidoEm: "2026-09-01T00:00:00.000Z",
};

/** Lead BR com telefone e horário, demo automática SEM foto nenhuma e SEM Instagram. */
function lead(extra: Partial<Lead> = {}, dados: Record<string, unknown> = {}): Lead {
  return {
    placeId: "abc",
    nome: "Barbearia do Zé",
    endereco: "Av. Brasil, 2785, Maringá, PR, Brasil",
    status: "novo",
    enriquecido: false,
    telefone: "(44) 3222-1111",
    telefoneIntl: "+55 44 3222-1111",
    horarios: HORARIOS,
    demo: {
      skinId: SKIN.id,
      themeId: SKIN.themeDefault.id,
      dados,
      origem: "automacao",
      criadoEm: "2026-09-01T00:00:00.000Z",
      atualizadoEm: "2026-09-01T00:00:00.000Z",
    },
    criadoEm: "2026-09-01T00:00:00.000Z",
    atualizadoEm: "2026-09-01T00:00:00.000Z",
    ...extra,
  } as Lead;
}

describe("aprovação automática — um RECORTE da prontidão", () => {
  it("passa com telefone + horários + idioma certo, IGNORANDO imagens e Instagram", () => {
    const l = lead();
    const chaves = pendenciasProntidao(l, SKIN).map((p) => p.chave);
    // A prontidão inteira reprovaria: imagens genéricas e sem Instagram.
    expect(chaves).toEqual(expect.arrayContaining(["imagens", "instagram"]));
    expect(passaCriterioAprovacaoAutomatica(l, SKIN)).toBe(true);
  });

  it("reprova sem horários", () => {
    expect(passaCriterioAprovacaoAutomatica(lead({ horarios: undefined }), SKIN)).toBe(false);
  });

  it("reprova sem telefone", () => {
    expect(
      passaCriterioAprovacaoAutomatica(lead({ telefone: undefined, telefoneIntl: undefined }), SKIN),
    ).toBe(false);
  });

  it("reprova lead estrangeiro com o texto ainda no idioma do template; passa quando o texto foi gerado", () => {
    const fora = { endereco: "123 Main St, Miami, Estados Unidos" };
    expect(passaCriterioAprovacaoAutomatica(lead(fora), SKIN)).toBe(false);
    expect(passaCriterioAprovacaoAutomatica(lead(fora, { slogan: "Craft and blade." }), SKIN)).toBe(true);
  });

  it("o critério puro só olha telefone, horário e idioma", () => {
    expect(
      criterioAprovacaoAutomatica([
        { chave: "imagens", rotulo: "x" },
        { chave: "instagram", rotulo: "x" },
      ]),
    ).toBe(true);
    expect(criterioAprovacaoAutomatica([{ chave: "horario", rotulo: "x" }])).toBe(false);
    expect(criterioAprovacaoAutomatica([{ chave: "idioma", rotulo: "x" }])).toBe(false);
  });

  it("demo sem origem é manual", () => {
    expect(origemDaDemo(undefined)).toBe("manual");
    expect(origemDaDemo({})).toBe("manual");
    expect(origemDaDemo({ origem: "automacao" })).toBe("automacao");
  });
});
