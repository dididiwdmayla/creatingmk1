import { beforeEach, describe, expect, it, vi } from "vitest";

import { CAPTURA_HEADER } from "@/lib/demos/capturas/seguranca.mjs";
import { DEFAULT_SKIN } from "@/lib/demos/registry";
import type { LeadDemo } from "@/lib/demos/types";

/**
 * O caminho INTEIRO do header até `theme.intro`, via `resolverDemo` — a
 * função que as duas rotas públicas (lead e avulsa) compartilham. A régua
 * é `theme.intro`, não HTML: cada skin desenha a splash do jeito dela, mas
 * as duas só leem esse campo (ver `IntroExperience` de cada skin).
 *
 * `demo.tema.intro = true` é o que faz o teste provar alguma coisa — o
 * preset default de toda skin já nasce com `intro: false` (fiel ao
 * material bruto), então suprimir um `false` não prova que o mecanismo
 * funciona.
 */
let headerRecebido: string | null;

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => new Headers(headerRecebido ? { [CAPTURA_HEADER]: headerRecebido } : {}),
}));
// next/font/google exige o plugin SWC do Next (não roda sob vitest puro) —
// irrelevante pro que este teste verifica, mesmo stub das outras suítes de
// rota pública (ver [leadId]/__tests__/page.test.tsx).
vi.mock("../fonts", () => ({
  demoCoreFontsClassName: "fonts-stub",
  resolveExtraFontClassNames: async () => "",
}));

beforeEach(() => {
  headerRecebido = null;
  vi.unstubAllEnvs();
});

function fonteComIntroLigada() {
  const demo: LeadDemo = {
    skinId: DEFAULT_SKIN.id,
    themeId: DEFAULT_SKIN.themeDefault.id,
    dados: {},
    tema: { intro: true },
    criadoEm: "2026-07-01T00:00:00.000Z",
    atualizadoEm: "2026-07-01T00:00:00.000Z",
  };
  return {
    id: "qa",
    avulsa: false,
    demo,
    idioma: "pt-BR",
    moeda: "BRL",
    nome: "Negócio Contrato Real",
  };
}

describe("resolverDemo — a intro some da demo pública para o motor de captura", () => {
  it("sem header nenhum: theme.intro segue o que o tema pediu (ligada)", async () => {
    const { resolverDemo } = await import("../comum");
    const resolvida = await resolverDemo(fonteComIntroLigada());
    expect(resolvida?.theme.intro).toBe(true);
  });

  it("fail-closed: header certo mas CAPTURA_SECRET ausente no servidor — intro continua ligada", async () => {
    headerRecebido = "segredo-do-motor";
    const { resolverDemo } = await import("../comum");
    const resolvida = await resolverDemo(fonteComIntroLigada());
    expect(resolvida?.theme.intro).toBe(true);
  });

  it("header errado, mesmo com CAPTURA_SECRET configurada — intro continua ligada", async () => {
    vi.stubEnv("CAPTURA_SECRET", "segredo-do-motor");
    headerRecebido = "chute";
    const { resolverDemo } = await import("../comum");
    const resolvida = await resolverDemo(fonteComIntroLigada());
    expect(resolvida?.theme.intro).toBe(true);
  });

  it("caminho feliz: header bate com CAPTURA_SECRET — intro suprimida, resto do tema intocado", async () => {
    vi.stubEnv("CAPTURA_SECRET", "segredo-do-motor");
    headerRecebido = "segredo-do-motor";
    const { resolverDemo } = await import("../comum");
    const resolvida = await resolverDemo(fonteComIntroLigada());
    expect(resolvida?.theme.intro).toBe(false);
    // Só `intro` muda — o resto do tema (paleta, raio, densidade…) segue o
    // preset normalmente. A skin nunca sabe que uma captura existe.
    expect(resolvida?.theme.id).toBe(DEFAULT_SKIN.themeDefault.id);
    expect(resolvida?.theme.raio).toBe(DEFAULT_SKIN.themeDefault.raio);
  });
});
