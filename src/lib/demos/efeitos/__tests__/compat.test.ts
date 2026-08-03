import { describe, expect, it } from "vitest";

import { getSkin } from "../../registry";
import { aplicarTema, migrarTemaPatch } from "../../tema";
import { resolverEfeitoFundo } from "../registry";
import { validateLeadDemoInput } from "../../validate";

/**
 * Compatibilidade com demos salvas ANTES de "gradiente"/"particulas"
 * entrarem no registro de efeitos e antes da intensidade existir: o
 * preset "ouro-da-meia-noite" da barbearia sul já tinha
 * `fundoEfeito: "particulas"` hardcoded (ver themes.ts) desde bem antes
 * desta feature — sem TemaPatch e sem `fundoEfeitoIntensidade`, exatamente
 * o formato de uma demo antiga. O pipeline real da rota pública
 * (aplicarTema ← preset/patch, depois resolverEfeitoFundo) precisa
 * continuar resolvendo pro MESMO efeito, nunca "nada".
 */
describe("compatibilidade: preset com efeito de fundo salvo antes do registro existir", () => {
  it('preset "ouro-da-meia-noite" (fundoEfeito "particulas", sem patch) continua resolvendo pra "particulas"', () => {
    const skin = getSkin("barbearia2-sul")!;
    const preset = skin.themePresets.find((t) => t.id === "ouro-da-meia-noite")!;
    expect(preset.fundoEfeito).toBe("particulas");

    // aplicarTema(preset, undefined) é o cenário de uma demo sem tema
    // algum salvo — só o preset da skin, como no formato mais antigo.
    const theme = aplicarTema(preset, undefined);
    expect(theme.fundoEfeito).toBe("particulas");

    const resolvido = resolverEfeitoFundo(theme.fundoEfeito, undefined, skin.nicho);
    expect(resolvido?.efeito.id).toBe("particulas");
    expect(resolvido?.intensidade).toBeGreaterThan(0);
  });

  /**
   * Demo salva com um efeito que DEIXOU de existir (`geometrico-pulsante`,
   * removido por formar figuras legíveis e animar SVG de viewport inteira).
   * Ninguém migra o Firestore: o id antigo continua no `tema` das demos
   * publicadas, e o registro é quem o traduz (ver EFEITOS_MIGRADOS). Os
   * três caminhos que uma demo dessas atravessa estão cobertos aqui.
   */
  describe("demo salva com um efeito REMOVIDO do registro", () => {
    const skin = getSkin("multimarcas-vortice")!;

    it("a rota pública renderiza o substituto, não um fundo vazio", () => {
      const theme = aplicarTema(skin.themeDefault, {
        fundoEfeito: "geometrico-pulsante",
        fundoEfeitoIntensidade: 2,
      });
      // aplicarTema preserva o id salvo (é o que está no banco)…
      expect(theme.fundoEfeito).toBe("geometrico-pulsante");
      // …e a resolução é quem entrega o efeito novo.
      const resolvido = resolverEfeitoFundo(theme.fundoEfeito, 2, skin.nicho);
      expect(resolvido?.efeito.id).toBe("ondas");
      expect(resolvido?.intensidade).toBe(2);
    });

    it("o PUT dessa demo continua válido (o id antigo não vira 400)", () => {
      expect(() =>
        validateLeadDemoInput({
          skinId: skin.id,
          themeId: skin.themeDefault.id,
          tema: { fundoEfeito: "geometrico-pulsante", fundoEfeitoIntensidade: 3 },
        }),
      ).not.toThrow();
    });

    it("abrir no editor troca o id salvo pelo novo (o próximo save grava 'ondas')", () => {
      expect(migrarTemaPatch({ fundoEfeito: "geometrico-pulsante", destaque: "#ff0000" })).toEqual({
        fundoEfeito: "ondas",
        destaque: "#ff0000",
      });
      // Patch sem efeito (ou com efeito vivo) volta IDÊNTICO — nada de
      // reescrever o que não precisa migrar.
      const intocado = { fundoEfeito: "veios" as const };
      expect(migrarTemaPatch(intocado)).toBe(intocado);
      const vazio = {};
      expect(migrarTemaPatch(vazio)).toBe(vazio);
    });
  });

  it('TemaPatch antigo só com fundoEfeito (sem fundoEfeitoIntensidade) também resolve — o patch pode sobrescrever um preset "nenhum"', () => {
    const skin = getSkin("barbearia2-sul")!;
    const preset = skin.themeDefault; // default é "nenhum"
    expect(preset.fundoEfeito).toBe("nenhum");

    const theme = aplicarTema(preset, { fundoEfeito: "particulas" });
    const resolvido = resolverEfeitoFundo(theme.fundoEfeito, undefined, skin.nicho);
    expect(resolvido?.efeito.id).toBe("particulas");
  });
});
