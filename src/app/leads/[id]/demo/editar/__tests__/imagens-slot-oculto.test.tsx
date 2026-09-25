import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { montarDemoData } from "@/lib/demos/montar";
import { getSkin, SKINS } from "@/lib/demos/registry";
import { exemploDaSkin } from "@/lib/demos/variantes";
import type { SkinDefinition } from "@/lib/demos/types";

import { PainelImagens } from "../paineis";

/**
 * Aba Imagens: o slot que a VARIANTE ABERTA não desenha tem de avisar.
 *
 * Uma variante decide EXIBIR, nunca se o slot existe — as quatro
 * compartilham o mesmo contrato de slots, e é isso que a trava garante.
 * Mas duas composições da tatuagem não desenham uma das fotos (a abertura
 * `cartaz` não tem foto de fundo; o artista `indice` não tem retrato), e
 * sem aviso o operador sobe a imagem, não vê nada mudar e conclui que
 * está quebrado.
 *
 * O aviso é por VARIANTE: a mesma foto que some numa aparece na outra, e
 * dizer "não aparece" onde ela aparece seria pior que não dizer nada.
 */
const skin = getSkin("tatuagem-editorial")!;

function html(skinAlvo: SkinDefinition, themeId: string) {
  const dados = montarDemoData(exemploDaSkin(skinAlvo, themeId), undefined, undefined, skinAlvo.id);
  return renderToStaticMarkup(
    <PainelImagens
      dados={dados}
      skin={skinAlvo}
      themeId={themeId}
      uploadSlot={null}
      erro={null}
      onUpload={() => {}}
      onRemover={() => {}}
      imagensModo="foto"
      onImagensModoChange={() => {}}
    />,
  );
}

const avisoDe = (markup: string, slot: string) =>
  markup.match(new RegExp(`data-editor-aviso="imagens\\.${slot}"[^>]*>([^<]*)<`))?.[1];

describe("aviso de slot não exibido na variante", () => {
  it("Vesperal avisa que o hero só preenche as letras do título", () => {
    // A abertura `cartaz` não desenha a foto de fundo — mas `imagens.hero`
    // continua sendo o que entra DENTRO das letras (ver Wordmark), então o
    // aviso não pode ser "não aparece".
    const aviso = avisoDe(html(skin, "vesperal"), "hero");
    expect(aviso).toContain("letras do título");
    expect(aviso).not.toContain("Não aparece");
  });

  it("Cripta avisa que o retrato do artista não aparece", () => {
    expect(avisoDe(html(skin, "cripta"), "sobre")).toContain("Não aparece nesta variante");
  });

  it("o aviso é da variante aberta, não da skin", () => {
    // O mesmo slot, nas outras três: nenhum aviso.
    for (const id of ["sangue", "cripta", "marfim"]) {
      expect(avisoDe(html(skin, id), "hero"), `hero em ${id}`).toBeUndefined();
    }
    for (const id of ["sangue", "vesperal", "marfim"]) {
      expect(avisoDe(html(skin, id), "sobre"), `sobre em ${id}`).toBeUndefined();
    }
  });

  it("todo slot declarado existe no contrato de imagens da skin — TODA skin do registro", () => {
    // Um typo em `imagensOcultas` avisaria sobre um slot que não existe, e
    // ninguém veria — o aviso simplesmente nunca apareceria. Generalizado
    // pra todo o registro (não só tatuagem): sem isso, um typo na chapa
    // burger só apareceria olhando ESTE arquivo, e ele nunca olha pra lá.
    for (const s of SKINS) {
      const contrato = new Set(Object.keys(s.demoDataExemplo.imagens));
      for (const variante of s.variantes ?? []) {
        for (const slot of Object.keys(variante.imagensOcultas ?? {})) {
          expect(contrato.has(slot), `${s.id} / "${variante.id}": slot "${slot}"`).toBe(true);
        }
      }
    }
  });

  it("skin sem variantes não ganha aviso nenhum", () => {
    // tatuagem-pigmento-vivo ganhou variantes nesta migração — imobiliaria-
    // curada continua sem o eixo (SkinDefinition.variantes ausente).
    const outra = getSkin("imobiliaria-curada")!;
    expect(html(outra, outra.themeDefault.id)).not.toContain("data-editor-aviso");
  });
});

