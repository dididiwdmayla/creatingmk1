import Image from "next/image";
import { Fragment, type CSSProperties, type ReactNode } from "react";

import { secoesVisiveis } from "@/lib/demos/estrutura";
import { microcopiaDemo } from "@/lib/demos/microcopy";
import type { Animacao, Densidade, SkinProps } from "@/lib/demos/types";
import { Carousel } from "./interactive/Carousel";
import { ContatoFormClient } from "./interactive/ContatoForm";
import { CustomCursor } from "./interactive/CustomCursor";
import { IntroExperience } from "./interactive/IntroExperience";
import { LedEdges } from "./interactive/LedEdges";
import { ManifestoReveal } from "./interactive/ManifestoReveal";
import { Nav } from "./interactive/Nav";
import { ParallaxHero } from "./interactive/ParallaxHero";
import { Reveal } from "./interactive/Reveal";
import { SectionReveal, type RevealTipo } from "./interactive/SectionReveal";
import { formatarPreco, parseImovel } from "./propriedade";
import { IMOBILIARIA_SECOES } from "./secoes";

/**
 * Skin "Imobiliária Curada" — conversão fiel do material bruto
 * (skins-raw/imobiliaria/demo-imobiliaria): imobiliária boutique
 * editorial, serif calorosa (Fraunces) + sans neutra (Hanken Grotesk),
 * nav que troca de tema claro/escuro conforme a seção sob ela, manifesto
 * que acende palavra a palavra no scroll, bento de imóveis com selo e
 * hover de lente, vitrine de bairros arrastável e blobs flutuantes na
 * seção final.
 *
 * Componente PURO: todo texto/imagem vem de `data`, toda cor/fonte/raio/
 * densidade vem de `theme` (aplicado como CSS vars no wrapper). Estrutura
 * editável igual às demais skins — ver lib/demos/estrutura.ts. Botões são
 * SEMPRE pílula (border-radius total), fiel ao original — `theme.raio`
 * (`--d-radius`) só governa cards/imagens, nunca os CTAs.
 */

const SECTION_PAD: Record<Densidade, string> = {
  compacta: "4rem",
  confortavel: "6rem",
  arejada: "8.5rem",
};

const ANIM_DURATION: Record<Animacao, string> = {
  nenhuma: "0ms",
  sutil: "250ms",
  marcante: "550ms",
};
const ANIM_HOVER_SCALE: Record<Animacao, string> = {
  nenhuma: "1",
  sutil: "1.03",
  marcante: "1.05",
};
const ANIM_HOVER_LIFT: Record<Animacao, string> = {
  nenhuma: "0px",
  sutil: "-2px",
  marcante: "-6px",
};
/** Velocidade do selo giratório do hero — o original expunha isso como um
 * slider (`velocidadeSelo`, 6–40s); aqui vira parte do nível de animação
 * geral (mais rápido em "marcante"), o mesmo critério de reaproveitar
 * `Theme.animacao` em vez de inventar um controle novo. */
const BADGE_SPIN_DURATION: Record<Animacao, string> = {
  nenhuma: "0s",
  sutil: "26s",
  marcante: "15s",
};

const BADGE_CORES = ["var(--d-accent)", "var(--d-accent-3)", "var(--d-accent-2)"] as const;
const BADGE_INK = ["var(--d-bg)", "var(--d-bg)", "var(--d-text)"] as const;
const BAIRRO_CORES = ["var(--d-accent)", "var(--d-accent-3)", "var(--d-accent-2)"] as const;
const BAIRRO_INK = ["var(--d-bg)", "var(--d-bg)", "var(--d-text)"] as const;

const COMO_ICONES = [
  <path key="a" d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5z" />,
  <Fragment key="b">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
  </Fragment>,
  <Fragment key="c">
    <circle cx="7.5" cy="15.5" r="4.5" />
    <path d="M10.7 12.3 21 2" />
    <path d="M17 6l3 3" />
    <path d="M14 9l2 2" />
  </Fragment>,
];

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

/** Título com a última palavra em itálico na cor de destaque — fiel ao
 * padrão editorial do original (`Morar bem é uma <em>arte</em>.`). */
