import { describe, expect, it } from "vitest";

import { montarDemoData } from "../montar";
import { montarPatch } from "../patch";
import { DEFAULT_SKIN } from "../registry";
import type { DemoData } from "../types";

/**
 * montarPatch é o inverso de aplicarPatch: o patch gerado, aplicado sobre
 * a base, tem que reproduzir o estado editado — e ser MÍNIMO (nada de
 * regravar o que é igual ao template).
 */

const BASE = DEFAULT_SKIN.demoDataExemplo;

function clone(data: DemoData): DemoData {
  return structuredClone(data);
}

describe("montarPatch", () => {
  it("sem edição, patch vazio", () => {
    expect(montarPatch(BASE, clone(BASE), DEFAULT_SKIN)).toEqual({});
  });

  it("campo de topo editado entra; igual à base ou esvaziado sai", () => {
    const atual = clone(BASE);
    atual.slogan = "Novo slogan";
    atual.endereco = ""; // esvaziado → volta ao padrão (fora do patch)
    const patch = montarPatch(BASE, atual, DEFAULT_SKIN);
    expect(patch).toEqual({ slogan: "Novo slogan" });
  });

  it("listas (servicos/itens) entram inteiras quando mudam", () => {
    const atual = clone(BASE);
    atual.servicos[0] = { ...atual.servicos[0], preco: "R$ 999" };
    atual.secoes.filosofia = {
      ...atual.secoes.filosofia,
      itens: [{ titulo: "SÓ UM PILAR" }],
    };
    const patch = montarPatch(BASE, atual, DEFAULT_SKIN);
    expect(patch.servicos).toHaveLength(BASE.servicos.length);
    expect(patch.servicos?.[0].preco).toBe("R$ 999");
    expect(patch.secoes?.filosofia).toEqual({ itens: [{ titulo: "SÓ UM PILAR" }] });
    expect(patch.depoimentos).toBeUndefined();
  });

  it("campo de seção editado gera diff só daquele campo", () => {
    const atual = clone(BASE);
    atual.secoes.hero = { ...atual.secoes.hero, titulo: "OUTRO TÍTULO." };
    const patch = montarPatch(BASE, atual, DEFAULT_SKIN);
    expect(patch.secoes).toEqual({ hero: { titulo: "OUTRO TÍTULO." } });
  });

  it("animacaoEntrada entra no diff; ausente (padrão do template) fica fora", () => {
    const atual = clone(BASE);
    atual.secoes.filosofia = { ...atual.secoes.filosofia, animacaoEntrada: "deslizar-esquerda" };
    const patch = montarPatch(BASE, atual, DEFAULT_SKIN);
    expect(patch.secoes).toEqual({ filosofia: { animacaoEntrada: "deslizar-esquerda" } });

    // Aplicado sobre a base, reproduz o estado editado (inverso de aplicarPatch).
    const efetivo = montarDemoData(BASE, undefined, patch);
    expect(efetivo.secoes.filosofia.animacaoEntrada).toBe("deslizar-esquerda");
  });

  it("oculta=true entra; alinhamento só quando difere do natural da skin", () => {
    const atual = clone(BASE);
    atual.secoes.ritual = { ...atual.secoes.ritual, oculta: true };
    atual.secoes.filosofia = { ...atual.secoes.filosofia, alinhamento: "centro" };
    // "esquerda" é o natural (primeira alignOption) → não entra.
    atual.secoes.agendamento = { ...atual.secoes.agendamento, alinhamento: "esquerda" };
    const patch = montarPatch(BASE, atual, DEFAULT_SKIN);
    expect(patch.secoes?.ritual).toEqual({ oculta: true });
    expect(patch.secoes?.filosofia).toEqual({ alinhamento: "centro" });
    expect(patch.secoes?.agendamento).toBeUndefined();
  });

  it("imagens: só os slots que apontam para longe do template", () => {
    const atual = clone(BASE);
    atual.imagens.hero = "https://storage.googleapis.com/b/demos/A/hero-1.webp";
    const patch = montarPatch(BASE, atual, DEFAULT_SKIN);
    expect(patch.imagens).toEqual({
      hero: "https://storage.googleapis.com/b/demos/A/hero-1.webp",
    });
  });

  it("videos: só entram slots que apontam pra longe da base (ausente = sem vídeo)", () => {
    const atual = clone(BASE);
    atual.videos = { titulo: "https://storage.googleapis.com/b/demos/A/video-titulo-1.mp4" };
    const patch = montarPatch(BASE, atual, DEFAULT_SKIN);
    expect(patch.videos).toEqual({
      titulo: "https://storage.googleapis.com/b/demos/A/video-titulo-1.mp4",
    });

    expect(montarPatch(BASE, clone(BASE), DEFAULT_SKIN).videos).toBeUndefined();
  });

  it("ordemSecoes entra só quando difere da ordem default", () => {
    const ordemDefault = DEFAULT_SKIN.secoes.filter((s) => !s.fixa).map((s) => s.id);
    const igual = clone(BASE);
    igual.ordemSecoes = [...ordemDefault];
    expect(montarPatch(BASE, igual, DEFAULT_SKIN).ordemSecoes).toBeUndefined();

    const trocada = clone(BASE);
    trocada.ordemSecoes = [...ordemDefault].reverse();
    expect(montarPatch(BASE, trocada, DEFAULT_SKIN).ordemSecoes).toEqual(
      [...ordemDefault].reverse(),
    );
  });

  it("round-trip: aplicar o patch sobre a base reproduz o estado editado", () => {
    const atual = clone(BASE);
    atual.nome = "BARBEARIA DO ZÉ";
    atual.servicos = atual.servicos.slice(0, 2);
    atual.secoes.equipe = { ...atual.secoes.equipe, oculta: true };
    atual.ordemSecoes = DEFAULT_SKIN.secoes
      .filter((s) => !s.fixa)
      .map((s) => s.id)
      .reverse();

    const patch = montarPatch(BASE, atual, DEFAULT_SKIN);
    const reaplicado = montarDemoData(BASE, undefined, patch);
    expect(reaplicado.nome).toBe("BARBEARIA DO ZÉ");
    expect(reaplicado.servicos).toEqual(atual.servicos);
    expect(reaplicado.secoes.equipe.oculta).toBe(true);
    expect(reaplicado.ordemSecoes).toEqual(atual.ordemSecoes);
  });
});
