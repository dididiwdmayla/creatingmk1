import Image from "next/image";
import { Fragment, type CSSProperties, type ReactNode } from "react";

import { secoesVisiveis } from "@/lib/demos/estrutura";
import { microcopiaDemo } from "@/lib/demos/microcopy";
import { formatarPrecoServico } from "@/lib/demos/precos";
import type { Animacao, Densidade, SkinProps } from "@/lib/demos/types";
import { Counter } from "./interactive/Counter";
import { Header } from "./interactive/Header";
import { IntroExperience } from "./interactive/IntroExperience";
import { LedEdges } from "./interactive/LedEdges";
import { OrderCta } from "./interactive/OrderCta";
import { SectionReveal, type RevealTipo } from "./interactive/SectionReveal";
import { PETSHOP_SECOES } from "./secoes";

/**
 * Skin "Focinho Feliz" — conversão fiel do material bruto
 * (skins-raw/petshop, "Aumigo & Cia"): petshop pastel bem-humorado,
 * formas orgânicas tipo blob, tipografia serifada itálica (Instrument
 * Serif) sobre uma sans neutra (Instrument Sans), badge flutuante com
 * avaliação, badge giratório de texto em círculo, fita de frases em
 * marquee contínuo, contadores animados ao rolar e cards com leve
 * levitação no hover.
 *
 * O material bruto original é multi-página (Início/Serviços/Sobre/
 * Contato/Agendamento) e full-stack (wizard de agendamento com
 * calendário e Mercado Pago): só as páginas públicas visuais foram
 * convertidas, condensadas numa única demo de rolagem (mesmo critério das
 * demais skins). Serviços vieram da Home; equipe e diferenciais vieram de
 * Sobre. Todo botão de agendamento virou o CTA neutro `OrderCta` (ver
 * interactive/OrderCta.tsx) — WhatsApp quando `data.whatsapp` existe,
 * toast "Disponível na versão completa" quando não.
 *
 * Componente PURO: todo texto/imagem vem de `data`, toda cor/fonte/raio/
 * densidade vem de `theme` (aplicado como CSS vars no wrapper). Estrutura
 * editável igual às demais skins — ver lib/demos/estrutura.ts.
 */

const SECTION_PAD: Record<Densidade, string> = {
  compacta: "3.5rem",
  confortavel: "5.5rem",
  arejada: "7.5rem",
};

const ANIM_DURATION: Record<Animacao, string> = {
  nenhuma: "0ms",
  sutil: "220ms",
  marcante: "420ms",
};
const ANIM_HOVER_SCALE: Record<Animacao, string> = {
  nenhuma: "1",
  sutil: "1.02",
  marcante: "1.06",
};
const ANIM_HOVER_LIFT: Record<Animacao, string> = {
  nenhuma: "0px",
  sutil: "-4px",
  marcante: "-8px",
};

const HERO_ALINHAMENTO: Record<string, string> = {
  esquerda: "items-start text-left",
  centro: "items-center text-center",
  direita: "items-end text-right",
};

/** Raio de blob variado por índice, fiel à galeria/hero do material bruto. */
const GALERIA_RAIOS = [
  "56% 44% 52% 48% / 48% 54% 46% 52%",
  "24px",
  "24px",
  "48% 52% 45% 55% / 55% 48% 52% 45%",
  "24px",
  "52% 48% 56% 44% / 46% 52% 48% 54%",
];

const STEP_BG = ["var(--d-accent-3)", "var(--d-accent)", "var(--d-accent-2)"];
const STEP_FG = ["var(--d-text)", "var(--d-accent-ink)", "var(--d-accent-ink)"];

function Placeholder({
  src,
  alt,
  sizes,
  priority,
  slot,
  className = "object-cover",
}: {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  slot?: string;
  className?: string;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      fill
      unoptimized
      data-demo-slot={slot}
      className={className}
      sizes={sizes}
      priority={priority}
    />
  );
}

function Eyebrow({ texto, slot }: { texto?: string; slot?: string }) {
  if (!texto) return null;
  return (
    <p
      data-demo-slot={slot}
      className="mb-4 font-[family-name:var(--d-corpo)] text-[13px] font-semibold uppercase tracking-[0.18em]"
      style={{ color: "var(--d-muted)" }}
    >
      {texto}
    </p>
  );
}