function TituloDestaque({ texto, as: As = "h2", className, style, slot }: {
  texto: string;
  as?: "h1" | "h2";
  className?: string;
  style?: CSSProperties;
  slot?: string;
}) {
  const partes = texto.trim().split(" ");
  if (partes.length <= 1) {
    return (
      <As data-demo-slot={slot} className={className} style={style}>
        <em style={{ fontStyle: "italic", color: "var(--d-accent)" }}>{texto}</em>
      </As>
    );
  }
  const ultima = partes.pop() as string;
  const m = ultima.match(/^(.*?)([.!?]*)$/);
  const palavra = m ? m[1] : ultima;
  const pontuacao = m ? m[2] : "";
  return (
    <As data-demo-slot={slot} className={className} style={style}>
      {partes.join(" ")}{" "}
      <em style={{ fontStyle: "italic", color: "var(--d-accent)" }}>{palavra}</em>
      {pontuacao}
    </As>
  );
}

export function ImobiliariaCurada({ data, theme, idioma }: SkinProps) {
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
    "--d-anim-ease": "cubic-bezier(0.22, 0.61, 0.21, 1)",
    "--d-hover-scale": ANIM_HOVER_SCALE[theme.animacao],
    "--d-hover-lift": ANIM_HOVER_LIFT[theme.animacao],
    "--d-badge-spin": BADGE_SPIN_DURATION[theme.animacao],
  } as CSSProperties;

  const HERO_ALINHAMENTO: Record<string, string> = {
    esquerda: "items-start text-left",
    centro: "items-center text-center",
    direita: "items-end text-right",
  };

  const s = data.secoes;
  const visiveis = secoesVisiveis(IMOBILIARIA_SECOES, data);
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

  const navItens = (
    [
      ["imoveis", s.imoveis?.rotulo ?? "Imóveis"],
      ["bairros", s.bairros?.rotulo ?? "Bairros"],
      ["como", s.como?.rotulo ?? "Como funciona"],
      ["contato", s.contato?.rotulo ?? "Contato"],
    ] as const
  )
    .filter(([id]) => visiveis.includes(id))
    .map(([id, label]) => ({ href: `#${id}`, label }));

  const manifesto =
    s.imoveis?.texto ??
    "Acreditamos que uma casa não se mede em metros quadrados — se mede em manhãs de sol, em jantares que atravessam a noite e em silêncios que abraçam.";

  const secoes: Record<string, () => ReactNode> = {
    /* ── Hero (fixa) ─────────────────────────────────────────── */
    hero: () => (
      <header
        id="topo"
        data-nav-theme="light"
        className="relative overflow-hidden px-5 sm:px-10"
        style={{ backgroundColor: "var(--d-bg)" }}
      >
        <div className="mx-auto grid min-h-screen max-w-[1320px] items-center gap-14 pb-16 pt-[90px] md:grid-cols-[1.15fr_0.85fr] md:gap-16">
          <div className={`flex flex-col ${HERO_ALINHAMENTO[theme.heroTitulo.alinhamento]}`}>
            {s.hero?.rotulo && (
              <Reveal animacao={theme.animacao}>
                <p
                  data-demo-slot="secoes.hero.rotulo"
                  className="mb-7 font-[family-name:var(--d-destaque)] text-sm font-semibold uppercase tracking-[0.22em]"
                  style={{ color: "var(--d-accent)" }}
                >
                  {s.hero.rotulo}
                </p>
              </Reveal>
            )}
            <Reveal animacao={theme.animacao} atraso={80}>
              <TituloDestaque
                texto={s.hero?.titulo ?? data.nome}
                as="h1"
                slot="secoes.hero.titulo"
                className="mb-9 whitespace-pre-line font-[family-name:var(--d-hero-font)] font-normal leading-[0.98] tracking-[-0.03em] text-[var(--d-text)]"
                style={{ fontSize: "calc(clamp(3.5rem, 8.5vw, 8.625rem) * var(--d-hero-escala))" }}
              />
            </Reveal>
            {s.hero?.texto && (
              <Reveal animacao={theme.animacao} atraso={160}>
                <p
                  data-demo-slot="secoes.hero.texto"
                  className="mb-10 max-w-[440px] text-lg leading-relaxed"
                  style={{ color: "var(--d-muted)" }}
                >
                  {s.hero.texto}
                </p>
              </Reveal>
            )}
            <Reveal animacao={theme.animacao} atraso={240} className="flex flex-wrap items-center gap-7">
              {s.hero?.cta && (
                <a href="#imoveis" data-cta className="d-cta-pill d-arrow-cta">
                  {s.hero.cta}
                  <span className="d-arrow-cta-tail">&nbsp;→</span>
                </a>
              )}
              {s.hero?.ctaSecundaria && (
                <a href="#como" className="d-link-underline text-base font-semibold">
                  {s.hero.ctaSecundaria}
                </a>
              )}
            </Reveal>
          </div>

          <Reveal animacao={theme.animacao} atraso={200} className="relative">
            <ParallaxHero animacao={theme.animacao}>
              <div className="relative">
                <div
                  className="relative aspect-[4/5] w-full overflow-hidden"
                  style={{
                    borderRadius: "58% 42% 55% 45% / 46% 55% 45% 54%",
                    backgroundColor: "var(--d-bg-elev)",
                  }}
                >
                  <Placeholder
                    src={data.imagens.hero}
                    alt={`Fachada de imóvel de ${data.nome}`}
                    sizes="(max-width: 768px) 100vw, 45vw"
                    priority
                    slot="imagens.hero"
                  />
                </div>
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -left-11 -top-8 h-[150px] w-[150px] d-badge-spin"
                  style={{ filter: "drop-shadow(0 10px 24px rgba(0,0,0,0.18))" }}
                >
                  <svg viewBox="0 0 100 100" width="100%" height="100%">
                    <circle cx="50" cy="50" r="50" fill="var(--d-accent-2)" />
                    <defs>
                      <path id="d-badge-circ" d="M50,50 m-37,0 a37,37 0 1,1 74,0 a37,37 0 1,1 -74,0" />
                    </defs>
                    <text
                      style={{
                        fontFamily: "var(--d-corpo)",
                        fontWeight: 700,
                        fontSize: "8.1px",
                        letterSpacing: "2px",
                        fill: "var(--d-text)",
                      }}
                    >
                      <textPath href="#d-badge-circ">
                        {data.nome.toUpperCase()} •{" "}
                        {(data.slogan ?? "CURADORIA DE IMÓVEIS").toUpperCase()} •{" "}
                      </textPath>
                    </text>
                    <circle cx="50" cy="50" r="5" fill="var(--d-accent)" />
                  </svg>
                </div>
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -bottom-4 -right-3 -z-10 h-24 w-24"
                  style={{
                    backgroundColor: "var(--d-accent-3)",
                    borderRadius: "62% 38% 50% 50% / 50% 60% 40% 50%",
                  }}
                />
              </div>
            </ParallaxHero>
          </Reveal>
        </div>
      </header>
    ),

    /* ── Manifesto (fixo, sem toggle de visibilidade — abertura do bloco de imóveis) ── */

    /* ── Imóveis em destaque ─────────────────────────────────── */
    imoveis: () =>
      data.servicos.length > 0 && (
        <>
          <section data-nav-theme="dark" className="px-5 py-[var(--d-sec-y)] sm:px-10" style={{ backgroundColor: "var(--d-accent-3)" }}>
            <div className="mx-auto max-w-[1100px]">
              <Reveal animacao={theme.animacao}>
                <p
                  className="mb-10 font-[family-name:var(--d-destaque)] text-[13px] font-semibold uppercase tracking-[0.24em]"
                  style={{ color: "var(--d-accent-2)" }}
                >
                  Nosso manifesto
                </p>
              </Reveal>
              <ManifestoReveal texto={manifesto} slot="secoes.imoveis.texto" />
            </div>
          </section>

          <section id="imoveis" data-nav-theme="light" className="px-5 py-[var(--d-sec-y)] sm:px-10">
            <div className="mx-auto max-w-[1320px]">
              <div className="mb-16 flex flex-wrap items-end justify-between gap-6">
                <Reveal animacao={theme.animacao}>
                  <TituloDestaque
                    texto={s.imoveis?.titulo ?? "Imóveis em destaque"}
                    slot="secoes.imoveis.titulo"
                    className="font-[family-name:var(--d-display)] text-[clamp(2.75rem,5.5vw,5.25rem)] font-normal leading-[1] tracking-[-0.025em] text-[var(--d-text)]"
                  />
                </Reveal>
                {s.imoveis?.cta && (
                  <Reveal animacao={theme.animacao} atraso={100}>
                    <a href="#contato" className="d-link-underline whitespace-nowrap text-base font-semibold">
                      {s.imoveis.cta}
                    </a>
                  </Reveal>
                )}
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-12">
                {data.servicos.map((servico, i) => {
                  const { selo, especificacoes } = parseImovel(servico.descricao);
                  // Padrão bento 7/5/5/7 (soma 24 = duas linhas de 12 colunas)
                  // repetido a cada 4 imóveis — classes completas e estáticas
                  // (Tailwind não gera classe a partir de string interpolada).
                  const SPAN_CLASSES = [
                    "lg:col-span-7",
                    "lg:col-span-5",
                    "lg:col-span-5",
                    "lg:col-span-7",
                  ] as const;
                  const spanClasse = SPAN_CLASSES[i % 4];
                  const alto = i % 4 === 0 || i % 4 === 3;
                  const cor = BADGE_CORES[i % BADGE_CORES.length];
                  const ink = BADGE_INK[i % BADGE_INK.length];
                  return (
                    <SectionReveal
                      key={servico.nome}
                      animacao={theme.animacao}
                      tipo="padrao"
                      className={spanClasse}
                    >
                      <div
                        data-card
                        className={`group relative h-full overflow-hidden ${alto ? "h-[420px] sm:h-[500px]" : "h-[380px] sm:h-[420px]"}`}
                        style={{ borderRadius: "var(--d-radius)", backgroundColor: "var(--d-bg-elev)" }}
                      >
                        <div className="absolute inset-0 transition-transform duration-[1100ms] ease-[cubic-bezier(0.22,0.61,0.21,1)] group-hover:scale-105">
                          <Placeholder
                            src={data.imagens[`imovel-${i + 1}`] ?? data.imagens.hero}
                            alt={servico.nome}
                            sizes="(max-width: 768px) 100vw, 50vw"
                            slot={`imagens.imovel-${i + 1}`}
                          />
                        </div>
                        <div
                          className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%]"
                          style={{ background: "linear-gradient(180deg, transparent, rgba(0,0,0,0.72))" }}
                        />
                        {selo && (
                          <span
                            data-demo-slot={`servicos.${i}.descricao`}
                            className="pointer-events-none absolute left-5 top-5 rounded-full px-[14px] py-[7px] text-[13px] font-bold uppercase tracking-[0.08em]"
                            style={{ backgroundColor: cor, color: ink }}
                          >
                            {selo}
                          </span>
                        )}
                        <div className="pointer-events-none absolute inset-x-6 bottom-6" style={{ color: "var(--d-bg)" }}>
                          <p data-demo-slot={`servicos.${i}.nome`} className="mb-1 text-xl font-semibold">
                            {servico.nome}
                          </p>
                          {especificacoes && <p className="mb-3 text-sm opacity-80">{especificacoes}</p>}
                          <div className="flex items-center justify-between gap-4">
                            <span
                              data-demo-slot={`servicos.${i}.preco`}
                              className="font-[family-name:var(--d-display)] text-[30px] font-light"
                            >
                              {formatarPreco(servico.preco)}
                            </span>
                            <a
                              href="#contato"
                              className="pointer-events-auto translate-y-2 rounded-full px-5 py-[10px] text-sm font-semibold opacity-0 transition-[opacity,transform] duration-[450ms] ease-[cubic-bezier(0.22,0.61,0.21,1)] group-hover:translate-y-0 group-hover:opacity-100"
                              style={{ backgroundColor: "var(--d-bg)", color: "var(--d-text)" }}
                            >
                              Ver imóvel
                            </a>
                          </div>
                        </div>
                      </div>
                    </SectionReveal>
                  );
                })}
              </div>

              {(s.imoveis?.itens?.[0] || s.imoveis?.ctaSecundaria) && (
                <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
                  {s.imoveis?.itens?.[0] && (
                    <SectionReveal animacao={theme.animacao} tipo="fade">
                      <div
                        className="flex h-[240px] flex-col justify-between p-8"
                        style={{ borderRadius: "var(--d-radius)", backgroundColor: "var(--d-accent-2)", color: "var(--d-text)" }}
                      >
                        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 11l9-8 9 8" />
                          <path d="M5 9.5V21h14V9.5" />
                          <path d="M9 21v-6h6v6" />
                        </svg>
                        <div>
                          <p data-demo-slot="secoes.imoveis.itens.0.titulo" className="mb-2 font-[family-name:var(--d-display)] text-6xl font-light tracking-[-0.03em]">
                            {s.imoveis.itens[0].titulo}
                          </p>
                          <p data-demo-slot="secoes.imoveis.itens.0.texto" className="text-[17px] font-semibold leading-snug">
                            {s.imoveis.itens[0].texto}
                          </p>
                        </div>
                      </div>
                    </SectionReveal>
                  )}
                  {s.imoveis?.ctaSecundaria && (
                    <SectionReveal animacao={theme.animacao} tipo="fade">
                      <div className="flex h-[240px] flex-col justify-center px-1">
                        {s.imoveis.itens?.[1]?.titulo && (
                          <p
                            data-demo-slot="secoes.imoveis.itens.1.titulo"
                            className="mb-[18px] font-[family-name:var(--d-citacao)] text-2xl italic leading-snug"
                            style={{ color: "var(--d-accent-3)" }}
                          >
                            {s.imoveis.itens[1].titulo}
                          </p>
                        )}
                        <a href="#contato" data-demo-slot="secoes.imoveis.ctaSecundaria" className="text-[15px] font-semibold" style={{ color: "var(--d-text)" }}>
                          {s.imoveis.ctaSecundaria}
                        </a>
                      </div>
                    </SectionReveal>
                  )}
                </div>
              )}
            </div>
          </section>
        </>
      ),

    /* ── Bairros ─────────────────────────────────────────────── */
    bairros: () =>
      (s.bairros?.itens?.length ?? 0) > 0 && (
        <section id="bairros" data-nav-theme="light" className="py-16 pb-[var(--d-sec-y)]">
          <div className="mx-auto mb-12 flex max-w-[1320px] flex-wrap items-end justify-between gap-6 px-5 sm:px-10">
            <Reveal animacao={theme.animacao}>
              <TituloDestaque
                texto={s.bairros?.titulo ?? "Bairros"}
                slot="secoes.bairros.titulo"
                className="font-[family-name:var(--d-display)] text-[clamp(2.75rem,5.5vw,5.25rem)] font-normal leading-[1] tracking-[-0.025em] text-[var(--d-text)]"
              />
            </Reveal>
            {s.bairros?.texto && (
              <Reveal animacao={theme.animacao} atraso={100}>
                <p data-demo-slot="secoes.bairros.texto" className="text-[15px]" style={{ color: "var(--d-muted)" }}>
                  {s.bairros.texto}
                </p>
              </Reveal>
            )}
          </div>
          <Carousel>
            {(s.bairros?.itens ?? []).map((bairro, i) => {
              const cor = BAIRRO_CORES[i % BAIRRO_CORES.length];
              const ink = BAIRRO_INK[i % BAIRRO_INK.length];
              return (
                <div
                  key={bairro.titulo}
                  className="relative h-[470px] w-[330px] shrink-0 overflow-hidden"
                  style={{ borderRadius: "var(--d-radius)", backgroundColor: "var(--d-bg-elev)" }}
                >
                  <div className="pointer-events-none absolute inset-0">
                    <Placeholder
                      src={data.imagens[`bairro-${i + 1}`] ?? data.imagens.hero}
                      alt={bairro.titulo}
                      sizes="330px"
                      slot={`imagens.bairro-${i + 1}`}
                    />
                  </div>
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{ background: `linear-gradient(180deg, transparent 38%, ${cor} 100%)`, opacity: 0.9 }}
                  />
                  <div className="pointer-events-none absolute inset-x-6 bottom-[26px]" style={{ color: ink }}>
                    <p data-demo-slot={`secoes.bairros.itens.${i}.titulo`} className="mb-2 font-[family-name:var(--d-display)] text-[44px] font-normal leading-none tracking-[-0.02em]">
                      {bairro.titulo}
                    </p>
                    {bairro.subtitulo && (
                      <p data-demo-slot={`secoes.bairros.itens.${i}.subtitulo`} className="text-sm font-medium opacity-85">
                        {bairro.subtitulo}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </Carousel>
        </section>
      ),

    /* ── Como funciona ───────────────────────────────────────── */
    como: () =>
      (s.como?.itens?.length ?? 0) > 0 && (
        <section id="como" data-nav-theme="light" className="px-5 pb-[var(--d-sec-y)] sm:px-10">
          <div className="mx-auto max-w-[1320px]">
            <Reveal animacao={theme.animacao} className="mb-[70px]">
              <TituloDestaque
                texto={s.como?.titulo ?? "Como funciona"}
                slot="secoes.como.titulo"
                className="font-[family-name:var(--d-display)] text-[clamp(2.75rem,5.5vw,5.25rem)] font-normal leading-[1] tracking-[-0.025em] text-[var(--d-text)]"
              />
            </Reveal>
            <div className="grid grid-cols-1 md:grid-cols-3">
              {(s.como?.itens ?? []).map((passo, i) => (
                <SectionReveal key={passo.titulo} animacao={theme.animacao} tipo="padrao">
                  <div
                    className={`h-full py-2 pr-11 ${i > 0 ? "border-t pt-9 md:border-l md:border-t-0 md:pl-11 md:pt-2" : ""}`}
                    style={i > 0 ? { borderColor: "var(--d-border)" } : undefined}
                  >
                    <p
                      className="mb-[22px] font-[family-name:var(--d-display)] text-[92px] font-light leading-none tracking-[-0.04em] sm:text-[110px]"
                      style={{ color: "var(--d-accent)" }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </p>
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--d-accent-3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-4">
                      {COMO_ICONES[i % COMO_ICONES.length]}
                    </svg>
                    <h3 data-demo-slot={`secoes.como.itens.${i}.titulo`} className="mb-3 text-[22px] font-semibold" style={{ color: "var(--d-text)" }}>
                      {passo.titulo}
                    </h3>
                    {passo.texto && (
                      <p data-demo-slot={`secoes.como.itens.${i}.texto`} className="text-base leading-relaxed" style={{ color: "var(--d-muted)" }}>
                        {passo.texto}
                      </p>
                    )}
                  </div>
                </SectionReveal>
              ))}
            </div>
          </div>
        </section>
      ),

    /* ── Depoimento ──────────────────────────────────────────── */
    depoimento: () =>
      data.depoimentos.length > 0 && (
        <section data-nav-theme="dark" className="px-5 py-[var(--d-sec-y)] sm:px-10" style={{ backgroundColor: "var(--d-accent)" }}>
          <div className="mx-auto max-w-[1000px]">
            <Reveal animacao={theme.animacao} className="mb-9">
              <svg width="56" height="42" viewBox="0 0 56 42" fill="var(--d-accent-2)">
                <path d="M0 42V26C0 11 8 2 22 0l3 8c-8 2-12 6-13 12h12v22H0zm32 0V26C32 11 40 2 54 0l2 8c-8 2-12 6-13 12h13v22H32z" />
              </svg>
            </Reveal>
            <Reveal animacao={theme.animacao} atraso={100}>
              <p
                data-demo-slot="depoimentos.0.texto"
                className="mb-11 font-[family-name:var(--d-citacao)] text-[clamp(1.875rem,3.8vw,3.125rem)] font-normal italic leading-[1.3] tracking-[-0.01em]"
                style={{ color: "var(--d-accent-ink)" }}
              >
                {data.depoimentos[0].texto}
              </p>
            </Reveal>
            <Reveal animacao={theme.animacao} atraso={200} className="flex items-center gap-5">
              <div
                className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-full"
                style={{ backgroundColor: "var(--d-bg-elev)" }}
              >
                <Placeholder
                  src={data.imagens["depoimento-1"] ?? data.imagens.hero}
                  alt={data.depoimentos[0].autor}
                  sizes="72px"
                  slot="imagens.depoimento-1"
                  className="object-cover"
                />
              </div>
              <p data-demo-slot="depoimentos.0.autor" className="text-[17px] font-bold" style={{ color: "var(--d-accent-ink)" }}>
                {data.depoimentos[0].autor}
              </p>
            </Reveal>
          </div>
        </section>
      ),

    /* ── Contato (rodapé) ───────────────────────────────────── */
    contato: () => (
      <footer
        id="contato"
        className={`relative overflow-hidden ${centro("contato") ? "text-center" : "text-center md:text-left"}`}
        style={{ backgroundColor: "var(--d-bg)" }}
      >
        <div data-nav-theme="light" className="relative px-5 py-[calc(var(--d-sec-y)*1.15)] sm:px-10">
          <div aria-hidden="true" className="d-blob d-blob-1" style={{ backgroundColor: "var(--d-accent-2)" }} />
          <div aria-hidden="true" className="d-blob d-blob-2" style={{ backgroundColor: "var(--d-accent)" }} />
          <div aria-hidden="true" className="d-blob d-blob-3" style={{ backgroundColor: "var(--d-accent-3)" }} />

          <div className="relative z-10 mx-auto max-w-[880px] text-center">
            <Reveal animacao={theme.animacao}>
              <TituloDestaque
                texto={s.contato?.titulo ?? "Fale com a gente."}
                slot="secoes.contato.titulo"
                className="mb-7 font-[family-name:var(--d-display)] text-[clamp(3rem,6.5vw,6.375rem)] font-normal leading-[1.02] tracking-[-0.03em] text-[var(--d-text)]"
              />
            </Reveal>
            {s.contato?.texto && (
              <Reveal animacao={theme.animacao} atraso={100}>
                <p data-demo-slot="secoes.contato.texto" className="mx-auto mb-12 max-w-[520px] text-lg leading-relaxed" style={{ color: "var(--d-muted)" }}>
                  {s.contato.texto}
                </p>
              </Reveal>
            )}
            {s.contato?.cta && (
              <Reveal animacao={theme.animacao} atraso={200}>
                <ContatoFormClient label={s.contato.cta} />
              </Reveal>
            )}
          </div>
        </div>

        <div data-nav-theme="dark" className="relative px-5 pb-10 pt-16 sm:px-10" style={{ backgroundColor: "var(--d-bg-alt)", color: "var(--d-bg)" }}>
          <div className="mx-auto max-w-[1320px]">
            <p
              data-demo-slot="nome"
              className="mb-[70px] font-[family-name:var(--d-deco)] text-[clamp(4.5rem,10vw,9.375rem)] font-medium italic leading-none tracking-[-0.03em]"
            >
              {data.nome}
            </p>
            <div className="grid grid-cols-1 gap-12 border-b pb-16 sm:grid-cols-2 md:grid-cols-4" style={{ borderColor: "rgba(255,255,255,0.16)" }}>
              <div className="text-left">
                {data.slogan && (
                  <p data-demo-slot="slogan" className="mb-6 max-w-[300px] text-base leading-relaxed opacity-70">
                    {data.slogan}
                  </p>
                )}
                {(data.endereco || data.cidade) && (
                  <p data-demo-slot={data.endereco ? "endereco" : "cidade"} className="text-sm opacity-55">
                    {data.endereco}
                    {data.endereco && data.cidade ? <br /> : null}
                    {data.cidade}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-[14px] text-left">
                <p className="mb-1 text-[13px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--d-accent-2)" }}>
                  {m.navegue}
                </p>
                {navItens.map((item) => (
                  <a key={item.href} href={item.href} className="text-[15px] opacity-85 transition-opacity hover:opacity-100">
                    {item.label}
                  </a>
                ))}
              </div>
              <div className="flex flex-col gap-[14px] text-left">
                <p className="mb-1 text-[13px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--d-accent-2)" }}>
                  {m.faleComAGente}
                </p>
                {data.telefone && (
                  <a data-demo-slot="telefone" href={`tel:${data.telefone.replace(/\D/g, "")}`} className="text-[15px] opacity-85 transition-opacity hover:opacity-100">
                    {data.telefone}
                  </a>
                )}
                {data.horarios && (
                  <p data-demo-slot="horarios" className="mt-1 text-[15px] leading-relaxed opacity-60">
                    {data.horarios}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-[14px] text-left">
                <p className="mb-1 text-[13px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--d-accent-2)" }}>
                  {m.redes}
                </p>
                {data.instagram && (
                  <a
                    data-demo-slot="instagram"
                    href={`https://instagram.com/${data.instagram.replace(/^@/, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[15px] opacity-85 transition-opacity hover:opacity-100"
                  >
                    Instagram
                  </a>
                )}
                {data.whatsapp && (
                  <a
                    data-demo-slot="whatsapp"
                    href={`https://wa.me/${data.whatsapp.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[15px] opacity-85 transition-opacity hover:opacity-100"
                  >
                    WhatsApp
                  </a>
                )}
              </div>
            </div>
            <div className="flex flex-wrap justify-between gap-5 pt-7 text-[13px] opacity-50">
              <p>© {new Date().getFullYear()} {data.nome}. {m.direitosReservados}</p>
              <p data-demo-slot="secoes.contato.ctaSecundaria">
                {s.contato?.ctaSecundaria ?? "Feito com calma."}
              </p>
            </div>
          </div>
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
        html { scroll-behavior: smooth; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }

        /* Nav claro/escuro conforme a seção sob ela — ver interactive/Nav.tsx. */
        .d-nav {
          background: color-mix(in srgb, var(--d-bg) 82%, transparent);
          color: var(--d-text);
          border-bottom: 1px solid color-mix(in srgb, var(--d-text) 10%, transparent);
          transition: background 0.5s, color 0.5s, border-color 0.5s;
        }
        .d-nav[data-theme="dark"] {
          background: color-mix(in srgb, var(--d-text) 28%, transparent);
          color: var(--d-bg);
          border-bottom-color: color-mix(in srgb, var(--d-bg) 16%, transparent);
        }
        .d-nav-cta { background: var(--d-accent); color: var(--d-accent-ink); }
        .d-nav[data-theme="dark"] .d-nav-cta { background: var(--d-bg); color: var(--d-accent); }

        /* Botão pílula — SEMPRE 999px, independente de --d-radius (fiel ao original). */
        .d-cta-pill {
          display: inline-flex; align-items: center; background: var(--d-accent); color: var(--d-accent-ink);
          padding: 17px 32px; border-radius: 999px; font-size: 16px; font-weight: 600;
          transition: padding var(--d-anim-duration) var(--d-anim-ease), background 0.3s;
        }
        .d-cta-pill:hover { padding: 17px 38px; background: color-mix(in srgb, var(--d-accent) 82%, black); }
        @media (prefers-reduced-motion: reduce) { .d-cta-pill:hover { padding: 17px 32px; } }

        /* Link sublinhado (cor de marca, sublinhado no acento secundário). */
        .d-link-underline { color: var(--d-text); border-bottom: 2px solid var(--d-accent-2); padding-bottom: 3px; transition: color var(--d-anim-duration) var(--d-anim-ease); }
        .d-link-underline:hover { color: var(--d-accent); }

        /* Seta que aparece no hover do CTA — fiel ao data-cta-arrow do original. */
        .d-arrow-cta-tail { display: inline-block; overflow: hidden; width: 0; opacity: 0; transform: translateX(-8px); white-space: nowrap;
          transition: width 0.4s var(--d-anim-ease), opacity 0.4s, transform 0.4s var(--d-anim-ease); }
        .d-arrow-cta:hover .d-arrow-cta-tail { width: 24px; opacity: 1; transform: translateX(0); }
        @media (prefers-reduced-motion: reduce) { .d-arrow-cta-tail { transition: none; } }

        /* Selo giratório do hero — velocidade por nível de animação (ver BADGE_SPIN_DURATION). */
        @keyframes d-badge-spin { to { transform: rotate(360deg); } }
        .d-badge-spin { animation: d-badge-spin var(--d-badge-spin) linear infinite; }
        [data-d-anim="nenhuma"] .d-badge-spin { animation: none; }
        @media (prefers-reduced-motion: reduce) { .d-badge-spin { animation: none; } }

        /* Blobs flutuantes da seção de contato — puro CSS, fiel ao original. */
        @keyframes d-float-1 { 0%, 100% { transform: translate(0,0) rotate(0deg); } 50% { transform: translate(14px,-20px) rotate(8deg); } }
        @keyframes d-float-2 { 0%, 100% { transform: translate(0,0); } 50% { transform: translate(-18px,16px); } }
        @keyframes d-float-3 { 0%, 100% { transform: translate(0,0) rotate(0deg); } 50% { transform: translate(10px,14px) rotate(-10deg); } }
        .d-blob { position: absolute; pointer-events: none; }
        .d-blob-1 { top: 8%; left: 6%; width: 170px; height: 170px; border-radius: 62% 38% 55% 45% / 48% 60% 40% 52%; opacity: 0.5; animation: d-float-1 11s ease-in-out infinite; }
        .d-blob-2 { bottom: 10%; right: 7%; width: 220px; height: 220px; border-radius: 45% 55% 40% 60% / 55% 45% 55% 45%; opacity: 0.25; animation: d-float-2 14s ease-in-out infinite; }
        .d-blob-3 { top: 16%; right: 18%; width: 90px; height: 90px; border-radius: 55% 45% 60% 40% / 45% 55% 45% 55%; opacity: 0.3; animation: d-float-3 9s ease-in-out infinite; }
        [data-d-anim="nenhuma"] .d-blob { animation: none; }
        @media (prefers-reduced-motion: reduce) { .d-blob { animation: none; } }

        /* ── Hover do tema (Theme.hover) — cards de imóvel; a lente de zoom
           na foto (group-hover:scale-105) é sempre ligada, fiel ao
           original — os presets acrescentam um efeito por cima dela. ──── */
        [data-card] { transition: transform var(--d-anim-duration) var(--d-anim-ease), box-shadow var(--d-anim-duration) var(--d-anim-ease); }
        [data-d-hover="lift"] [data-card]:hover { transform: translateY(var(--d-hover-lift)); }
        [data-d-hover="brilho"] [data-card]:hover { box-shadow: 0 0 32px color-mix(in srgb, var(--d-accent) 45%, transparent); }
        @media (prefers-reduced-motion: reduce) {
          [data-card], [data-card] .absolute.inset-0 { transition: none !important; }
          [data-card]:hover { transform: none !important; }
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

      <LedEdges preset={theme.led} />
      <CustomCursor animacao={theme.animacao} />

      <IntroExperience nome={data.nome} accent={paleta.destaque} ink={paleta.destaqueInk} ativa={theme.intro === true}>
        <Nav
          nome={data.nome}
          itens={navItens}
          ctaLabel={visiveis.includes("contato") ? "Fale com a gente" : undefined}
        />

        {visiveis.map((id) => {
          if (id === "hero" || id === "imoveis" || id === "contato") {
            // Hero é chrome fixo (própria seção define seu nav-theme); imóveis já
            // embrulha CADA card com SectionReveal internamente (ver acima);
            // contato (rodapé) nunca anima como bloco — só o conteúdo interno via Reveal.
            return <Fragment key={id}>{secoes[id]?.()}</Fragment>;
          }
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
    </div>
  );
}
