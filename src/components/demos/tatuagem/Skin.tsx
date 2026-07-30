import Image from "next/image";
import { Fragment, type CSSProperties, type ReactNode } from "react";

import { secoesVisiveis } from "@/lib/demos/estrutura";
import type { Alinhamento, Animacao, Densidade, SkinProps } from "@/lib/demos/types";
import { BackgroundEffect } from "./BackgroundEffect";
import { GothicLetters } from "./GothicLetters";
import { FadeUp } from "./interactive/FadeUp";
import { IntroExperience } from "./interactive/IntroExperience";
import { LedEdges } from "./interactive/LedEdges";
import { Parallax } from "./interactive/Parallax";
import { ScrollHeader } from "./interactive/ScrollHeader";
import { SectionReveal, type RevealTipo } from "./interactive/SectionReveal";
import { TATUAGEM_SECOES } from "./secoes";
import { Wordmark } from "./Wordmark";

/**
 * Skin "Tatuagem Editorial Sombria" — conversão fiel do material bruto
 * (skins-raw/tatuagem, VERTEBRA Studio): preto profundo, acento sangue,
 * blackletter gótica, respiros longos, cursor de máquina, splash de
 * abertura letra-a-letra, faixa rolante, manifesto editorial e portfólio
 * em masonry.
 *
 * Componente PURO: todo texto/imagem vem de `data`, toda cor/fonte/raio/
 * densidade vem de `theme` (aplicado como CSS vars no wrapper). Nenhuma
 * chamada externa — imagens são placeholders locais por slot. O vídeo com
 * máscara SVG do wordmark original virou um efeito 100% CSS (gradiente +
 * contorno multicor, ver Wordmark.tsx) para manter a Forja livre de
 * assets binários (todo o resto do sistema é SVG local).
 *
 * `investimento` (preços) e `depoimentos` são seções acrescentadas ao
 * original — exigidas pelo contrato universal de DemoData (ver
 * secoes.ts) — reskinadas na mesma linguagem editorial.
 *
 * Estrutura editável: as seções renderizam na ordem efetiva de
 * DemoData.ordemSecoes (ver lib/demos/estrutura.ts), respeitam
 * DemoSecao.oculta e alinhamento onde TATUAGEM_SECOES declara
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

/** Seções sem animação de entrada no material bruto (blocos estáticos). */
const SEM_ENTRADA_DEFAULT = new Set(["statement", "marquee"]);

function waHref(whatsapp: string | undefined): string {
  const digitos = (whatsapp ?? "").replace(/\D/g, "");
  return digitos ? `https://wa.me/${digitos}` : "#contato";
}

function Etiqueta({ texto, slot }: { texto?: string; slot?: string }) {
  if (!texto) return null;
  return (
    <span
      data-demo-slot={slot}
      className="mb-4 block font-[family-name:var(--d-mono)] text-xs uppercase tracking-widest text-[var(--d-muted)]"
    >
      {texto}
    </span>
  );
}

function Titulo({ texto, slot, className = "" }: { texto?: string; slot?: string; className?: string }) {
  if (!texto) return null;
  return (
    <h2
      data-demo-slot={slot}
      className={`font-[family-name:var(--d-display)] tracking-tight text-[var(--d-text)] drop-shadow-sm ${className}`}
      style={{ fontSize: "clamp(2.5rem, 6vw, 4.5rem)" }}
    >
      {texto}
    </h2>
  );
}

function Placeholder({
  src,
  alt,
  sizes,
  priority,
  slot,
  className = "",
  filtro = true,
}: {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  slot?: string;
  className?: string;
  /** Filtro dark/dessaturado do original (`.image-dark-filter`) — hero NÃO usa (só o gradiente escuro por cima). */
  filtro?: boolean;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      fill
      unoptimized
      data-demo-slot={slot}
      className={`object-cover ${className}`}
      style={filtro ? { filter: "grayscale(100%) contrast(1.25) brightness(0.75)" } : undefined}
      sizes={sizes}
      priority={priority}
    />
  );
}

