import { describe, expect, it } from "vitest";

import {
  IDIOMAS_SUPORTADOS,
  idiomaDoPais,
  idiomaDoPaisECidade,
  idiomaLabel,
  idiomaLabelRegional,
} from "../idioma";

describe("idiomaDoPais", () => {
  it("resolve países mapeados, case-insensitive", () => {
    expect(idiomaDoPais("Argentina")).toBe("es-AR");
    expect(idiomaDoPais("suíça")).toBe("de-CH");
  });

  it("país desconhecido ou ausente cai no padrão", () => {
    expect(idiomaDoPais("Narnia")).toBe("pt-BR");
    expect(idiomaDoPais(undefined)).toBe("pt-BR");
  });
});

describe("idiomaDoPaisECidade — países plurilíngues", () => {
  it("Suíça: cidade francófona vence o default alemão do país", () => {
    expect(idiomaDoPaisECidade("Suíça", "Genebra")).toBe("fr-CH");
    expect(idiomaDoPaisECidade("Suíça", "Genève")).toBe("fr-CH");
    expect(idiomaDoPaisECidade("Suíça", "Lausanne")).toBe("fr-CH");
  });

  it("Suíça: cidade italófona vence o default alemão do país", () => {
    expect(idiomaDoPaisECidade("Suíça", "Lugano")).toBe("it-CH");
  });

  it("Suíça: cidade germanófona (ou sem cidade) cai no default do país", () => {
    expect(idiomaDoPaisECidade("Suíça", "Zürich")).toBe("de-CH");
    expect(idiomaDoPaisECidade("Suíça", undefined)).toBe("de-CH");
  });

  it("Bélgica: cidade flamenga vence o default francês do país", () => {
    expect(idiomaDoPaisECidade("Bélgica", "Antwerpen")).toBe("nl-BE");
    expect(idiomaDoPaisECidade("Bélgica", "Gent")).toBe("nl-BE");
  });

  it("Bélgica: cidade valã (ou sem cidade) cai no default do país", () => {
    expect(idiomaDoPaisECidade("Bélgica", "Liège")).toBe("fr-BE");
    expect(idiomaDoPaisECidade("Bélgica", undefined)).toBe("fr-BE");
  });

  it("Canadá: cidade quebequense vence o default inglês do país", () => {
    expect(idiomaDoPaisECidade("Canadá", "Montréal")).toBe("fr-CA");
    expect(idiomaDoPaisECidade("Canadá", "Québec")).toBe("fr-CA");
  });

  it("Canadá: cidade anglófona (ou sem cidade) cai no default do país", () => {
    expect(idiomaDoPaisECidade("Canadá", "Toronto")).toBe("en-CA");
    expect(idiomaDoPaisECidade("Canadá", undefined)).toBe("en-CA");
  });

  it("país fora do mapa plurilíngue nunca consulta cidade", () => {
    expect(idiomaDoPaisECidade("Argentina", "Genebra")).toBe("es-AR");
  });

  it("sem país reconhecido, cai no padrão mesmo com cidade batendo noutro país", () => {
    expect(idiomaDoPaisECidade(undefined, "Genebra")).toBe("pt-BR");
  });
});

describe("idiomaLabelRegional — variantes extras", () => {
  it("rotula as variantes regionais de países plurilíngues", () => {
    expect(idiomaLabelRegional("fr-CH")).toBe("francês (Suíça)");
    expect(idiomaLabelRegional("it-CH")).toBe("italiano (Suíça)");
    expect(idiomaLabelRegional("nl-BE")).toBe("holandês (Bélgica)");
    expect(idiomaLabelRegional("fr-CA")).toBe("francês (Canadá)");
  });

  it("continua rotulando as variantes já existentes", () => {
    expect(idiomaLabelRegional("es-AR")).toBe("espanhol (Argentina)");
  });
});

describe("IDIOMAS_SUPORTADOS", () => {
  it("inclui as variantes regionais extras, sem duplicar", () => {
    expect(IDIOMAS_SUPORTADOS).toContain("fr-CH");
    expect(IDIOMAS_SUPORTADOS).toContain("it-CH");
    expect(IDIOMAS_SUPORTADOS).toContain("nl-BE");
    expect(IDIOMAS_SUPORTADOS).toContain("fr-CA");
    expect(new Set(IDIOMAS_SUPORTADOS).size).toBe(IDIOMAS_SUPORTADOS.length);
  });

  it("toda entrada tem um rótulo resolvível (raiz conhecida)", () => {
    for (const idioma of IDIOMAS_SUPORTADOS) {
      expect(idiomaLabel(idioma)).not.toBe(idioma);
    }
  });
});
