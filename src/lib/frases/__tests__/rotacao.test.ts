import { describe, expect, it } from "vitest";

import {
  fraseAtual,
  frasesEfetivas,
  normalizarSlots,
  posicaoAtual,
  proximoIndice,
} from "../rotacao";

const TRES = ["primeira", "segunda", "terceira"];

describe("normalizarSlots", () => {
  it("completa até 3 slots e descarta lixo", () => {
    expect(normalizarSlots(["a"])).toEqual(["a", "", ""]);
    expect(normalizarSlots(undefined)).toEqual(["", "", ""]);
    expect(normalizarSlots([1, null, "c"])).toEqual(["", "", "c"]);
  });

  it("ignora slots além do terceiro", () => {
    expect(normalizarSlots(["a", "b", "c", "d"])).toEqual(["a", "b", "c"]);
  });
});

describe("frasesEfetivas", () => {
  it("mantém só os slots preenchidos, na ordem dos campos", () => {
    expect(frasesEfetivas({ frases: ["a", "  ", "c"] })).toEqual(["a", "c"]);
  });

  it("conjunto sem nada preenchido não participa da rotação", () => {
    expect(frasesEfetivas({ frases: ["", " ", ""] })).toEqual([]);
  });
});

describe("rotação 1→2→3→1", () => {
  it("gira as três frases e volta pra primeira", () => {
    let indice = 0;
    const vistas: (string | undefined)[] = [];
    for (let i = 0; i < 4; i++) {
      vistas.push(fraseAtual({ frases: TRES, indice }));
      indice = proximoIndice({ frases: TRES, indice });
    }

    expect(vistas).toEqual(["primeira", "segunda", "terceira", "primeira"]);
    expect(indice).toBe(1);
  });

  it("com duas frases preenchidas alterna entre as duas (não pula um slot vazio)", () => {
    const conjunto = { frases: ["a", "", "c"] };
    expect(fraseAtual({ ...conjunto, indice: 0 })).toBe("a");
    expect(proximoIndice({ ...conjunto, indice: 0 })).toBe(1);
    expect(fraseAtual({ ...conjunto, indice: 1 })).toBe("c");
    expect(proximoIndice({ ...conjunto, indice: 1 })).toBe(0);
  });

  it("com uma frase só, o contador não sai do lugar", () => {
    const conjunto = { frases: ["única", "", ""], indice: 0 };
    expect(fraseAtual(conjunto)).toBe("única");
    expect(proximoIndice(conjunto)).toBe(0);
  });
});

describe("índice fora da faixa", () => {
  it("apagar uma frase depois do contador ter passado dela não quebra a leitura", () => {
    // Contador em 2 (terceira frase) e o admin apaga a terceira: sobram duas.
    const conjunto = { frases: ["a", "b", ""], indice: 2 };
    expect(posicaoAtual(conjunto)).toBe(0);
    expect(fraseAtual(conjunto)).toBe("a");
    expect(proximoIndice(conjunto)).toBe(1);
  });

  it("índice sujo (negativo, fracionário) cai em 0", () => {
    expect(fraseAtual({ frases: TRES, indice: -3 })).toBe("primeira");
    expect(fraseAtual({ frases: TRES, indice: 1.5 })).toBe("primeira");
  });

  it("conjunto vazio não tem frase nem posição", () => {
    expect(posicaoAtual({ frases: ["", "", ""], indice: 0 })).toBeUndefined();
    expect(fraseAtual({ frases: ["", "", ""], indice: 0 })).toBeUndefined();
    expect(proximoIndice({ frases: ["", "", ""], indice: 7 })).toBe(0);
  });
});
