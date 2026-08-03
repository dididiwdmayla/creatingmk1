import { describe, expect, it } from "vitest";

import { cssPlanoDaPagina } from "../plano";

describe("cssPlanoDaPagina", () => {
  it("pinta o body com a cor pedida, vencendo a classe do layout raiz", () => {
    // O `!important` não é enfeite: o `<body>` vem do layout RAIZ com a
    // classe `bg-background` do app, e um seletor de elemento perde de
    // uma classe por especificidade. Ver o cabeçalho de ../plano.ts.
    expect(cssPlanoDaPagina("#1a1411")).toBe("body{background-color:#1a1411 !important}");
  });

  it("só cor hex entra no CSS — a paleta é dado, e dado não vira sintaxe", () => {
    expect(cssPlanoDaPagina("red;} body{display:none")).toBe("");
    expect(cssPlanoDaPagina("var(--d-bg)")).toBe("");
    expect(cssPlanoDaPagina("")).toBe("");
  });
});
