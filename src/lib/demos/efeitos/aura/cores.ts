import type { AuraCoresPatch, AuraCoresValor, ThemePaleta } from "../../types";

/**
 * Resolução das cores da aura, separada do componente pra ser testável sem
 * DOM (ver __tests__/cores.test.ts). Duas cores editáveis (uma por blob —
 * ver Aura.tsx), com dois jeitos de ligar: valores próprios (`primaria`/
 * `secundaria`, cada campo cai no default do tema se ausente) ou o preset
 * fixo "fumaça colorida" (deliberadamente independente da paleta do tema).
 * Sem nada escolhido, cai por completo no tema — comportamento de antes
 * deste controle existir.
 */

/** Preset "fumaça colorida" — vívido, sem relação com a paleta de nenhum tema. */
export const FUMACA_COLORIDA: Required<AuraCoresPatch> = {
  primaria: "#ff3ec8",
  secundaria: "#31e0ff",
};

/** Cores efetivas da aura (sempre concretas — nunca ausentes). */
export interface AuraCoresResolvidas {
  primaria: string;
  secundaria: string;
}

export function resolverCoresAura(
  valor: AuraCoresValor | undefined,
  paletaTema: Pick<ThemePaleta, "destaque" | "acentoSecundario">,
): AuraCoresResolvidas {
  if (valor === "fumaca-colorida") return FUMACA_COLORIDA;
  return {
    primaria: valor?.primaria ?? paletaTema.destaque,
    secundaria: valor?.secundaria ?? paletaTema.acentoSecundario,
  };
}

/**
 * Paleta efetiva pra passar como `cores` da aura: mesma paleta do tema,
 * só com `destaque`/`acentoSecundario` (os dois campos que Aura.tsx lê)
 * substituídos pelas cores resolvidas — o resto do contrato de efeitos
 * (`EfeitoProps.cores: ThemePaleta`) fica igual pros outros 3 efeitos, sem
 * precisar de um prop especial só pra aura.
 */
export function paletaParaAura(paleta: ThemePaleta, auraCores: AuraCoresValor | undefined): ThemePaleta {
  const { primaria, secundaria } = resolverCoresAura(auraCores, paleta);
  return { ...paleta, destaque: primaria, acentoSecundario: secundaria };
}
