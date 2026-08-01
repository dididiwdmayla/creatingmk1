import { describe, expect, it } from "vitest";

import { getSkin } from "../../registry";
import { aplicarTema } from "../../tema";
import { resolverEfeitoFundo } from "../registry";

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

  it('TemaPatch antigo só com fundoEfeito (sem fundoEfeitoIntensidade) também resolve — o patch pode sobrescrever um preset "nenhum"', () => {
    const skin = getSkin("barbearia2-sul")!;
    const preset = skin.themeDefault; // default é "nenhum"
    expect(preset.fundoEfeito).toBe("nenhum");

    const theme = aplicarTema(preset, { fundoEfeito: "particulas" });
    const resolvido = resolverEfeitoFundo(theme.fundoEfeito, undefined, skin.nicho);
    expect(resolvido?.efeito.id).toBe("particulas");
  });
});
