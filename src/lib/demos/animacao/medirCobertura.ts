"use client";

import { useEffect, useRef } from "react";

import { coberturaAnimada, type FaixaSecao } from "./cobertura";

/**
 * Leitura no DOM da cobertura animada (ver ./cobertura.ts, que tem a
 * matemática e o porquê). Os marcadores são os `data-d-secao-anim` que toda
 * skin publica em volta de cada seção (ver ./SecaoMarcada.tsx).
 *
 * Custo: uma consulta e ~10 `getBoundingClientRect` por quadro, e só
 * enquanto a página rola — o listener é passivo e throttled por rAF, e o
 * resultado vai DIRETO pro DOM por um callback (nenhum estado React por
 * quadro), o mesmo padrão do LedEdges.
 *
 * Sobre `prefers-reduced-motion`: esta medição continua rodando. Ela não
 * é movimento autônomo — a opacidade só muda quando a PESSOA rola a
 * página, como um `position: sticky`. Desligá-la faria a demo ignorar a
 * escolha "sem animação nesta seção" justamente para quem pediu menos
 * movimento, que é o contrário do que se quer.
 */

/** Faixas das seções marcadas, em pixels relativos à viewport. */
export function medirFaixas(doc: Document = document): FaixaSecao[] {
  const faixas: FaixaSecao[] = [];
  for (const el of doc.querySelectorAll<HTMLElement>("[data-d-secao-anim]")) {
    const r = el.getBoundingClientRect();
    faixas.push({ topo: r.top, base: r.bottom, animada: el.dataset.dSecaoAnim !== "0" });
  }
  return faixas;
}

export function medirCobertura(anterior: number): number {
  return coberturaAnimada(medirFaixas(), window.innerHeight, anterior);
}

/**
 * Assina scroll/resize e chama `aoMudar` com a cobertura atual sempre que
 * ela muda de verdade (variação mínima de 0.002 — abaixo disso é ruído de
 * subpixel e só geraria repintura à toa). Chama uma vez no mount, e de
 * novo num beat seguinte: os marcadores das skins entram no DOM no mesmo
 * commit, mas imagens/fontes ainda mexem nas alturas logo depois.
 */
export function useCoberturaAnimada(aoMudar: (valor: number) => void) {
  const aoMudarRef = useRef(aoMudar);
  useEffect(() => {
    aoMudarRef.current = aoMudar;
  }, [aoMudar]);

  useEffect(() => {
    let raf = 0;
    let atual = 1;

    const medir = () => {
      const valor = medirCobertura(atual);
      if (Math.abs(valor - atual) < 0.002) return;
      atual = valor;
      aoMudarRef.current(valor);
    };

    const agendar = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        medir();
      });
    };

    medir();
    const beat = setTimeout(medir, 400);
    window.addEventListener("scroll", agendar, { passive: true });
    window.addEventListener("resize", agendar, { passive: true });
    return () => {
      window.removeEventListener("scroll", agendar);
      window.removeEventListener("resize", agendar);
      clearTimeout(beat);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
}
