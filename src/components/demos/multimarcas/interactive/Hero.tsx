"use client";

import Image from "next/image";
import { Fragment, useEffect, useRef, type ReactNode } from "react";

import { microcopiaDemo } from "@/lib/demos/microcopy";
import type { Alinhamento, DemoSecao, MultimarcasComposicao } from "@/lib/demos/types";
import { useIntroDone } from "./introContext";
import { Mostrador, type EscalaDoMostrador } from "./Mostrador";
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
  abertura = "tipografica",
  foto,
  faixas = [],
  identidade,
  ctaTroca,
}: {
  nome: string;
  hero: DemoSecao | undefined;
  alinhamento: Alinhamento;
  /** Link do wa.me — ausente quando não há WhatsApp; o CTA some junto. */
  waHref?: string;
  idioma?: string;
  /** O desenho da abertura (knob `abertura` da composição, §6). */
  abertura?: MultimarcasComposicao["abertura"];
  /**
   * A foto de abertura (`imagens.hero`). Só a abertura sangrada e a
   * dividida a desenham; a tipográfica e a busca declaram o slot em
   * `imagensOcultas` e ele nem chega ao HTML (§8).
   */
  foto?: { src: string; alt: string };
  /** Busca: as faixas de preço do estoque, como links `#faixa-N`. */
  faixas?: readonly { id: string; rotulo: string }[];
  /** Busca: a barra de identidade (a escada da §7, já renderizada). */
  identidade?: ReactNode;
  /** Dividida: o CTA de troca, que é o assunto da loja de picape. */
  ctaTroca?: { rotulo: string; href: string };
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
  const desenhaFoto = foto && (abertura === "sangrada" || abertura === "dividida");
  // Um mostrador só por página, e a escala dele acompanha a abertura. A
  // busca sem faixas (estoque oculto ou sem preços) e a dividida sem foto
  // caem no selo, para o painel de instrumentos nunca sumir.
  const escala: EscalaDoMostrador =
    abertura === "busca" && faixas.length > 0
      ? "marcador"
      : abertura === "sangrada"
        ? "mostrador"
        : abertura === "dividida" && desenhaFoto
          ? "canto"
          : "selo";
  const apoio = linhaDeApoio(hero?.titulo, nome);

  return (
    <header id="topo" className="mm-hero">
      {desenhaFoto && (
        <div className="mm-hero-foto">
          <Image
            src={foto.src}
            alt={foto.alt}
            fill
            unoptimized
            priority
            data-demo-slot="imagens.hero"
            className="object-cover"
            sizes={abertura === "sangrada" ? "100vw" : "(min-width: 768px) 50vw, 100vw"}
          />
          {/* O véu é o que deixa o nome ler sobre a foto — tokenizado
              (--mm-veu, na folha) e medido como texto sobre fundo. */}
          {abertura === "sangrada" && <div className="mm-hero-veu" aria-hidden="true" />}
          {escala === "canto" && (
            <div className="mm-hero-gauge" data-escala="canto" aria-hidden="true">
              <Mostrador escala="canto" agulha={needleRef} legenda={m.rpm} />
            </div>
          )}
        </div>
      )}
      <div ref={linhaRef} className="mm-hero-diagonal" aria-hidden="true">
        <div
          className="absolute left-[-12%] top-[34%] h-[7px] w-[126%] rotate-[-7deg]"
          style={{
            borderTop: "2px solid color-mix(in srgb, var(--d-accent) 28%, transparent)",
            borderBottom: "8px solid color-mix(in srgb, var(--d-accent) 28%, transparent)",
          }}
        />
      </div>

      {(escala === "selo" || escala === "mostrador") && (
        <div className="mm-hero-gauge" data-escala={escala} aria-hidden="true">
          <Mostrador escala={escala} agulha={needleRef} legenda={m.rpm} />
          {escala === "selo" && (
            <span
              className="font-[family-name:var(--d-mono)] text-[10px] tracking-[2px] text-[var(--d-muted)]"
              style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
            >
              {m.scrollEstilizado}
            </span>
          )}
        </div>
      )}

      <div className={`mm-hero-corpo ${HERO_ALINHAMENTO[alinhamento]}`}>
        {hero?.rotulo?.trim() && (
          <p
            data-demo-slot="secoes.hero.rotulo"
            className="mm-hero-rotulo mb-6 flex flex-wrap items-center gap-3 pr-[90px] font-[family-name:var(--d-corpo)] text-[13px] font-semibold tracking-[4px] text-[var(--d-accent)]"
            style={{ transition: "opacity 800ms ease 400ms", opacity: revelado ? 1 : 0 }}
          >
            <span className="inline-block h-0.5 w-[34px]" style={{ background: "var(--d-accent)" }} />
            {hero.rotulo.toUpperCase()}
          </p>
        )}

        <h1
          data-demo-slot="nome"
          className="mm-hero-h1 mb-[30px] font-[family-name:var(--d-hero-font)] uppercase leading-none tracking-[0.5px]"
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

        {abertura === "busca" && faixas.length > 0 && (
          <div className="mm-hero-busca">
            <div className="mm-hero-gauge" data-escala="marcador" aria-hidden="true">
              <Mostrador escala="marcador" agulha={needleRef} />
              <span className="font-[family-name:var(--d-mono)] text-[9px] tracking-[1.5px] text-[var(--d-muted)]">
                {m.rpm}
              </span>
            </div>
            <nav className="mm-hero-faixas" aria-label={m.faixaDePreco}>
              {faixas.map((f) => (
                <a
                  key={f.id}
                  href={`#${f.id}`}
                  className="mm-faixa d-press rounded-lg border font-[family-name:var(--d-corpo)] text-[15px] font-bold text-[var(--d-text)]"
                >
                  {f.rotulo}
                </a>
              ))}
            </nav>
          </div>
        )}

        <div
          className="mm-hero-ctas flex flex-wrap gap-3.5"
          style={{ transition: "opacity 800ms ease 640ms", opacity: revelado ? 1 : 0 }}
        >
          {ctaTroca && (
            <a
              href={ctaTroca.href}
              data-demo-slot="secoes.avaliacao.cta"
              className="d-press d-cta-gradiente inline-flex items-center justify-center rounded-full px-[34px] py-[18px] font-[family-name:var(--d-corpo)] text-sm font-bold tracking-[1.5px]"
            >
              {ctaTroca.rotulo.toUpperCase()}
            </a>
          )}
          {hero?.cta?.trim() && (
            <a
              href="#estoque"
              data-demo-slot="secoes.hero.cta"
              className="mm-hero-cta d-press d-cta-gradiente inline-flex items-center justify-center rounded-full px-[34px] py-[18px] font-[family-name:var(--d-corpo)] text-sm font-bold tracking-[1.5px]"
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

        {identidade && <div className="mm-hero-identidade">{identidade}</div>}
      </div>

      <div
        className="mm-hero-chev"
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
