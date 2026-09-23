"use client";

import { Fragment, useEffect, useRef } from "react";

import { microcopiaDemo } from "@/lib/demos/microcopy";
import type { Alinhamento, DemoSecao } from "@/lib/demos/types";
import { useIntroDone } from "./introContext";
import { linhaDeApoio, linhasDoNome } from "./logic";

const HERO_ALINHAMENTO: Record<Alinhamento, string> = {
  esquerda: "items-start text-left",
  centro: "items-center text-center",
  direita: "items-end text-right",
};

/**
 * Hero: kicker, o NOME do negócio no `<h1>` revelado palavra a palavra (só depois do preloader
 * terminar — `useIntroDone`), texto, CTAs e o velocímetro decorativo que
 * reage à velocidade do scroll. Fiel ao `heroIntro()`/`loop()` (needle) do
 * material bruto; a linha diagonal ganha um parallax sutil no scroll.
 */
export function Hero({
  nome,
  hero,
  alinhamento,
  waHref,
  idioma,
}: {
  nome: string;
  hero: DemoSecao | undefined;
  alinhamento: Alinhamento;
  /** Link do wa.me — ausente quando não há WhatsApp; o CTA some junto. */
  waHref?: string;
  idioma?: string;
}) {
  const m = microcopiaDemo(idioma);
  const revelado = useIntroDone();
  const needleRef = useRef<SVGGElement>(null);
  const linhaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let lastY = window.scrollY;
    let speed = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const y = window.scrollY;
      const v = Math.abs(y - lastY);
      lastY = y;
      speed = speed * 0.88 + v * 0.12;
      needleRef.current?.setAttribute("transform", `rotate(${Math.min(-115 + speed * 5.5, 115)} 50 46)`);
      if (linhaRef.current && y < window.innerHeight * 1.4) {
        linhaRef.current.style.transform = `translateY(${y * 0.13}px)`;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // O `<h1>` é SEMPRE o nome do negócio (§6.1 do plano). O título salvo
  // continua sendo o mesmo slot, e vira a linha de apoio logo abaixo — uma
  // demo já salva com título não perde o texto, só o papel dele muda.
  const [linha1, linha2] = linhasDoNome(nome);
  const apoio = linhaDeApoio(hero?.titulo, nome);

  return (
    <header
      id="topo"
      className="relative flex min-h-[100svh] flex-col justify-center overflow-hidden px-[max(24px,5vw)] pb-[90px] pt-[120px]"
    >
      <div ref={linhaRef} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div
          className="absolute left-[-12%] top-[34%] h-[7px] w-[126%] rotate-[-7deg]"
          style={{
            borderTop: "2px solid color-mix(in srgb, var(--d-accent) 28%, transparent)",
            borderBottom: "8px solid color-mix(in srgb, var(--d-accent) 28%, transparent)",
          }}
        />
      </div>

      <div
        className="absolute flex items-center gap-2.5 opacity-90"
        style={{ top: "calc(86px + env(safe-area-inset-top))", right: "max(24px, 5vw)" }}
        aria-hidden="true"
      >
        <svg width="54" height="42" viewBox="0 0 100 78" fill="none">
          <path d="M14 70 A44 44 0 1 1 86 70" stroke="var(--d-border)" strokeWidth="5" strokeLinecap="round" />
          <path d="M79 30 A44 44 0 0 1 86 70" stroke="var(--d-accent)" strokeWidth="5" strokeLinecap="round" />
          <g ref={needleRef} transform="rotate(-115 50 46)">
            <line x1="50" y1="46" x2="50" y2="12" stroke="var(--d-text)" strokeWidth="4" strokeLinecap="round" />
          </g>
          <circle cx="50" cy="46" r="5" fill="var(--d-accent)" />
        </svg>
        <span
          className="font-[family-name:var(--d-mono)] text-[10px] tracking-[2px] text-[var(--d-muted)]"
          style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
        >
          {m.scrollEstilizado}
        </span>
      </div>

      <div className={`relative mx-auto flex w-full max-w-[1200px] flex-col ${HERO_ALINHAMENTO[alinhamento]}`}>
        {hero?.rotulo?.trim() && (
          <p
            data-demo-slot="secoes.hero.rotulo"
            className="mb-6 flex flex-wrap items-center gap-3 pr-[90px] font-[family-name:var(--d-corpo)] text-[13px] font-semibold tracking-[4px] text-[var(--d-accent)]"
            style={{ transition: "opacity 800ms ease 400ms", opacity: revelado ? 1 : 0 }}
          >
            <span className="inline-block h-0.5 w-[34px]" style={{ background: "var(--d-accent)" }} />
            {hero.rotulo.toUpperCase()}
          </p>
        )}

        <h1
          data-demo-slot="nome"
          className="mb-[30px] font-[family-name:var(--d-hero-font)] uppercase leading-none tracking-[0.5px]"
          style={{ fontSize: "calc(clamp(42px, 9.6vw, 124px) * var(--d-hero-escala))" }}
        >
          {/* Espaço de TEXTO entre as palavras (não margem): sem ele o nome
              acessível e o `textContent` do <h1> saíam colados. */}
          <span className="block overflow-hidden pb-[0.06em]">
            {linha1.map((p, i) => (
              <Fragment key={i}>
                <span className="inline-block overflow-hidden align-bottom">
                  <span
                    className="inline-block"
                    style={{
                      transition: `transform 850ms cubic-bezier(.2,.9,.2,1) ${150 + i * 95}ms`,
                      transform: revelado ? "translateY(0)" : "translateY(115%)",
                    }}
                  >
                    {p}
                  </span>
                </span>{" "}
              </Fragment>
            ))}
          </span>
          {linha2.length > 0 && (
            <span className="block overflow-hidden pb-[0.08em] text-[var(--d-accent)]">
              {linha2.map((p, i) => (
                <Fragment key={i}>
                  <span className="inline-block overflow-hidden align-bottom">
                    <span
                      className="inline-block"
                      style={{
                        transition: `transform 850ms cubic-bezier(.2,.9,.2,1) ${150 + (linha1.length + i) * 95}ms`,
                        transform: revelado ? "translateY(0)" : "translateY(115%)",
                      }}
                    >
                      {p}
                    </span>
                  </span>
                  {i < linha2.length - 1 && " "}
                </Fragment>
              ))}
            </span>
          )}
        </h1>

        {apoio && (
          <p
            data-demo-slot="secoes.hero.titulo"
            className="-mt-3 mb-7 max-w-[760px] text-balance font-[family-name:var(--d-display)] text-[clamp(22px,3vw,34px)] font-bold leading-[1.15] text-[var(--d-text)]"
            style={{ transition: "opacity 800ms ease 460ms", opacity: revelado ? 1 : 0 }}
          >
            {apoio}
          </p>
        )}

        {hero?.texto?.trim() && (
          <p
            data-demo-slot="secoes.hero.texto"
            className="mb-[38px] max-w-[520px] text-pretty font-[family-name:var(--d-corpo)] text-[clamp(15px,1.8vw,18px)] leading-relaxed text-[var(--d-muted)]"
            style={{ transition: "opacity 800ms ease 520ms", opacity: revelado ? 1 : 0 }}
          >
            {hero.texto}
          </p>
        )}

        <div
          className="flex flex-wrap gap-3.5"
          style={{ transition: "opacity 800ms ease 640ms", opacity: revelado ? 1 : 0 }}
        >
          {hero?.cta?.trim() && (
            <a
              href="#estoque"
              data-demo-slot="secoes.hero.cta"
              className="d-press d-cta-gradiente inline-flex items-center justify-center rounded-full px-[34px] py-[18px] font-[family-name:var(--d-corpo)] text-sm font-bold tracking-[1.5px]"
            >
              {hero.cta.toUpperCase()}
            </a>
          )}
          {hero?.ctaSecundaria?.trim() && waHref && (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              data-demo-slot="secoes.hero.ctaSecundaria"
              className="d-press inline-flex items-center justify-center rounded-full border px-[34px] py-[18px] font-[family-name:var(--d-corpo)] text-sm font-bold tracking-[1.5px] transition-colors"
              style={{ borderColor: "color-mix(in srgb, var(--d-text) 35%, transparent)", color: "var(--d-text)" }}
            >
              {hero.ctaSecundaria.toUpperCase()}
            </a>
          )}
        </div>
      </div>

      <div
        className="absolute bottom-[calc(22px+env(safe-area-inset-bottom))] left-1/2 flex -translate-x-1/2 flex-col items-center"
        style={{ transition: "opacity 800ms ease 760ms", opacity: revelado ? 1 : 0 }}
        aria-hidden="true"
      >
        <svg width="18" height="10" viewBox="0 0 18 10" className="d-chev">
          <path d="M2 2l7 6 7-6" stroke="var(--d-accent)" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
        <svg width="18" height="10" viewBox="0 0 18 10" className="d-chev" style={{ animationDelay: "0.25s" }}>
          <path d="M2 2l7 6 7-6" stroke="var(--d-accent)" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
      </div>
    </header>
  );
}
