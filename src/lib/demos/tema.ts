import { getFonte } from "./fontes";
import type { TemaPatch, Theme } from "./types";

/**
 * Aplicação do TemaPatch (LeadDemo.tema) por cima do preset escolhido.
 * Funções puras: a rota pública /demo/[leadId] e o editor usam a mesma
 * montagem — o preview do editor é sempre fiel ao que será publicado.
 */

/** Raios de borda oferecidos pelo editor (do editorial reto ao bem suave). */
export const TEMA_RAIOS: readonly string[] = ["0px", "4px", "8px", "12px", "16px", "24px"];

/** #rgb ou #rrggbb (o editor grava sempre #rrggbb; leitura é tolerante). */
export const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function hexParaRgb(hex: string): { r: number; g: number; b: number } {
  const puro = hex.slice(1);
  const cheio =
    puro.length === 3 ? puro.split("").map((c) => c + c).join("") : puro;
  return {
    r: parseInt(cheio.slice(0, 2), 16),
    g: parseInt(cheio.slice(2, 4), 16),
    b: parseInt(cheio.slice(4, 6), 16),
  };
}

/** Luminância relativa (WCAG) de uma cor #hex. */
function luminancia(hex: string): number {
  const { r, g, b } = hexParaRgb(hex);
  const [lr, lg, lb] = [r, g, b].map((canal) => {
    const s = canal / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

/**
 * Ink (cor de texto) sobre um destaque customizado: preto ou branco, o que
 * tiver mais contraste — o preset garante o ink do destaque DELE, mas uma
 * cor escolhida a dedo precisa do cálculo.
 */
export function inkPara(destaque: string): string {
  const l = luminancia(destaque);
  const contrasteBranco = 1.05 / (l + 0.05);
  const contrastePreto = (l + 0.05) / 0.05;
  return contrastePreto >= contrasteBranco ? "#111111" : "#ffffff";
}

/** Tema efetivo do lead: preset ← ajustes do TemaPatch. Sem patch, o próprio preset. */
export function aplicarTema(preset: Theme, patch: TemaPatch | undefined): Theme {
  if (!patch) return preset;

  const fonteDisplay = getFonte(patch.fonteDisplay);
  const fonteCorpo = getFonte(patch.fonteCorpo);
  const destaqueValido = patch.destaque && HEX_RE.test(patch.destaque);

  return {
    ...preset,
    paleta: destaqueValido
      ? {
          ...preset.paleta,
          destaque: patch.destaque as string,
          destaqueInk: inkPara(patch.destaque as string),
        }
      : preset.paleta,
    fontes: {
      ...preset.fontes,
      ...(fonteDisplay && { display: fonteDisplay.css }),
      ...(fonteCorpo && { corpo: fonteCorpo.css }),
    },
    raio: patch.raio && TEMA_RAIOS.includes(patch.raio) ? patch.raio : preset.raio,
    densidade: patch.densidade ?? preset.densidade,
    animacao: patch.animacao ?? preset.animacao,
  };
}