function StepDash() {
  return (
    <svg
      aria-hidden="true"
      width="56"
      height="28"
      viewBox="0 0 64 30"
      className="mt-[-40px] hidden shrink-0 sm:block"
    >
      <path
        d="M2 24 C 20 4, 44 4, 58 16"
        fill="none"
        stroke="var(--d-accent)"
        strokeWidth="2"
        strokeDasharray="6 8"
        strokeLinecap="round"
        className="d-step-dash"
      />
      <path
        d="M52 10 L 59 16 L 50 19"
        fill="none"
        stroke="var(--d-accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const WHATSAPP_ICON_PATH =
  "M21 11.5a8.5 8.5 0 0 1-12.4 7.6L3 21l1.9-5.6A8.5 8.5 0 1 1 21 11.5z M8.8 9.2c.3 2.4 3.6 5.7 6 6l1.4-1.4-2-1.3-1 .7c-.8-.4-1.9-1.5-2.3-2.3l.7-1-1.3-2z";

export function PetshopFocinhoFeliz({ data, theme, idioma, moeda }: SkinProps) {
  const { paleta, fontes } = theme;
  const m = microcopiaDemo(idioma);
  const vars = {
    "--d-bg": paleta.fundo,
    "--d-bg-alt": paleta.fundoAlt,
    "--d-bg-elev": paleta.fundoElevado,
    "--d-accent": paleta.destaque,
    "--d-accent-ink": paleta.destaqueInk,
    "--d-text": paleta.texto,
    "--d-muted": paleta.textoSuave,
    "--d-border": paleta.borda,
    "--d-accent-2": paleta.acentoSecundario,
    "--d-accent-3": paleta.acentoTerciario,
    "--d-radius": theme.raio,
    "--d-display": fontes.display,
    "--d-corpo": fontes.corpo,
    "--d-mono": fontes.mono,
    "--d-serif": fontes.serif,
    "--d-deco": fontes.decorativa,
    "--d-citacao": fontes.citacao,
    "--d-destaque": fontes.destaque,
    "--d-hero-font": theme.heroTitulo.fonte || fontes.display,
    "--d-hero-escala": theme.heroTitulo.escala,
    "--d-sec-y": SECTION_PAD[theme.densidade],
    "--d-anim-duration": ANIM_DURATION[theme.animacao],
    "--d-anim-ease": "cubic-bezier(0.22, 1, 0.36, 1)",
    "--d-hover-scale": ANIM_HOVER_SCALE[theme.animacao],
    "--d-hover-lift": ANIM_HOVER_LIFT[theme.animacao],
  } as CSSProperties;

  const s = data.secoes;
  const visiveis = secoesVisiveis(PETSHOP_SECOES, data);
  const centro = (id: string): boolean => s[id]?.alinhamento === "centro";
  const entradaDe = (id: string) => s[id]?.animacaoEntrada;
  const wrapperTipo = (id: string): RevealTipo | null => {
    const entrada = entradaDe(id);
    if (entrada === undefined) return "padrao";
    if (entrada === "nenhuma") return null;
    if (entrada === "deslizar-esquerda") return "esquerda";
    if (entrada === "deslizar-direita") return "direita";
    return "fade";
  };

  const mensagemAgendar = `Olá! Gostaria de agendar um horário para o meu pet${
    data.nome ? ` na ${data.nome}` : ""
  }.`;

  const secoes: Record<string, () => ReactNode> = {
    /* ── Hero (fixa) ─────────────────────────────────────────── */
    hero: () => (
      <section
        id="topo"
        className="relative overflow-hidden pb-16 pt-32 sm:pt-40"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-40 -top-44 z-0 h-[560px] w-[560px] rounded-[58%_42%_55%_45%/52%_48%_60%_40%]"
          style={{ backgroundColor: "var(--d-bg-alt)" }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-[55%] top-24 z-0 hidden rotate-[-18deg] opacity-80 sm:block"
        >
          <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="var(--d-accent-2)" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="6.2" cy="8.2" r="2.6" />
            <circle cx="8.2" cy="6.2" r="2.6" />
            <circle cx="17.8" cy="15.8" r="2.6" />
            <circle cx="15.8" cy="17.8" r="2.6" />
            <path d="M8.8 8.8 L15.2 15.2" strokeWidth="3.2" />
          </svg>
        </div>

        <div className="relative z-10 mx-auto flex max-w-6xl flex-wrap items-center gap-12 px-4 sm:px-6">
          <div
            className={`flex min-w-[min(100%,320px)] flex-1 basis-[460px] flex-col ${HERO_ALINHAMENTO[theme.heroTitulo.alinhamento]}`}
          >
            <Eyebrow texto={s.hero?.rotulo} slot="secoes.hero.rotulo" />
            <h1
              data-demo-slot="secoes.hero.titulo"
              className="font-[family-name:var(--d-hero-font)] font-normal leading-[1.02] tracking-[-0.02em]"
              style={{
                fontSize: "calc(clamp(2.75rem, 7.2vw, 6rem) * var(--d-hero-escala))",
                color: "var(--d-text)",
              }}
            >
              {s.hero?.titulo ?? data.nome}
            </h1>
            {s.hero?.texto && (
              <p
                data-demo-slot="secoes.hero.texto"
                className="mt-6 max-w-lg text-[clamp(1rem,1.4vw,1.2rem)] leading-relaxed"
                style={{ color: "var(--d-muted)" }}
              >
                {s.hero.texto}
              </p>
            )}
            <div className="mt-9 flex flex-wrap gap-3.5">
              {s.hero?.cta && (
                <OrderCta
                  whatsapp={data.whatsapp}
                  mensagem={mensagemAgendar}
                  idioma={idioma}
                  slot="secoes.hero.cta"
                  className="d-cta-pill d-cta-pill-lg"
                >
                  {s.hero.cta}
                </OrderCta>
              )}
              {s.hero?.ctaSecundaria && (
                <a href="#servicos" data-demo-slot="secoes.hero.ctaSecundaria" className="d-cta-outline d-cta-outline-lg">
                  {s.hero.ctaSecundaria}
                </a>
              )}
            </div>
          </div>

          <div className="relative flex min-w-[min(100%,300px)] flex-1 basis-[380px] justify-center">
            <div
              className="relative aspect-[0.92] w-full max-w-[440px] overflow-hidden shadow-[0_24px_60px_rgba(43,34,119,0.18)]"
              style={{ borderRadius: "56% 44% 52% 48% / 48% 54% 46% 52%" }}
            >
              <Placeholder
                src={data.imagens.hero}
                alt={`Pet feliz em ${data.nome}`}
                sizes="(max-width: 768px) 90vw, 440px"
                priority
                slot="imagens.hero"
              />
            </div>

            {s.hero?.itens?.[0] && (
              <div
                className="d-badge-float absolute bottom-[8%] left-0 flex items-center gap-3 rounded-2xl px-4.5 py-3.5 shadow-[0_10px_30px_rgba(43,34,119,0.15)]"
                style={{ backgroundColor: "var(--d-bg)" }}
              >
                <span
                  data-demo-slot="secoes.hero.itens.0.titulo"
                  className="font-[family-name:var(--d-display)] text-[26px] italic"
                  style={{ color: "var(--d-accent)" }}
                >
                  {s.hero.itens[0].titulo}
                </span>
                {s.hero.itens[0].subtitulo && (
                  <span
                    data-demo-slot="secoes.hero.itens.0.subtitulo"
                    className="text-[13px] leading-snug"
                    style={{ color: "var(--d-muted)" }}
                  >
                    {s.hero.itens[0].subtitulo}
                  </span>
                )}
              </div>
            )}

            {s.hero?.itens?.[1] && (
              <div
                aria-hidden="true"
                className="d-badge-spin absolute -right-2 -top-2 hidden h-[104px] w-[104px] sm:block"
              >
                <svg viewBox="0 0 100 100" width="104" height="104">
                  <defs>
                    <path id="d-petshop-hero-circle" d="M50,50 m-38,0 a38,38 0 1,1 76,0 a38,38 0 1,1 -76,0" />
                  </defs>
                  <text
                    style={{
                      fontFamily: "var(--d-corpo)",
                      fontSize: "10.5px",
                      fontWeight: 600,
                      letterSpacing: "2.4px",
                      fill: "var(--d-accent-2)",
                      textTransform: "uppercase",
                    }}
                  >
                    <textPath href="#d-petshop-hero-circle">{s.hero.itens[1].titulo}</textPath>
                  </text>
                </svg>
              </div>
            )}
          </div>
        </div>
      </section>
    ),

    /* ── Fita de frases (marquee contínuo) ─────────────────────── */
    faixa: () =>
      (s.faixa?.itens?.length ?? 0) > 0 && (
        <div
          className="relative z-10 my-3 overflow-hidden py-4"
          style={{ backgroundColor: "var(--d-accent-2)", transform: "rotate(-1deg)" }}
        >
          <div className="d-marquee-track flex w-max whitespace-nowrap">
            {[0, 1].map((copia) => (
              <span key={copia} aria-hidden={copia === 1 || undefined} className="flex shrink-0 pr-2">
                {s.faixa!.itens!.map((item, i) => (
                  <span
                    key={i}
                    data-demo-slot={copia === 0 ? `secoes.faixa.itens.${i}.titulo` : undefined}
                    className="pr-8 font-[family-name:var(--d-citacao)] text-xl italic"
                    style={{ color: "var(--d-bg)" }}
                  >
                    {item.titulo} ✦
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>
      ),

    /* ── Números (contadores animados) ─────────────────────────── */
    numeros: () =>
      (s.numeros?.itens?.length ?? 0) > 0 && (
        <section id="numeros" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="grid gap-8 text-center sm:grid-cols-3">
            {s.numeros!.itens!.map((item, i) => (
              <div key={i}>
                <div
                  data-demo-slot={`secoes.numeros.itens.${i}.titulo`}
                  className="font-[family-name:var(--d-display)] text-[clamp(2.75rem,5.5vw,4.5rem)]"
                  style={{ color: "var(--d-text)" }}
                >
                  <Counter texto={item.titulo} />
                </div>
                {item.subtitulo && (
                  <div
                    data-demo-slot={`secoes.numeros.itens.${i}.subtitulo`}
                    className="mt-1.5 text-[15px]"
                    style={{ color: "var(--d-accent-2)" }}
                  >
                    {item.subtitulo}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ),

    /* ── Serviços ───────────────────────────────────────────────── */
    servicos: () =>
      data.servicos.length > 0 && (
        <section id="servicos" className="relative z-10 mx-auto max-w-[1320px] px-4 py-8 sm:px-6">
          <div
            className="rounded-[var(--d-radius)] px-4 py-14 sm:px-10 sm:py-20"
            style={{ backgroundColor: "var(--d-accent)" }}
          >
            <div className="mx-auto max-w-6xl">
              <div className="mb-10 flex flex-wrap items-end justify-between gap-5">
                <h2
                  data-demo-slot="secoes.servicos.titulo"
                  className="max-w-xl font-[family-name:var(--d-display)] text-[clamp(2.25rem,4.6vw,3.75rem)] leading-[1.05] tracking-[-0.02em]"
                  style={{ color: "var(--d-accent-ink)" }}
                >
                  {s.servicos?.titulo}
                </h2>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {data.servicos.map((servico, i) => (
                  <div
                    key={servico.nome}
                    className="d-card-hover flex flex-col overflow-hidden rounded-[calc(var(--d-radius)*1.1)]"
                    style={{ backgroundColor: "var(--d-bg)" }}
                  >
                    <div className="relative h-44">
                      <Placeholder
                        src={data.imagens[`servico-${i + 1}`] ?? data.imagens.hero}
                        alt={servico.nome}
                        slot={`imagens.servico-${i + 1}`}
                        sizes="(max-width: 768px) 100vw, 25vw"
                      />
                    </div>
                    <div className="flex flex-1 flex-col gap-2.5 p-6">
                      <h3
                        data-demo-slot={`servicos.${i}.nome`}
                        className="font-[family-name:var(--d-display)] text-2xl"
                        style={{ color: "var(--d-text)" }}
                      >
                        {servico.nome}
                      </h3>
                      {servico.descricao && (
                        <p
                          data-demo-slot={`servicos.${i}.descricao`}
                          className="flex-1 text-sm leading-relaxed"
                          style={{ color: "var(--d-muted)" }}
                        >
                          {servico.descricao}
                        </p>
                      )}
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <span
                          data-demo-slot={`servicos.${i}.preco`}
                          className="text-[13px] font-semibold"
                          style={{ color: "var(--d-accent-2)" }}
                        >
                          {formatarPrecoServico(servico, idioma, moeda)}
                        </span>
                        <span aria-hidden="true" className="d-cta-round d-cta-round-sm">
                          →
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      ),

    /* ── Como funciona (passos) ─────────────────────────────────── */
    comoFunciona: () =>
      (s.comoFunciona?.itens?.length ?? 0) > 0 && (
        <section id="comoFunciona" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <h2
            data-demo-slot="secoes.comoFunciona.titulo"
            className={`mb-14 font-[family-name:var(--d-display)] text-[clamp(2.25rem,4.6vw,3.75rem)] tracking-[-0.02em] ${
              centro("comoFunciona") ? "text-center" : ""
            }`}
            style={{ color: "var(--d-text)" }}
          >
            {s.comoFunciona?.titulo}
          </h2>
          <div className="flex flex-wrap items-stretch justify-center gap-6">
            {s.comoFunciona!.itens!.map((item, i, arr) => (
              <div key={i} className="flex max-w-[380px] flex-1 basis-[260px] items-center gap-3">
                <div className="flex-1 px-2 text-center">
                  <div
                    className="d-step-badge mx-auto mb-5 flex h-[86px] w-[86px] items-center justify-center rounded-[50%_46%_52%_48%/48%_52%_46%_54%] font-[family-name:var(--d-display)] text-4xl"
                    style={{ backgroundColor: STEP_BG[i % 3], color: STEP_FG[i % 3] }}
                  >
                    {i + 1}
                  </div>
                  <h3
                    data-demo-slot={`secoes.comoFunciona.itens.${i}.titulo`}
                    className="mb-2 font-[family-name:var(--d-display)] text-xl"
                    style={{ color: "var(--d-text)" }}
                  >
                    {item.titulo}
                  </h3>
                  {item.texto && (
                    <p
                      data-demo-slot={`secoes.comoFunciona.itens.${i}.texto`}
                      className="text-[15px] leading-relaxed"
                      style={{ color: "var(--d-muted)" }}
                    >
                      {item.texto}
                    </p>
                  )}
                </div>
                {i < arr.length - 1 && <StepDash />}
              </div>
            ))}
          </div>
        </section>
      ),

    /* ── Depoimentos ─────────────────────────────────────────────── */
    depoimentos: () =>
      data.depoimentos.length > 0 && (
        <section id="depoimentos" className="px-4 py-16 sm:px-6 sm:py-24" style={{ backgroundColor: "var(--d-accent-2)" }}>
          <div className="mx-auto max-w-6xl">
            <h2
              data-demo-slot="secoes.depoimentos.titulo"
              className={`mb-12 max-w-xl font-[family-name:var(--d-display)] text-[clamp(2.25rem,4.6vw,3.75rem)] tracking-[-0.02em] ${
                centro("depoimentos") ? "mx-auto text-center" : ""
              }`}
              style={{ color: "var(--d-accent-ink)" }}
            >
              {s.depoimentos?.titulo}
            </h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {data.depoimentos.map((dep, i) => (
                <figure
                  key={i}
                  className="d-quote-card flex flex-col gap-5 rounded-[calc(var(--d-radius)*1.1)] p-7"
                  style={{
                    backgroundColor: "color-mix(in srgb, var(--d-bg) 6%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--d-bg) 12%, transparent)",
                  }}
                >
                  <blockquote
                    data-demo-slot={`depoimentos.${i}.texto`}
                    className="font-[family-name:var(--d-citacao)] text-lg italic leading-snug"
                    style={{ color: "color-mix(in srgb, var(--d-bg) 92%, transparent)" }}
                  >
                    “{dep.texto}”
                  </blockquote>
                  <figcaption
                    data-demo-slot={`depoimentos.${i}.autor`}
                    className="mt-auto text-sm font-semibold"
                    style={{ color: "var(--d-accent-ink)" }}
                  >
                    {dep.autor}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      ),

    /* ── Equipe ─────────────────────────────────────────────────── */
    equipe: () =>
      (s.equipe?.itens?.length ?? 0) > 0 && (
        <section id="equipe" className="relative z-10 mx-auto max-w-[1320px] px-4 py-8 sm:px-6">
          <div
            className="rounded-[var(--d-radius)] px-4 py-14 sm:px-10 sm:py-20"
            style={{ backgroundColor: "color-mix(in srgb, var(--d-accent) 55%, var(--d-accent-2) 45%)" }}
          >
            <div className="mx-auto max-w-6xl">
              <h2
                data-demo-slot="secoes.equipe.titulo"
                className={`mb-3 font-[family-name:var(--d-display)] text-[clamp(2.25rem,4.6vw,3.75rem)] tracking-[-0.02em] ${
                  centro("equipe") ? "mx-auto max-w-xl text-center" : "max-w-xl"
                }`}
                style={{ color: "var(--d-accent-ink)" }}
              >
                {s.equipe?.titulo}
              </h2>
              {s.equipe?.texto && (
                <p
                  data-demo-slot="secoes.equipe.texto"
                  className={`mb-12 max-w-lg text-base ${centro("equipe") ? "mx-auto text-center" : ""}`}
                  style={{ color: "color-mix(in srgb, var(--d-accent-ink) 90%, transparent)" }}
                >
                  {s.equipe.texto}
                </p>
              )}
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {s.equipe!.itens!.map((membro, i) => (
                  <div
                    key={i}
                    className="d-team-card rounded-[calc(var(--d-radius)*1.1)] p-6 text-center"
                    style={
                      {
                        "--tilt": i % 2 === 0 ? "-1.5deg" : "1.5deg",
                        backgroundColor: "var(--d-bg)",
                      } as CSSProperties
                    }
                  >
                    <div
                      className="mx-auto mb-4 h-[120px] w-[120px] overflow-hidden rounded-[52%_48%_56%_44%/46%_52%_48%_54%]"
                      style={{ border: "3px solid var(--d-accent-3)", position: "relative" }}
                    >
                      <Placeholder
                        src={data.imagens[`equipe-${i + 1}`] ?? data.imagens.hero}
                        alt={membro.titulo}
                        slot={`imagens.equipe-${i + 1}`}
                        sizes="130px"
                      />
                    </div>
                    <h3
                      data-demo-slot={`secoes.equipe.itens.${i}.titulo`}
                      className="font-[family-name:var(--d-display)] text-xl"
                      style={{ color: "var(--d-text)" }}
                    >
                      {membro.titulo}
                    </h3>
                    {membro.subtitulo && (
                      <div
                        data-demo-slot={`secoes.equipe.itens.${i}.subtitulo`}
                        className="my-1.5 text-xs font-semibold uppercase tracking-wider"
                        style={{ color: "color-mix(in srgb, var(--d-accent) 55%, var(--d-accent-2) 45%)" }}
                      >
                        {membro.subtitulo}
                      </div>
                    )}
                    {membro.texto && (
                      <p
                        data-demo-slot={`secoes.equipe.itens.${i}.texto`}
                        className="text-sm italic leading-relaxed"
                        style={{ color: "var(--d-muted)" }}
                      >
                        {membro.texto}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      ),

    /* ── Diferenciais ───────────────────────────────────────────── */
    diferenciais: () =>
      (s.diferenciais?.itens?.length ?? 0) > 0 && (
        <section id="diferenciais" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <h2
            data-demo-slot="secoes.diferenciais.titulo"
            className="mb-12 max-w-2xl font-[family-name:var(--d-display)] text-[clamp(2.25rem,4.6vw,3.75rem)] tracking-[-0.02em]"
            style={{ color: "var(--d-text)" }}
          >
            {s.diferenciais?.titulo}
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {s.diferenciais!.itens!.map((item, i) => (
              <div
                key={i}
                className="d-value-card flex flex-col gap-3 rounded-[calc(var(--d-radius)*0.85)] p-7"
                style={{ border: "1px solid var(--d-border)" }}
              >
                <span
                  aria-hidden="true"
                  className="font-[family-name:var(--d-display)] text-3xl italic"
                  style={{ color: "var(--d-accent)" }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3
                  data-demo-slot={`secoes.diferenciais.itens.${i}.titulo`}
                  className="font-[family-name:var(--d-display)] text-2xl"
                  style={{ color: "var(--d-text)" }}
                >
                  {item.titulo}
                </h3>
                {item.texto && (
                  <p
                    data-demo-slot={`secoes.diferenciais.itens.${i}.texto`}
                    className="text-[15px] leading-relaxed"
                    style={{ color: "var(--d-muted)" }}
                  >
                    {item.texto}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      ),

    /* ── Galeria (clientes da semana) ─────────────────────────────── */
    galeria: () =>
      (s.galeria?.itens?.length ?? 0) > 0 && (
        <section id="galeria" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div
            className={`mb-10 flex flex-wrap items-end justify-between gap-4 ${centro("galeria") ? "text-center" : ""}`}
          >
            <h2
              data-demo-slot="secoes.galeria.titulo"
              className="font-[family-name:var(--d-display)] text-[clamp(2.25rem,4.6vw,3.75rem)] tracking-[-0.02em]"
              style={{ color: "var(--d-text)" }}
            >
              {s.galeria?.titulo}
            </h2>
            {s.galeria?.texto && (
              <p
                data-demo-slot="secoes.galeria.texto"
                className="max-w-xs text-[15px]"
                style={{ color: "var(--d-accent-2)" }}
              >
                {s.galeria.texto}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {s.galeria!.itens!.map((item, i) => (
              <div
                key={i}
                className="d-gallery-tile relative aspect-square overflow-hidden"
                style={{ borderRadius: GALERIA_RAIOS[i % GALERIA_RAIOS.length] }}
              >
                <Placeholder
                  src={data.imagens[`galeria-${i + 1}`] ?? data.imagens.hero}
                  alt={item.titulo ?? ""}
                  slot={`imagens.galeria-${i + 1}`}
                  sizes="(max-width: 768px) 33vw, 16vw"
                />
                <div
                  className="d-gallery-caption absolute inset-x-0 bottom-0 flex h-[44%] items-end p-3.5"
                  style={{
                    background:
                      "linear-gradient(to top, color-mix(in srgb, var(--d-text) 75%, transparent), transparent)",
                  }}
                >
                  {item.titulo && (
                    <span
                      data-demo-slot={`secoes.galeria.itens.${i}.titulo`}
                      className="font-[family-name:var(--d-display)] text-xl italic"
                      style={{ color: "var(--d-bg)" }}
                    >
                      {item.titulo}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ),

    /* ── Chamada final ─────────────────────────────────────────────── */
    ctaFinal: () => (
      <section id="cta-final" className="mx-auto max-w-[1320px] px-4 py-8 sm:px-6">
        <div
          className="relative overflow-hidden rounded-[var(--d-radius)] px-6 py-16 text-center sm:px-16 sm:py-24"
          style={{ backgroundColor: "var(--d-accent-3)" }}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-16 -top-24 h-[280px] w-[280px] rounded-[58%_42%_55%_45%/52%_48%_60%_40%]"
            style={{ backgroundColor: "color-mix(in srgb, var(--d-bg) 12%, transparent)" }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 -right-14 h-[320px] w-[320px] rounded-[45%_55%_48%_52%/55%_45%_52%_48%]"
            style={{ backgroundColor: "color-mix(in srgb, var(--d-text) 15%, transparent)" }}
          />
          {s.ctaFinal?.titulo && (
            <h2
              data-demo-slot="secoes.ctaFinal.titulo"
              className="relative mx-auto max-w-3xl font-[family-name:var(--d-display)] text-[clamp(2.25rem,5.6vw,4.5rem)] leading-[1.05] tracking-[-0.02em]"
              style={{ color: "var(--d-text)" }}
            >
              {s.ctaFinal.titulo}
            </h2>
          )}
          {s.ctaFinal?.texto && (
            <p
              data-demo-slot="secoes.ctaFinal.texto"
              className="relative mx-auto mt-5 max-w-md text-base leading-relaxed"
              style={{ color: "color-mix(in srgb, var(--d-text) 85%, transparent)" }}
            >
              {s.ctaFinal.texto}
            </p>
          )}
          {s.ctaFinal?.cta && (
            <OrderCta
              whatsapp={data.whatsapp}
              mensagem={mensagemAgendar}
              idioma={idioma}
              slot="secoes.ctaFinal.cta"
              className="d-cta-pill d-cta-pill-lg d-cta-pill-dark relative mt-9 inline-flex"
            >
              {s.ctaFinal.cta}
            </OrderCta>
          )}
        </div>
      </section>
    ),

    /* ── Contato (rodapé) ─────────────────────────────────────────── */
    contato: () => (
      <footer
        id="contato"
        className={`relative overflow-hidden border-t-8 px-4 pb-10 pt-16 sm:px-6 ${
          centro("contato") ? "text-center" : "text-center sm:text-left"
        }`}
        style={{ backgroundColor: "var(--d-text)", borderColor: "var(--d-accent)" }}
      >
        <div
          className={`relative z-10 mx-auto mb-14 flex w-full max-w-5xl flex-col items-center gap-12 sm:flex-row sm:justify-between ${
            centro("contato") ? "" : "sm:items-start"
          }`}
        >
          <div className="flex max-w-xs flex-col items-center gap-4 sm:items-start">
            <h2 data-demo-slot="nome" className="font-[family-name:var(--d-display)] text-3xl" style={{ color: "var(--d-bg)" }}>
              {data.nome}
            </h2>
            {data.slogan && (
              <p data-demo-slot="slogan" className="text-[15px] leading-relaxed" style={{ color: "color-mix(in srgb, var(--d-bg) 75%, transparent)" }}>
                {data.slogan}
              </p>
            )}
            {data.instagram && (
              <a
                href={`https://instagram.com/${data.instagram.replace(/^@/, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                data-demo-slot="instagram"
                className="d-social-icon flex h-10 w-10 items-center justify-center rounded-full"
                style={{ border: "1px solid color-mix(in srgb, var(--d-bg) 30%, transparent)" }}
                aria-label="Instagram"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--d-bg)" strokeWidth="1.8" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                </svg>
              </a>
            )}
          </div>

          {data.horarios && (
            <div className="flex flex-col items-center gap-3 sm:items-start">
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "color-mix(in srgb, var(--d-bg) 60%, transparent)" }}>
                {m.horario}
              </h3>
              <p data-demo-slot="horarios" className="text-[15px]" style={{ color: "color-mix(in srgb, var(--d-bg) 85%, transparent)" }}>
                {data.horarios}
              </p>
            </div>
          )}

          <div className="flex flex-col items-center gap-3 sm:items-start">
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "color-mix(in srgb, var(--d-bg) 60%, transparent)" }}>
              {m.faleComAGente}
            </h3>
            {data.telefone && (
              <a href={`tel:${data.telefone.replace(/\D/g, "")}`} data-demo-slot="telefone" className="d-footer-link text-[15px]" style={{ color: "color-mix(in srgb, var(--d-bg) 85%, transparent)" }}>
                {data.telefone}
              </a>
            )}
            {(data.endereco || data.cidade) && (
              <p data-demo-slot={data.endereco ? "endereco" : "cidade"} className="text-[15px]" style={{ color: "color-mix(in srgb, var(--d-bg) 75%, transparent)" }}>
                {data.endereco ?? data.cidade}
              </p>
            )}
            {s.contato?.cta && (
              <OrderCta
                whatsapp={data.whatsapp}
                mensagem={mensagemAgendar}
                idioma={idioma}
                slot="secoes.contato.cta"
                className="d-cta-outline mt-1"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d={WHATSAPP_ICON_PATH} />
                </svg>
                {s.contato.cta}
              </OrderCta>
            )}
          </div>
        </div>

        <div
          className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-3 border-t pt-8 sm:flex-row"
          style={{ borderColor: "color-mix(in srgb, var(--d-bg) 15%, transparent)" }}
        >
          <p className="text-xs" style={{ color: "color-mix(in srgb, var(--d-bg) 55%, transparent)" }}>
            © {new Date().getFullYear()} {data.nome}.{" "}
            <span data-demo-slot="secoes.contato.texto">
              {s.contato?.texto ?? "Feito com carinho e pelos de pet no teclado."}
            </span>
          </p>
        </div>
      </footer>
    ),
  };

  return (
    <div
      style={vars}
      data-d-hover={theme.hover}
      data-d-clique={theme.clique}
      data-d-anim={theme.animacao}
      className="min-h-screen overflow-x-clip bg-[var(--d-bg)] font-[family-name:var(--d-corpo)] text-[var(--d-text)] selection:bg-[var(--d-accent)] selection:text-[var(--d-accent-ink)]"
    >
      <style>{`
        /* ── Botões / CTAs ───────────────────────────────────── */
        .d-cta-pill {
          display: inline-flex; align-items: center; justify-content: center; gap: 0.6rem;
          font-family: var(--d-corpo); font-weight: 600;
          color: var(--d-accent-ink); background: var(--d-accent);
          border-radius: 9999px; padding: 0.85rem 1.7rem; font-size: 15px;
          transition: transform var(--d-anim-duration) var(--d-anim-ease),
            box-shadow var(--d-anim-duration) var(--d-anim-ease), background var(--d-anim-duration) var(--d-anim-ease);
        }
        .d-cta-pill-lg { padding: 1.05rem 2.1rem; font-size: 16px; }
        .d-cta-pill-dark { background: var(--d-text); color: var(--d-bg); }
        .d-cta-pill:hover { transform: translateY(var(--d-hover-lift)) scale(var(--d-hover-scale)); box-shadow: 0 12px 28px color-mix(in srgb, var(--d-text) 22%, transparent); }
        .d-cta-pill-dark:hover { color: var(--d-accent); }
        @media (prefers-reduced-motion: reduce) { .d-cta-pill:hover { transform: none; } }

        .d-cta-outline {
          display: inline-flex; align-items: center; gap: 0.5rem;
          font-family: var(--d-corpo); font-weight: 600; color: var(--d-text);
          border: 1.5px solid color-mix(in srgb, var(--d-text) 30%, transparent);
          border-radius: 9999px; padding: 0.85rem 1.7rem; font-size: 15px;
          transition: transform var(--d-anim-duration) var(--d-anim-ease), border-color var(--d-anim-duration) var(--d-anim-ease), background var(--d-anim-duration) var(--d-anim-ease), color var(--d-anim-duration) var(--d-anim-ease);
        }
        .d-cta-outline-lg { padding: 1.05rem 2.1rem; font-size: 16px; }
        .d-cta-outline:hover { border-color: var(--d-text); background: var(--d-text); color: var(--d-bg); transform: translateY(var(--d-hover-lift)); }
        @media (prefers-reduced-motion: reduce) { .d-cta-outline:hover { transform: none; } }

        .d-cta-round {
          display: inline-flex; align-items: center; justify-content: center;
          width: 46px; height: 46px; border-radius: 9999px;
          background: var(--d-accent); color: var(--d-accent-ink);
          box-shadow: 0 4px 14px color-mix(in srgb, var(--d-accent) 40%, transparent);
          transition: transform var(--d-anim-duration) var(--d-anim-ease);
        }
        .d-cta-round-sm { width: 34px; height: 34px; font-size: 15px; }
        .d-cta-round:hover { transform: scale(var(--d-hover-scale)); }
        @media (prefers-reduced-motion: reduce) { .d-cta-round:hover { transform: none; } }
        .d-cta-pill:active, .d-cta-outline:active, .d-cta-round:active { opacity: 0.92; }

        /* ── Cards / hovers genéricos ───────────────────────── */
        .d-card-hover, .d-quote-card, .d-value-card, .d-team-card {
          transition: transform var(--d-anim-duration) var(--d-anim-ease),
            box-shadow var(--d-anim-duration) var(--d-anim-ease),
            border-color var(--d-anim-duration) var(--d-anim-ease),
            background var(--d-anim-duration) var(--d-anim-ease);
        }
        .d-card-hover:hover { transform: translateY(var(--d-hover-lift)); box-shadow: 0 20px 44px color-mix(in srgb, var(--d-text) 16%, transparent); }
        .d-quote-card:hover { transform: translateY(var(--d-hover-lift)); background: color-mix(in srgb, var(--d-bg) 10%, transparent) !important; }
        .d-value-card:hover { border-color: var(--d-accent) !important; background: color-mix(in srgb, var(--d-accent) 6%, transparent); transform: translateY(var(--d-hover-lift)); }
        .d-team-card:hover { transform: translateY(var(--d-hover-lift)) rotate(var(--tilt, 0deg)); box-shadow: 0 20px 44px color-mix(in srgb, var(--d-text) 16%, transparent); }
        .d-step-badge { transition: transform var(--d-anim-duration) var(--d-anim-ease); }
        .d-step-badge:hover { transform: rotate(-6deg) scale(var(--d-hover-scale)); }
        .d-social-icon, .d-footer-link { transition: border-color var(--d-anim-duration) var(--d-anim-ease), background var(--d-anim-duration) var(--d-anim-ease), color var(--d-anim-duration) var(--d-anim-ease), transform var(--d-anim-duration) var(--d-anim-ease); }
        .d-social-icon:hover { border-color: var(--d-accent) !important; background: var(--d-accent); transform: translateY(var(--d-hover-lift)); }
        .d-footer-link:hover { color: var(--d-accent-3) !important; }
        @media (prefers-reduced-motion: reduce) {
          .d-card-hover:hover, .d-quote-card:hover, .d-value-card:hover, .d-team-card:hover,
          .d-step-badge:hover, .d-social-icon:hover { transform: none; }
        }

        /* Galeria: legenda revelada no hover (fiel ao original). */
        .d-gallery-caption { opacity: 0; transition: opacity var(--d-anim-duration) var(--d-anim-ease); }
        .d-gallery-tile:hover .d-gallery-caption { opacity: 1; }

        /* ── Animações contínuas fiéis ao material bruto ─────── */
        @keyframes d-badge-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
        .d-badge-float { animation: d-badge-float 5s ease-in-out infinite; }
        @keyframes d-badge-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .d-badge-spin { animation: d-badge-spin 14s linear infinite; }
        @keyframes d-marquee { from { transform: translateX(0); } to { transform: translateX(-100%); } }
        .d-marquee-track { animation: d-marquee 26s linear infinite; }
        @keyframes d-step-dash { to { stroke-dashoffset: -28; } }
        .d-step-dash { animation: d-step-dash 1.4s linear infinite; }
        [data-d-anim="nenhuma"] .d-badge-float, [data-d-anim="nenhuma"] .d-badge-spin,
        [data-d-anim="nenhuma"] .d-marquee-track, [data-d-anim="nenhuma"] .d-step-dash {
          animation: none;
        }
        @media (prefers-reduced-motion: reduce) {
          .d-badge-float, .d-badge-spin, .d-marquee-track, .d-step-dash { animation: none; }
        }

        /* ── Animação de clique (Theme.clique) ──────────────── */
        [data-d-clique="pressao"]:not([data-d-anim="nenhuma"]) a:active,
        [data-d-clique="pressao"]:not([data-d-anim="nenhuma"]) button:active { transform: scale(0.96); transition-duration: 90ms; }
        @keyframes d-clique-pulso { 0% { transform: scale(1); } 40% { transform: scale(1.05); } 100% { transform: scale(1); } }
        [data-d-clique="pulso"]:not([data-d-anim="nenhuma"]) a:active,
        [data-d-clique="pulso"]:not([data-d-anim="nenhuma"]) button:active { animation: d-clique-pulso 280ms var(--d-anim-ease); }
        @media (prefers-reduced-motion: reduce) {
          [data-d-clique] a:active, [data-d-clique] button:active { transform: none; animation: none; }
        }

        /* ── Hover do tema (Theme.hover) ────────────────────── */
        [data-d-hover="zoom"] .d-cta-pill:hover, [data-d-hover="zoom"] .d-cta-round:hover { transform: scale(var(--d-hover-scale)); }
        [data-d-hover="zoom"] .d-card-hover:hover, [data-d-hover="zoom"] .d-team-card:hover { transform: scale(var(--d-hover-scale)); }
        [data-d-hover="brilho"] .d-cta-pill:hover, [data-d-hover="brilho"] .d-cta-round:hover {
          transform: none; box-shadow: 0 0 32px color-mix(in srgb, var(--d-accent) 55%, transparent);
        }
        [data-d-hover="brilho"] .d-card-hover:hover, [data-d-hover="brilho"] .d-team-card:hover {
          transform: none;
          box-shadow: 0 0 24px color-mix(in srgb, var(--d-accent) 30%, transparent);
          border-color: color-mix(in srgb, var(--d-accent) 45%, transparent);
        }
        @media (prefers-reduced-motion: reduce) {
          [data-d-hover] .d-cta-pill:hover, [data-d-hover] .d-card-hover:hover,
          [data-d-hover] .d-cta-round:hover, [data-d-hover] .d-team-card:hover { transform: none; }
        }

      `}</style>

      <LedEdges preset={theme.led} estilo={theme.ledEstilo} />

      <IntroExperience
        fundo={paleta.acentoSecundario}
        palavra1Cor={paleta.acentoTerciario}
        palavra2Cor={paleta.destaque}
        ativa={theme.intro === true}
      >
        <Header nome={data.nome} whatsapp={data.whatsapp} idioma={idioma} />

        {visiveis.map((id) => {
          const tipo = wrapperTipo(id);
          return tipo === null ? (
            <Fragment key={id}>{secoes[id]?.()}</Fragment>
          ) : (
            <SectionReveal key={id} animacao={theme.animacao} tipo={tipo}>
              {secoes[id]?.()}
            </SectionReveal>
          );
        })}
      </IntroExperience>

      <OrderCta
        whatsapp={data.whatsapp}
        mensagem={mensagemAgendar}
        idioma={idioma}
        aria-label={m.conversarNoWhatsapp}
        className="d-cta-round fixed bottom-5 right-5 z-[70]"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d={WHATSAPP_ICON_PATH} />
        </svg>
      </OrderCta>
    </div>
  );
}
