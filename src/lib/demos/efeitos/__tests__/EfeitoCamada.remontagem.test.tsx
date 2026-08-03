// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it } from "vitest";

import { LedEdges } from "../../led/LedEdges";
import { resolverCamadaEfeito } from "../camada";
import { EfeitoCamada } from "../EfeitoCamada";

/**
 * REGRESSÃO: **nenhum bloco de estilo da camada decorativa pode sobrar no
 * DOM depois que o componente que o injetou desmonta.**
 *
 * O `<style>` do modo de cor (`@property --d-efeito-cN` + `@keyframes
 * d-cores-efeito`) e o `<style>` do próprio efeito vivem no JSX, e o
 * editor remonta a camada com frequência (troca de efeito, troca de modo
 * de cor, troca de skin — cada uma muda a identidade do componente
 * renderizado). Se um desses blocos ficasse órfão, dez remontagens
 * deixariam dez `@keyframes` de mesmo nome no documento: o navegador passa
 * a resolver o último declarado, as `@property` duplicadas disputam o
 * `initial-value` e a página acumula folha morta a cada tecla digitada.
 *
 * Hoje o React remove o `<style>` junto com o componente e o número fica
 * em 1 — medido também no editor real (30 caracteres digitados com o
 * preview aberto: 1 bloco antes, 1 depois, nos 5 efeitos que têm bloco
 * próprio). Este teste é o que trava a regra, para que uma migração futura
 * para folha global / `adoptedStyleSheets` continue tendo que deduplicar.
 */

const REMONTAGENS = 10;

beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  document.body.innerHTML = "";
});

/** Blocos de estilo do documento inteiro que casam com o padrão. */
function blocos(padrao: RegExp): number {
  return [...document.querySelectorAll("style")].filter((s) => padrao.test(s.textContent ?? "")).length;
}

const PALETA = {
  fundo: "#101010",
  fundoAlt: "#151515",
  fundoElevado: "#1c1c1c",
  destaque: "#d8a657",
  destaqueInk: "#101010",
  texto: "#f2ede4",
  textoSuave: "#a89c88",
  borda: "#2a2a2a",
  acentoSecundario: "#7aa2c4",
  acentoTerciario: "#c47a7a",
};

describe("camada decorativa: nenhum bloco de estilo órfão após remontagens", () => {
  for (const modo of ["arco-iris", "iridescente", "transicao"] as const) {
    it(`modo "${modo}": ${REMONTAGENS} remontagens deixam no máximo 1 bloco de cada bloco de estilo`, () => {
      const camada = resolverCamadaEfeito({
        paleta: PALETA,
        efeitoId: "gradiente",
        efeitoCores: { modo, cores: ["#00c2ff", "#ff2e88", "#ffd23f"] },
        auraCores: undefined,
      });
      // Pré-condição: o modo escolhido REALMENTE injeta CSS — senão o teste
      // passaria contando zero e não provaria nada.
      expect(camada.coresCss).toContain("@keyframes d-cores-efeito");

      for (let i = 0; i < REMONTAGENS; i++) {
        const container = document.createElement("div");
        document.body.appendChild(container);
        let root!: ReturnType<typeof createRoot>;
        act(() => {
          root = createRoot(container);
          root.render(
            <EfeitoCamada
              id="gradiente"
              intensidade={3}
              cores={camada.cores}
              coresCss={camada.coresCss}
              coresAnimacao={camada.coresAnimacao}
            />,
          );
        });
        // Enquanto montada, existe exatamente UM bloco — nunca zero (o
        // efeito perderia a cor animada), nunca dois.
        expect(blocos(/@keyframes\s+d-cores-efeito/)).toBe(1);
        expect(blocos(/@property\s+--d-efeito-c1/)).toBe(1);

        act(() => root.unmount());
        container.remove();
      }

      expect(blocos(/@keyframes\s+d-cores-efeito/)).toBe(0);
      expect(blocos(/@property\s+--d-efeito-c1/)).toBe(0);
      expect(document.querySelectorAll("style").length).toBe(0);
    });
  }

  it(`LED: ${REMONTAGENS} remontagens não acumulam o <style> do estilo nem o do modo de cor`, () => {
    for (let i = 0; i < REMONTAGENS; i++) {
      const container = document.createElement("div");
      document.body.appendChild(container);
      let root!: ReturnType<typeof createRoot>;
      act(() => {
        root = createRoot(container);
        root.render(
          <LedEdges
            preset="marcante"
            estilo="moldura"
            cores={{ modo: "arco-iris" }}
            corBase={PALETA.destaque}
          />,
        );
      });
      expect(blocos(/\.d-led-edges/)).toBe(1);
      expect(blocos(/@keyframes\s+d-cores-led/)).toBe(1);

      act(() => root.unmount());
      container.remove();
    }

    expect(document.querySelectorAll("style").length).toBe(0);
  });
});
