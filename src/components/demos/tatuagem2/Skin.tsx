import Image from "next/image";
import { Fragment, type CSSProperties, type ReactNode } from "react";

import { secoesVisiveis } from "@/lib/demos/estrutura";
import { microcopiaDemo } from "@/lib/demos/microcopy";
import { formatarPrecoServico } from "@/lib/demos/precos";
import type { Alinhamento, Animacao, Densidade, SkinProps } from "@/lib/demos/types";
import { FadeUp } from "./interactive/FadeUp";
import { FaqAccordion } from "./interactive/FaqAccordion";
import { IntroExperience } from "./interactive/IntroExperience";
import { LedEdges } from "./interactive/LedEdges";
import { LineDraw } from "./interactive/LineDraw";
import { ManifestoReveal } from "./interactive/ManifestoReveal";
import { Nav } from "./interactive/Nav";
import { Parallax } from "./interactive/Parallax";
import { PigmentTracker } from "./interactive/PigmentTracker";
import { ScrollGallery } from "./interactive/ScrollGallery";
import { SectionReveal, type RevealTipo } from "./interactive/SectionReveal";
import { SplashTitle } from "./interactive/SplashTitle";
import { TATUAGEM2_SECOES } from "./secoes";

/**
 * Skin "Tatuagem Pigmento Vivo" — conversão fiel do material bruto
 * (skins-raw/tatuagem2, CROMA Tattoo Studio): fundo claro, blobs
 * coloridos borrados, manifesto que "acende" palavra a palavra no
 * scroll, cartões com blob+tilt no hover, portfólio em trilha horizontal
 * pinada e rabiscos de assinatura desenhados na tela.
 *
 * Componente PURO: todo texto/imagem vem de `data`, toda cor/fonte/raio/
 * densidade vem de `theme` (aplicado como CSS vars no wrapper). Nenhuma
 * chamada externa — imagens são placeholders locais por slot (só o
 * Portfólio tem imagem de verdade; hero e cartões de estilos/artistas não
 * usam foto no original, só blobs de cor e rabiscos SVG).
 *
 * `investimento` (preços) e `depoimentos` são seções acrescentadas ao
 * original — exigidas pelo contrato universal de DemoData (ver
 * secoes.ts) — reskinadas na mesma linguagem colorida/editorial.
 *
 * Estrutura editável: as seções renderizam na ordem efetiva de
 * DemoData.ordemSecoes (ver lib/demos/estrutura.ts), respeitam
 * DemoSecao.oculta e alinhamento onde TATUAGEM2_SECOES declara
 * alignOptions. Os atributos `data-demo-slot` marcam cada texto com o
 * caminho do slot em DemoData — o editor visual usa isso para focar o
 * campo certo ao clicar no preview.
 */

const SECTION_PAD: Record<Densidade, string> = {
  compacta: "5rem",
  confortavel: "8rem",
  arejada: "10rem",
};

const ANIM_DURATION: Record<Animacao, string> = {
  nenhuma: "0ms",
  sutil: "250ms",
  marcante: "500ms",
};
const ANIM_HOVER_SCALE: Record<Animacao, string> = {
  nenhuma: "1",
  sutil: "1.03",
  marcante: "1.05",
};
const ANIM_HOVER_LIFT: Record<Animacao, string> = {
  nenhuma: "0px",
  sutil: "-3px",
  marcante: "-8px",
};

/** Seções com revelação própria (não embrulhar de novo no SectionReveal padrão). */
const SEM_ENTRADA_DEFAULT = new Set(["manifesto"]);

function waHref(whatsapp: string | undefined): string {
  const digitos = (whatsapp ?? "").replace(/\D/g, "");
  return digitos ? `https://wa.me/${digitos}` : "#agendar";
}

function Etiqueta({ texto, slot }: { texto?: string; slot?: string }) {
  if (!texto) return null;
  return (
    <span
      data-demo-slot={slot}
      className="mb-4 block font-[family-name:var(--d-mono)] text-xs font-semibold uppercase tracking-[0.24em] text-[var(--d-text)]"
    >
      {texto}
    </span>
  );
}

function Placeholder({
  src,
  alt,
  sizes,
  slot,
  className = "",
}: {
  src: string;
  alt: string;
  sizes: string;
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
      className={`object-cover ${className}`}
      sizes={sizes}
    />
  );
}

/** Rabiscos de assinatura dos artistas — chrome decorativo fixo (não é conteúdo do lead). */
const RABISCOS_ARTISTA = [
  "M30 130 C 30 60, 90 30, 110 60 C 128 87, 95 110, 80 92 C 65 74, 95 50, 125 62 C 165 78, 170 115, 140 130 C 115 142, 80 138, 70 120",
  "M20 100 C 50 40, 80 40, 100 80 C 120 120, 150 120, 180 60 M 180 60 C 170 80, 150 90, 130 85",
  "M40 140 C 60 100, 55 70, 85 55 C 115 40, 140 55, 138 80 C 136 102, 110 108, 100 92 C 92 78, 105 64, 122 68 M 85 55 C 95 40, 115 30, 135 32",
];

