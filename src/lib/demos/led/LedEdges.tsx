"use client";

import { useEffect, useRef } from "react";

import type { LedPreset } from "../types";
import { LED_ESTILO_PADRAO } from "./registry";

/**
 * Bordas com luz LED na cor de destaque do tema (`var(--d-accent)`,
 * definida pelo wrapper da própria skin — este componente nunca recebe
 * `cores`, só lê a CSS var já disponível no DOM ancestral, igual a antes
 * desta migração). Micro-interação de `Theme.led` (nível: desligado/
 * sutil/marcante) × `Theme.ledEstilo` (registro de estilos visuais — ver
 * ./registry.ts): CSS puro (opacity/box-shadow/gradiente, sem transform de
 * layout), reage ao scroll via uma única custom property (`--d-led-scroll`,
 * 0–1) escrita direto no DOM por um ref dentro de um listener de scroll
 * passivo throttled por rAF — nenhum estado React por frame — e pulsa no
 * clique (`.d-led-pulse`, `filter: brightness()` reiniciado por toggle de
 * classe). `desligado` nem monta nada; `prefers-reduced-motion` mantém as
 * barras estáticas (sem listener de scroll/click nenhum).
 *
 * Centralizado aqui (era um arquivo idêntico duplicado em cada
 * `src/components/demos/<skin>/interactive/LedEdges.tsx` — ver
 * ARCHITECTURE.md): o CSS de cada estilo vive TODO neste componente
 * (mesma convenção de `efeitos/gradiente/Gradiente.tsx`, que injeta o
 * próprio `<style>`), então acrescentar um estilo novo ao registro não
 * exige tocar em nenhuma das 8 skins. Cada `interactive/LedEdges.tsx` de
 * skin agora só reexporta este componente.
 */
