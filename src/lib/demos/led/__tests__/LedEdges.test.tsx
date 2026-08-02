// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { LedEdges } from "../LedEdges";

/**
 * Cobre o contrato do registro de estilos aplicado ao componente real: o
 * DOM muda por estilo (barra/dissipado usam as mesmas 2 barras — só o CSS
 * difere —, cantos usa 4 cantos, moldura usa 4 lados), o nível
 * "desligado" nunca monta nada e o estilo ausente cai no padrão ("barra").
 */
beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
});

function montar(container: HTMLElement, preset: "desligado" | "sutil" | "marcante", estilo?: string): Root {
  let root!: Root;
  act(() => {
    root = createRoot(container);
    root.render(<LedEdges preset={preset} estilo={estilo} />);
  });
  return root;
}

describe("LedEdges", () => {
  let container: HTMLElement;
  let root: Root | undefined;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (root) act(() => root!.unmount());
    container.remove();
  });

  it('"desligado" não monta nada', () => {
    root = montar(container, "desligado", "moldura");
    expect(container.innerHTML).toBe("");
  });

  it('estilo ausente cai no padrão "barra" (2 barras, left/right)', () => {
    root = montar(container, "sutil");
    const wrapper = container.querySelector("[data-d-led-estilo]");
    expect(wrapper?.getAttribute("data-d-led-estilo")).toBe("barra");
    expect(container.querySelectorAll(".d-led-bar").length).toBe(2);
    expect(container.querySelector(".d-led-left")).toBeTruthy();
    expect(container.querySelector(".d-led-right")).toBeTruthy();
  });

  it('"dissipado" reaproveita a mesma estrutura de 2 barras', () => {
    root = montar(container, "sutil", "dissipado");
    expect(container.querySelectorAll(".d-led-bar").length).toBe(2);
  });

  it('"cantos" renderiza 4 cantos, sem barra contínua', () => {
    root = montar(container, "sutil", "cantos");
    expect(container.querySelectorAll(".d-led-corner").length).toBe(4);
    expect(container.querySelectorAll(".d-led-bar").length).toBe(0);
  });

  it('"moldura" renderiza o perímetro completo (4 lados)', () => {
    root = montar(container, "sutil", "moldura");
    const lados = container.querySelectorAll(".d-led-side");
    expect(lados.length).toBe(4);
    expect(container.querySelector(".d-led-side-top")).toBeTruthy();
    expect(container.querySelector(".d-led-side-right")).toBeTruthy();
    expect(container.querySelector(".d-led-side-bottom")).toBeTruthy();
    expect(container.querySelector(".d-led-side-left")).toBeTruthy();
  });

  it("clique dispara o pulso (classe d-led-pulse) independente do estilo", () => {
    root = montar(container, "sutil", "cantos");
    const wrapper = container.querySelector("[data-d-led-estilo]");
    expect(wrapper?.classList.contains("d-led-pulse")).toBe(false);
    act(() => {
      document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(wrapper?.classList.contains("d-led-pulse")).toBe(true);
  });
});