/**
 * A chapa burger não tem uma composição "sem foto de fundo" como a
 * `cartaz` da tatuagem — as três oculta são sempre `nenhum` (comida
 * flutuante fora de lugar, ou uma carta tipográfica). Por isso não há um
 * "Vesperal" aqui: as duas variantes que escondem slot têm a MESMA frase,
 * e o que precisa provar é a lista COMPLETA de slots por variante, não uma
 * frase especial.
 */
describe("aviso de slot não exibido — lancheria-chapa-burger", () => {
  const chapa = getSkin("lancheria-chapa-burger")!;

  it("balcao avisa sobre os três flutuantes, e só eles", () => {
    const markup = html(chapa, "balcao");
    for (const slot of ["flutuante-bacon", "flutuante-queijo", "flutuante-bebida"]) {
      expect(avisoDe(markup, slot), slot).toContain("Não aparece nesta variante");
    }
    for (const slot of ["bebida-1", "bebida-2", "bebida-3", "bebida-4", "bebida-5"]) {
      expect(avisoDe(markup, slot), slot).toBeUndefined();
    }
  });

  it("sala avisa sobre as cinco bebidas E os três flutuantes — a carta é tipográfica", () => {
    const markup = html(chapa, "sala");
    for (const slot of [
      "bebida-1", "bebida-2", "bebida-3", "bebida-4", "bebida-5",
      "flutuante-bacon", "flutuante-queijo", "flutuante-bebida",
    ]) {
      expect(avisoDe(markup, slot), slot).toContain("Não aparece nesta variante");
    }
  });

  it("chapa e praca desenham os 20 — nenhum aviso", () => {
    for (const id of ["chapa", "praca"]) {
      expect(html(chapa, id), id).not.toContain("data-editor-aviso");
    }
  });

  it("o aviso é da variante aberta: bebida-1 avisa na sala, não na balcao nem na chapa", () => {
    expect(avisoDe(html(chapa, "sala"), "bebida-1")).toContain("Não aparece nesta variante");
    expect(avisoDe(html(chapa, "balcao"), "bebida-1")).toBeUndefined();
    expect(avisoDe(html(chapa, "chapa"), "bebida-1")).toBeUndefined();
  });
});

/**
 * A multimarcas também só oculta `hero` — nas outras duas (garagem, campo) a
 * abertura desenha foto e os onze slots aparecem (docs/plano-multimarcas.md
 * §8). Mesma frase genérica da chapa burger, então o que precisa provar é a
 * lista completa por variante, não uma frase especial.
 */
describe("aviso de slot não exibido — multimarcas-vortice", () => {
  const multimarcas = getSkin("multimarcas-vortice")!;
  const SLOTS = ["hero", "destaque", ...Array.from({ length: 9 }, (_, i) => `carro-${i + 1}`)];

  it.each(["vortice", "patio"])("%s avisa só sobre o hero", (id) => {
    const markup = html(multimarcas, id);
    expect(avisoDe(markup, "hero"), "hero").toContain("Não aparece nesta variante");
    for (const slot of SLOTS.filter((s) => s !== "hero")) {
      expect(avisoDe(markup, slot), slot).toBeUndefined();
    }
  });

  it("garagem e campo desenham os onze — nenhum aviso", () => {
    for (const id of ["garagem", "campo"]) {
      expect(html(multimarcas, id), id).not.toContain("data-editor-aviso");
    }
  });

  it("o aviso é da variante aberta: hero avisa na vortice, não na garagem nem na campo", () => {
    expect(avisoDe(html(multimarcas, "vortice"), "hero")).toContain("Não aparece nesta variante");
    expect(avisoDe(html(multimarcas, "garagem"), "hero")).toBeUndefined();
    expect(avisoDe(html(multimarcas, "campo"), "hero")).toBeUndefined();
  });
});
