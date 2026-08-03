"use client";

import { useEffect, useRef } from "react";

import { corParaRgb, rgba, type Rgb } from "../corComputada";
import type { EfeitoProps } from "../types";
import { useEfeitoAtivo } from "../useEfeitoAtivo";
import { alvoPonteiro, alvoScroll, deriva, fatorLerp, lerpPonto } from "./alvo";
import { paradasMancha, type ParadaCanvas } from "./estilo";

/**
 * AURA — duas esferas de fumaça colorida que derivam para os cantos ao
 * longo do scroll. O comportamento é o mesmo de sempre: no desktop
 * (`pointer: fine`) o alvo segue o ponteiro; no celular o alvo é o CENTRO
 * da viewport, deslocado pelo progresso de scroll e somado a uma deriva
 * lenta autônoma (senoidal), pra não morrer parado. Interpolação (lerp)
 * suaviza o caminho até o alvo — nunca posição colada. Matemática do alvo
 * isolada em ./alvo.ts (testável sem DOM).
 *
 * ## O que mudou por dentro, e por quê (tudo medido — ver ./estilo.ts)
 *
 * Cada esfera era uma `<div>` com `radial-gradient` no `background`, mais
 * `opacity` e `mix-blend-mode: screen`. Hoje é um `<canvas>` de bitmap
 * PEQUENO (LADO_RASTER), esticado pelo CSS para o mesmo tamanho aparente de
 * antes, com a rampa desenhada em **transparência pré-calculada** (o alfa
 * final já vem na tabela, sem `opacity` e sem blend nenhum).
 *
 * O defeito que isso corrige é de COMPOSITING, e só aparece nos modos de
 * cor animados: uma cor que muda a 60 Hz dentro de um `background` de CSS
 * regenera a imagem de gradiente e REPINTA o elemento — que aqui tem ~2× a
 * viewport de lado, duas vezes. Medido no celular com CPU 4×, rolando a
 * página inteira: 10,5 Mpx/s repintados com a cor do tema contra **83,6
 * Mpx/s no iridescente** e 82,6 no arco-íris. Num canvas, a cor animada é
 * LIDA do `color` computado a cada poucos quadros (mesmo truque do
 * `ondas`) e o redesenho é de um bitmap de 256×256 — e só quando a cor
 * muda de verdade. Nos modos `tema` e `fixa` o efeito desenha UMA vez e
 * nunca mais.
 *
 * O movimento continua sendo só `transform: translate3d` escrito direto no
 * DOM por ref a cada quadro (nunca estado React) — isto é COMPOSIÇÃO, não
 * repintura, e é por isso que ele pode continuar a 60 Hz enquanto o
 * desenho não precisa.
 *
 * Contrato dos efeitos: `intensidade` 0 não monta nada; `cores` é a paleta
 * (as duas esferas usam `destaque`/`acentoSecundario`); pausa fora da
 * viewport / aba oculta / `pausado` congela na última posição, nunca
 * desmonta; `prefers-reduced-motion` posiciona e desenha UMA vez, sem
 * listener nem rAF; a rasterização fica muito abaixo do teto de
 * `devicePixelRatioClamped(2)`; nenhum `filter`, em lugar nenhum.
 */

/**
 * Lado do bitmap de cada esfera, em pixels. A forma é uma rampa radial sem
 * nenhum detalhe fino — o degrau mais forte da tabela medida é de ~7% de
 * cor entre paradas vizinhas —, e a ampliação até o tamanho CSS (810px num
 * celular de 390×844) é INTERPOLADA pelo navegador, o que só suaviza. É a
 * mesma decisão do `ondas` (0,4 px por px CSS), aqui ainda mais folgada:
 * 256² = 65 mil pixels por desenho contra os 2,6 milhões que o gradiente de
 * CSS repintava a cada quadro.
 */
const LADO_RASTER = 256;

/**
 * De quantos em quantos quadros a cor computada é relida. Os ciclos de cor
 * duram 20–42s: a 10 Hz (6 quadros a 60 fps) o passo de matiz do arco-íris
 * é ~1,3° entre desenhos, muito abaixo do que o olho separa numa mancha
 * difusa — e o desenho só acontece quando a string MUDA, então `tema` e
 * `fixa` custam zero depois do primeiro quadro.
 */
const QUADROS_ENTRE_LEITURAS_DE_COR = 6;

/** Cor de partida antes do primeiro `getComputedStyle` (SSR/jsdom). */
const RGB_PADRAO: Rgb = [235, 235, 235];

/** Pinta a rampa inteira no bitmap — uma chamada por mudança de cor. */
function pintarMancha(
  ctx: CanvasRenderingContext2D,
  lado: number,
  paradas: ParadaCanvas[],
  cor: Rgb,
) {
  const centro = lado / 2;
  ctx.clearRect(0, 0, lado, lado);
  const rampa = ctx.createRadialGradient(centro, centro, 0, centro, centro, centro);
  for (const { parada, alfa } of paradas) rampa.addColorStop(parada, rgba(cor, alfa));
  ctx.fillStyle = rampa;
  ctx.fillRect(0, 0, lado, lado);
}

