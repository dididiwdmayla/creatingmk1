import Image from "next/image";
import { Fragment, type CSSProperties, type ReactNode } from "react";

import { secoesVisiveis } from "@/lib/demos/estrutura";
import type { Animacao, Densidade, SkinProps } from "@/lib/demos/types";
import { BackgroundEffect } from "./BackgroundEffect";
import { BairroCarousel } from "./interactive/BairroCarousel";
import { CustomCursor } from "./interactive/CustomCursor";
import { HeroVisual } from "./interactive/HeroVisual";
import { IntroExperience } from "./interactive/IntroExperience";
import { LedEdges } from "./interactive/LedEdges";
import { ManifestoReveal } from "./interactive/ManifestoReveal";
import { Nav } from "./interactive/Nav";
import { NewsletterForm } from "./interactive/NewsletterForm";
import { Reveal } from "./interactive/Reveal";
import { SectionReveal, type RevealTipo } from "./interactive/SectionReveal";
import { IMOBILIARIA_SECOES } from "./secoes";

/**
 * Skin "Raiz Imóveis" — conversão fiel do material bruto
 * (skins-raw/imobiliaria): imobiliária boutique editorial, creme quente
 * com terracota/oliva/mostarda, selo circular giratório no hero,
 * manifesto revelado palavra a palavra no scroll, grade de imóveis em
 * destaque, carrossel de bairros com arraste, passos "como funciona",
 * depoimento e captura de e-mail.
 *
 * Componente PURO: todo texto/imagem vem de `data`, toda cor/fonte/raio/
 * densidade vem de `theme` (aplicado como CSS vars no wrapper). O
 * original anima por REVELAÇÃO INDIVIDUAL de elemento (`data-reveal` +
 * `data-delay`, stagger), não por um wrapper de seção inteira — por isso
 * cada bloco usa `Reveal` (ver interactive/Reveal.tsx) com o delay fiel ao
 * original; `SectionReveal` só entra quando o editor pede um override de
 * entrada por seção (aba Estrutura).
 *
 * Estrutura editável: as seções renderizam na ordem efetiva de
 * DemoData.ordemSecoes (ver lib/demos/estrutura.ts), respeitam
 * DemoSecao.oculta e alinhamento (onde IMOBILIARIA_SECOES declara
 * alignOptions). Os atributos `data-demo-slot` marcam cada texto com o
 * caminho do slot em DemoData — o editor visual usa isso para focar o
 * campo certo ao clicar no preview.
 */

const SECTION_PAD: Record<Densidade, string> = {
  compacta: "5rem",
  confortavel: "7.5rem",
  arejada: "9.5rem",
};

/**
 * Intensidade de hover/transição por nível de animação — consumida como
 * CSS vars (`--d-anim-*`), mesmo padrão das demais skins.
 */
const ANIM_DURATION: Record<Animacao, string> = {
  nenhuma: "0ms",
  sutil: "350ms",
  marcante: "550ms",
};
const ANIM_HOVER_SCALE: Record<Animacao, string> = {
  nenhuma: "1",
  sutil: "1.03",
  marcante: "1.06",
};
const ANIM_HOVER_LIFT: Record<Animacao, string> = {
  nenhuma: "0px",
  sutil: "-3px",
  marcante: "-8px",
};
/** Duração do selo giratório do hero — mais rápido em "marcante", fiel ao spin contínuo do original. */
const BADGE_SPIN: Record<Animacao, string> = {
  nenhuma: "0s",
  sutil: "18s",
  marcante: "12s",
};

/** Categoria + legenda: a descrição do imóvel combina "Categoria · specs" (ver exemplo.ts). */
function categoriaELegenda(descricao: string | undefined): { categoria?: string; legenda?: string } {
  if (!descricao) return {};
  const [primeiro, ...resto] = descricao.split(" · ");
  return resto.length > 0 ? { categoria: primeiro, legenda: resto.join(" · ") } : { legenda: primeiro };
}

function Placeholder({
  src,
  alt,
  sizes,
  slot,
  className = "object-cover",
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
      className={className}
      sizes={sizes}
    />
  );
}

