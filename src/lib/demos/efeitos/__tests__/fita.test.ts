import { describe, expect, it } from "vitest";

import { fitaAfilada, perfilEspessura, pontoCubica, type Ponto } from "../fita";

const reta = (t: number): Ponto => ({ x: t * 100, y: 50 });

describe("perfilEspessura", () => {
  it("é zero nas duas pontas — a fita nasce e morre em nada, sem aresta", () => {
    expect(perfilEspessura(0, 5, 3, 0)).toBeCloseTo(0, 6);
    expect(perfilEspessura(1, 5, 3, 0)).toBeCloseTo(0, 6);
  });

  it("nunca passa da espessura máxima pedida", () => {
    for (let i = 0; i <= 40; i++) {
      expect(perfilEspessura(i / 40, 5, 3, 1.2)).toBeLessThanOrEqual(5 + 1e-9);
    }
  });

  it("não é uniforme ao longo do traço (ondulação, não lente simétrica)", () => {
    const amostras = Array.from({ length: 21 }, (_, i) => perfilEspessura(i / 20, 5, 3, 0.7));
    // Espelhar em torno do meio deve DIFERIR: uma lente simétrica pura
    // seria idêntica, e é exatamente isso que a ondulação existe pra evitar.
    const espelhado = [...amostras].reverse();
    const maiorDiferenca = Math.max(...amostras.map((v, i) => Math.abs(v - espelhado[i])));
    expect(maiorDiferenca).toBeGreaterThan(0.2);
  });
});

describe("fitaAfilada", () => {
  it("gera um contorno FECHADO com só comandos M/L/Z", () => {
    const d = fitaAfilada(reta, (t) => perfilEspessura(t, 4, 2, 0));
    expect(d.startsWith("M ")).toBe(true);
    expect(d.endsWith(" Z")).toBe(true);
    expect(d.match(/[A-Za-z]/g)?.every((c) => "MLZ".includes(c))).toBe(true);
  });

  it("as duas pontas se fecham: primeiro e último vértice coincidem com a curva", () => {
    const d = fitaAfilada(reta, (t) => perfilEspessura(t, 4, 2, 0), 8);
    const numeros = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    const [x0, y0] = numeros;
    // Espessura zero em t=0 => o vértice cai EXATAMENTE sobre a curva.
    expect(x0).toBeCloseTo(0, 6);
    expect(y0).toBeCloseTo(50, 6);
  });

  it("é determinística (mesmo HTML no server e no client)", () => {
    const um = fitaAfilada(reta, (t) => perfilEspessura(t, 4, 2, 0.5));
    const dois = fitaAfilada(reta, (t) => perfilEspessura(t, 4, 2, 0.5));
    expect(um).toBe(dois);
  });

  it("a largura no meio acompanha a espessura pedida", () => {
    const meia = 6;
    const d = fitaAfilada(reta, () => meia, 2);
    const n = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    // Amostras: 3 na ida (t=0, .5, 1) e 3 na volta. O y do ponto do meio da
    // ida e o da volta ficam a 2×meia de distância.
    const yIdaMeio = n[3];
    const yVoltaMeio = n[9];
    expect(Math.abs(yIdaMeio - yVoltaMeio)).toBeCloseTo(2 * meia, 6);
  });
});

describe("pontoCubica", () => {
  it("começa em p0 e termina em p3", () => {
    const p0 = { x: 0, y: 0 };
    const c1 = { x: 10, y: 40 };
    const c2 = { x: 60, y: -20 };
    const p3 = { x: 100, y: 10 };
    expect(pontoCubica(p0, c1, c2, p3, 0)).toEqual(p0);
    const fim = pontoCubica(p0, c1, c2, p3, 1);
    expect(fim.x).toBeCloseTo(p3.x, 6);
    expect(fim.y).toBeCloseTo(p3.y, 6);
  });
});
