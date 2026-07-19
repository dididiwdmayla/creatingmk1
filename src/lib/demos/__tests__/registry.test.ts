import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { DEFAULT_SKIN, SKINS, getSkin, getTheme } from "../registry";

describe("registro de skins", () => {
  it("tem ao menos uma skin e ids únicos", () => {
    expect(SKINS.length).toBeGreaterThan(0);
    const ids = SKINS.map((skin) => skin.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(DEFAULT_SKIN).toBe(SKINS[0]);
  });

  it("getSkin acha por id e devolve undefined para desconhecido", () => {
    expect(getSkin(DEFAULT_SKIN.id)).toBe(DEFAULT_SKIN);
    expect(getSkin("nao-existe")).toBeUndefined();
    expect(getSkin(undefined)).toBeUndefined();
  });

  it.each(SKINS.map((skin) => [skin.id, skin] as const))(
    "skin %s cumpre o contrato",
    (_id, skin) => {
      expect(skin.nicho).toBeTruthy();
      expect(skin.nome).toBeTruthy();
      expect(typeof skin.componente).toBe("function");

      // O default está entre os presets (a ficha oferece só presets).
      expect(skin.themePresets).toContain(skin.themeDefault);
      const themeIds = skin.themePresets.map((theme) => theme.id);
      expect(new Set(themeIds).size).toBe(themeIds.length);

      // Exemplo completo: é a base sobre a qual lead e ficha só sobrescrevem.
      const exemplo = skin.demoDataExemplo;
      expect(exemplo.nome).toBeTruthy();
      expect(exemplo.servicos.length).toBeGreaterThan(0);
      for (const servico of exemplo.servicos) {
        expect(servico.nome).toBeTruthy();
        expect(servico.preco).toBeTruthy();
      }

      // Placeholders locais por slot: caminho em /public que existe de fato.
      for (const [slot, src] of Object.entries(exemplo.imagens)) {
        expect(src, `imagem do slot ${slot}`).toMatch(/^\//);
        expect(
          existsSync(join(process.cwd(), "public", src)),
          `placeholder ausente em public${src} (slot ${slot})`,
        ).toBe(true);
      }

      // Miniatura do passo de escolha de skin: caminho local existente.
      expect(skin.thumbnail).toMatch(/^\//);
      expect(
        existsSync(join(process.cwd(), "public", skin.thumbnail)),
        `miniatura ausente em public${skin.thumbnail}`,
      ).toBe(true);

      // Limites de escala do título hero: min < max, ambos positivos.
      expect(skin.heroEscalaLimites.min).toBeGreaterThan(0);
      expect(skin.heroEscalaLimites.max).toBeGreaterThan(skin.heroEscalaLimites.min);

      // Vídeo-no-título é opt-in: NUNCA vem com vídeo de exemplo (a Forja
      // não versiona vídeo de terceiros — só imagem tem placeholder).
      expect(exemplo.videos).toBeUndefined();

      // Todo Theme (default + presets) resolve heroTitulo/led — ver tema.ts.
      for (const theme of skin.themePresets) {
        expect(theme.heroTitulo.escala).toBeGreaterThan(0);
        expect(["esquerda", "centro", "direita"]).toContain(theme.heroTitulo.alinhamento);
        expect(["desligado", "sutil", "marcante"]).toContain(theme.led);
      }

      // Contrato de seções do editor: ids únicos, presentes no exemplo
      // (o painel monta os campos a partir dele), pelo menos uma seção
      // reordenável e alignOptions só com valores válidos.
      const secaoIds = skin.secoes.map((secao) => secao.id);
      expect(secaoIds.length).toBeGreaterThan(0);
      expect(new Set(secaoIds).size).toBe(secaoIds.length);
      expect(skin.secoes.some((secao) => !secao.fixa)).toBe(true);
      for (const secao of skin.secoes) {
        expect(secao.nome, `nome da seção ${secao.id}`).toBeTruthy();
        expect(
          exemplo.secoes[secao.id],
          `seção ${secao.id} declarada mas ausente no exemplo`,
        ).toBeDefined();
        for (const opcao of secao.alignOptions ?? []) {
          expect(["esquerda", "centro", "direita"]).toContain(opcao);
        }
        for (const opcao of secao.entradaOptions ?? []) {
          expect([
            "nenhuma",
            "fade",
            "deslizar-esquerda",
            "deslizar-direita",
            "typewriter",
          ]).toContain(opcao);
        }
      }
    },
  );

  it("videoSlots é opt-in por skin (tatuagem tem, barbearia não)", () => {
    const tatuagem = SKINS.find((s) => s.id === "tatuagem-editorial");
    const barbearia = SKINS.find((s) => s.id === "barbearia-editorial");
    expect(tatuagem?.videoSlots).toEqual(["titulo"]);
    expect(barbearia?.videoSlots ?? []).toEqual([]);
  });

  it("getTheme cai no default quando o preset não existe", () => {
    expect(getTheme(DEFAULT_SKIN, "nao-existe")).toBe(DEFAULT_SKIN.themeDefault);
    expect(getTheme(DEFAULT_SKIN, undefined)).toBe(DEFAULT_SKIN.themeDefault);
    const outro = DEFAULT_SKIN.themePresets.find((t) => t !== DEFAULT_SKIN.themeDefault);
    if (outro) expect(getTheme(DEFAULT_SKIN, outro.id)).toBe(outro);
  });
});
