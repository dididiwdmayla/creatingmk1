import { describe, expect, it } from "vitest";

import { ordemEfetiva, secaoAnimada, secoesVisiveis } from "../estrutura";
import type { DemoData, SkinSecaoDef } from "../types";

const SECOES: SkinSecaoDef[] = [
  { id: "hero", nome: "Hero", fixa: true },
  { id: "a", nome: "A" },
  { id: "b", nome: "B" },
  { id: "c", nome: "C" },
];

function data(parcial: Partial<DemoData>): DemoData {
  return {
    nome: "X",
    servicos: [],
    depoimentos: [],
    secoes: {},
    imagens: {},
    ...parcial,
  };
}

describe("ordemEfetiva", () => {
  it("sem ordem salva, usa a ordem default da skin", () => {
    expect(ordemEfetiva(SECOES, undefined)).toEqual(["hero", "a", "b", "c"]);
    expect(ordemEfetiva(SECOES, [])).toEqual(["hero", "a", "b", "c"]);
  });

  it("reordena as não-fixas mantendo a fixa no lugar", () => {
    expect(ordemEfetiva(SECOES, ["c", "a", "b"])).toEqual(["hero", "c", "a", "b"]);
  });

  it("ignora ids desconhecidos; não listadas entram antes da sucessora listada no contrato", () => {
    // Nenhuma pedida sucede "a" nem "b" no contrato (só "c" está listada, e
    // "c" é a última do contrato) — as duas entram antes dela, na ordem do
    // contrato.
    expect(ordemEfetiva(SECOES, ["c", "zzz"])).toEqual(["hero", "a", "b", "c"]);
  });

  it("id de seção fixa na ordem é ignorado", () => {
    // "a" sucede antes de "b" (a pedida) no contrato → entra antes dela;
    // "c" vem DEPOIS de "b" no contrato → sem sucessora listada, vai pro fim.
    expect(ordemEfetiva(SECOES, ["hero", "b"])).toEqual(["hero", "a", "b", "c"]);
  });

  it("seção não listada entra antes da primeira sucessora listada no contrato, não no fim", () => {
    // Contrato: hero, a, b, c. Só "c" foi pedida — "a" e "b" (não listadas,
    // ambas ANTES de "c" no contrato) entram coladas antes dela, na ordem em
    // que aparecem no contrato — e não depois: é o defeito que uma seção
    // nova no meio do contrato causaria se a regra continuasse "sempre no
    // fim" (ver docs/plano-multimarcas.md §5).
    expect(ordemEfetiva(SECOES, ["c"])).toEqual(["hero", "a", "b", "c"]);
  });

  it("seção não listada sem sucessora pedida vai para o fim", () => {
    // "c" é a última do contrato: nenhuma pedida a sucede.
    expect(ordemEfetiva(SECOES, ["b", "a"])).toEqual(["hero", "b", "a", "c"]);
  });
});

describe("secoesVisiveis", () => {
  it("todas visíveis por default", () => {
    expect(secoesVisiveis(SECOES, data({}))).toEqual(["hero", "a", "b", "c"]);
  });

  it("oculta some; fixa nunca some", () => {
    const d = data({ secoes: { b: { oculta: true }, hero: { oculta: true } } });
    expect(secoesVisiveis(SECOES, d)).toEqual(["hero", "a", "c"]);
  });

  it("combina ordem + ocultas", () => {
    const d = data({
      ordemSecoes: ["c", "b", "a"],
      secoes: { a: { oculta: true } },
    });
    expect(secoesVisiveis(SECOES, d)).toEqual(["hero", "c", "b"]);
  });
});

describe("secaoAnimada", () => {
  it("ausente = ligada (o que toda demo publicada antes do controle tem)", () => {
    expect(secaoAnimada(data({}), "a")).toBe(true);
    expect(secaoAnimada(data({ secoes: { a: { titulo: "X" } } }), "a")).toBe(true);
    expect(secaoAnimada(data({}), "secao-que-nao-existe")).toBe(true);
  });

  it("só o false desliga — e vale pra seção fixa também", () => {
    const d = data({ secoes: { a: { animacao: false }, hero: { animacao: false } } });
    expect(secaoAnimada(d, "a")).toBe(false);
    expect(secaoAnimada(d, "hero")).toBe(false);
    expect(secaoAnimada(d, "b")).toBe(true);
  });

  it("desligar animação não esconde a seção (é outro controle)", () => {
    const d = data({ secoes: { a: { animacao: false } } });
    expect(secoesVisiveis(SECOES, d)).toContain("a");
  });
});