export function TatuagemPigmentoVivo({ data, theme, idioma, moeda }: SkinProps) {
  const { paleta, fontes } = theme;
  const m = microcopiaDemo(idioma);
  const pigmentos = [paleta.destaque, paleta.acentoSecundario, paleta.acentoTerciario];

  const vars = {
    "--d-bg": paleta.fundo,
    "--d-bg-alt": paleta.fundoAlt,
    "--d-bg-elev": paleta.fundoElevado,
    "--d-accent": paleta.destaque,
    "--d-accent-ink": paleta.destaqueInk,
    "--d-accent-2": paleta.acentoSecundario,
    "--d-accent-3": paleta.acentoTerciario,
    "--d-text": paleta.texto,
    "--d-muted": paleta.textoSuave,
    "--d-border": paleta.borda,
    "--d-unlit": `color-mix(in srgb, var(--d-text) 32%, var(--d-bg))`,
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
    "--d-anim-ease": "cubic-bezier(0.16, 1, 0.3, 1)",
    "--d-hover-scale": ANIM_HOVER_SCALE[theme.animacao],
    "--d-hover-lift": ANIM_HOVER_LIFT[theme.animacao],
  } as CSSProperties;

  const s = data.secoes;
  const agendar = waHref(data.whatsapp);
  const HERO_ALINHAMENTO_TEXT: Record<Alinhamento, string> = {
    esquerda: "text-left items-start",
    centro: "text-center items-center",
    direita: "text-right items-end",
  };

  const visiveis = secoesVisiveis(TATUAGEM2_SECOES, data);
  const ALINHAMENTO_PADRAO: Record<string, Alinhamento> = {
    depoimentos: "esquerda",
    processo: "esquerda",
  };
  const alinhamentoDe = (id: string): Alinhamento =>
    s[id]?.alinhamento ?? ALINHAMENTO_PADRAO[id] ?? "esquerda";
  const centro = (id: string): boolean => alinhamentoDe(id) === "centro";

  const entradaDe = (id: string) => s[id]?.animacaoEntrada;
  const wrapperTipo = (id: string): RevealTipo | null => {
    const entrada = entradaDe(id);
    if (entrada === undefined) return SEM_ENTRADA_DEFAULT.has(id) ? null : "padrao";
    if (entrada === "nenhuma") return null;
    if (entrada === "deslizar-esquerda") return "esquerda";
    if (entrada === "deslizar-direita") return "direita";
    return "fade";
  };

  const links = [
    s.estilos?.rotulo && { href: "#estilos", label: s.estilos?.rotulo },
    s.portfolio?.rotulo && { href: "#portfolio", label: s.portfolio?.rotulo },
    s.artistas?.rotulo && { href: "#artistas", label: s.artistas?.rotulo },
    s.faq?.rotulo && { href: "#faq", label: s.faq.rotulo },
  ].filter((link): link is { href: string; label: string } => Boolean(link));

  const secoes: Record<string, () => ReactNode> = {
    /* ── Hero (fixa) ─────────────────────────────────────────── */
    hero: () => (
      <section
        id="topo"
        data-pigment={pigmentos[0]}
        className="relative flex min-h-[100svh] flex-col justify-center overflow-hidden px-6 pb-20 pt-32 md:px-[clamp(20px,5vw,72px)]"
      >
        <div className="pointer-events-none absolute -left-[8%] top-[6%] h-[46vw] w-[46vw] rounded-full">
          <Parallax animacao={theme.animacao} className="h-full w-full">
            <div className="d-blob d-blob-a h-full w-full rounded-full" />
          </Parallax>
        </div>
        <div className="pointer-events-none absolute -right-[10%] top-[30%] h-[42vw] w-[42vw] rounded-full">
          <Parallax animacao={theme.animacao} className="h-full w-full">
            <div className="d-blob d-blob-b h-full w-full rounded-full" />
          </Parallax>
        </div>
        <div className="pointer-events-none absolute -bottom-[12%] left-[32%] hidden h-[34vw] w-[34vw] rounded-full md:block">
          <Parallax animacao={theme.animacao} className="h-full w-full">
            <div className="d-blob d-blob-c h-full w-full rounded-full" />
          </Parallax>
        </div>

        <svg
          viewBox="0 0 1200 600"
          preserveAspectRatio="xMidYMid slice"
          className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.85]"
          aria-hidden="true"
        >
          <path
            d="M -20 430 C 180 380, 300 480, 430 420 C 540 370, 520 260, 610 240 C 700 220, 700 330, 640 350 C 590 367, 560 300, 615 265 C 680 224, 770 200, 830 250 C 900 308, 850 400, 930 420 C 1030 445, 1120 380, 1240 410"
            fill="none"
            stroke="var(--d-text)"
            strokeWidth="1.6"
            className="d-hero-line"
          />
        </svg>

        <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col">
          <FadeUp animacao={theme.animacao} delay={0.1}>
            <Etiqueta texto={s.hero?.rotulo} slot="secoes.hero.rotulo" />
          </FadeUp>

          <div className={`flex w-full flex-col ${HERO_ALINHAMENTO_TEXT[theme.heroTitulo.alinhamento]}`}>
            <SplashTitle
              texto={s.hero?.titulo ?? data.nome}
              slot="secoes.hero.titulo"
              as="h1"
              accentCycle={pigmentos}
              className="whitespace-pre-line font-[family-name:var(--d-hero-font)] leading-[0.98] text-[var(--d-text)]"
              style={{ fontSize: "calc(clamp(2.75rem, 9vw, 7.5rem) * var(--d-hero-escala))" }}
            />
          </div>

          {s.hero?.texto && (
            <FadeUp animacao={theme.animacao} delay={0.3} className="mt-6 max-w-xl">
              <p data-demo-slot="secoes.hero.texto" className="text-[15px] leading-relaxed text-[var(--d-muted)] md:text-base">
                {s.hero.texto}
              </p>
            </FadeUp>
          )}

          {s.hero?.cta && (
            <FadeUp animacao={theme.animacao} delay={0.5} className="mt-10">
              <a href={agendar} data-demo-slot="secoes.hero.cta" className="d-cta-pill d-cta-solida">
                {s.hero.cta}
              </a>
            </FadeUp>
          )}
        </div>
      </section>
    ),

    /* ── Manifesto ───────────────────────────────────────────── */
    manifesto: () =>
      s.manifesto?.texto && (
        <section data-pigment={paleta.texto} className="px-6 py-[calc(var(--d-sec-y)*1.2)] md:px-[clamp(20px,7vw,120px)]">
          <ManifestoReveal
            texto={s.manifesto.texto}
            slot="secoes.manifesto.texto"
            accentCycle={pigmentos}
            ativa={theme.animacao !== "nenhuma"}
            className="max-w-4xl font-[family-name:var(--d-serif)] leading-[1.18] text-[clamp(1.75rem,5vw,4.5rem)]"
          />
        </section>
      ),

    /* ── Estilos ─────────────────────────────────────────────── */
    estilos: () =>
      s.estilos && (
        <section id="estilos" className="px-6 py-[var(--d-sec-y)] md:px-[clamp(20px,5vw,72px)]">
          <div className="mb-14">
            <Etiqueta texto={s.estilos.rotulo} slot="secoes.estilos.rotulo" />
            <SplashTitle
              texto={s.estilos.titulo}
              slot="secoes.estilos.titulo"
              accentCycle={pigmentos}
              className="font-[family-name:var(--d-display)] text-[clamp(2.25rem,6vw,5.5rem)] leading-[1] text-[var(--d-text)]"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {(s.estilos.itens ?? []).map((item, i) => {
              const ultimo = i === (s.estilos?.itens?.length ?? 0) - 1;
              const cor = pigmentos[i % pigmentos.length];
              return (
                <FadeUp key={item.titulo} animacao={theme.animacao} delay={0.06 * i}>
                  <div
                    className={`d-estilo-card group relative flex min-h-[300px] flex-col justify-between overflow-hidden p-7 ${
                      ultimo ? "d-estilo-card-escuro" : ""
                    }`}
                    style={
                      {
                        "--d-card-blob": cor,
                        borderRadius: "var(--d-radius)",
                      } as CSSProperties
                    }
                  >
                    <span
                      data-demo-slot={`secoes.estilos.itens.${i}.detalhe`}
                      className="relative font-[family-name:var(--d-mono)] text-sm font-semibold"
                      style={{ color: ultimo ? "var(--d-bg)" : cor }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="relative">
                      <h3
                        data-demo-slot={`secoes.estilos.itens.${i}.titulo`}
                        className="mb-2 font-[family-name:var(--d-display)] text-[2rem] italic leading-none"
                      >
                        {item.titulo}
                      </h3>
                      {item.texto && (
                        <p
                          data-demo-slot={`secoes.estilos.itens.${i}.texto`}
                          className="text-sm leading-relaxed"
                          style={{ color: ultimo ? "color-mix(in srgb, var(--d-bg) 70%, transparent)" : "var(--d-muted)" }}
                        >
                          {item.texto}
                        </p>
                      )}
                    </div>
                  </div>
                </FadeUp>
              );
            })}
          </div>
        </section>
      ),

    /* ── Investimento ────────────────────────────────────────── */
    investimento: () => (
      <section
        id="investimento"
        data-pigment={pigmentos[2]}
        className="border-y border-[var(--d-border)] bg-[var(--d-bg-alt)] px-6 py-[var(--d-sec-y)] md:px-[clamp(20px,5vw,72px)]"
      >
        <div className="mx-auto max-w-5xl">
          <div className="mb-14">
            <Etiqueta texto={s.investimento?.rotulo} slot="secoes.investimento.rotulo" />
            <SplashTitle
              texto={s.investimento?.titulo}
              slot="secoes.investimento.titulo"
              accentCycle={pigmentos}
              className="font-[family-name:var(--d-display)] text-[clamp(2rem,5.5vw,4.5rem)] leading-[1] text-[var(--d-text)]"
            />
          </div>
          <div className="flex flex-col gap-3">
            {data.servicos.map((servico, i) => (
              <div
                key={servico.nome}
                className="flex flex-col items-start justify-between gap-2 border-b border-[var(--d-border)] py-5 sm:flex-row sm:items-baseline"
              >
                <div>
                  <h3
                    data-demo-slot={`servicos.${i}.nome`}
                    className="font-[family-name:var(--d-display)] text-xl italic text-[var(--d-text)] md:text-2xl"
                  >
                    {servico.nome}
                  </h3>
                  {servico.descricao && (
                    <p data-demo-slot={`servicos.${i}.descricao`} className="mt-1 max-w-xl text-sm text-[var(--d-muted)]">
                      {servico.descricao}
                    </p>
                  )}
                </div>
                <span
                  data-demo-slot={`servicos.${i}.preco`}
                  className="whitespace-nowrap rounded-full px-4 py-1.5 font-[family-name:var(--d-mono)] text-sm font-semibold"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${pigmentos[i % pigmentos.length]} 16%, transparent)`,
                    color: pigmentos[i % pigmentos.length],
                  }}
                >
                  {formatarPrecoServico(servico, idioma, moeda)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    ),

    /* ── Portfólio (trilha horizontal) ──────────────────────── */
    portfolio: () =>
      s.portfolio && (
        <section id="portfolio" data-pigment={pigmentos[0]} className="py-[var(--d-sec-y)]">
          <div className="mb-10 px-6 md:px-[clamp(20px,5vw,72px)]">
            <Etiqueta texto={s.portfolio.rotulo} slot="secoes.portfolio.rotulo" />
            <SplashTitle
              texto={s.portfolio.titulo}
              slot="secoes.portfolio.titulo"
              accentCycle={pigmentos}
              className="font-[family-name:var(--d-display)] text-[clamp(2.25rem,6vw,5.5rem)] leading-[1] text-[var(--d-text)]"
            />
          </div>

          <ScrollGallery>
            {(s.portfolio.itens ?? []).map((item, i) => {
              const largura = [420, 300, 360, 280, 400, 340][i % 6];
              const altura = [520, 400, 480, 360, 500, 440][i % 6];
              return (
                <figure key={i} className="m-0 flex-shrink-0">
                  <div
                    className="relative overflow-hidden"
                    style={{
                      width: `min(${largura}px, 78vw)`,
                      height: altura,
                      borderRadius: "var(--d-radius)",
                    }}
                  >
                    <Placeholder
                      src={data.imagens[`portfolio-${i + 1}`] ?? Object.values(data.imagens)[0]}
                      alt={`${item.titulo} — ${item.subtitulo ?? ""}`}
                      sizes="(max-width: 768px) 78vw, 420px"
                      slot={`imagens.portfolio-${i + 1}`}
                    />
                  </div>
                  <figcaption
                    data-demo-slot={`secoes.portfolio.itens.${i}`}
                    className="mt-2.5 text-[13px] text-[var(--d-muted)]"
                  >
                    {item.titulo} · {item.subtitulo} · {item.detalhe}
                  </figcaption>
                </figure>
              );
            })}
          </ScrollGallery>
        </section>
      ),

    /* ── Artistas ────────────────────────────────────────────── */
    artistas: () =>
      s.artistas && (
        <section id="artistas" data-pigment={pigmentos[1]} className="px-6 py-[var(--d-sec-y)] md:px-[clamp(20px,5vw,72px)]">
          <div className="mb-16">
            <Etiqueta texto={s.artistas.rotulo} slot="secoes.artistas.rotulo" />
            <SplashTitle
              texto={s.artistas.titulo}
              slot="secoes.artistas.titulo"
              accentCycle={pigmentos}
              className="font-[family-name:var(--d-display)] text-[clamp(2.25rem,6vw,5.5rem)] leading-[1] text-[var(--d-text)]"
            />
          </div>
          <div className="flex flex-wrap items-start gap-x-[clamp(24px,4vw,64px)] gap-y-12">
            {(s.artistas.itens ?? []).map((item, i) => {
              const cor = pigmentos[i % pigmentos.length];
              return (
                <FadeUp key={item.titulo} animacao={theme.animacao} delay={0.1 * i} className="max-w-[380px] flex-1 basis-[280px]">
                  <LineDraw
                    d={RABISCOS_ARTISTA[i % RABISCOS_ARTISTA.length]}
                    viewBox="0 0 200 160"
                    stroke={cor}
                    className="mb-5 block w-full max-w-[220px]"
                  />
                  <h3
                    data-demo-slot={`secoes.artistas.itens.${i}.titulo`}
                    className="mb-1.5 font-[family-name:var(--d-display)] text-[2.1rem] leading-none text-[var(--d-text)]"
                  >
                    {item.titulo}
                  </h3>
                  {item.subtitulo && (
                    <p
                      data-demo-slot={`secoes.artistas.itens.${i}.subtitulo`}
                      className="mb-3 font-[family-name:var(--d-mono)] text-[13px] font-semibold uppercase tracking-[0.14em]"
                      style={{ color: cor }}
                    >
                      {item.subtitulo}
                    </p>
                  )}
                  {item.texto && (
                    <p data-demo-slot={`secoes.artistas.itens.${i}.texto`} className="text-[15px] leading-relaxed text-[var(--d-muted)]">
                      {item.texto}
                    </p>
                  )}
                </FadeUp>
              );
            })}
          </div>
        </section>
      ),

    /* ── Depoimentos ─────────────────────────────────────────── */
    depoimentos: () =>
      data.depoimentos.length > 0 && (
        <section className="px-6 py-[var(--d-sec-y)] md:px-[clamp(20px,5vw,72px)]">
          <div className={`mx-auto max-w-7xl ${centro("depoimentos") ? "text-center" : ""}`}>
            <div className="mb-14">
              <Etiqueta texto={s.depoimentos?.rotulo} slot="secoes.depoimentos.rotulo" />
              <SplashTitle
                texto={s.depoimentos?.titulo}
                slot="secoes.depoimentos.titulo"
                accentCycle={pigmentos}
                className="font-[family-name:var(--d-display)] text-[clamp(2rem,5.5vw,4.5rem)] leading-[1] text-[var(--d-text)]"
              />
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {data.depoimentos.map((dep, i) => (
                <figure
                  key={dep.autor}
                  className="d-card-hover flex h-full flex-col justify-between gap-5 bg-[var(--d-bg-elev)] p-7"
                  style={{ borderRadius: "var(--d-radius)" }}
                >
                  <div>
                    {dep.nota !== undefined && (
                      <div className="mb-3" style={{ color: pigmentos[i % pigmentos.length] }} aria-label={m.avaliacaoEstrelas(dep.nota)}>
                        {"★".repeat(Math.max(0, Math.min(5, Math.round(dep.nota))))}
                      </div>
                    )}
                    <blockquote
                      data-demo-slot={`depoimentos.${i}.texto`}
                      className="font-[family-name:var(--d-serif)] text-lg italic leading-relaxed text-[var(--d-text)]"
                    >
                      &ldquo;{dep.texto}&rdquo;
                    </blockquote>
                  </div>
                  <figcaption
                    data-demo-slot={`depoimentos.${i}.autor`}
                    className="font-[family-name:var(--d-mono)] text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--d-muted)]"
                  >
                    — {dep.autor}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      ),

    /* ── Processo ────────────────────────────────────────────── */
    processo: () =>
      s.processo && (
        <section id="processo" data-pigment={pigmentos[0]} className="px-6 py-[var(--d-sec-y)] md:px-[clamp(20px,5vw,72px)]">
          <div className={`mx-auto max-w-4xl ${centro("processo") ? "text-center" : ""}`}>
            <div className="mb-20">
              <Etiqueta texto={s.processo.rotulo} slot="secoes.processo.rotulo" />
              <SplashTitle
                texto={s.processo.titulo}
                slot="secoes.processo.titulo"
                accentCycle={pigmentos}
                className="font-[family-name:var(--d-display)] text-[clamp(2.25rem,6vw,5.5rem)] leading-[1] text-[var(--d-text)]"
              />
            </div>
            <div className="relative">
              <LineDraw
                d="M0 30 C 150 10, 250 50, 400 30 C 550 10, 650 50, 800 30 C 950 10, 1050 50, 1200 30"
                viewBox="0 0 1200 60"
                stroke={pigmentos[1]}
                strokeWidth={1.6}
                duration={2.2}
                className="pointer-events-none absolute left-0 top-[22px] hidden w-full md:block"
              />
              <div className="relative grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
                {(s.processo.itens ?? []).map((passo, i) => (
                  <FadeUp key={passo.titulo} animacao={theme.animacao} delay={0.1 * i}>
                    <div
                      className="mb-5 flex h-11 w-11 items-center justify-center rounded-full border-[1.6px] bg-[var(--d-bg)] font-[family-name:var(--d-mono)] text-[15px] font-bold"
                      style={{ borderColor: pigmentos[i % pigmentos.length], color: pigmentos[i % pigmentos.length] }}
                    >
                      {passo.subtitulo}
                    </div>
                    <h3
                      data-demo-slot={`secoes.processo.itens.${i}.titulo`}
                      className="mb-1.5 font-[family-name:var(--d-display)] text-[1.75rem] italic leading-none text-[var(--d-text)]"
                    >
                      {passo.titulo}
                    </h3>
                    {passo.texto && (
                      <p data-demo-slot={`secoes.processo.itens.${i}.texto`} className="text-sm leading-relaxed text-[var(--d-muted)]">
                        {passo.texto}
                      </p>
                    )}
                  </FadeUp>
                ))}
              </div>
            </div>
          </div>
        </section>
      ),

    /* ── FAQ (Cuidados) ──────────────────────────────────────── */
    faq: () =>
      s.faq && (
        <section id="faq" className="mx-auto max-w-[920px] px-6 py-[var(--d-sec-y)] md:px-[clamp(20px,5vw,72px)]">
          <div className="mb-14">
            <Etiqueta texto={s.faq.rotulo} slot="secoes.faq.rotulo" />
            <SplashTitle
              texto={s.faq.titulo}
              slot="secoes.faq.titulo"
              accentCycle={pigmentos}
              className="font-[family-name:var(--d-display)] text-[clamp(2.25rem,6vw,5.5rem)] leading-[1] text-[var(--d-text)]"
            />
          </div>
          <FaqAccordion itens={s.faq.itens ?? []} slotBase="secoes.faq.itens" accentCycle={pigmentos} />
        </section>
      ),

    /* ── Agendar (CTA final) ─────────────────────────────────── */
    agendar: () => (
      <section
        id="agendar"
        data-pigment={paleta.texto}
        className="relative flex min-h-[92vh] flex-col items-center justify-center overflow-hidden px-6 py-[16vh] text-center md:px-[clamp(20px,5vw,72px)]"
      >
        <div className="d-cta-bg absolute inset-0" aria-hidden="true" />
        <div className="d-cta-blob d-cta-blob-a absolute -left-[10%] -top-[15%] h-[60vw] w-[60vw] rounded-full" aria-hidden="true" />
        <div className="d-cta-blob d-cta-blob-b absolute -bottom-[20%] -right-[12%] h-[55vw] w-[55vw] rounded-full" aria-hidden="true" />

        <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center">
          <SplashTitle
            texto={s.agendar?.titulo}
            slot="secoes.agendar.titulo"
            accentCycle={["#FFFFFF", "#FFFFFF", "#FFFFFF"]}
            className="mb-12 font-[family-name:var(--d-display)] text-[clamp(2.5rem,9vw,7.5rem)] leading-[1] text-white"
          />
          <div className="flex flex-wrap justify-center gap-4">
            {s.agendar?.cta && (
              <a href={agendar} data-demo-slot="secoes.agendar.cta" className="d-cta-pill d-cta-clara">
                {s.agendar.cta}
              </a>
            )}
            {s.agendar?.ctaSecundaria && (
              <a href={agendar} data-demo-slot="secoes.agendar.ctaSecundaria" className="d-cta-pill d-cta-contorno">
                {s.agendar.ctaSecundaria}
              </a>
            )}
          </div>
        </div>
      </section>
    ),

    /* ── Contato (rodapé) ────────────────────────────────────── */
    contato: () => (
      <footer className="flex flex-wrap items-end justify-between gap-10 px-6 py-14 md:px-[clamp(20px,5vw,72px)]">
        <div className="flex flex-col gap-2.5">
          <span className="font-[family-name:var(--d-display)] text-[1.9rem] text-[var(--d-text)]">
            <span data-demo-slot="nome">{data.nome}</span>
            <span style={{ color: "var(--d-accent)" }}>.</span>
          </span>
          {data.endereco && (
            <span data-demo-slot="endereco" className="text-sm text-[var(--d-muted)]">
              {data.endereco}
            </span>
          )}
          {data.cidade && (
            <span data-demo-slot="cidade" className="text-sm text-[var(--d-muted)]">
              {data.cidade}
            </span>
          )}
          {data.horarios && (
            <span data-demo-slot="horarios" className="text-sm text-[var(--d-muted)]">
              {data.horarios}
            </span>
          )}
          {data.telefone && data.telefone !== data.whatsapp && (
            <span data-demo-slot="telefone" className="text-sm text-[var(--d-muted)]">
              {data.telefone}
            </span>
          )}
          {data.instagram && (
            <span data-demo-slot="instagram" className="text-sm font-semibold text-[var(--d-text)]">
              {data.instagram}
            </span>
          )}
        </div>
        <span className="text-xs text-[var(--d-muted)]">
          © {new Date().getFullYear()} <span data-demo-slot="nome">{data.nome}</span>.{" "}
          <span data-demo-slot="secoes.contato.texto">
            {s.contato?.texto ?? "Estúdio fictício, tinta imaginária."}
          </span>
        </span>
      </footer>
    ),
  };

  return (
    <div
      style={vars}
      data-d-hover={theme.hover}
      data-d-clique={theme.clique}
      data-d-anim={theme.animacao}
      className="relative min-h-screen overflow-x-clip bg-[var(--d-bg)] font-[family-name:var(--d-corpo)] text-[var(--d-text)]"
    >
      <style>{`
        @keyframes d-blob-a { 0%,100% { transform: translate(0,0) scale(1); } 33% { transform: translate(8%,-6%) scale(1.12); } 66% { transform: translate(-5%,5%) scale(.94); } }
        @keyframes d-blob-b { 0%,100% { transform: translate(0,0) scale(1); } 40% { transform: translate(-7%,4%) scale(1.08); } 75% { transform: translate(6%,-3%) scale(.9); } }
        @keyframes d-blob-c { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(4%,7%) scale(1.15); } }
        .d-blob { filter: blur(48px); mix-blend-mode: multiply; }
        .d-blob-a { background: radial-gradient(circle at 40% 40%, color-mix(in srgb, var(--d-accent) 55%, transparent), transparent 68%); animation: d-blob-a 16s ease-in-out infinite; }
        .d-blob-b { background: radial-gradient(circle at 60% 50%, color-mix(in srgb, var(--d-accent-2) 42%, transparent), transparent 66%); animation: d-blob-b 19s ease-in-out infinite; }
        .d-blob-c { background: radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--d-accent-3) 45%, transparent), transparent 65%); animation: d-blob-c 14s ease-in-out infinite; }
        [data-d-anim="nenhuma"] .d-blob { animation: none; }
        @media (prefers-reduced-motion: reduce) { .d-blob { animation: none; } }

        .d-hero-line { stroke-dasharray: 1; stroke-dashoffset: 1; animation: d-draw-line 3s cubic-bezier(.6,0,.3,1) .4s forwards; }
        @keyframes d-draw-line { to { stroke-dashoffset: 0; } }
        @media (prefers-reduced-motion: reduce) { .d-hero-line { animation: none; stroke-dashoffset: 0; } }

        /* CTA em pílula (sempre arredondado — assinatura da skin, independente do raio do tema). */
        .d-cta-pill {
          display: inline-block;
          padding: 16px 34px;
          border-radius: 999px;
          font-family: var(--d-corpo);
          font-weight: 600;
          font-size: 15px;
          transition: background-color var(--d-anim-duration) var(--d-anim-ease),
            color var(--d-anim-duration) var(--d-anim-ease),
            transform var(--d-anim-duration) var(--d-anim-ease),
            box-shadow var(--d-anim-duration) var(--d-anim-ease);
        }
        .d-cta-solida { background: var(--d-text); color: var(--d-bg); }
        .d-cta-solida:hover { background: var(--d-accent); color: var(--d-accent-ink); }
        .d-cta-clara { background: var(--d-bg); color: var(--d-text); }
        .d-cta-clara:hover { background: var(--d-text); color: var(--d-bg); }
        .d-cta-contorno { border: 1.6px solid color-mix(in srgb, var(--d-bg) 70%, transparent); color: var(--d-bg); }
        .d-cta-contorno:hover { background: color-mix(in srgb, var(--d-bg) 14%, transparent); }
        [data-d-hover="zoom"] .d-cta-pill:hover { transform: scale(var(--d-hover-scale)); }
        [data-d-hover="lift"] .d-cta-pill:hover { transform: translateY(var(--d-hover-lift)); }
        [data-d-hover="brilho"] .d-cta-pill:hover { box-shadow: 0 0 32px color-mix(in srgb, var(--d-accent) 45%, transparent); }
        @media (prefers-reduced-motion: reduce) { .d-cta-pill:hover { transform: none; } }

        /* Nav CTA com gradiente multicor no hover (fiel a data-cta-grad do original). */
        /* display fica a cargo da utility Tailwind em cada uso (inline-flex / md:hidden) — uma
           declaração de display neste seletor teria a MESMA especificidade da utility responsiva
           e, por vir depois no documento (esta tag de estilo é renderizada no body, depois do
           CSS compilado do Tailwind no head), venceria o cascade mesmo fora do breakpoint. */
        .d-nav-cta { position: relative; overflow: hidden; border-radius: 999px; background: var(--d-text); color: var(--d-bg); padding: 11px 22px; font-weight: 600; }
        .d-nav-cta-grad {
          position: absolute; inset: 0; opacity: 0; transition: opacity .35s;
          background: linear-gradient(100deg, var(--d-accent), var(--d-accent-3) 35%, var(--d-accent-2) 70%, var(--d-accent));
        }
        .d-nav-cta:hover .d-nav-cta-grad { opacity: 1; }

        /* Cartões de "Estilos": blob que expande + leve inclinação 3D no hover — chrome fixo (fiel ao original), não gated por theme.hover. */
        .d-estilo-card {
          background: var(--d-bg);
          border: 1px solid var(--d-border);
          transition: transform .45s cubic-bezier(.2,.8,.2,1);
        }
        .d-estilo-card::before {
          content: "";
          position: absolute; bottom: -30%; right: -25%; width: 75%; aspect-ratio: 1;
          border-radius: 50%;
          background: radial-gradient(circle, color-mix(in srgb, var(--d-card-blob) 50%, transparent), transparent 70%);
          filter: blur(28px);
          mix-blend-mode: multiply;
          transition: transform .6s cubic-bezier(.2,.8,.2,1);
          pointer-events: none;
        }
        .d-estilo-card:nth-child(odd):hover { transform: perspective(900px) rotateX(3deg) rotateY(-3deg) translateY(-6px); }
        .d-estilo-card:nth-child(even):hover { transform: perspective(900px) rotateX(3deg) rotateY(3deg) translateY(-6px); }
        .d-estilo-card:hover::before { transform: scale(2.1); }
        .d-estilo-card-escuro { background: var(--d-text); color: var(--d-bg); border-color: var(--d-text); }
        @media (prefers-reduced-motion: reduce) { .d-estilo-card, .d-estilo-card::before { transition: none; } .d-estilo-card:hover { transform: none; } }
        @media (hover: none) { .d-estilo-card:hover { transform: none; } .d-estilo-card:hover::before { transform: none; } }

        /* Cards com hover controlado por Theme.hover (depoimentos, portfólio). */
        .d-card-hover { transition: transform var(--d-anim-duration) var(--d-anim-ease), box-shadow var(--d-anim-duration) var(--d-anim-ease); }
        [data-d-hover="zoom"] .d-card-hover:hover { transform: scale(var(--d-hover-scale)); }
        [data-d-hover="lift"] .d-card-hover:hover { transform: translateY(var(--d-hover-lift)); }
        [data-d-hover="brilho"] .d-card-hover:hover { box-shadow: 0 0 24px color-mix(in srgb, var(--d-accent) 25%, transparent); }
        @media (prefers-reduced-motion: reduce) { .d-card-hover:hover { transform: none; } }

        /* Animação de clique (Theme.clique). */
        [data-d-clique="pressao"]:not([data-d-anim="nenhuma"]) a:active,
        [data-d-clique="pressao"]:not([data-d-anim="nenhuma"]) button:active {
          transform: scale(0.96);
          transition-duration: 90ms;
        }
        @keyframes d-clique-pulso { 0% { transform: scale(1); } 40% { transform: scale(1.05); } 100% { transform: scale(1); } }
        [data-d-clique="pulso"]:not([data-d-anim="nenhuma"]) a:active,
        [data-d-clique="pulso"]:not([data-d-anim="nenhuma"]) button:active {
          animation: d-clique-pulso 280ms var(--d-anim-ease);
        }
        @media (prefers-reduced-motion: reduce) { [data-d-clique] a:active, [data-d-clique] button:active { transform: none; animation: none; } }

        /* CTA final: fundo em gradiente multicor + blobs animados. */
        .d-cta-bg { background: linear-gradient(135deg, var(--d-accent) 0%, var(--d-accent-2) 55%, var(--d-accent-3) 100%); }
        .d-cta-blob { filter: blur(60px); pointer-events: none; }
        .d-cta-blob-a { background: radial-gradient(circle, color-mix(in srgb, var(--d-accent-3) 75%, transparent), transparent 65%); animation: d-cta-blob 18s ease-in-out infinite; }
        .d-cta-blob-b { background: radial-gradient(circle, color-mix(in srgb, var(--d-accent) 80%, transparent), transparent 65%); animation: d-cta-blob 22s ease-in-out infinite reverse; }
        @keyframes d-cta-blob { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-4%,6%) scale(1.2); } }
        [data-d-anim="nenhuma"] .d-cta-blob { animation: none; }
        @media (prefers-reduced-motion: reduce) { .d-cta-blob { animation: none; } }

        /* Bordas laterais com luz LED (Theme.led) — idêntico às demais skins. */
        .d-led-edges { position: fixed; inset: 0; z-index: 45; pointer-events: none; --d-led-scroll: 0; }
        .d-led-bar {
          position: absolute; top: 0; bottom: 0; width: 3px;
          background: linear-gradient(to bottom, transparent 0%,
            color-mix(in srgb, var(--d-accent) 65%, transparent) calc(var(--d-led-scroll) * 100% - 18%),
            var(--d-accent) calc(var(--d-led-scroll) * 100%),
            color-mix(in srgb, var(--d-accent) 65%, transparent) calc(var(--d-led-scroll) * 100% + 18%), transparent 100%);
          box-shadow: 0 0 10px 1px color-mix(in srgb, var(--d-accent) 55%, transparent);
          opacity: 0.5;
          transition: opacity 200ms ease, box-shadow 200ms ease;
        }
        [data-d-led="marcante"] .d-led-bar { width: 4px; opacity: 0.85; box-shadow: 0 0 20px 3px color-mix(in srgb, var(--d-accent) 70%, transparent); }
        .d-led-left { left: 0; }
        .d-led-right { right: 0; }
        @keyframes d-led-pulso { 0% { filter: brightness(1); } 30% { filter: brightness(1.8); } 100% { filter: brightness(1); } }
        .d-led-pulse .d-led-bar { animation: d-led-pulso 500ms ease-out; }
        @media (prefers-reduced-motion: reduce) { .d-led-bar { transition: none; } .d-led-pulse .d-led-bar { animation: none; } }
      `}</style>

      <LedEdges preset={theme.led} />

      <PigmentTracker>
        <IntroExperience nome={data.nome} ativa={theme.intro === true}>
          <Nav nome={data.nome} links={links} ctaHref={agendar} ctaLabel={s.hero?.cta ?? "Agendar sessão"} />

          <div className="relative z-10">
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
          </div>
        </IntroExperience>
      </PigmentTracker>
    </div>
  );
}