export function TatuagemEditorial({ data, theme }: SkinProps) {
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
    // Título hero: controles próprios do editor (aba Tema), independentes
    // do resto da tipografia — "" em heroTitulo.fonte herda fontes.display.
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
    esquerda: "text-left",
    centro: "text-center",
    direita: "text-right",
  };

  const visiveis = secoesVisiveis(TATUAGEM_SECOES, data);
  // Ausente = primeira opção de alignOptions da seção (o "natural" da skin
  // — ver secoes.ts): portfólio nasce centralizado, depoimentos/processo
  // nascem à esquerda, fiéis ao material bruto.
  const ALINHAMENTO_PADRAO: Record<string, Alinhamento> = {
    portfolio: "centro",
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
    return "fade"; // "fade" (typewriter não é oferecido nesta skin)
  };

  const secoes: Record<string, () => ReactNode> = {
    /* ── Hero (fixa) ─────────────────────────────────────────── */
    hero: () => (
      <section
        id="topo"
        className="relative flex min-h-[100svh] w-full items-center justify-center overflow-hidden px-6 pb-24 pt-32 md:min-h-[90svh]"
      >
        <div className="absolute inset-0 z-[1]">
          <Placeholder
            src={data.imagens.hero}
            alt={`Ambiente de ${data.nome}`}
            sizes="100vw"
            priority
            slot="imagens.hero"
            filtro={false}
          />
        </div>
        <div
          className="absolute inset-0 z-[2]"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.75) 50%, rgba(0,0,0,0.90) 100%)",
          }}
        />

        <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col items-center text-center">
          <FadeUp animacao={theme.animacao} delay={0.2} className="mb-6">
            {data.cidade && (
              <p
                data-demo-slot="cidade"
                className="font-[family-name:var(--d-mono)] text-xs uppercase tracking-[0.2em] text-[var(--d-muted)] md:text-sm"
              >
                {data.cidade}
              </p>
            )}
          </FadeUp>

          <div className={`w-full max-w-[1200px] ${HERO_ALINHAMENTO_TEXT[theme.heroTitulo.alinhamento]}`}>
            <Wordmark
              nome={s.hero?.titulo ?? data.nome}
              slot="secoes.hero.titulo"
              videoSrc={data.videos?.titulo}
              imagemFallback={data.imagens.hero}
              className="mb-8 block text-[calc(clamp(3rem,13vw,9rem)*var(--d-hero-escala))] leading-[0.9] drop-shadow-[4px_6px_0_rgba(0,0,0,0.9)]"
            />
          </div>

          {data.slogan && (
            <FadeUp animacao={theme.animacao} delay={0.4} className="mb-2">
              <p
                data-demo-slot="slogan"
                className="font-[family-name:var(--d-destaque)] text-lg italic text-[var(--d-muted)] md:text-xl"
              >
                {data.slogan}
              </p>
            </FadeUp>
          )}

          {s.hero?.texto && (
            <FadeUp animacao={theme.animacao} delay={0.6} className="max-w-2xl">
              <p
                data-demo-slot="secoes.hero.texto"
                className="text-[15px] leading-relaxed text-[var(--d-muted)] md:text-[17px]"
              >
                {s.hero.texto}
              </p>
            </FadeUp>
          )}

          {s.hero?.cta && (
            <FadeUp animacao={theme.animacao} delay={0.8} className="mt-12">
              <a href={agendar} data-demo-slot="secoes.hero.cta" className="d-cta-simple">
                {s.hero.cta}
              </a>
            </FadeUp>
          )}
        </div>
      </section>
    ),

    /* ── Sobre (O Artista) ──────────────────────────────────── */
    sobre: () =>
      s.sobre && (
        <section id="sobre" className="px-6 py-[var(--d-sec-y)]">
          <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-24">
            <div className="relative mx-auto aspect-[3/4] w-full max-w-md lg:col-span-5 lg:mx-0">
              <Parallax animacao={theme.animacao} className="h-full w-full">
                <Placeholder
                  src={data.imagens.sobre}
                  alt={s.sobre.titulo ?? data.nome}
                  sizes="(max-width: 1024px) 100vw, 40vw"
                  slot="imagens.sobre"
                />
              </Parallax>
              <div className="pointer-events-none absolute -inset-4 z-0 hidden border border-[var(--d-border)] md:block" />
            </div>

            <div className="flex flex-col justify-center lg:col-span-7">
              <FadeUp animacao={theme.animacao} delay={0.1}>
                <Etiqueta texto={s.sobre.rotulo} slot="secoes.sobre.rotulo" />
              </FadeUp>
              <div className="mb-8">
                <Titulo
                  texto={s.sobre.titulo}
                  slot="secoes.sobre.titulo"
                  className="text-5xl md:text-6xl"
                />
              </div>
              <div className="max-w-2xl space-y-6 font-[family-name:var(--d-corpo)] text-[15px] leading-relaxed text-[var(--d-muted)]">
                {(s.sobre.texto ?? "")
                  .split(/\n{2,}/)
                  .filter(Boolean)
                  .map((paragrafo, i) => (
                    <FadeUp
                      key={i}
                      animacao={theme.animacao}
                      delay={0.3 + i * 0.1}
                      className=""
                    >
                      <p data-demo-slot={i === 0 ? "secoes.sobre.texto" : undefined}>{paragrafo}</p>
                    </FadeUp>
                  ))}
              </div>
              {(s.sobre.itens?.length ?? 0) > 0 && (
                <FadeUp animacao={theme.animacao} delay={0.6} className="mt-12 border-t border-[var(--d-border)] pt-8">
                  <ul className="flex flex-wrap gap-2">
                    {(s.sobre.itens ?? []).map((tag, i) => (
                      <li key={tag.titulo}>
                        <span
                          data-demo-slot={`secoes.sobre.itens.${i}.titulo`}
                          className="border border-[var(--d-border)] px-3 py-1.5 font-[family-name:var(--d-mono)] text-[9px] uppercase tracking-wider text-[var(--d-text)]"
                        >
                          {tag.titulo}
                        </span>
                      </li>
                    ))}
                  </ul>
                </FadeUp>
              )}
            </div>
          </div>
        </section>
      ),

    /* ── Manifesto (statement) ──────────────────────────────── */
    statement: () =>
      s.statement?.texto && (
        <section className="flex items-center justify-center overflow-hidden border-y border-[var(--d-border)] px-6 py-[calc(var(--d-sec-y)*1.3)]">
          <div className="mx-auto max-w-7xl text-center">
            <div
              data-demo-slot="secoes.statement.texto"
              className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 font-[family-name:var(--d-citacao)] font-black leading-[0.85] tracking-tighter text-[var(--d-text)]"
              style={{ fontSize: "clamp(3rem, 9vw, 7rem)" }}
            >
              {s.statement.texto.split(" ").map((palavra, i) => (
                <span
                  key={i}
                  className={i % 2 !== 0 ? "font-light italic text-[var(--d-muted)]" : ""}
                >
                  {palavra}
                </span>
              ))}
            </div>
          </div>
        </section>
      ),

    /* ── Portfólio (Arquivo) ────────────────────────────────── */
    portfolio: () =>
      s.portfolio && (
        <section id="portfolio" className="cursor-default px-6 py-[var(--d-sec-y)]">
          <div className={`mx-auto max-w-[1400px] ${centro("portfolio") ? "text-center" : ""}`}>
            <div className={`mb-20 flex flex-col ${centro("portfolio") ? "items-center" : "items-start"}`}>
              <Etiqueta texto={s.portfolio.rotulo} slot="secoes.portfolio.rotulo" />
              <Titulo texto={s.portfolio.titulo} slot="secoes.portfolio.titulo" className="text-5xl md:text-7xl" />
            </div>

            <div className="columns-1 gap-6 space-y-6 text-left md:columns-2 lg:columns-3">
              {(s.portfolio.itens ?? []).map((item, i) => (
                <FadeUp
                  key={i}
                  animacao={theme.animacao}
                  delay={0.1 * (i % 3)}
                  className="break-inside-avoid"
                >
                  <div
                    data-cursor="portfolio"
                    className="d-card-hover group relative overflow-hidden bg-[var(--d-bg-alt)]"
                  >
                    <div className="relative aspect-[4/5] w-full overflow-hidden">
                      <Placeholder
                        src={data.imagens[`portfolio-${i + 1}`] ?? data.imagens.hero}
                        alt={`${item.titulo} — ${item.detalhe ?? ""}`}
                        sizes="(max-width: 768px) 100vw, 33vw"
                        slot={`imagens.portfolio-${i + 1}`}
                        className="transition-transform duration-[var(--d-anim-duration)]"
                      />
                    </div>
                    <div className="pointer-events-none absolute inset-x-4 bottom-4 flex justify-start">
                      <div
                        data-demo-slot={`secoes.portfolio.itens.${i}`}
                        className="bg-[var(--d-bg)]/80 px-2 py-1 font-[family-name:var(--d-mono)] text-[9px] uppercase tracking-tighter text-[var(--d-text)] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                      >
                        {item.titulo} / {item.subtitulo} / {item.detalhe}
                      </div>
                    </div>
                  </div>
                </FadeUp>
              ))}
            </div>
          </div>
        </section>
      ),

    /* ── Investimento (preços) ──────────────────────────────── */
    investimento: () => (
      <section id="investimento" className="border-t border-[var(--d-border)] bg-[var(--d-bg-alt)] px-6 py-[var(--d-sec-y)]">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16">
            <Etiqueta texto={s.investimento?.rotulo} slot="secoes.investimento.rotulo" />
            <Titulo texto={s.investimento?.titulo} slot="secoes.investimento.titulo" className="text-4xl md:text-6xl" />
          </div>
          <div className="flex flex-col border-t border-[var(--d-border)]">
            {data.servicos.map((servico, i) => (
              <div
                key={servico.nome}
                className="flex flex-col border-b border-[var(--d-border)] py-8 transition-colors duration-[var(--d-anim-duration)]"
              >
                <div className="mb-3 flex items-baseline justify-between gap-4">
                  <h3
                    data-demo-slot={`servicos.${i}.nome`}
                    className="font-[family-name:var(--d-display)] text-2xl tracking-tight text-[var(--d-text)] md:text-3xl"
                  >
                    {servico.nome}
                  </h3>
                  <span
                    data-demo-slot={`servicos.${i}.preco`}
                    className="whitespace-nowrap font-[family-name:var(--d-mono)] text-sm font-medium tracking-wider text-[var(--d-accent)]"
                  >
                    {servico.preco}
                  </span>
                </div>
                {servico.descricao && (
                  <p
                    data-demo-slot={`servicos.${i}.descricao`}
                    className="max-w-xl text-sm leading-relaxed text-[var(--d-muted)] md:text-base"
                  >
                    {servico.descricao}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    ),

    /* ── Depoimentos ─────────────────────────────────────────── */
    depoimentos: () =>
      data.depoimentos.length > 0 && (
        <section className="px-6 py-[var(--d-sec-y)]">
          <div className="mx-auto max-w-7xl">
            <div className={`mb-16 ${centro("depoimentos") ? "text-center" : ""}`}>
              <Etiqueta texto={s.depoimentos?.rotulo} slot="secoes.depoimentos.rotulo" />
              <Titulo texto={s.depoimentos?.titulo} slot="secoes.depoimentos.titulo" className="text-4xl md:text-6xl" />
            </div>
            <div className="grid gap-8 md:grid-cols-3">
              {data.depoimentos.map((dep, i) => (
                <figure
                  key={dep.autor}
                  className="d-card-hover flex h-full flex-col justify-between gap-6 border border-[var(--d-border)] bg-[var(--d-bg-alt)] p-8"
                >
                  <div>
                    {dep.nota !== undefined && (
                      <div className="mb-4 tracking-[0.3em] text-[var(--d-accent)]" aria-label={`${dep.nota} de 5 estrelas`}>
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
                    className="font-[family-name:var(--d-mono)] text-[11px] uppercase tracking-[0.18em] text-[var(--d-muted)]"
                  >
                    — {dep.autor}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      ),

    /* ── Faixa rolante (marquee) ─────────────────────────────── */
    marquee: () => {
      const itens = s.marquee?.itens ?? [];
      if (itens.length === 0) return null;
      const repetido = [...itens, ...itens, ...itens, ...itens];
      return (
        <div className="flex w-full items-center overflow-hidden border-y border-[var(--d-border)] py-8">
          <div className="d-marquee flex w-max">
            {repetido.map((item, i) => (
              <div key={i} className="flex items-center">
                <span className="whitespace-nowrap font-[family-name:var(--d-mono)] text-[10px] uppercase tracking-[0.3em] text-[var(--d-muted)]">
                  {item.titulo}
                </span>
                <span className="mx-8 font-[family-name:var(--d-mono)] text-xs text-[var(--d-accent)]">•</span>
              </div>
            ))}
          </div>
        </div>
      );
    },

    /* ── Processo (Protocolo) ────────────────────────────────── */
    processo: () =>
      s.processo && (
        <section id="processo" className="px-6 py-[var(--d-sec-y)]">
          <div className={`mx-auto max-w-4xl ${centro("processo") ? "text-center" : ""}`}>
            <div className="mb-20">
              <Etiqueta texto={s.processo.rotulo} slot="secoes.processo.rotulo" />
              <Titulo texto={s.processo.titulo} slot="secoes.processo.titulo" className="text-5xl md:text-7xl" />
            </div>
            <div className="space-y-12 md:space-y-0">
              {(s.processo.itens ?? []).map((passo, i) => (
                <FadeUp
                  key={passo.titulo}
                  animacao={theme.animacao}
                  delay={0.1 * i}
                  className="items-start border-t border-[var(--d-border)] pb-8 pt-8 md:grid md:grid-cols-12 md:gap-8 md:pb-12"
                >
                  <div className="mb-4 md:col-span-2 md:mb-0">
                    <span
                      data-demo-slot={`secoes.processo.itens.${i}.subtitulo`}
                      className="block font-[family-name:var(--d-display)] text-4xl text-[var(--d-accent)] drop-shadow-sm lg:text-5xl"
                    >
                      {passo.subtitulo}
                    </span>
                  </div>
                  <div className="md:col-span-10">
                    <h3
                      data-demo-slot={`secoes.processo.itens.${i}.titulo`}
                      className="mb-1 font-[family-name:var(--d-corpo)] text-[15px] font-medium text-[var(--d-text)]"
                    >
                      {passo.titulo}
                    </h3>
                    {passo.texto && (
                      <p
                        data-demo-slot={`secoes.processo.itens.${i}.texto`}
                        className="text-[13px] leading-relaxed text-[var(--d-muted)]"
                      >
                        {passo.texto}
                      </p>
                    )}
                  </div>
                </FadeUp>
              ))}
            </div>
          </div>
        </section>
      ),

    /* ── Contato (footer) ────────────────────────────────────── */
    contato: () => (
      <footer
        id="contato"
        className="border-t border-[var(--d-border)] bg-[var(--d-bg-alt)] px-6 pb-12 pt-[var(--d-sec-y)] text-center"
      >
        <div className="mx-auto flex max-w-4xl flex-col items-center">
          <FadeUp animacao={theme.animacao}>
            <Titulo
              texto={s.contato?.titulo}
              slot="secoes.contato.titulo"
              className="mb-12 text-5xl md:text-7xl"
            />
          </FadeUp>

          {s.contato?.cta && (
            <FadeUp animacao={theme.animacao} delay={0.2} className="mb-16">
              <a
                href={agendar}
                data-demo-slot="secoes.contato.cta"
                data-cursor="hover"
                className="d-cta-slide"
              >
                <span>{s.contato.cta}</span>
              </a>
            </FadeUp>
          )}

          {(data.endereco || data.horarios || (data.telefone && data.telefone !== data.whatsapp)) && (
            <FadeUp animacao={theme.animacao} delay={0.3} className="mb-12 flex flex-col gap-1">
              {data.endereco && (
                <p data-demo-slot="endereco" className="font-[family-name:var(--d-mono)] text-xs text-[var(--d-muted)]">
                  {data.endereco}
                </p>
              )}
              {data.horarios && (
                <p data-demo-slot="horarios" className="font-[family-name:var(--d-mono)] text-xs text-[var(--d-muted)]">
                  {data.horarios}
                </p>
              )}
              {data.telefone && data.telefone !== data.whatsapp && (
                <p data-demo-slot="telefone" className="font-[family-name:var(--d-mono)] text-xs text-[var(--d-muted)]">
                  {data.telefone}
                </p>
              )}
            </FadeUp>
          )}

          <FadeUp
            animacao={theme.animacao}
            delay={0.4}
            className="flex w-full flex-col items-center justify-between border-t border-[var(--d-border)] pt-8 font-[family-name:var(--d-mono)] text-xs text-[var(--d-muted)] md:flex-row"
          >
            <div className="mb-4 md:mb-0">
              © {new Date().getFullYear()} <span data-demo-slot="nome">{data.nome}</span>. Todos os direitos
              reservados.
            </div>
            <div className="flex gap-6">
              {data.instagram && (
                <span data-demo-slot="instagram" className="transition-colors hover:text-[var(--d-text)]">
                  {data.instagram}
                </span>
              )}
              {data.whatsapp && (
                <a
                  href={agendar}
                  data-demo-slot="whatsapp"
                  className="transition-colors hover:text-[var(--d-text)]"
                >
                  WhatsApp
                </a>
              )}
            </div>
          </FadeUp>
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
      className="d-noise relative min-h-screen overflow-x-clip font-[family-name:var(--d-corpo)] text-[var(--d-text)]"
    >
      <style>{`
        /* Grão de ruído sutil sobre o fundo — mesmo filtro SVG do original (body). */
        .d-noise {
          background-color: var(--d-bg);
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-repeat: repeat;
          background-blend-mode: overlay;
        }

        /* Assinatura tipográfica (Wordmark): preenchimento em gradiente +
           contorno multicor NO MESMO elemento (background-clip:text e
           -webkit-text-stroke coexistem numa única caixa) — ver
           Wordmark.tsx. Eram duas camadas irmãs (uma só com o fill, outra
           só com o stroke, sobreposta via position:absolute), cada uma com
           sua própria animação infinita: sob carga de scroll rápido o
           navegador podia promovê-las a compositor layers independentes e
           uma acabava "atrasando" um frame em relação à outra — o contorno
           parecia se descolar do preenchimento (ghosting). Uma única caixa
           anima as duas propriedades juntas, sem essa divergência possível.
           A sombra do título (drop-shadow, className passada pela skin) já
           cai nesta mesma caixa — nunca numa camada irmã. */
        .d-wordmark { position: relative; display: inline-block; font-family: var(--d-deco); line-height: 1; }
        .d-wordmark-text {
          display: inline-block;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          /* pre-line (não nowrap): respeita quebra de linha do título
             (textarea do editor) e ainda permite quebrar em telas
             estreitas — nunca força overflow horizontal num título longo. */
          white-space: pre-line;
          background-image: linear-gradient(120deg,
            var(--d-bg) 0%,
            color-mix(in srgb, var(--d-accent) 35%, var(--d-bg)) 20%,
            var(--d-bg) 40%,
            color-mix(in srgb, var(--d-accent-2) 30%, var(--d-bg)) 60%,
            var(--d-bg) 80%,
            color-mix(in srgb, var(--d-accent-3) 30%, var(--d-bg)) 100%);
          background-size: 260% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          -webkit-text-stroke: 1px var(--d-accent);
          animation:
            d-wordmark-drift 9s ease-in-out infinite,
            d-stroke-cycle 12s ease-in-out infinite;
        }
        @keyframes d-wordmark-drift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes d-stroke-cycle {
          0%   { -webkit-text-stroke-color: var(--d-accent); }
          33%  { -webkit-text-stroke-color: var(--d-accent-2); }
          66%  { -webkit-text-stroke-color: var(--d-accent-3); }
          100% { -webkit-text-stroke-color: var(--d-accent); }
        }
        @media (prefers-reduced-motion: reduce) {
          .d-wordmark-text { animation: none; }
        }

        /* Faixa rolante infinita (marquee). */
        @keyframes d-marquee-scroll { 0% { transform: translateX(0%); } 100% { transform: translateX(-25%); } }
        .d-marquee { animation: d-marquee-scroll 34s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .d-marquee { animation-play-state: paused; } }

        /* CTA simples (hero) — preenche de cor sólida no hover. */
        .d-cta-simple {
          display: inline-block;
          padding: 20px 40px;
          border: 1px solid var(--d-border);
          font-family: var(--d-mono);
          font-size: 11px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: var(--d-text);
          transition: background-color var(--d-anim-duration) var(--d-anim-ease),
            border-color var(--d-anim-duration) var(--d-anim-ease),
            transform var(--d-anim-duration) var(--d-anim-ease);
        }
        .d-cta-simple:hover {
          background: var(--d-accent);
          border-color: var(--d-accent);
          color: var(--d-accent-ink);
        }

        /* CTA com preenchimento em "wipe" de baixo pra cima (contato/footer). */
        .d-cta-slide {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          padding: 20px 48px;
          border: 1px solid var(--d-text);
          font-family: var(--d-mono);
          font-size: 11px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: var(--d-text);
          transition: color var(--d-anim-duration) var(--d-anim-ease);
        }
        .d-cta-slide::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: 0;
          background: var(--d-accent);
          transform: translateY(100%);
          transition: transform var(--d-anim-duration) var(--d-anim-ease);
        }
        .d-cta-slide span { position: relative; z-index: 1; }
        .d-cta-slide:hover { color: var(--d-accent-ink); }
        .d-cta-slide:hover::before { transform: translateY(0); }

        [data-d-hover="zoom"] .d-cta-simple:hover, [data-d-hover="zoom"] .d-cta-slide:hover {
          transform: scale(var(--d-hover-scale));
        }
        [data-d-hover="lift"] .d-cta-simple:hover, [data-d-hover="lift"] .d-cta-slide:hover {
          transform: translateY(var(--d-hover-lift));
        }
        [data-d-hover="brilho"] .d-cta-simple:hover, [data-d-hover="brilho"] .d-cta-slide:hover {
          box-shadow: 0 0 32px color-mix(in srgb, var(--d-accent) 55%, transparent);
        }
        @media (prefers-reduced-motion: reduce) {
          .d-cta-simple, .d-cta-slide, .d-cta-simple:hover, .d-cta-slide:hover { transform: none; }
        }

        /* Cards com hover controlado por Theme.hover (portfólio, depoimentos). */
        .d-card-hover {
          transition: transform var(--d-anim-duration) var(--d-anim-ease),
            box-shadow var(--d-anim-duration) var(--d-anim-ease),
            border-color var(--d-anim-duration) var(--d-anim-ease);
        }
        [data-d-hover="zoom"] .d-card-hover:hover img { transform: scale(var(--d-hover-scale)); }
        [data-d-hover="lift"] .d-card-hover:hover { transform: translateY(var(--d-hover-lift)); }
        [data-d-hover="brilho"] .d-card-hover:hover {
          box-shadow: 0 0 24px color-mix(in srgb, var(--d-accent) 30%, transparent);
          border-color: color-mix(in srgb, var(--d-accent) 45%, transparent);
        }
        @media (prefers-reduced-motion: reduce) {
          .d-card-hover:hover, .d-card-hover:hover img { transform: none; }
        }

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
        @media (prefers-reduced-motion: reduce) {
          [data-d-clique] a:active, [data-d-clique] button:active { transform: none; animation: none; }
        }

        /* Letras góticas gigantes — chrome sempre ligado (ver GothicLetters.tsx),
           absolutas dentro do wrapper raiz (position: relative), rolam junto
           com o conteúdo (igual ao .gothic-bg do original, que cobre o
           .page-container inteiro, não a viewport). */
        .d-gothic-bg {
          position: absolute; inset: 0; z-index: 1; pointer-events: none; overflow: hidden; user-select: none;
        }
        .d-gothic-bg span {
          position: absolute;
          font-family: var(--d-deco);
          color: var(--d-text);
          line-height: 1;
          white-space: nowrap;
        }

        /* Efeito de fundo OPCIONAL (Theme.fundoEfeito) — camada extra por
           cima do chrome fixo acima, desligada por default (ver themes.ts). */
        .d-bg-gradiente {
          position: fixed; inset: -25%; z-index: 20; pointer-events: none; opacity: 0.12;
          background: radial-gradient(circle at 28% 30%, var(--d-accent) 0%, transparent 42%),
            radial-gradient(circle at 72% 68%, var(--d-accent-2) 0%, transparent 40%);
          filter: blur(90px);
          animation: d-bg-drift 28s ease-in-out infinite alternate;
          will-change: transform;
        }
        @keyframes d-bg-drift {
          from { transform: translate3d(-3%, -2%, 0) scale(1); }
          to { transform: translate3d(3%, 2%, 0) scale(1.08); }
        }
        .d-bg-particulas {
          position: fixed; inset: 0; z-index: 20; pointer-events: none; overflow: hidden;
        }
        .d-bg-particulas span {
          position: absolute;
          bottom: -10px;
          border-radius: 9999px;
          background: var(--d-accent);
          opacity: 0;
          animation-name: d-bg-flutua;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        @keyframes d-bg-flutua {
          0% { transform: translateY(0); opacity: 0; }
          8% { opacity: 0.35; }
          85% { opacity: 0.12; }
          100% { transform: translateY(-105vh); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .d-bg-gradiente, .d-bg-particulas { animation: none; display: none; }
        }

        /* Bordas laterais com luz LED (Theme.led) — ver LedEdges.tsx.
           --d-led-scroll (0–1, escrito via ref/rAF) desloca o ponto mais
           brilhante do gradiente ao longo da barra conforme o progresso do
           scroll; box-shadow/opacity só, sem transform de layout. */
        .d-led-edges {
          position: fixed; inset: 0; z-index: 45; pointer-events: none;
          --d-led-scroll: 0;
        }
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
        @keyframes d-led-pulso {
          0% { filter: brightness(1); }
          30% { filter: brightness(1.8); }
          100% { filter: brightness(1); }
        }
        .d-led-pulse .d-led-bar { animation: d-led-pulso 500ms ease-out; }
        @media (prefers-reduced-motion: reduce) {
          .d-led-bar { transition: none; }
          .d-led-pulse .d-led-bar { animation: none; }
        }
      `}</style>

      <GothicLetters nome={data.nome} />
      <BackgroundEffect efeito={theme.fundoEfeito} animacao={theme.animacao} />
      <LedEdges preset={theme.led} />

      <IntroExperience nome={data.nome} accent={paleta.destaque} ativa={theme.intro !== false}>
        <ScrollHeader
          nome={data.nome}
          ctaHref={agendar}
          ctaLabel="Agendar"
          links={[
            s.sobre?.rotulo && { href: "#sobre", label: "Sobre" },
            s.portfolio?.rotulo && { href: "#portfolio", label: "Portfólio" },
            s.processo?.rotulo && { href: "#processo", label: "Processo" },
          ].filter((link): link is { href: string; label: string } => Boolean(link))}
        />

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
    </div>
  );
}