export function LedEdges({ preset, estilo }: { preset: LedPreset; estilo?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const estiloResolvido = estilo || LED_ESTILO_PADRAO;

  useEffect(() => {
    if (preset === "desligado") return;
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.style.setProperty("--d-led-scroll", "0.5");
      return;
    }

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const pct = max > 0 ? window.scrollY / max : 0;
        el.style.setProperty("--d-led-scroll", String(Math.min(1, Math.max(0, pct))));
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const onClick = () => {
      el.classList.remove("d-led-pulse");
      void el.offsetWidth; // força reflow pra poder reiniciar a animação
      el.classList.add("d-led-pulse");
    };
    document.addEventListener("click", onClick);

    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("click", onClick);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [preset]);

  if (preset === "desligado") return null;

  return (
    <div ref={ref} data-d-led={preset} data-d-led-estilo={estiloResolvido} className="d-led-edges" aria-hidden="true">
      <style>{`
        .d-led-edges {
          position: fixed; inset: 0; z-index: 45; pointer-events: none;
          --d-led-scroll: 0;
          /*
            Rampa de alfa compartilhada por "dissipado", "cantos" e
            "moldura": os três precisam da MESMA queda (forte colado na
            borda, longa até sumir) — só muda a direção em que ela é
            aplicada. Escalonada assim, não linear, porque uma rampa linear
            até transparent ainda lê como aresta: o olho pega a mudança de
            inclinação. Os valores existem como custom properties (e não
            escritos à mão em cada gradiente) pra que o nível "marcante"
            precise redefinir só estes quatro números.
          */
          --d-led-a1: 30%;
          --d-led-a2: 13%;
          --d-led-a3: 5%;
          --d-led-a4: 1.5%;
          /* Alcance do halo: PEQUENO, junto à borda — a queda longa vem da
             rampa acima, não de ocupar meia tela. */
          --d-led-halo: 40px;
          --d-led-moldura: 24px;
          --d-led-canto: 46vmin;
          /*
            Perfil AO LONGO da borda: o ponto mais brilhante segue
            --d-led-scroll e some pras duas pontas, então o halo nunca
            encosta nos cantos com intensidade cheia (era daí que vinha a
            leitura de "retângulo desenhado"). Máscara, não background —
            assim o gradiente de cor fica livre pra desenhar a queda
            PERPENDICULAR à borda, e as duas direções se multiplicam.
          */
          --d-led-perfil-v: linear-gradient(to bottom,
            transparent 0%,
            rgba(0, 0, 0, 0.18) calc(var(--d-led-scroll) * 100% - 46%),
            rgba(0, 0, 0, 1) calc(var(--d-led-scroll) * 100%),
            rgba(0, 0, 0, 0.18) calc(var(--d-led-scroll) * 100% + 46%),
            transparent 100%);
          /*
            Mesma ideia por QUARTO de --d-led-scroll, um por lado da moldura
            (topo → direita → baixo → esquerda). Só a lista de stops mora
            aqui: a direção (to right / to bottom / …) fica em cada lado, que
            é a única coisa que difere entre eles.
          */
          --d-led-q1: clamp(0%, calc(var(--d-led-scroll) * 400%), 100%);
          --d-led-q2: clamp(0%, calc((var(--d-led-scroll) - 0.25) * 400%), 100%);
          --d-led-q3: clamp(0%, calc((var(--d-led-scroll) - 0.5) * 400%), 100%);
          --d-led-q4: clamp(0%, calc((var(--d-led-scroll) - 0.75) * 400%), 100%);
          --d-led-perfil-q1: transparent 0%,
            rgba(0, 0, 0, 0.16) calc(var(--d-led-q1) - 34%),
            rgba(0, 0, 0, 1) var(--d-led-q1),
            rgba(0, 0, 0, 0.16) calc(var(--d-led-q1) + 34%),
            transparent 100%;
          --d-led-perfil-q2: transparent 0%,
            rgba(0, 0, 0, 0.16) calc(var(--d-led-q2) - 34%),
            rgba(0, 0, 0, 1) var(--d-led-q2),
            rgba(0, 0, 0, 0.16) calc(var(--d-led-q2) + 34%),
            transparent 100%;
          --d-led-perfil-q3: transparent 0%,
            rgba(0, 0, 0, 0.16) calc(var(--d-led-q3) - 34%),
            rgba(0, 0, 0, 1) var(--d-led-q3),
            rgba(0, 0, 0, 0.16) calc(var(--d-led-q3) + 34%),
            transparent 100%;
          --d-led-perfil-q4: transparent 0%,
            rgba(0, 0, 0, 0.16) calc(var(--d-led-q4) - 34%),
            rgba(0, 0, 0, 1) var(--d-led-q4),
            rgba(0, 0, 0, 0.16) calc(var(--d-led-q4) + 34%),
            transparent 100%;
        }
        [data-d-led="marcante"].d-led-edges {
          --d-led-a1: 46%;
          --d-led-a2: 21%;
          --d-led-a3: 8%;
          --d-led-a4: 2.5%;
          --d-led-halo: 62px;
          --d-led-moldura: 36px;
          --d-led-canto: 58vmin;
        }

        /* ---- estilo "barra" (default/original): barra fina, ponta nítida ---- */
        .d-led-bar {
          position: absolute; top: 0; bottom: 0; width: 3px;
          background: linear-gradient(to bottom,
            transparent 0%,
            color-mix(in srgb, var(--d-accent) 65%, transparent) calc(var(--d-led-scroll) * 100% - 18%),
            var(--d-accent) calc(var(--d-led-scroll) * 100%),
            color-mix(in srgb, var(--d-accent) 65%, transparent) calc(var(--d-led-scroll) * 100% + 18%),
            transparent 100%);
          box-shadow: 0 0 10px 1px color-mix(in srgb, var(--d-accent) 55%, transparent);
          opacity: 0.5;
          transition: opacity 200ms ease, box-shadow 200ms ease;
        }
        [data-d-led="marcante"] .d-led-bar {
          width: 4px;
          opacity: 0.85;
          box-shadow: 0 0 20px 3px color-mix(in srgb, var(--d-accent) 70%, transparent);
        }
        .d-led-left { left: 0; }
        .d-led-right { right: 0; }

        /* ---- estilo "dissipado": halo PEQUENO colado na borda, queda suave ----
           A versão anterior tinha gradiente só AO LONGO da barra (to bottom)
           e era chapada na largura: uma laje de 110-160px que terminava numa
           aresta vertical dura no meio do caminho pra tela — a "faixa
           escura" relatada. Agora a queda é PERPENDICULAR à borda (é ela que
           define o halo) e o vínculo com o scroll virou MÁSCARA ao longo da
           borda, então nenhuma das duas direções termina em aresta. */
        [data-d-led-estilo="dissipado"] .d-led-bar {
          width: var(--d-led-halo);
          opacity: 1;
          box-shadow: none;
          -webkit-mask-image: var(--d-led-perfil-v);
          mask-image: var(--d-led-perfil-v);
        }
        [data-d-led-estilo="dissipado"] .d-led-left {
          background: linear-gradient(to right,
            color-mix(in srgb, var(--d-accent) var(--d-led-a1), transparent) 0%,
            color-mix(in srgb, var(--d-accent) var(--d-led-a2), transparent) 20%,
            color-mix(in srgb, var(--d-accent) var(--d-led-a3), transparent) 46%,
            color-mix(in srgb, var(--d-accent) var(--d-led-a4), transparent) 72%,
            transparent 100%);
        }
        [data-d-led-estilo="dissipado"] .d-led-right {
          background: linear-gradient(to left,
            color-mix(in srgb, var(--d-accent) var(--d-led-a1), transparent) 0%,
            color-mix(in srgb, var(--d-accent) var(--d-led-a2), transparent) 20%,
            color-mix(in srgb, var(--d-accent) var(--d-led-a3), transparent) 46%,
            color-mix(in srgb, var(--d-accent) var(--d-led-a4), transparent) 72%,
            transparent 100%);
        }

        /* ---- estilo "cantos": luz SANGRANDO na diagonal a partir de cada canto ----
           Não são quatro pontos: a versão anterior era um radial de 64-96px
           com box-shadow, o que desenhava quatro bolinhas com aresta de
           caixa. Agora o gradiente LINEAR dá a direção (a diagonal que sai
           do canto) e a queda longa; a máscara radial ancorada no mesmo
           canto mata qualquer aresta da caixa que o carrega. */
        .d-led-corner {
          position: absolute;
          width: var(--d-led-canto); height: var(--d-led-canto);
          background: linear-gradient(var(--d-led-diagonal),
            color-mix(in srgb, var(--d-accent) var(--d-led-a1), transparent) 0%,
            color-mix(in srgb, var(--d-accent) var(--d-led-a2), transparent) 18%,
            color-mix(in srgb, var(--d-accent) var(--d-led-a3), transparent) 42%,
            color-mix(in srgb, var(--d-accent) var(--d-led-a4), transparent) 66%,
            transparent 88%);
          -webkit-mask-image: radial-gradient(125% 125% at var(--d-led-ancora),
            rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0.5) 40%, transparent 84%);
          mask-image: radial-gradient(125% 125% at var(--d-led-ancora),
            rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0.5) 40%, transparent 84%);
          transition: opacity 200ms ease;
        }
        .d-led-corner-tl { top: 0; left: 0; --d-led-diagonal: 135deg; --d-led-ancora: 0% 0%; }
        .d-led-corner-tr { top: 0; right: 0; --d-led-diagonal: 225deg; --d-led-ancora: 100% 0%; }
        .d-led-corner-bl { bottom: 0; left: 0; --d-led-diagonal: 45deg; --d-led-ancora: 0% 100%; }
        .d-led-corner-br { bottom: 0; right: 0; --d-led-diagonal: 315deg; --d-led-ancora: 100% 100%; }
        /* topo mais forte no início do scroll, base mais forte no fim — o par acende conforme a seção correspondente se aproxima. */
        .d-led-corner-tl, .d-led-corner-tr {
          opacity: clamp(0.15, calc(0.15 + (1 - var(--d-led-scroll)) * 0.45), 0.6);
        }
        .d-led-corner-bl, .d-led-corner-br {
          opacity: clamp(0.15, calc(0.15 + var(--d-led-scroll) * 0.45), 0.6);
        }
        [data-d-led="marcante"] .d-led-corner-tl, [data-d-led="marcante"] .d-led-corner-tr {
          opacity: clamp(0.3, calc(0.3 + (1 - var(--d-led-scroll)) * 0.6), 1);
        }
        [data-d-led="marcante"] .d-led-corner-bl, [data-d-led="marcante"] .d-led-corner-br {
          opacity: clamp(0.3, calc(0.3 + var(--d-led-scroll) * 0.6), 1);
        }

        /* ---- estilo "moldura": perímetro completo, pulso percorrendo via scroll ----
           Mesma queda em gradiente do "dissipado", agora nos 4 lados: a
           versão anterior era uma tira CHAPADA de 3-4px com box-shadow, o
           que lê como retângulo desenhado por cima da página, não como luz.
           Cada lado é uma banda estreita cuja cor cai PERPENDICULAR à borda
           até transparente; a máscara ao longo do lado carrega o ponto
           brilhante que viaja (um quarto de --d-led-scroll por lado, topo →
           direita → baixo → esquerda, como antes) e apaga as duas pontas,
           então os cantos não fecham num contorno contínuo. */
        .d-led-side {
          position: absolute;
          opacity: 1;
          transition: opacity 200ms ease;
        }
        .d-led-side-top { top: 0; left: 0; right: 0; height: var(--d-led-moldura); }
        .d-led-side-bottom { bottom: 0; left: 0; right: 0; height: var(--d-led-moldura); }
        .d-led-side-left { top: 0; bottom: 0; left: 0; width: var(--d-led-moldura); }
        .d-led-side-right { top: 0; bottom: 0; right: 0; width: var(--d-led-moldura); }
        .d-led-side-top {
          background: linear-gradient(to bottom,
            color-mix(in srgb, var(--d-accent) var(--d-led-a1), transparent) 0%,
            color-mix(in srgb, var(--d-accent) var(--d-led-a2), transparent) 22%,
            color-mix(in srgb, var(--d-accent) var(--d-led-a3), transparent) 50%,
            color-mix(in srgb, var(--d-accent) var(--d-led-a4), transparent) 74%,
            transparent 100%);
          -webkit-mask-image: linear-gradient(to right, var(--d-led-perfil-q1));
          mask-image: linear-gradient(to right, var(--d-led-perfil-q1));
        }
        .d-led-side-right {
          background: linear-gradient(to left,
            color-mix(in srgb, var(--d-accent) var(--d-led-a1), transparent) 0%,
            color-mix(in srgb, var(--d-accent) var(--d-led-a2), transparent) 22%,
            color-mix(in srgb, var(--d-accent) var(--d-led-a3), transparent) 50%,
            color-mix(in srgb, var(--d-accent) var(--d-led-a4), transparent) 74%,
            transparent 100%);
          -webkit-mask-image: linear-gradient(to bottom, var(--d-led-perfil-q2));
          mask-image: linear-gradient(to bottom, var(--d-led-perfil-q2));
        }
        .d-led-side-bottom {
          background: linear-gradient(to top,
            color-mix(in srgb, var(--d-accent) var(--d-led-a1), transparent) 0%,
            color-mix(in srgb, var(--d-accent) var(--d-led-a2), transparent) 22%,
            color-mix(in srgb, var(--d-accent) var(--d-led-a3), transparent) 50%,
            color-mix(in srgb, var(--d-accent) var(--d-led-a4), transparent) 74%,
            transparent 100%);
          -webkit-mask-image: linear-gradient(to left, var(--d-led-perfil-q3));
          mask-image: linear-gradient(to left, var(--d-led-perfil-q3));
        }
        .d-led-side-left {
          background: linear-gradient(to right,
            color-mix(in srgb, var(--d-accent) var(--d-led-a1), transparent) 0%,
            color-mix(in srgb, var(--d-accent) var(--d-led-a2), transparent) 22%,
            color-mix(in srgb, var(--d-accent) var(--d-led-a3), transparent) 50%,
            color-mix(in srgb, var(--d-accent) var(--d-led-a4), transparent) 74%,
            transparent 100%);
          -webkit-mask-image: linear-gradient(to top, var(--d-led-perfil-q4));
          mask-image: linear-gradient(to top, var(--d-led-perfil-q4));
        }

        @keyframes d-led-pulso {
          0% { filter: brightness(1); }
          30% { filter: brightness(1.8); }
          100% { filter: brightness(1); }
        }
        .d-led-pulse .d-led-bar,
        .d-led-pulse .d-led-corner,
        .d-led-pulse .d-led-side {
          animation: d-led-pulso 500ms ease-out;
        }
        @media (prefers-reduced-motion: reduce) {
          .d-led-bar, .d-led-corner, .d-led-side { transition: none; }
          .d-led-pulse .d-led-bar,
          .d-led-pulse .d-led-corner,
          .d-led-pulse .d-led-side { animation: none; }
        }
      `}</style>
      {estiloResolvido === "cantos" ? (
        <>
          <span className="d-led-corner d-led-corner-tl" />
          <span className="d-led-corner d-led-corner-tr" />
          <span className="d-led-corner d-led-corner-bl" />
          <span className="d-led-corner d-led-corner-br" />
        </>
      ) : estiloResolvido === "moldura" ? (
        <>
          <span className="d-led-side d-led-side-top" />
          <span className="d-led-side d-led-side-right" />
          <span className="d-led-side d-led-side-bottom" />
          <span className="d-led-side d-led-side-left" />
        </>
      ) : (
        <>
          <span className="d-led-bar d-led-left" />
          <span className="d-led-bar d-led-right" />
        </>
      )}
    </div>
  );
}
