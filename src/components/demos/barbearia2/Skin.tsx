import Image from "next/image";
import { Fragment, type CSSProperties, type ReactNode } from "react";

import { secoesVisiveis } from "@/lib/demos/estrutura";
import { microcopiaDemo } from "@/lib/demos/microcopy";
import { formatarPrecoServico } from "@/lib/demos/precos";
import type { Animacao, Densidade, SkinProps } from "@/lib/demos/types";
import { DragGallery } from "./interactive/DragGallery";
import { FadeUp } from "./interactive/FadeUp";
import { IntroExperience } from "./interactive/IntroExperience";
import { LedEdges } from "./interactive/LedEdges";
import { RevealLine } from "./interactive/RevealLine";
import { SectionReveal, type RevealTipo } from "./interactive/SectionReveal";
import { BARBEARIA2_SECOES } from "./secoes";

/**
 * Skin "Barbearia Sul" — conversão fiel do material bruto
 * (skins-raw/barbearia2): editorial minimalista verde-musgo e latão, com
 * etiquetas mono, título hero centralizado com corte de navalha (sweep +
 * "chop"), lista de serviços que expande no hover, ritual em três atos com
 * algarismos romanos, galeria arrastável em preto-e-branco e rodapé com
 * letreiro (marquee) infinito.
 *
 * O material bruto original tinha um WIDGET DE AGENDAMENTO completo
 * (calendário, horários, formulário, confirmação) plugado a um backend
 * fake — fora do escopo da Forja, que só converte páginas públicas
 * visuais (mesmo critério de lancheria/OrderCta.tsx: o carrinho/checkout
 * dela também não foi portado). A seção virou um painel de CTA único,
 * mantendo a moldura com borda do widget original, que aciona o WhatsApp
 * do lead.
 *
 * Componente PURO: todo texto/imagem vem de `data`, toda cor/fonte/raio/
 * densidade vem de `theme` (aplicado como CSS vars no wrapper). Estrutura
 * editável igual às demais skins — ver lib/demos/estrutura.ts.
 */

const SECTION_PAD: Record<Densidade, string> = {
  compacta: "4rem",
  confortavel: "6rem",
  arejada: "8rem",
};

const ANIM_DURATION: Record<Animacao, string> = {
  nenhuma: "0ms",
  sutil: "200ms",
  marcante: "450ms",
};
const ANIM_HOVER_SCALE: Record<Animacao, string> = {
  nenhuma: "1",
  sutil: "1.02",
  marcante: "1.06",
};
const ANIM_HOVER_LIFT: Record<Animacao, string> = {
  nenhuma: "0px",
  sutil: "-2px",
  marcante: "-8px",
};

/** Link wa.me a partir do número exibido; sem número, âncora pro agendamento. */
function waHref(whatsapp: string | undefined, mensagem?: string): string {
  const digitos = (whatsapp ?? "").replace(/\D/g, "");
  if (!digitos) return "#agendamento";
  return mensagem ? `https://wa.me/${digitos}?text=${encodeURIComponent(mensagem)}` : `https://wa.me/${digitos}`;
}

/** Iniciais do nome do negócio pro logotipo do topo (ex.: "Barbearia Sul" → "BS"). */
function iniciais(nome: string): string {
  const palavras = nome.trim().split(/\s+/).filter(Boolean);
  if (palavras.length === 0) return "";
  if (palavras.length === 1) return palavras[0].slice(0, 2).toUpperCase();
  return (palavras[0][0] + palavras[palavras.length - 1][0]).toUpperCase();
}

const ROMANOS = ["I", "II", "III", "IV", "V", "VI"];