export function Aura({ intensidade, cores, pausado }: EfeitoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const blob1Ref = useRef<HTMLCanvasElement>(null);
  const blob2Ref = useRef<HTMLCanvasElement>(null);
  const { ativo, reducedMotion } = useEfeitoAtivo(containerRef, pausado);
  const ativoRef = useRef(ativo);

  useEffect(() => {
    ativoRef.current = ativo;
  }, [ativo]);

  useEffect(() => {
    if (intensidade === 0) return;
    const container = containerRef.current;
    const blob1 = blob1Ref.current;
    const blob2 = blob2Ref.current;
    if (!container || !blob1 || !blob2) return;
    const ctx1 = blob1.getContext("2d");
    const ctx2 = blob2.getContext("2d");
    if (!ctx1 || !ctx2) return;

    const paradas = paradasMancha(intensidade);
    for (const canvas of [blob1, blob2]) {
      canvas.width = LADO_RASTER;
      canvas.height = LADO_RASTER;
    }

    // A cor lida da última vez, POR esfera: o redesenho só acontece quando
    // a string computada muda (nos modos "tema"/"fixa" ela nunca muda).
    let corLida1 = "";
    let corLida2 = "";
    const repintarSeMudou = () => {
      const lida1 = getComputedStyle(blob1).color;
      if (lida1 !== corLida1) {
        corLida1 = lida1;
        pintarMancha(ctx1, LADO_RASTER, paradas, corParaRgb(lida1) ?? RGB_PADRAO);
      }
      const lida2 = getComputedStyle(blob2).color;
      if (lida2 !== corLida2) {
        corLida2 = lida2;
        pintarMancha(ctx2, LADO_RASTER, paradas, corParaRgb(lida2) ?? RGB_PADRAO);
      }
    };
    repintarSeMudou();

    if (reducedMotion) {
      // Estático: posição fixa, sem listener nem rAF nenhum.
      blob1.style.transform = "translate3d(-10%, -10%, 0)";
      blob2.style.transform = "translate3d(10%, 10%, 0)";
      return;
    }

    const isDesktop = window.matchMedia("(pointer: fine)").matches;
    let target = { x: 0, y: 0 };
    let current1 = { x: -10, y: -10 };
    let current2 = { x: 10, y: 10 };

    function onPointerMove(event: PointerEvent) {
      target = alvoPonteiro(event.clientX, event.clientY, container!.getBoundingClientRect());
    }

    function onScroll() {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      target = alvoScroll(window.scrollY, max);
    }

    if (isDesktop) {
      window.addEventListener("pointermove", onPointerMove, { passive: true });
    } else {
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
    }

    const lerp = fatorLerp(intensidade);
    let raf = 0;
    let quadro = 0;

    function tick(now: number) {
      raf = requestAnimationFrame(tick);
      if (!ativoRef.current) return; // pausado: congela na última posição

      let alvo = target;
      if (!isDesktop) {
        const d = deriva(now);
        alvo = { x: target.x + d.x, y: target.y + d.y };
      }

      current1 = lerpPonto(current1, alvo, lerp);
      current2 = lerpPonto(current2, { x: -alvo.x, y: -alvo.y }, lerp);

      // Só transform: composição pura, sem repintura da superfície.
      blob1!.style.transform = `translate3d(${current1.x}%, ${current1.y}%, 0)`;
      blob2!.style.transform = `translate3d(${current2.x}%, ${current2.y}%, 0)`;

      if (quadro++ % QUADROS_ENTRE_LEITURAS_DE_COR === 0) repintarSeMudou();
    }
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("scroll", onScroll);
    };
  }, [intensidade, reducedMotion]);

  if (intensidade === 0) return null;

  return (
    <div
      ref={containerRef}
      // fixed (não absolute): cobre a viewport inteira em qualquer scroll,
      // em vez de ficar preso à altura do bloco inicial do documento — ver
      // ARCHITECTURE.md ("efeitos de fundo cobrem a viewport inteira").
      // z-index POSITIVO (mesma convenção dos demais efeitos): toda seção
      // da demo tem fundo sólido próprio (--d-bg/--d-bg-alt cobrindo 100%
      // da largura, sem gaps), então um z-index negativo pinta o efeito
      // atrás desse fundo e ele nunca aparece — ver ARCHITECTURE.md.
      // pointer-events: none garante que não bloqueia clique.
      className="pointer-events-none fixed inset-0 z-40 overflow-hidden"
      aria-hidden="true"
      // Fade da camada (--d-efeito-fade, escrito por EfeitoCamada conforme
      // as seções com animação entram e saem da viewport — ver
      // lib/demos/animacao/cobertura.ts). Toda raiz de efeito multiplica
      // esta var na própria opacidade; ausente = 1 (fora da camada).
      style={{ opacity: "var(--d-efeito-fade, 1)" }}
    >
      {/*
        A caixa é ESCALA_CAIXA vezes o lado histórico (60/55vmax) e o
        canto é recuado de metade do que ela cresceu, pra que o CENTRO do
        blob fique exatamente onde estava: a cauda da mancha (que o antigo
        `filter: blur` pintava PRA FORA da caixa) precisa caber dentro
        dela. Ver ./estilo.ts. O bitmap é sempre LADO_RASTER², qualquer que
        seja o tamanho CSS — o navegador interpola a ampliação.
      */}
      <canvas
        ref={blob1Ref}
        className="absolute left-[calc(25%-18vmax)] top-[calc(25%-18vmax)] h-[96vmax] w-[96vmax] will-change-transform"
        // A cor do tema (ou o `var(--d-efeito-cN)` animado pelo modo de
        // cor) entra como `color` e é LIDA computada — é assim que um
        // efeito em canvas respeita os 5 modos sem precisar conhecê-los.
        style={{ color: cores.destaque, transform: "translate3d(-10%, -10%, 0)" }}
      />
      <canvas
        ref={blob2Ref}
        className="absolute right-[calc(25%-16.5vmax)] bottom-[calc(25%-16.5vmax)] h-[88vmax] w-[88vmax] will-change-transform"
        style={{ color: cores.acentoSecundario, transform: "translate3d(10%, 10%, 0)" }}
      />
    </div>
  );
}
