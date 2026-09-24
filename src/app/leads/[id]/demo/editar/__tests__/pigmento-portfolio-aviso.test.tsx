import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { montarDemoData } from "@/lib/demos/montar";
import { getSkin } from "@/lib/demos/registry";
import { exemploDaSkin } from "@/lib/demos/variantes";
import type { DemoItem } from "@/lib/demos/types";

import { PainelImagens } from "../paineis";

/**
 * Aba Imagens da `tatuagem-pigmento-vivo`: o portfólio aceita até 30
 * itens (ver validate.ts), mas só existe foto pros 8 primeiros
 * (`portfolio-1`..`portfolio-8`) — do 9º em diante a peça sai só com a
 * legenda (Skin.tsx, `temSlot`). Sem aviso, o operador digita o 9º item
 * e não entende por que ele não tem onde subir foto (docs/plano-
 * tatuagem-pigmento-vivo.md §11).
 *
 * Não é `imagensOcultas` (que é POR VARIANTE): a contagem de itens é a
 * MESMA nas quatro — por isso o aviso não depende de `themeId`.
 */
const skin = getSkin("tatuagem-pigmento-vivo")!;

const item = (i: number): DemoItem => ({ titulo: `Peça ${i}`, subtitulo: "Teste", detalhe: "" });

function html(themeId: string, quantosItens: number) {
  const base = montarDemoData(exemploDaSkin(skin, themeId), undefined, undefined, skin.id);
  const dados = {
    ...base,
    secoes: {
      ...base.secoes,
      portfolio: { ...base.secoes.portfolio, itens: Array.from({ length: quantosItens }, (_, i) => item(i + 1)) },
    },
  };
  return renderToStaticMarkup(
    <PainelImagens
      dados={dados}
      skin={skin}
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

describe("aviso do 9º item do portfólio em diante — tatuagem-pigmento-vivo", () => {
  it("com 8 itens (o exemplo): nenhum aviso", () => {
    expect(html("aquarela", 8)).not.toContain("só com a legenda");
  });

  it("com 10 itens: avisa a contagem certa — 10 itens, 8 fotos", () => {
    const markup = html("aquarela", 10);
    expect(markup).toContain("O portfólio tem 10 itens e 8 fotos");
    expect(markup).toContain("9º item em diante");
  });

  it("não depende da variante aberta — a mesma contagem nas quatro", () => {
    for (const id of ["aquarela", "boreal", "meia-noite", "terra"]) {
      expect(html(id, 12), id).toContain("O portfólio tem 12 itens e 8 fotos");
    }
  });

  it("com menos itens que fotos: nenhum aviso (nada a avisar)", () => {
    expect(html("aquarela", 3)).not.toContain("só com a legenda");
  });
});