export function ImobiliariaRaiz({ data, theme }: SkinProps) {
  const { paleta, fontes } = theme;
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
    "--d-anim-ease": "cubic-bezier(0.22, 0.61, 0.21, 1)",
    "--d-hover-scale": ANIM_HOVER_SCALE[theme.animacao],
    "--d-hover-lift": ANIM_HOVER_LIFT[theme.animacao],
    "--d-badge-spin": BADGE_SPIN[theme.animacao],
  } as CSSProperties;

  // Só o título hero muda de alinhamento (self-* + text-align), sem afetar
  // o resto do bloco — mesmo critério de barbearia/tatuagem (ver ARCHITECTURE.md).
  const HERO_TITULO_ALINHAMENTO: Record<string, string> = {
    esquerda: "self-start text-left",
    centro: "self-center text-center",
    direita: "self-end text-right",
  };

  const s = data.secoes;
  const visiveis = secoesVisiveis(IMOBILIARIA_SECOES, data);
  const centro = (id: string): boolean => s[id]?.alinhamento === "centro";
  const entradaDe = (id: string) => s[id]?.animacaoEntrada;

  // Default (sem override) fica SEM o wrapper de seção inteira: a
  // fidelidade ao original vem do `Reveal` por elemento dentro de cada
  // bloco, não de um fade/slide único por seção (ver secoes.ts).
  const wrapperTipo = (id: string): RevealTipo | null => {
    const entrada = entradaDe(id);
    if (entrada === undefined) return null;
    if (entrada === "nenhuma") return null;
    if (entrada === "deslizar-esquerda") return "esquerda";
    if (entrada === "deslizar-direita") return "direita";
    return "fade";
  };

  const navLinks = [
    { href: "#imoveis", label: "Imóveis" },
    { href: "#bairros", label: "Bairros" },
    { href: "#como", label: "Como funciona" },
    { href: "#contato", label: "Contato" },
  ];

  const secoes: Record<string, () => ReactNode> = {
    /* ── Hero (fixa) ─────────────────────────────────────────── */
    hero: () => (
      <header
        id="topo"
        data-nav-theme="light"
        className="relative overflow-hidden bg-[var(--d-bg)] px-5 md:px-10"
      >
        <div className="mx-auto grid min-h-screen max-w-7xl items-center gap-14 pb-16 pt-[110px] md:grid-cols-[1.15fr_0.85fr] md:gap-16 md:pt-[90px]">
          <div className="flex flex-col items-start">
            {s.hero?.rotulo && (
              <Reveal animacao={theme.animacao} as="p" className="mb-7 font-[family-name:var(--d-corpo)] text-sm font-semibold uppercase tracking-[0.22em] text-[var(--d-accent)]">
                <span data-demo-slot="secoes.hero.rotulo">{s.hero.rotulo}</span>
              </Reveal>
            )}
            <Reveal
              animacao={theme.animacao}
              delay={80}
              as="h1"
              className={`mb-9 w-full font-[family-name:var(--d-hero-font)] font-normal leading-[0.98] tracking-tight text-[var(--d-text)] ${HERO_TITULO_ALINHAMENTO[theme.heroTitulo.alinhamento]}`}
            >
              <span
                data-demo-slot="secoes.hero.titulo"
                style={{ fontSize: "calc(clamp(2.75rem, 8.5vw, 8.6rem) * var(--d-hero-escala))" }}
                className="block"
              >
                {(s.hero?.titulo ?? data.nome).split(/(\barte\b\.?$)/i).map((parte, i) =>
                  /\barte\b/i.test(parte) ? (
                    <em key={i} className="italic text-[var(--d-accent)]">
                      {parte}
                    </em>
                  ) : (
                    <Fragment key={i}>{parte}</Fragment>
                  ),
                )}
              </span>
            </Reveal>
            {s.hero?.texto && (
              <Reveal animacao={theme.animacao} delay={160} as="p" className="mb-10 max-w-[440px] font-[family-name:var(--d-corpo)] text-lg leading-relaxed text-[var(--d-muted)]">
                <span data-demo-slot="secoes.hero.texto">{s.hero.texto}</span>
              </Reveal>
            )}
            <Reveal animacao={theme.animacao} delay={240} as="div" className="flex flex-wrap items-center gap-7">
              {s.hero?.cta && (
                <a
                  href="#imoveis"
                  data-demo-slot="secoes.hero.cta"
                  data-cursor-alvo
                  className="d-cta group inline-flex items-center rounded-full px-8 py-[17px] text-base font-semibold"
                >
                  {s.hero.cta}
                  <span className="ml-0 inline-block w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-300 group-hover:ml-2 group-hover:w-4 group-hover:opacity-100">
                    →
                  </span>
                </a>
              )}
              {s.hero?.ctaSecundaria && (
                <a
                  href="#como"
                  data-demo-slot="secoes.hero.ctaSecundaria"
                  className="border-b-2 border-[var(--d-accent-3)] pb-[3px] text-base font-semibold text-[var(--d-accent-2)] transition-colors hover:text-[var(--d-accent)]"
                >
                  {s.hero.ctaSecundaria}
                </a>
              )}
            </Reveal>
          </div>

          <Reveal animacao={theme.animacao} delay={200} as="div" className="relative">
            <HeroVisual
              nome={data.nome}
              slogan={data.slogan}
              imageSrc={data.imagens.hero}
              animacao={theme.animacao}
            />
          </Reveal>
        </div>
      </header>
    ),

    /* ── Manifesto ──────────────────────────────────────────── */
    manifesto: () =>
      s.manifesto?.texto && (
        <section
          data-nav-theme="dark"
          className="relative overflow-hidden bg-[var(--d-text)] px-5 py-[var(--d-sec-y)] md:px-10"
        >
          <div
            className="pointer-events-none absolute -right-[10%] -top-[20%] h-[420px] w-[420px] rounded-full opacity-20 blur-[90px]"
            style={{ backgroundColor: "var(--d-accent-2)" }}
            aria-hidden="true"
          />
          <div className="relative mx-auto max-w-[1100px]">
            {s.manifesto.rotulo && (
              <Reveal animacao={theme.animacao} as="p" className="mb-10 font-[family-name:var(--d-corpo)] text-[13px] font-semibold uppercase tracking-[0.24em] text-[var(--d-accent-3)]">
                <span data-demo-slot="secoes.manifesto.rotulo">{s.manifesto.rotulo}</span>
              </Reveal>
            )}
            <ManifestoReveal texto={s.manifesto.texto} animacao={theme.animacao} />
          </div>
        </section>
      ),

    /* ── Imóveis em destaque ────────────────────────────────── */
    imoveis: () =>
      data.servicos.length > 0 && (
        <section id="imoveis" data-nav-theme="light" className="bg-[var(--d-bg)] px-5 py-[var(--d-sec-y)] md:px-10">
          <div className="mx-auto max-w-7xl">
            <Reveal animacao={theme.animacao} as="div" className="mb-16 flex flex-wrap items-end justify-between gap-6">
              <h2
                data-demo-slot="secoes.imoveis.titulo"
                className="font-[family-name:var(--d-display)] text-[clamp(2.75rem,5.5vw,5.25rem)] font-normal leading-[1] tracking-tight text-[var(--d-text)]"
              >
                {s.imoveis?.titulo}
              </h2>
              {s.imoveis?.cta && (
                <a
                  href="#contato"
                  data-demo-slot="secoes.imoveis.cta"
                  className="whitespace-nowrap border-b-2 border-[var(--d-accent-3)] pb-[3px] text-base font-semibold text-[var(--d-accent-2)] transition-colors hover:text-[var(--d-accent)]"
                >
                  {s.imoveis.cta}
                </a>
              )}
            </Reveal>

            <div className="grid items-start gap-6 md:grid-cols-12">
              {data.servicos.map((imovel, i) => {
                const { categoria, legenda } = categoriaELegenda(imovel.descricao);
                const spans = ["md:col-span-5", "md:col-span-4", "md:col-span-4", "md:col-span-5"];
                const alturas = ["h-[560px]", "h-[460px]", "h-[440px]", "h-[520px]"];
                return (
                  <Reveal
                    key={imovel.nome}
                    animacao={theme.animacao}
                    delay={(i % 2) * 90}
                    as="div"
                    className={`${spans[i % spans.length]} ${alturas[i % alturas.length]} d-card-hover group relative overflow-hidden rounded-[var(--d-radius)] bg-[var(--d-bg-elev)]`}
                  >
                    <div data-cursor-alvo className="absolute inset-0">
                      <Image
                        src={data.imagens[`imovel-${i + 1}`] ?? data.imagens.hero}
                        alt={imovel.nome}
                        fill
                        unoptimized
                        data-demo-slot={`imagens.imovel-${i + 1}`}
                        sizes="(max-width: 768px) 100vw, 45vw"
                        className="d-card-img object-cover"
                      />
                      <div
                        className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%]"
                        style={{
                          background: `linear-gradient(180deg, transparent, color-mix(in srgb, var(--d-text) 74%, transparent))`,
                        }}
                      />
                      {categoria && (
                        <span className="absolute left-5 top-5 rounded-full bg-[var(--d-accent)] px-3.5 py-1.5 text-[13px] font-bold uppercase tracking-[0.08em] text-[var(--d-accent-ink)]">
                          {categoria}
                        </span>
                      )}
                      <div className="absolute inset-x-6 bottom-6 text-[var(--d-bg)]">
                        <p data-demo-slot={`servicos.${i}.nome`} className="mb-1 text-xl font-semibold">
                          {imovel.nome}
                        </p>
                        {legenda && (
                          <p data-demo-slot={`servicos.${i}.descricao`} className="mb-3 text-sm opacity-80">
                            {legenda}
                          </p>
                        )}
                        <div className="flex items-center justify-between gap-4">
                          <span data-demo-slot={`servicos.${i}.preco`} className="font-[family-name:var(--d-display)] text-[28px] font-light">
                            {imovel.preco}
                          </span>
                          <a
                            href="#contato"
                            className="pointer-events-auto rounded-full bg-[var(--d-bg)] px-5 py-2.5 text-sm font-semibold text-[var(--d-text)] opacity-0 transition-all duration-300 group-hover:opacity-100"
                          >
                            Ver imóvel
                          </a>
                        </div>
                      </div>
                    </div>
                  </Reveal>
                );
              })}

              {s.imoveis?.itens?.[0] && (
                <Reveal
                  animacao={theme.animacao}
                  delay={180}
                  as="div"
                  className="flex h-[380px] flex-col justify-between rounded-[var(--d-radius)] p-8 md:col-span-3"
                  style={{ backgroundColor: "var(--d-accent-3)", color: "var(--d-text)" }}
                >
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 11l9-8 9 8" />
                    <path d="M5 9.5V21h14V9.5" />
                    <path d="M9 21v-6h6v6" />
                  </svg>
                  <div>
                    <p data-demo-slot="secoes.imoveis.itens.0.titulo" className="mb-2.5 font-[family-name:var(--d-display)] text-7xl font-light leading-none tracking-tight">
                      {s.imoveis.itens[0].titulo}
                    </p>
                    <p data-demo-slot="secoes.imoveis.itens.0.texto" className="text-[17px] font-semibold leading-snug">
                      {s.imoveis.itens[0].texto}
                    </p>
                  </div>
                </Reveal>
              )}

              {s.imoveis?.itens?.[1] && (
                <Reveal animacao={theme.animacao} delay={180} as="div" className="self-end px-1 pb-5 md:col-span-3">
                  <p data-demo-slot="secoes.imoveis.itens.1.titulo" className="mb-[18px] font-[family-name:var(--d-citacao)] text-2xl italic leading-snug text-[var(--d-accent-2)]">
                    {s.imoveis.itens[1].titulo}
                  </p>
                  {s.imoveis.ctaSecundaria && (
                    <a href="#contato" data-demo-slot="secoes.imoveis.ctaSecundaria" className="text-[15px] font-semibold text-[var(--d-text)] transition-colors hover:text-[var(--d-accent)]">
                      {s.imoveis.ctaSecundaria} →
                    </a>
                  )}
                </Reveal>
              )}
            </div>
          </div>
        </section>
      ),

    /* ── Bairros ────────────────────────────────────────────── */
    bairros: () =>
      (s.bairros?.itens?.length ?? 0) > 0 && (
        <section id="bairros" data-nav-theme="light" className="bg-[var(--d-bg)] py-[calc(var(--d-sec-y)*0.55)]">
          <Reveal animacao={theme.animacao} as="div" className="mx-auto mb-11 flex max-w-7xl flex-wrap items-end justify-between gap-6 px-5 md:px-10">
            <h2
              data-demo-slot="secoes.bairros.titulo"
              className="font-[family-name:var(--d-display)] text-[clamp(2.75rem,5.5vw,5.25rem)] font-normal leading-[1] tracking-tight text-[var(--d-text)]"
            >
              {s.bairros?.titulo}
            </h2>
            <p className="text-sm text-[var(--d-muted)]">Arraste para o lado →</p>
          </Reveal>
          <BairroCarousel itens={s.bairros?.itens ?? []} imagens={data.imagens} />
        </section>
      ),

    /* ── Como funciona ──────────────────────────────────────── */
    como: () =>
      (s.como?.itens?.length ?? 0) > 0 && (
        <section id="como" data-nav-theme="light" className="bg-[var(--d-bg)] px-5 pb-[var(--d-sec-y)] md:px-10">
          <div className={`mx-auto max-w-7xl ${centro("como") ? "text-center" : ""}`}>
            <Reveal animacao={theme.animacao} as="h2" className="mb-[70px] font-[family-name:var(--d-display)] text-[clamp(2.75rem,5.5vw,5.25rem)] font-normal leading-[1] tracking-tight text-[var(--d-text)]">
              <span data-demo-slot="secoes.como.titulo">{s.como?.titulo}</span>
            </Reveal>
            <div className="grid gap-0 md:grid-cols-3">
              {(s.como?.itens ?? []).map((passo, i) => (
                <Reveal
                  key={passo.titulo}
                  animacao={theme.animacao}
                  delay={i * 120}
                  as="div"
                  className={`p-2 py-2 ${
                    i === 0
                      ? "md:pr-11 md:pl-0"
                      : `border-t border-[var(--d-border)] md:border-l md:border-t-0 ${i === 2 ? "md:pl-11 md:pr-0" : "md:px-11"}`
                  }`}
                >
                  {passo.subtitulo && (
                    <p data-demo-slot={`secoes.como.itens.${i}.subtitulo`} className="mb-5 font-[family-name:var(--d-display)] text-[6.5rem] font-light leading-none tracking-tight text-[var(--d-accent)]">
                      {passo.subtitulo}
                    </p>
                  )}
                  <h3 data-demo-slot={`secoes.como.itens.${i}.titulo`} className="mb-3 text-xl font-semibold text-[var(--d-text)]">
                    {passo.titulo}
                  </h3>
                  {passo.texto && (
                    <p data-demo-slot={`secoes.como.itens.${i}.texto`} className="text-base leading-relaxed text-[var(--d-muted)]">
                      {passo.texto}
                    </p>
                  )}
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      ),

    /* ── Depoimento ─────────────────────────────────────────── */
    depoimento: () =>
      data.depoimentos.length > 0 && (
        <section
          data-nav-theme="dark"
          className="px-5 py-[var(--d-sec-y)] md:px-10"
          style={{ backgroundColor: "var(--d-accent)" }}
        >
          <div className="mx-auto max-w-[1000px]">
            <Reveal animacao={theme.animacao} as="div">
              <svg width="56" height="42" viewBox="0 0 56 42" fill="var(--d-accent-3)" className="mb-9" aria-hidden="true">
                <path d="M0 42V26C0 11 8 2 22 0l3 8c-8 2-12 6-13 12h12v22H0zm32 0V26C32 11 40 2 54 0l2 8c-8 2-12 6-13 12h13v22H32z" />
              </svg>
            </Reveal>
            <Reveal animacao={theme.animacao} delay={100} as="p" className="mb-11 font-[family-name:var(--d-citacao)] text-[clamp(1.5rem,3.8vw,3.125rem)] italic leading-[1.3] tracking-tight text-[var(--d-accent-ink)]">
              <span data-demo-slot="depoimentos.0.texto">&ldquo;{data.depoimentos[0].texto}&rdquo;</span>
            </Reveal>
            <Reveal animacao={theme.animacao} delay={200} as="div" className="flex items-center gap-5">
              <div className="relative h-[72px] w-[72px] flex-none overflow-hidden rounded-full bg-[var(--d-bg-elev)]">
                <Placeholder src={data.imagens["depoimento-1"]} alt={data.depoimentos[0].autor} sizes="72px" slot="imagens.depoimento-1" />
              </div>
              <p data-demo-slot="depoimentos.0.autor" className="text-[17px] font-bold text-[var(--d-accent-ink)]">
                {data.depoimentos[0].autor}
              </p>
            </Reveal>
          </div>
        </section>
      ),

    /* ── Contato ────────────────────────────────────────────── */
    contato: () => (
      <section
        id="contato"
        data-nav-theme="light"
        className="relative overflow-hidden bg-[var(--d-bg)] px-5 py-[var(--d-sec-y)] md:px-10"
      >
        <div
          className="d-blob-1 pointer-events-none absolute left-[6%] top-[8%] h-[170px] w-[170px] opacity-55"
          style={{ backgroundColor: "var(--d-accent-3)", borderRadius: "62% 38% 55% 45% / 48% 60% 40% 52%" }}
          aria-hidden="true"
        />
        <div
          className="d-blob-2 pointer-events-none absolute bottom-[10%] right-[7%] h-[220px] w-[220px] opacity-30"
          style={{ backgroundColor: "var(--d-accent)", borderRadius: "45% 55% 40% 60% / 55% 45% 55% 45%" }}
          aria-hidden="true"
        />
        <div
          className="d-blob-3 pointer-events-none absolute right-[18%] top-[16%] h-[90px] w-[90px] opacity-35"
          style={{ backgroundColor: "var(--d-accent-2)", borderRadius: "55% 45% 60% 40% / 45% 55% 45% 55%" }}
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-[880px] text-center">
          <Reveal animacao={theme.animacao} as="h2" className="mb-7 font-[family-name:var(--d-display)] text-[clamp(2.5rem,6.5vw,6.375rem)] font-normal leading-[1.02] tracking-tight text-[var(--d-text)]">
            <span data-demo-slot="secoes.contato.titulo">{s.contato?.titulo}</span>
          </Reveal>
          {s.contato?.texto && (
            <Reveal animacao={theme.animacao} delay={100} as="p" className="mx-auto mb-12 max-w-[520px] text-lg leading-relaxed text-[var(--d-muted)]">
              <span data-demo-slot="secoes.contato.texto">{s.contato.texto}</span>
            </Reveal>
          )}
          <Reveal animacao={theme.animacao} delay={200} as="div">
            <NewsletterForm ctaTexto={s.contato?.cta ?? "Quero receber"} />
          </Reveal>
        </div>
      </section>
    ),
  };

  return (
    <div
      style={vars}
      data-d-hover={theme.hover}
      data-d-clique={theme.clique}
      data-d-anim={theme.animacao}
      className="min-h-screen overflow-x-clip bg-[var(--d-bg)] font-[family-name:var(--d-corpo)] text-[var(--d-text)] selection:bg-[var(--d-accent-3)] selection:text-[var(--d-text)]"
    >
      <style>{`
        html { scroll-behavior: smooth; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }

        /* ── Pílula de CTA (hero + newsletter + stat) ────────── */
        .d-cta {
          color: var(--d-accent-ink); background: var(--d-accent);
          box-shadow: 0 8px 24px color-mix(in srgb, var(--d-accent) 30%, transparent);
          transition: transform var(--d-anim-duration) var(--d-anim-ease),
            box-shadow var(--d-anim-duration) var(--d-anim-ease), padding var(--d-anim-duration) var(--d-anim-ease);
        }
        .d-cta:hover { transform: scale(var(--d-hover-scale)) translateY(var(--d-hover-lift)); }
        @media (prefers-reduced-motion: reduce) { .d-cta:hover { transform: none; } }

        .d-newsletter-form { background: var(--d-bg); border-color: var(--d-text); }

        /* Lift/zoom genérico de card (imóveis, bairros) — --d-hover-* escala com o nível global. */
        .d-card-hover {
          transition: transform var(--d-anim-duration) var(--d-anim-ease),
            box-shadow var(--d-anim-duration) var(--d-anim-ease);
        }
        .d-card-hover:hover { transform: translateY(var(--d-hover-lift)); }
        @media (prefers-reduced-motion: reduce) { .d-card-hover:hover { transform: none; } }
        .d-card-img { transition: transform 1.1s var(--d-anim-ease); }
        .d-card-hover:hover .d-card-img { transform: scale(var(--d-hover-scale)); }
        @media (prefers-reduced-motion: reduce) { .d-card-hover:hover .d-card-img { transform: none; } }

        /* ── Hover do tema (Theme.hover) ──────────────────────── */
        [data-d-hover="lift"] .d-cta:hover { transform: translateY(var(--d-hover-lift)); }
        [data-d-hover="zoom"] .d-cta:hover, [data-d-hover="zoom"] .d-card-hover:hover { transform: scale(var(--d-hover-scale)); }
        [data-d-hover="brilho"] .d-cta:hover {
          transform: none; box-shadow: 0 0 32px color-mix(in srgb, var(--d-accent) 55%, transparent);
        }
        [data-d-hover="brilho"] .d-card-hover:hover {
          transform: none; box-shadow: 0 0 26px color-mix(in srgb, var(--d-accent) 32%, transparent);
        }
        @media (prefers-reduced-motion: reduce) {
          [data-d-hover] .d-cta:hover, [data-d-hover] .d-card-hover:hover { transform: none; }
        }

        /* ── Animação de clique (Theme.clique) ────────────────── */
        [data-d-clique="pressao"]:not([data-d-anim="nenhuma"]) a:active,
        [data-d-clique="pressao"]:not([data-d-anim="nenhuma"]) button:active { transform: scale(0.96); transition-duration: 90ms; }
        @keyframes d-clique-pulso { 0% { transform: scale(1); } 40% { transform: scale(1.05); } 100% { transform: scale(1); } }
        [data-d-clique="pulso"]:not([data-d-anim="nenhuma"]) a:active,
        [data-d-clique="pulso"]:not([data-d-anim="nenhuma"]) button:active { animation: d-clique-pulso 280ms var(--d-anim-ease); }
        @media (prefers-reduced-motion: reduce) {
          [data-d-clique] a:active, [data-d-clique] button:active { transform: none; animation: none; }
        }

        /* ── Nav (troca de tema por seção sob a barra) ───────── */
        .d-nav {
          background: color-mix(in srgb, var(--d-bg) 82%, transparent);
          border-bottom: 1px solid color-mix(in srgb, var(--d-text) 10%, transparent);
          --d-nav-fg: var(--d-text);
        }
        .d-nav-cta { background: var(--d-accent); color: var(--d-accent-ink); }
        [data-nav-escura="true"].d-nav {
          background: color-mix(in srgb, var(--d-text) 28%, transparent);
          border-bottom-color: color-mix(in srgb, var(--d-bg) 16%, transparent);
          --d-nav-fg: var(--d-bg);
        }
        [data-nav-escura="true"] .d-nav-cta { background: var(--d-bg); color: var(--d-accent); }

        /* ── Selo giratório do hero ───────────────────────────── */
        @keyframes d-badge-spin { to { transform: rotate(360deg); } }
        .d-badge-spin { animation: d-badge-spin var(--d-badge-spin) linear infinite; }
        @media (prefers-reduced-motion: reduce) { .d-badge-spin { animation: none; } }

        /* ── Blobs flutuantes do Contato ──────────────────────── */
        @keyframes d-float-1 { 0%,100% { transform: translate(0,0) rotate(0deg); } 50% { transform: translate(14px,-20px) rotate(8deg); } }
        @keyframes d-float-2 { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-18px,16px); } }
        @keyframes d-float-3 { 0%,100% { transform: translate(0,0) rotate(0deg); } 50% { transform: translate(10px,14px) rotate(-10deg); } }
        .d-blob-1 { animation: d-float-1 11s ease-in-out infinite; }
        .d-blob-2 { animation: d-float-2 14s ease-in-out infinite; }
        .d-blob-3 { animation: d-float-3 9s ease-in-out infinite; }
        [data-d-anim="nenhuma"] .d-blob-1, [data-d-anim="nenhuma"] .d-blob-2, [data-d-anim="nenhuma"] .d-blob-3 { animation: none; }
        @media (prefers-reduced-motion: reduce) { .d-blob-1, .d-blob-2, .d-blob-3 { animation: none; } }

        /* ── Efeito de fundo (Theme.fundoEfeito) ──────────────── */
        .d-bg-gradiente {
          position: fixed; inset: -25%; z-index: 40; pointer-events: none; opacity: 0.1;
          background: radial-gradient(circle at 30% 30%, var(--d-accent) 0%, transparent 40%),
            radial-gradient(circle at 70% 65%, var(--d-accent-3) 0%, transparent 38%);
          filter: blur(80px); animation: d-bg-drift 26s ease-in-out infinite alternate; will-change: transform;
        }
        @keyframes d-bg-drift { from { transform: translate3d(-3%, -2%, 0) scale(1); } to { transform: translate3d(3%, 2%, 0) scale(1.08); } }
        .d-bg-particulas { position: fixed; inset: 0; z-index: 40; pointer-events: none; overflow: hidden; }
        .d-bg-particulas span {
          position: absolute; bottom: -10px; border-radius: 9999px; background: var(--d-accent); opacity: 0;
          animation-name: d-bg-flutua; animation-timing-function: linear; animation-iteration-count: infinite;
        }
        @keyframes d-bg-flutua { 0% { transform: translateY(0); opacity: 0; } 8% { opacity: 0.35; } 85% { opacity: 0.12; } 100% { transform: translateY(-105vh); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) { .d-bg-gradiente, .d-bg-particulas { display: none; } }

        /* Bordas laterais com luz LED — ver LedEdges.tsx. */
        .d-led-edges { position: fixed; inset: 0; z-index: 45; pointer-events: none; --d-led-scroll: 0; }
        .d-led-bar {
          position: absolute; top: 0; bottom: 0; width: 3px;
          background: linear-gradient(to bottom, transparent 0%,
            color-mix(in srgb, var(--d-accent) 65%, transparent) calc(var(--d-led-scroll) * 100% - 18%),
            var(--d-accent) calc(var(--d-led-scroll) * 100%),
            color-mix(in srgb, var(--d-accent) 65%, transparent) calc(var(--d-led-scroll) * 100% + 18%),
            transparent 100%);
          box-shadow: 0 0 10px 1px color-mix(in srgb, var(--d-accent) 55%, transparent);
          opacity: 0.5; transition: opacity 200ms ease, box-shadow 200ms ease;
        }
        [data-d-led="marcante"] .d-led-bar { width: 4px; opacity: 0.85; box-shadow: 0 0 20px 3px color-mix(in srgb, var(--d-accent) 70%, transparent); }
        .d-led-left { left: 0; } .d-led-right { right: 0; }
        @keyframes d-led-pulso { 0% { filter: brightness(1); } 30% { filter: brightness(1.8); } 100% { filter: brightness(1); } }
        .d-led-pulse .d-led-bar { animation: d-led-pulso 500ms ease-out; }
        @media (prefers-reduced-motion: reduce) { .d-led-bar { transition: none; } .d-led-pulse .d-led-bar { animation: none; } }
      `}</style>

      <BackgroundEffect efeito={theme.fundoEfeito} animacao={theme.animacao} />
      <LedEdges preset={theme.led} />
      <CustomCursor accent={paleta.destaque} />

      <IntroExperience nome={data.nome} accent={paleta.destaque} ink={paleta.destaqueInk} ativa={theme.intro === true}>
        <Nav nome={data.nome} links={navLinks} />

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

        {/* ── Rodapé (chrome fixo, fora da lista editável — ver ARCHITECTURE.md) ── */}
        <footer data-nav-theme="dark" className="relative bg-[var(--d-text)] px-5 pb-10 pt-24 text-[var(--d-bg)] md:px-10">
          <div className="mx-auto max-w-7xl">
            <p
              data-demo-slot="nome"
              className="mb-16 font-[family-name:var(--d-deco)] text-[clamp(4.5rem,10vw,9.375rem)] font-medium italic leading-none tracking-tight"
            >
              {data.nome}
            </p>
            <div className="grid gap-12 border-b pb-16" style={{ borderColor: "color-mix(in srgb, var(--d-bg) 16%, transparent)", gridTemplateColumns: "2fr 1fr 1fr 1fr" }}>
              <div>
                {data.slogan && (
                  <p data-demo-slot="slogan" className="mb-6 max-w-[300px] text-base leading-relaxed opacity-70">
                    {data.slogan}
                  </p>
                )}
                {(data.cidade || data.endereco) && (
                  <p data-demo-slot={data.cidade ? "cidade" : "endereco"} className="text-sm opacity-55">
                    {data.cidade ?? data.endereco}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-3.5">
                <p className="mb-1.5 text-[13px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--d-accent-3)" }}>
                  Navegue
                </p>
                {navLinks.map((link) => (
                  <a key={link.href} href={link.href} className="text-[15px] opacity-85 transition-opacity hover:opacity-100">
                    {link.label}
                  </a>
                ))}
              </div>
              <div className="flex flex-col gap-3.5">
                <p className="mb-1.5 text-[13px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--d-accent-3)" }}>
                  Fale conosco
                </p>
                {data.whatsapp && (
                  <a href={`https://wa.me/${data.whatsapp.replace(/\D/g, "")}`} data-demo-slot="whatsapp" className="text-[15px] opacity-85 transition-opacity hover:opacity-100">
                    {data.whatsapp}
                  </a>
                )}
                {data.telefone && data.telefone !== data.whatsapp && (
                  <p data-demo-slot="telefone" className="text-[15px] opacity-85">
                    {data.telefone}
                  </p>
                )}
                {data.horarios && (
                  <p data-demo-slot="horarios" className="mt-1.5 text-[15px] leading-relaxed opacity-60">
                    {data.horarios}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-3.5">
                <p className="mb-1.5 text-[13px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--d-accent-3)" }}>
                  Redes
                </p>
                {data.instagram && (
                  <p data-demo-slot="instagram" className="text-[15px] opacity-85">
                    {data.instagram}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-5 pt-7 text-[13px] opacity-50">
              <p>
                © {new Date().getFullYear()} {data.nome}. Todos os direitos reservados.
              </p>
              <p>Feito com calma.</p>
            </div>
          </div>
        </footer>
      </IntroExperience>
    </div>
  );
}
