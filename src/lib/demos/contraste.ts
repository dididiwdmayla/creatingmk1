/**
 * Cor e contraste WCAG — módulo PURO (sem registro de efeitos, fontes nem
 * LED), para poder entrar em componente de cliente sem arrastar o resto de
 * ./tema.ts para o bundle. Extraído de ./tema.ts, que o reexporta.
 */

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
export function luminancia(hex: string): number {
  const { r, g, b } = hexParaRgb(hex);
  const [lr, lg, lb] = [r, g, b].map((canal) => {
    const s = canal / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

/** Razão de contraste WCAG entre duas cores #hex (1 a 21). */
export function contrasteWcag(a: string, b: string): number {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
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