function Placeholder({
  src,
  alt,
  sizes,
  className = "object-cover",
  slot,
}: {
  src: string;
  alt: string;
  sizes: string;
  className?: string;
  slot?: string;
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

/** Etiqueta pequena de seção (mono, uppercase, tracking largo) — sem número: o original não numera seções. */
function Etiqueta({ texto, slot }: { texto?: string; slot?: string }) {
  if (!texto) return null;
  return (
    <span
      data-demo-slot={slot}
      className="block font-[family-name:var(--d-mono)] text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--d-muted)] md:text-xs"
    >
      {texto}
    </span>
  );
}

export function BarbeariaSul({ data, theme, idioma, moeda }: SkinProps) {
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

  const HERO_ALINHAMENTO: Record<string, string> = {
    esquerda: "items-start text-left",
    centro: "items-center text-center",
    direita: "items-end text-right",
  };

  const s = data.secoes;
  const agendar = waHref(data.whatsapp);

  const visiveis = secoesVisiveis(BARBEARIA2_SECOES, data);
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

  const galeriaItens = s.galeria?.itens ?? [];
  const barbeiroItens = s.barbeiros?.itens ?? [];
  const ritualItens = s.ritual?.itens ?? [];

  const secoes: Record<string, () => ReactNode> = {
    /* ── Hero (fixa) ─────────────────────────────────────────── */
    hero: () => (
      <section
        id="topo"
        className="relative flex min-h-screen flex-col overflow-hidden"
        style={{
          background:
            "radial-gradient(ellipse 55% 40% at 50% 6%, color-mix(in srgb, var(--d-accent) 9%, transparent), transparent 70%)",
        }}
      >
        <FadeUp animacao={theme.animacao} delay={0.15}>
          <nav className="flex items-baseline justify-between gap-6 px-6 py-6 md:px-12">
            <span className="font-[family-name:var(--d-display)] text-xl tracking-tight text-[var(--d-text)]">
              {iniciais(data.nome)}
            </span>
            <span className="flex items-baseline gap-8 font-[family-name:var(--d-mono)] text-[11px] uppercase tracking-[0.15em]">
              {data.horarios && (
                <span data-demo-slot="horarios" className="hidden text-[var(--d-muted)] sm:inline">
                  {data.horarios}
                </span>
              )}
              <a
                href="#agendamento"
                className="border-b border-[var(--d-accent)] pb-0.5 text-[var(--d-text)] transition-colors hover:text-[var(--d-accent)]"
              >
                Agendar
              </a>
            </span>
          </nav>
        </FadeUp>

        <div
          className={`flex flex-1 flex-col justify-center px-4 ${HERO_ALINHAMENTO[theme.heroTitulo.alinhamento]}`}
        >
          <h1
            data-demo-slot="secoes.hero.titulo"
            className="w-full whitespace-pre-line font-[family-name:var(--d-hero-font)] uppercase leading-[0.92] tracking-tight text-[var(--d-text)]"
            style={{ fontSize: "calc(clamp(3rem, 12vw, 9rem) * var(--d-hero-escala))" }}
          >
            {(s.hero?.titulo ?? data.nome).split("\n").map((linha, i, arr) => (
              <FadeUp
                key={i}
                animacao={theme.animacao}
                delay={0.3 + i * 0.08}
                className="block"
              >
                <span
                  className={i === arr.length - 1 && arr.length > 1 ? "d-hero-cut inline-block" : undefined}
                  style={i === arr.length - 1 && arr.length > 1 ? { animationDelay: "1.38s" } : undefined}
                >
                  {linha}
                </span>
              </FadeUp>
            ))}
          </h1>
          {arrTemDuasLinhas(s.hero?.titulo ?? data.nome) && (
            <div className="mx-auto w-full max-w-5xl px-2">
              <RevealLine
                animacao={theme.animacao}
                delay={0.9}
                className="h-px bg-[var(--d-accent)] opacity-50"
              />
            </div>
          )}
        </div>

        <FadeUp animacao={theme.animacao} delay={1.6}>
          <div className="flex flex-wrap justify-between gap-3 px-6 pb-8 font-[family-name:var(--d-mono)] text-[11px] uppercase tracking-[0.15em] text-[var(--d-muted)] md:px-12">
            {data.cidade && <span data-demo-slot="cidade">{data.cidade}</span>}
            {data.slogan && (
              <span data-demo-slot="slogan" className="text-center">
                {data.slogan}
              </span>
            )}
            <a
              href="#manifesto"
              className="transition-colors hover:text-[var(--d-accent)]"
            >
              ↓ {m.desca}
            </a>
          </div>
        </FadeUp>
      </section>
    ),

    /* ── Manifesto ──────────────────────────────────────────── */
    manifesto: () =>
      (s.manifesto?.titulo || s.manifesto?.texto) && (
        <section className="px-6 py-[var(--d-sec-y)] md:px-12">
          <div className={`mx-auto flex max-w-6xl flex-col gap-3 ${centro("manifesto") ? "items-center text-center" : ""}`}>
            {s.manifesto.titulo && (
              <FadeUp animacao={theme.animacao} delay={0}>
                <h2
                  data-demo-slot="secoes.manifesto.titulo"
                  className="font-[family-name:var(--d-display)] text-4xl leading-tight tracking-tight text-[var(--d-text)] md:text-6xl"
                  style={{ textWrap: "balance" }}
                >
                  {s.manifesto.titulo}
                </h2>
              </FadeUp>
            )}
            {s.manifesto.texto && (
              <FadeUp animacao={theme.animacao} delay={0.08}>
                <p
                  data-demo-slot="secoes.manifesto.texto"
                  className="font-[family-name:var(--d-display)] text-4xl leading-tight tracking-tight text-[var(--d-muted)] md:text-6xl"
                  style={{ textWrap: "balance" }}
                >
                  {s.manifesto.texto}
                </p>
              </FadeUp>
            )}
          </div>
        </section>
      ),

    /* ── Serviços ───────────────────────────────────────────── */
    servicos: () =>
      data.servicos.length > 0 && (
        <section id="servicos" className="bg-[var(--d-bg-alt)] px-6 py-[var(--d-sec-y)] md:px-12">
          <div className="mx-auto max-w-5xl">
            <RevealLine animacao={theme.animacao} className="mb-2 h-px bg-[var(--d-accent)] opacity-50" />
            <Etiqueta texto={s.servicos?.rotulo} slot="secoes.servicos.rotulo" />
            <div className="mt-12 border-t border-[var(--d-border)] pl-0 sm:pl-11">
              {data.servicos.map((servico, i) => (
                <div key={servico.nome} className="d-servico group border-b border-[var(--d-border)] py-6">
                  <div className="flex items-baseline justify-between gap-4">
                    <h3
                      data-demo-slot={`servicos.${i}.nome`}
                      className="d-servico-nome relative font-[family-name:var(--d-display)] text-2xl leading-tight tracking-tight text-[var(--d-text)] transition-transform md:text-3xl"
                    >
                      <span
                        aria-hidden="true"
                        className="d-servico-razor absolute -left-11 top-[0.6em] hidden h-px w-7 origin-left scale-x-0 bg-[var(--d-accent)] transition-transform sm:block"
                      />
                      {servico.nome}
                    </h3>
                    <span
                      data-demo-slot={`servicos.${i}.preco`}
                      className="whitespace-nowrap font-[family-name:var(--d-mono)] text-sm tracking-wider text-[var(--d-text)]"
                    >
                      {formatarPrecoServico(servico, idioma, moeda)}
                    </span>
                  </div>
                  {servico.descricao && (
                    <div className="d-servico-desc grid grid-rows-[0fr] overflow-hidden transition-[grid-template-rows]">
                      <div className="overflow-hidden">
                        <div className="flex flex-wrap items-baseline justify-between gap-4 pt-3">
                          <p
                            data-demo-slot={`servicos.${i}.descricao`}
                            className="max-w-md text-[var(--d-muted)]"
                          >
                            {servico.descricao}
                          </p>
                          <a
                            href={waHref(data.whatsapp, `Olá! Gostaria de agendar: ${servico.nome}.`)}
                            className="whitespace-nowrap font-[family-name:var(--d-mono)] text-xs uppercase tracking-[0.15em] text-[var(--d-accent)]"
                          >
                            Agendar este →
                          </a>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      ),

    /* ── O ritual ───────────────────────────────────────────── */
    ritual: () =>
      ritualItens.length > 0 && (
        <section className="px-6 py-[var(--d-sec-y)] md:px-12">
          <div className="mx-auto max-w-6xl">
            <RevealLine animacao={theme.animacao} className="mb-2 h-px bg-[var(--d-accent)] opacity-50" />
            <Etiqueta texto={s.ritual?.rotulo} slot="secoes.ritual.rotulo" />
            <div
              className={`mt-12 grid gap-12 sm:grid-cols-2 md:grid-cols-3 md:gap-16 ${centro("ritual") ? "text-center" : ""}`}
            >
              {ritualItens.map((passo, i) => (
                <FadeUp key={passo.titulo} animacao={theme.animacao} delay={i * 0.08}>
                  <div className="flex flex-col gap-3">
                    <div
                      aria-hidden="true"
                      className="font-[family-name:var(--d-display)] text-7xl leading-none md:text-8xl"
                      style={{
                        color: "transparent",
                        WebkitTextStroke: "1px color-mix(in srgb, var(--d-accent) 75%, transparent)",
                      }}
                    >
                      {ROMANOS[i] ?? String(i + 1)}
                    </div>
                    <h3
                      data-demo-slot={`secoes.ritual.itens.${i}.titulo`}
                      className="font-[family-name:var(--d-display)] text-2xl tracking-tight text-[var(--d-text)]"
                    >
                      {passo.titulo}
                    </h3>
                    {passo.texto && (
                      <p
                        data-demo-slot={`secoes.ritual.itens.${i}.texto`}
                        className="text-[var(--d-muted)]"
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

    /* ── Galeria ────────────────────────────────────────────── */
    galeria: () =>
      galeriaItens.length > 0 && (
        <section aria-label={m.galeria} className="py-[var(--d-sec-y)]">
          <div className="mx-auto max-w-6xl px-6 md:px-12">
            <RevealLine animacao={theme.animacao} className="mb-2 h-px bg-[var(--d-accent)] opacity-50" />
            <Etiqueta texto={s.galeria?.rotulo} slot="secoes.galeria.rotulo" />
          </div>
          <div className="mt-10">
            <DragGallery className="flex gap-4 overflow-x-auto px-6 pb-3 [scroll-snap-type:x_proximity] md:px-12">
              {galeriaItens.map((foto, i) => {
                const slot = `galeria-${i + 1}`;
                const src = data.imagens[slot];
                if (!src) return null;
                return (
                  <figure
                    key={slot}
                    className="d-foto group relative aspect-[4/5] flex-none [scroll-snap-align:start]"
                    style={{ width: "clamp(220px, 55vw, 380px)" }}
                  >
                    <Placeholder
                      src={src}
                      alt={foto.titulo || `Foto ${i + 1} de ${data.nome}`}
                      sizes="(max-width: 768px) 60vw, 380px"
                      className="d-foto-img object-cover"
                      slot={`imagens.${slot}`}
                    />
                    {foto.titulo && (
                      <figcaption
                        data-demo-slot={`secoes.galeria.itens.${i}.titulo`}
                        className="absolute bottom-3 left-3 font-[family-name:var(--d-mono)] text-[11px] uppercase tracking-[0.15em] text-[var(--d-text)]"
                      >
                        {foto.titulo}
                      </figcaption>
                    )}
                  </figure>
                );
              })}
            </DragGallery>
          </div>
        </section>
      ),

    /* ── Barbeiros ──────────────────────────────────────────── */
    barbeiros: () =>
      barbeiroItens.length > 0 && (
        <section className="px-6 py-[var(--d-sec-y)] md:px-12">
          <div className="mx-auto max-w-6xl">
            <RevealLine animacao={theme.animacao} className="mb-2 h-px bg-[var(--d-accent)] opacity-50" />
            <Etiqueta texto={s.barbeiros?.rotulo} slot="secoes.barbeiros.rotulo" />
            <div
              className={`mt-12 grid gap-10 sm:grid-cols-2 ${centro("barbeiros") ? "text-center" : ""}`}
            >
              {barbeiroItens.map((membro, i) => {
                const slot = `equipe-${i + 1}`;
                const src = data.imagens[slot];
                return (
                  <FadeUp key={membro.titulo} animacao={theme.animacao} delay={i * 0.08}>
                    <div className="group">
                      {src && (
                        <div className="d-foto relative aspect-[3/4] w-full overflow-hidden">
                          <Placeholder
                            src={src}
                            alt={membro.titulo}
                            sizes="(max-width: 768px) 100vw, 45vw"
                            className="d-foto-img object-cover"
                            slot={`imagens.${slot}`}
                          />
                        </div>
                      )}
                      <h3
                        data-demo-slot={`secoes.barbeiros.itens.${i}.titulo`}
                        className="d-nome-sublinhado mt-6 inline-block font-[family-name:var(--d-display)] text-2xl tracking-tight text-[var(--d-text)] md:text-3xl"
                      >
                        {membro.titulo}
                        <span aria-hidden="true" className="d-nome-linha mt-1.5 block h-px origin-left scale-x-0 bg-[var(--d-accent)]" />
                      </h3>
                      {membro.subtitulo && (
                        <p
                          data-demo-slot={`secoes.barbeiros.itens.${i}.subtitulo`}
                          className="font-[family-name:var(--d-mono)] text-xs uppercase tracking-[0.15em] text-[var(--d-muted)]"
                        >
                          {membro.subtitulo}
                        </p>
                      )}
                    </div>
                  </FadeUp>
                );
              })}
            </div>
          </div>
        </section>
      ),

    /* ── Agendamento ────────────────────────────────────────── */
    agendamento: () =>
      s.agendamento && (
        <section id="agendamento" className="bg-[var(--d-bg-alt)] px-6 py-[var(--d-sec-y)] md:px-12">
          <div className={`mx-auto max-w-3xl ${centro("agendamento") ? "text-center" : ""}`}>
            <RevealLine animacao={theme.animacao} className="mb-4 h-px bg-[var(--d-accent)] opacity-50" />
            {s.agendamento.titulo && (
              <h2
                data-demo-slot="secoes.agendamento.titulo"
                className="mb-2 font-[family-name:var(--d-display)] text-4xl leading-tight tracking-tight text-[var(--d-text)] md:text-5xl"
                style={{ textWrap: "balance" }}
              >
                {s.agendamento.titulo}
              </h2>
            )}
            {s.agendamento.texto && (
              <p data-demo-slot="secoes.agendamento.texto" className="mb-8 text-[var(--d-muted)]">
                {s.agendamento.texto}
              </p>
            )}
            <div
              className={`flex flex-col gap-6 border border-[var(--d-border)] p-8 md:p-12 ${centro("agendamento") ? "items-center" : "items-start"}`}
            >
              <p className="font-[family-name:var(--d-mono)] text-xs uppercase tracking-[0.15em] text-[var(--d-muted)]">
                Escolha o serviço, o dia e o horário direto pelo WhatsApp — sem formulário, sem espera.
              </p>
              {s.agendamento.cta && (
                <a href={agendar} data-demo-slot="secoes.agendamento.cta" className="d-cta">
                  {s.agendamento.cta}
                </a>
              )}
            </div>
          </div>
        </section>
      ),

    /* ── Contato (rodapé) ──────────────────────────────────── */
    contato: () => (
      <footer id="contato" className="relative">
        {/* Letreiro (marquee) infinito com o nome do negócio. */}
        <div className="d-marquee-track overflow-hidden border-y border-[var(--d-border)] py-6">
          <div className="d-marquee flex whitespace-nowrap">
            {[0, 1].map((rep) => (
              <span
                key={rep}
                aria-hidden={rep === 1}
                className="font-[family-name:var(--d-display)] text-2xl tracking-wide text-[var(--d-muted)] md:text-4xl"
              >
                {Array.from({ length: 3 }, () => data.nome + (data.cidade ? ` — ${data.cidade}` : "")).join(
                  " — ",
                )}
                {" — "}
              </span>
            ))}
          </div>
        </div>

        <div className="mx-auto grid max-w-6xl grid-cols-1 items-start gap-10 px-6 py-16 sm:grid-cols-2 md:grid-cols-4 md:px-12">
          {data.endereco && (
            <div>
              <Etiqueta texto={m.endereco} />
              <p data-demo-slot="endereco" className="mt-1 leading-relaxed text-[var(--d-text)]">
                {data.endereco}
              </p>
            </div>
          )}
          {data.horarios && (
            <div>
              <Etiqueta texto={m.horario} />
              <p
                data-demo-slot="horarios"
                className="mt-1 font-[family-name:var(--d-mono)] text-sm leading-loose text-[var(--d-text)]"
              >
                {data.horarios}
              </p>
            </div>
          )}
          {data.telefone && data.telefone !== data.whatsapp && (
            <div>
              <Etiqueta texto={m.telefone} />
              <p data-demo-slot="telefone" className="mt-1 leading-relaxed text-[var(--d-text)]">
                {data.telefone}
              </p>
            </div>
          )}
          {data.instagram && (
            <div>
              <Etiqueta texto={s.contato?.rotulo ?? "Siga"} slot="secoes.contato.rotulo" />
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                data-demo-slot="instagram"
                className="mt-1 inline-block border-b border-[var(--d-border)] pb-0.5 font-[family-name:var(--d-mono)] text-sm text-[var(--d-text)] transition-colors hover:border-[var(--d-accent)] hover:text-[var(--d-accent)]"
              >
                {data.instagram}
              </a>
            </div>
          )}
          <div>
            <a href={agendar} data-demo-slot="whatsapp" className="d-cta inline-block">
              Agendar horário
            </a>
          </div>
        </div>

        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-3 px-6 pb-8 font-[family-name:var(--d-mono)] text-[11px] uppercase tracking-[0.12em] text-[var(--d-muted)] md:px-12">
          <span data-demo-slot="secoes.contato.texto">
            {s.contato?.texto ?? "Feito à mão, como tudo aqui."}
          </span>
          <span data-demo-slot="nome">
            © {new Date().getFullYear()} {data.nome}
          </span>
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
        /* "Chop" da segunda linha do título hero — flourish de carga única,
           independente de theme.animacao (só prefers-reduced-motion desliga),
           mesmo critério do .d-pole da barbearia. */
        @keyframes d-hero-cut { from { transform: translateY(0); } to { transform: translateY(8px); } }
        .d-hero-cut { animation: d-hero-cut 0.3s var(--d-anim-ease) forwards; }
        @media (prefers-reduced-motion: reduce) { .d-hero-cut { animation: none; } }

        /* Lista de serviços: hover expande a descrição e desloca o nome,
           com a "navalha" (linha) crescendo do zero — fiel ao material bruto. */
        .d-servico-desc { transition-duration: var(--d-anim-duration); transition-timing-function: var(--d-anim-ease); }
        .d-servico:hover .d-servico-desc { grid-template-rows: 1fr; }
        .d-servico-nome { transition-duration: var(--d-anim-duration); transition-timing-function: var(--d-anim-ease); }
        .d-servico:hover .d-servico-nome { transform: translateX(12px); }
        .d-servico-razor { transition-duration: var(--d-anim-duration); transition-timing-function: var(--d-anim-ease); }
        .d-servico:hover .d-servico-razor { transform: scaleX(1); }
        @media (prefers-reduced-motion: reduce) {
          .d-servico-nome, .d-servico-razor { transition: none; }
        }

        /* Fotos (galeria/barbeiros): preto-e-branco em repouso, cor no hover
           — fiel ao material bruto ("foto p&b"). */
        .d-foto-img { filter: grayscale(1) brightness(0.85); transition: filter 0.5s var(--d-anim-ease); }
        .d-foto:hover .d-foto-img, .group:hover .d-foto-img { filter: grayscale(0) brightness(1); }
        @media (prefers-reduced-motion: reduce) { .d-foto-img { transition: none; } }

        /* Nome do barbeiro: sublinhado cresce do zero no hover do card. */
        .d-nome-linha { transition: transform 0.5s var(--d-anim-ease); }
        .group:hover .d-nome-linha { transform: scaleX(1); }
        @media (prefers-reduced-motion: reduce) { .d-nome-linha { transition: none; } }

        /* Letreiro (marquee) infinito do rodapé — pausa no hover. */
        @keyframes d-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .d-marquee { animation: d-marquee 40s linear infinite; will-change: transform; }
        .d-marquee-track:hover .d-marquee { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) { .d-marquee { animation: none; } }

        /* CTA sólido (agendamento + rodapé). */
        .d-cta {
          display: inline-block;
          font-family: var(--d-display);
          font-size: 13px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: var(--d-accent-ink);
          background: var(--d-accent);
          border-radius: var(--d-radius);
          padding: 1rem 2rem;
          transition: transform var(--d-anim-duration) var(--d-anim-ease),
            opacity var(--d-anim-duration) var(--d-anim-ease),
            box-shadow var(--d-anim-duration) var(--d-anim-ease);
        }
        .d-cta:hover { opacity: 0.85; transform: scale(var(--d-hover-scale)) translateY(var(--d-hover-lift)); }
        @media (prefers-reduced-motion: reduce) { .d-cta:hover { transform: none; } }

        /* ── Hover do tema (Theme.hover) ── */
        [data-d-hover="zoom"] .d-cta:hover { transform: scale(var(--d-hover-scale)); }
        [data-d-hover="brilho"] .d-cta:hover {
          transform: none;
          box-shadow: 0 0 32px color-mix(in srgb, var(--d-accent) 55%, transparent);
        }
        @media (prefers-reduced-motion: reduce) { [data-d-hover] .d-cta:hover { transform: none; } }

        /* ── Animação de clique (Theme.clique) ── */
        [data-d-clique="pressao"]:not([data-d-anim="nenhuma"]) a:active,
        [data-d-clique="pressao"]:not([data-d-anim="nenhuma"]) button:active {
          transform: scale(0.96); transition-duration: 90ms;
        }
        @keyframes d-clique-pulso { 0% { transform: scale(1); } 40% { transform: scale(1.05); } 100% { transform: scale(1); } }
        [data-d-clique="pulso"]:not([data-d-anim="nenhuma"]) a:active,
        [data-d-clique="pulso"]:not([data-d-anim="nenhuma"]) button:active {
          animation: d-clique-pulso 280ms var(--d-anim-ease);
        }
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

      <IntroExperience
        nome={data.nome}
        accent={paleta.destaque}
        ink={paleta.destaqueInk}
        ativa={theme.intro === true}
      >
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
    </div>
  );
}

function arrTemDuasLinhas(texto: string): boolean {
  return texto.split("\n").length > 1;
}
