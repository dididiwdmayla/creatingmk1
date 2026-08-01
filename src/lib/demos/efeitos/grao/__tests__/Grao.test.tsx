// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ThemePaleta } from "@/lib/demos/types";

import { Grao } from "../Grao";

/**
 * Testa a reatividade do componente real (não a versão estática de
 * registry.test.ts, que só verifica um render isolado por chamada — não
 * pega bug de re-render na MESMA instância). jsdom não implementa canvas
 * nativamente (ver node_modules/jsdom): stub mínimo de getContext/
 * toDataURL só pra `gerarTileRuido` completar sem lançar.
 */

const CORES: ThemePaleta = {
  fundo: "#111111",
  fundoAlt: "#1c1c1c",
  fundoElevado: "#242424",
  destaque: "#ff6600",
  destaqueInk: "#111111",
  texto: "#f5f5f5",
  textoSuave: "#bbbbbb",
  borda: "rgba(255,255,255,0.1)",
  acentoSecundario: "#22aaff",
  acentoTerciario: "#88cc00",
};

let observados: Element[] = [];

beforeEach(() => {
  observados = [];
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = class {
    observe(el: Element) {
      observados.push(el);
    }
    disconnect() {}
    unobserve() {}
  };
  HTMLCanvasElement.prototype.getContext = (() => ({
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: () => {},
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.toDataURL = () => "data:image/png;base64,FAKE";
});

function montar(container: HTMLElement, intensidade: 0 | 1 | 2 | 3): Root {
  let root!: Root;
  act(() => {
    root = createRoot(container);
    root.render(<Grao intensidade={intensidade} cores={CORES} />);
  });
  return root;
}

function atualizar(root: Root, intensidade: 0 | 1 | 2 | 3) {
  act(() => {
    root.render(<Grao intensidade={intensidade} cores={CORES} />);
  });
}

describe("Grao — reage a mudança de intensidade sem remontagem manual", () => {
  let container: HTMLElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
  });

  it("0 -> 2: monta o overlay e observa o elemento na MESMA instância, sem remontar", () => {
    root = montar(container, 0);
    expect(container.innerHTML).toBe("");
    expect(observados.length).toBe(0);

    atualizar(root, 2);

    expect(container.innerHTML).not.toBe("");
    const div = container.querySelector("div");
    expect(div?.style.backgroundImage).toContain("data:image/png");
    // O IntersectionObserver deve observar o elemento assim que ele
    // aparece no DOM, mesmo tendo sido null no commit anterior (0).
    expect(observados).toEqual([div]);
  });

  it("2 -> 0: desmonta o overlay (volta a não renderizar nada)", () => {
    root = montar(container, 2);
    expect(container.innerHTML).not.toBe("");

    atualizar(root, 0);

    expect(container.innerHTML).toBe("");
  });

  it("0 -> 2 -> 0 -> 2: cada reaparição volta a observar o novo elemento", () => {
    root = montar(container, 0);
    atualizar(root, 2);
    const primeiroDiv = container.querySelector("div");
    expect(observados).toEqual([primeiroDiv]);

    atualizar(root, 0);
    expect(container.innerHTML).toBe("");

    atualizar(root, 2);
    const segundoDiv = container.querySelector("div");
    expect(segundoDiv).toBeTruthy();
    expect(observados).toEqual([primeiroDiv, segundoDiv]);
  });
});
