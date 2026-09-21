import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { montarDemoData } from "@/lib/demos/montar";
import { getSkin } from "@/lib/demos/registry";
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

  it("todo slot declarado existe no contrato de imagens da skin", () => {
    // Um typo em `imagensOcultas` avisaria sobre um slot que não existe, e
    // ninguém veria — o aviso simplesmente nunca apareceria.
    const contrato = new Set(Object.keys(skin.demoDataExemplo.imagens));
    for (const variante of skin.variantes ?? []) {
      for (const slot of Object.keys(variante.imagensOcultas ?? {})) {
        expect(contrato.has(slot), `variante "${variante.id}": slot "${slot}"`).toBe(true);
      }
    }
  });

  it("skin sem variantes não ganha aviso nenhum", () => {
    const outra = getSkin("tatuagem-pigmento-vivo")!;
    expect(html(outra, outra.themeDefault.id)).not.toContain("data-editor-aviso");
  });
});
