"use client";

import { useEffect, useRef } from "react";

/**
 * Sincroniza `<meta name="theme-color">` com o fundo da seção mais próxima
 * do topo, com lerp suave (fiel ao `loop()`/`meta` do material bruto —
 * simplificado: aqui só a cor por seção via scroll; os pulsos pontuais de
 * clique/menu do original ficam de fora, efeito quase imperceptível fora
 * de inspeção de perto). Lê `data-themec="#rrggbb"` de cada `<section>`.
 */
export function ThemeColorSync({ corInicial }: { corInicial: string }) {
  const curRef = useRef<[number, number, number]>(hexParaRgb(corInicial));
  const lastHexRef = useRef<string>("");

  useEffect(() => {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }
    const metaEl = meta;

    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const secoes = document.querySelectorAll<HTMLElement>("[data-themec]");
      let alvoHex = corInicial;
      secoes.forEach((s) => {
        if (s.getBoundingClientRect().top <= 90) alvoHex = s.dataset.themec ?? alvoHex;
      });
      const alvo = hexParaRgb(alvoHex);
      const cur = curRef.current;
      for (let i = 0; i < 3; i++) cur[i] += (alvo[i] - cur[i]) * 0.12;
      const hex = `#${cur.map((n) => Math.round(n).toString(16).padStart(2, "0")).join("")}`;
      if (hex !== lastHexRef.current) {
        lastHexRef.current = hex;
        metaEl.setAttribute("content", hex);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [corInicial]);

  return null;
}

function hexParaRgb(hex: string): [number, number, number] {
  const puro = hex.replace("#", "");
  return [
    Number.parseInt(puro.slice(0, 2), 16) || 0,
    Number.parseInt(puro.slice(2, 4), 16) || 0,
    Number.parseInt(puro.slice(4, 6), 16) || 0,
  ];
}
