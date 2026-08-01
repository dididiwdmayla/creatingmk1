import { describe, expect, it } from "vitest";

import { alvoPonteiro, alvoScroll, deriva, fatorLerp, lerpPonto } from "../alvo";

describe("alvoPonteiro (desktop)", () => {
  const rect = { left: 0, top: 0, width: 200, height: 100 };

  it("ponteiro no centro do container => alvo no centro (0,0)", () => {
    expect(alvoPonteiro(100, 50, rect)).toEqual({ x: 0, y: 0 });
  });

  it("ponteiro no canto superior esquerdo => alvo negativo", () => {
    const alvo = alvoPonteiro(0, 0, rect);
    expect(alvo.x).toBeLessThan(0);
    expect(alvo.y).toBeLessThan(0);
  });

  it("ponteiro no canto inferior direito => alvo positivo", () => {
    const alvo = alvoPonteiro(200, 100, rect);
    expect(alvo.x).toBeGreaterThan(0);
    expect(alvo.y).toBeGreaterThan(0);
  });
});

describe("alvoScroll (celular) — alvo é o centro da viewport, deslocado pelo scroll", () => {
  it("no meio do scroll (pct 0.5), o alvo é o centro (0,0)", () => {
    expect(alvoScroll(50, 100)).toEqual({ x: 0, y: 0 });
  });

  it("no topo da página, o alvo desloca pra um lado", () => {
    const alvo = alvoScroll(0, 100);
    expect(alvo.x).toBeLessThan(0);
    expect(alvo.y).toBeLessThan(0);
  });

  it("no fim da página, o alvo desloca pro lado oposto", () => {
    const alvo = alvoScroll(100, 100);
    expect(alvo.x).toBeGreaterThan(0);
    expect(alvo.y).toBeGreaterThan(0);
  });

  it("página mais curta que a viewport (scrollMax <= 0) nunca divide por zero", () => {
    expect(alvoScroll(0, 0)).toEqual(alvoScroll(0, -10));
    expect(Number.isFinite(alvoScroll(0, 0).x)).toBe(true);
    expect(Number.isFinite(alvoScroll(0, -10).x)).toBe(true);
  });
});

describe("deriva — deriva lenta autônoma, nunca parada", () => {
  it("varia entre instantes diferentes (nunca morre parado)", () => {
    const a = deriva(0);
    const b = deriva(5000);
    expect(a).not.toEqual(b);
  });

  it("amplitude limitada (senoidal, não escapa a escala do alvo)", () => {
    for (const t of [0, 1000, 5000, 20000, 123456]) {
      const d = deriva(t);
      expect(Math.abs(d.x)).toBeLessThanOrEqual(8);
      expect(Math.abs(d.y)).toBeLessThanOrEqual(8);
    }
  });
});

describe("lerpPonto — interpolação suave, nunca posição colada", () => {
  it("fator 0: fica exatamente onde está (não se move)", () => {
    expect(lerpPonto({ x: 5, y: 5 }, { x: 20, y: 20 }, 0)).toEqual({ x: 5, y: 5 });
  });

  it("fator entre 0 e 1: se aproxima do alvo sem chegar (nunca cola)", () => {
    const proximo = lerpPonto({ x: 0, y: 0 }, { x: 10, y: 10 }, 0.1);
    expect(proximo.x).toBeGreaterThan(0);
    expect(proximo.x).toBeLessThan(10);
  });

  it("fator 1: chega exatamente no alvo (limite superior, não usado na prática)", () => {
    expect(lerpPonto({ x: 0, y: 0 }, { x: 10, y: 10 }, 1)).toEqual({ x: 10, y: 10 });
  });
});

describe("fatorLerp — intensidade maior alcança o alvo mais rápido", () => {
  it("escala monotonicamente com a intensidade", () => {
    expect(fatorLerp(1)).toBeLessThan(fatorLerp(2));
    expect(fatorLerp(2)).toBeLessThan(fatorLerp(3));
  });

  it("nunca é 0 nem >= 1 (sempre interpola, nunca cola nem trava)", () => {
    for (const i of [1, 2, 3] as const) {
      expect(fatorLerp(i)).toBeGreaterThan(0);
      expect(fatorLerp(i)).toBeLessThan(1);
    }
  });
});
