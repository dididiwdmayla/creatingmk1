import { describe, expect, it } from "vitest";

import type { CoresTrio } from "../modos";
import { coresEscolhidas, modoValido, resolverModoCores } from "../modos";

const BASE: CoresTrio = ["#c9a227", "#1b5e3b", "#7a0c0c"];

/** Matizes dos quadros de um @keyframes gerado — na ordem do slot pedido. */
function matizesDoSlot(css: string, slot: 1 | 2 | 3): number[] {
  return [...css.matchAll(new RegExp(`--d-x-c${slot}: hsl\\(([\\d.]+)`, "g"))].map((m) =>
    Number(m[1]),
  );
}

describe("resolverModoCores", () => {
  it('modo "tema" (e ausência de valor) devolve a base intacta, sem CSS nem animação', () => {
    for (const valor of [undefined, { modo: "tema" as const }]) {
      const r = resolverModoCores(valor, BASE, "x");
      expect(r.efetivo).toBe("tema");
      expect(r.cores).toEqual(BASE);
      expect(r.css).toBe("");
      expect(r.animacao).toBeUndefined();
    }
  });

  it('"fixa" ocupa os três papéis com a cor escolhida, sem animação', () => {
    const r = resolverModoCores({ modo: "fixa", cores: ["#ff00aa"] }, BASE, "x");
    expect(r.cores).toEqual(["#ff00aa", "#ff00aa", "#ff00aa"]);
    expect(r.css).toBe("");
    expect(r.animacao).toBeUndefined();
  });

  it('"transicao" gira as cores entre os papéis e volta ao quadro inicial', () => {
    const r = resolverModoCores({ modo: "transicao", cores: ["#ff0000", "#00ff00"] }, BASE, "x");
    expect(r.efetivo).toBe("transicao");
    expect(r.cores[0]).toBe("var(--d-x-c1, #c9a227)");
    expect(r.animacao?.nome).toBe("d-cores-x");
    // Duas cores → 2 passos de 14s.
    expect(r.animacao?.duracaoSegundos).toBe(28);
    expect(r.css).toContain('@property --d-x-c1');
    expect(r.css).toContain('syntax: "<color>"');
    expect(r.css).toContain("inherits: true");
    // Slot 1: cor A → cor B → cor A (o último quadro fecha o ciclo).
    const slot1 = [...r.css.matchAll(/--d-x-c1: (#\w+);/g)].map((m) => m[1]);
    expect(slot1).toEqual(["#ff0000", "#00ff00", "#ff0000"]);
    // Slot 2 anda uma cor à frente do slot 1 no mesmo quadro.
    const slot2 = [...r.css.matchAll(/--d-x-c2: (#\w+);/g)].map((m) => m[1]);
    expect(slot2).toEqual(["#00ff00", "#ff0000", "#00ff00"]);
    // 0% e 100% existem (senão a animação salta no fim do ciclo).
    expect(r.css).toContain("0% {");
    expect(r.css).toContain("100% {");
  });

  it('"transicao" com uma cor só vira "fixa"; sem cor válida volta pro tema', () => {
    expect(resolverModoCores({ modo: "transicao", cores: ["#ff0000"] }, BASE, "x").efetivo).toBe(
      "fixa",
    );
    expect(resolverModoCores({ modo: "transicao", cores: ["vermelho"] }, BASE, "x").efetivo).toBe(
      "tema",
    );
  });

  it('"iridescente" mantém a paleta e só desloca o matiz de leve, ida e volta', () => {
    const r = resolverModoCores({ modo: "iridescente" }, BASE, "x");
    const matizes = matizesDoSlot(r.css, 1);
    const baseMatiz = matizes[0];
    expect(matizes).toHaveLength(5);
    expect(matizes[4]).toBeCloseTo(baseMatiz, 1); // fecha o ciclo
    // Distância CIRCULAR de cada quadro até o matiz do tema.
    const desvios = matizes.map((h) => Math.abs((((h - baseMatiz + 540) % 360) + 360) % 360 - 180));
    // Sutil: nenhum quadro passa de ~16° do matiz do tema.
    expect(Math.max(...desvios)).toBeLessThanOrEqual(16.1);
    // …e o deslocamento existe de verdade (não é um ciclo parado).
    expect(Math.max(...desvios)).toBeGreaterThan(15);
    expect(r.animacao?.duracaoSegundos).toBe(20);
  });

  it('"arco-iris" percorre o círculo inteiro em passos e satura mais que o tema', () => {
    const r = resolverModoCores({ modo: "arco-iris" }, BASE, "x");
    const matizes = matizesDoSlot(r.css, 1);
    expect(matizes).toHaveLength(9); // 360/45 + o quadro de fechamento
    // Passos de 45°, sempre pra frente (mod 360).
    for (let i = 1; i < matizes.length; i++) {
      const passo = (matizes[i] - matizes[i - 1] + 360) % 360;
      expect(passo).toBeCloseTo(45, 1);
    }
    // "mais saturado": o verde escuro da base (#1b5e3b, s≈0.55) sobe.
    const saturacoes = [...r.css.matchAll(/--d-x-c2: hsl\([\d.]+ ([\d.]+)%/g)].map((m) =>
      Number(m[1]),
    );
    expect(Math.min(...saturacoes)).toBeGreaterThanOrEqual(62);
    expect(r.animacao?.timing).toBe("linear");
  });

  it("base sem matiz manipulável cai no tema em vez de quebrar", () => {
    const baseOpaca: CoresTrio = ["rgba(255,255,255,0.1)", "#1b5e3b", "#7a0c0c"];
    expect(resolverModoCores({ modo: "iridescente" }, baseOpaca, "x").efetivo).toBe("tema");
    expect(resolverModoCores({ modo: "arco-iris" }, baseOpaca, "x").efetivo).toBe("tema");
    // "fixa"/"transicao" não dependem da base — continuam funcionando.
    expect(resolverModoCores({ modo: "fixa", cores: ["#123456"] }, baseOpaca, "x").efetivo).toBe(
      "fixa",
    );
  });

  it("o fallback do var() é sempre a cor do tema (navegador sem @property mostra a demo de sempre)", () => {
    const r = resolverModoCores({ modo: "arco-iris" }, BASE, "efeito");
    expect(r.cores).toEqual([
      "var(--d-efeito-c1, #c9a227)",
      "var(--d-efeito-c2, #1b5e3b)",
      "var(--d-efeito-c3, #7a0c0c)",
    ]);
  });

  it("o prefixo separa os namespaces de efeito e LED", () => {
    const efeito = resolverModoCores({ modo: "iridescente" }, BASE, "efeito");
    const led = resolverModoCores({ modo: "iridescente" }, BASE, "led-cor");
    expect(efeito.animacao?.nome).not.toBe(led.animacao?.nome);
    expect(led.css).toContain("--d-led-cor-c1");
    expect(led.css).not.toContain("--d-efeito-c1");
  });

  it("modo desconhecido cai no tema", () => {
    expect(modoValido("psicodelico")).toBe(false);
    // @ts-expect-error — entrada inválida vinda de dado antigo/persistido
    expect(resolverModoCores({ modo: "psicodelico" }, BASE, "x").efetivo).toBe("tema");
  });

  it("coresEscolhidas descarta o que não é hex e limita a três", () => {
    expect(
      coresEscolhidas({ modo: "transicao", cores: ["#fff", "nope", "#000000", "#111", "#222"] }),
    ).toEqual(["#fff", "#000000", "#111"]);
  });
});
