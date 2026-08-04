import { describe, expect, it } from "vitest";

import type { Lead } from "@/lib/leads/types";
import { imagensPendentes, pendenciasProntidao } from "../prontidao";
import { DEFAULT_SKIN } from "../registry";

const SKIN = DEFAULT_SKIN;

function makeLead(extra: Partial<Lead> = {}): Lead {
  return {
    placeId: "abc",
    nome: "Barbearia do Zé",
    endereco: "Av. Brasil, 2785, Maringá, PR, Brasil",
    status: "novo",
    enriquecido: false,
    criadoEm: "2026-07-01T00:00:00.000Z",
    atualizadoEm: "2026-07-01T00:00:00.000Z",
    ...extra,
  };
}

describe("pendenciasProntidao", () => {
  it("lead sem demo: nenhuma pendência (nada a mostrar)", () => {
    expect(pendenciasProntidao(makeLead(), SKIN)).toEqual([]);
  });

  it("demo recém-criada sem nada preenchido: todas as pendências de conteúdo, exceto idioma (lead é BR)", () => {
    const lead = makeLead({
      demo: {
        skinId: SKIN.id,
        themeId: SKIN.themeDefault.id,
        dados: {},
        criadoEm: "2026-08-01T00:00:00.000Z",
        atualizadoEm: "2026-08-01T00:00:00.000Z",
      },
    });
    const chaves = pendenciasProntidao(lead, SKIN).map((p) => p.chave);
    expect(chaves).toContain("instagram");
    expect(chaves).toContain("horario");
    expect(chaves).toContain("telefone");
    expect(chaves).toContain("imagens");
    expect(chaves).not.toContain("idioma");
  });

  it("telefone e whatsapp vindos do próprio lead removem a pendência de telefone", () => {
    const lead = makeLead({
      telefone: "(44) 3222-1111",
      telefoneIntl: "+55 44 3222-1111",
      demo: {
        skinId: SKIN.id,
        themeId: SKIN.themeDefault.id,
        dados: {},
        criadoEm: "2026-08-01T00:00:00.000Z",
        atualizadoEm: "2026-08-01T00:00:00.000Z",
      },
    });
    expect(pendenciasProntidao(lead, SKIN).map((p) => p.chave)).not.toContain("telefone");
  });

  it("horário salvo remove a pendência de horário", () => {
    const lead = makeLead({
      horarios: {
        faixas: [{ diaAbre: 1, horaAbre: 9, minAbre: 0, diaFecha: 1, horaFecha: 18, minFecha: 0 }],
        obtidoEm: "2026-08-01T00:00:00.000Z",
      },
      demo: {
        skinId: SKIN.id,
        themeId: SKIN.themeDefault.id,
        dados: {},
        criadoEm: "2026-08-01T00:00:00.000Z",
        atualizadoEm: "2026-08-01T00:00:00.000Z",
      },
    });
    expect(pendenciasProntidao(lead, SKIN).map((p) => p.chave)).not.toContain("horario");
  });

  it("instagram detectado a partir do site do lead remove a pendência", () => {
    const lead = makeLead({
      siteUrl: "https://instagram.com/barbearia.do.ze",
      temSite: true,
      demo: {
        skinId: SKIN.id,
        themeId: SKIN.themeDefault.id,
        dados: {},
        criadoEm: "2026-08-01T00:00:00.000Z",
        atualizadoEm: "2026-08-01T00:00:00.000Z",
      },
    });
    expect(pendenciasProntidao(lead, SKIN).map((p) => p.chave)).not.toContain("instagram");
  });

  it("lead de país com idioma-alvo diferente, sem texto próprio: pendência de idioma aparece", () => {
    const lead = makeLead({
      endereco: "123 Main St, Miami, Estados Unidos",
      demo: {
        skinId: SKIN.id,
        themeId: SKIN.themeDefault.id,
        dados: {},
        criadoEm: "2026-08-01T00:00:00.000Z",
        atualizadoEm: "2026-08-01T00:00:00.000Z",
      },
    });
    expect(pendenciasProntidao(lead, SKIN).map((p) => p.chave)).toContain("idioma");
  });

  it("mesmo lead de fora, com slogan já editado: pendência de idioma some", () => {
    const lead = makeLead({
      endereco: "123 Main St, Miami, Estados Unidos",
      demo: {
        skinId: SKIN.id,
        themeId: SKIN.themeDefault.id,
        dados: { slogan: "Craft and blade." },
        criadoEm: "2026-08-01T00:00:00.000Z",
        atualizadoEm: "2026-08-01T00:00:00.000Z",
      },
    });
    expect(pendenciasProntidao(lead, SKIN).map((p) => p.chave)).not.toContain("idioma");
  });

  it("todas as imagens da skin com upload: pendência de imagens some", () => {
    const slots = Object.keys(SKIN.demoDataExemplo.imagens);
    const imagens = Object.fromEntries(slots.map((slot) => [slot, `https://x/${slot}.jpg`]));
    const lead = makeLead({
      demo: {
        skinId: SKIN.id,
        themeId: SKIN.themeDefault.id,
        dados: { imagens },
        criadoEm: "2026-08-01T00:00:00.000Z",
        atualizadoEm: "2026-08-01T00:00:00.000Z",
      },
    });
    expect(pendenciasProntidao(lead, SKIN).map((p) => p.chave)).not.toContain("imagens");
  });
});

describe("imagensPendentes", () => {
  it("sem upload nenhum: pendentes == total", () => {
    const lead = makeLead();
    const { pendentes, total } = imagensPendentes(lead, SKIN);
    expect(total).toBeGreaterThan(0);
    expect(pendentes).toBe(total);
  });

  it("conta só os slots SEM override, ignorando slots que a skin não declara", () => {
    const [primeiroSlot] = Object.keys(SKIN.demoDataExemplo.imagens);
    const lead = makeLead({
      demo: {
        skinId: SKIN.id,
        themeId: SKIN.themeDefault.id,
        dados: { imagens: { [primeiroSlot]: "https://x/a.jpg", slotInexistente: "https://x/b.jpg" } },
        criadoEm: "2026-08-01T00:00:00.000Z",
        atualizadoEm: "2026-08-01T00:00:00.000Z",
      },
    });
    const { pendentes, total } = imagensPendentes(lead, SKIN);
    expect(pendentes).toBe(total - 1);
  });
});
