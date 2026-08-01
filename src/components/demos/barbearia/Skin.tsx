import Image from "next/image";
import { Fragment, type CSSProperties, type ReactNode } from "react";

import { secoesVisiveis } from "@/lib/demos/estrutura";
import type { Animacao, Densidade, SkinProps } from "@/lib/demos/types";
import { AnimatedScissors } from "./interactive/AnimatedScissors";
import { IntroExperience } from "./interactive/IntroExperience";
import { LedEdges } from "./interactive/LedEdges";
import { ScrollHeader } from "./interactive/ScrollHeader";
import { SectionReveal, type RevealTipo } from "./interactive/SectionReveal";
import { BARBEARIA_SECOES } from "./secoes";
import { TeamCard } from "./interactive/TeamCard";
import { TypewriterText } from "./interactive/TypewriterText";

/**
 * Skin "Barbearia Editorial" — conversão fiel do material bruto
 * (skins-raw/barbearia): editorial escuro com seções numeradas, etiquetas
 * mono, headlines display condensadas, lista de serviços com preço, equipe,
 * citação-ritual, passos de agendamento e contato.
 *
 * Componente PURO: todo texto/imagem vem de `data`, toda cor/fonte/raio/
 * densidade vem de `theme` (aplicado como CSS vars no wrapper). Nenhuma
 * chamada externa — imagens são placeholders locais por slot e o "mapa" é
 * decorativo (o botão de rota é um link comum para o Google Maps).
 *
 * Estrutura editável: as seções renderizam na ordem efetiva de
 * DemoData.ordemSecoes (ver lib/demos/estrutura.ts), respeitam
 * DemoSecao.oculta e alinhamento (onde BARBEARIA_SECOES declara
 * alignOptions). A numeração das seções numeradas ("01 / FILOSOFIA") é
 * recalculada pela ordem visível — reordenar nunca deixa número furado.
 *
 * Os atributos `data-demo-slot` marcam cada texto com o caminho do slot em
 * DemoData — o editor visual usa isso para focar o campo certo ao clicar
 * no preview. São atributos inertes na demo pública.
 */

const SECTION_PAD: Record<Densidade, string> = {
  compacta: "4.5rem",
  confortavel: "7rem",
  arejada: "9rem",
};

/**
 * Intensidade de hover/transição por nível de animação — consumida como
 * CSS vars (`--d-anim-*`) por qualquer elemento com transição na skin
 * (CTA, cards, linhas de serviço). "nenhuma" zera duração e deslocamento:
 * o hover ainda funciona (cor/borda mudam), só não anima.
 */
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

/** Seções que carregam número na etiqueta, na ordem visível. */
const SECOES_NUMERADAS = new Set(["filosofia", "servicos", "equipe", "ritual", "contato"]);

/**
 * Seções cujo título (ou citação, no Ritual) usa máquina de escrever POR
 * DEFAULT — fiel ao material bruto. O override por seção
 * (DemoSecao.animacaoEntrada) liga/desliga isso por cima.
 */
const TYPEWRITER_DEFAULT = new Set(["filosofia", "servicos", "equipe", "ritual", "contato"]);

/** Link wa.me a partir do número exibido; sem número, âncora pro contato. */
function waHref(whatsapp: string | undefined): string {
  const digitos = (whatsapp ?? "").replace(/\D/g, "");
  return digitos ? `https://wa.me/${digitos}` : "#contato";
}

/**
 * Etiqueta de seção. O original alterna dois estilos: "caixa" (borda +
 * fundo com blur — Filosofia/Ritual/Booking/Contato) e texto solto sem
 * caixa (Serviços/Equipe/QuickBooking).
 */
function Etiqueta({
  numero,
  texto,
  caixa,
  slot,
  className = "mb-6",
}: {
  numero?: string;
  texto?: string;
  caixa?: boolean;
  slot?: string;
  className?: string;
}) {
  if (!texto) return null;
  const label = numero ? `${numero} / ${texto}` : texto;
  if (caixa) {
    return (
      <span
        data-demo-slot={slot}
        className={`${className} inline-block border border-[var(--d-accent)]/25 bg-[var(--d-bg)]/40 px-4 py-1.5 font-[family-name:var(--d-mono)] text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--d-accent)] backdrop-blur-sm md:text-xs`}
      >
        {label}
      </span>
    );
  }
  return (
    <span
      data-demo-slot={slot}
      className={`${className} block font-[family-name:var(--d-mono)] text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--d-accent)] md:text-xs`}
    >
      {label}
    </span>
  );
}

/** `animado` reproduz a máquina de escrever do original (só nas seções que a usavam). */
function Headline({ texto, animado, slot }: { texto?: string; animado?: boolean; slot?: string }) {
  if (!texto) return null;
  return (
    <h2
      data-demo-slot={slot}
      className="font-[family-name:var(--d-display)] text-4xl uppercase leading-tight tracking-tight text-[var(--d-text)] md:text-5xl"
    >
      {animado ? <TypewriterText text={texto} triggerOnInView speed={40} /> : texto}
    </h2>
  );
}

/** Ícone do WhatsApp usado no CTA de agendamento rápido (chrome fixo, não dado do lead). */
function WhatsAppIcon() {
  return (
    <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.51 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.717-1.458L0 24zm6.59-4.846c1.6.95 3.1 1.455 4.7 1.456 5.483 0 9.94-4.444 9.943-9.914.002-2.651-1.023-5.143-2.884-7.009C16.486 1.82 14.004.792 11.4.792 5.92.792 1.463 5.235 1.461 10.704c-.001 1.71.463 3.38 1.341 4.904l-.991 3.619 3.731-.975c1.51.82 3.1 1.25 4.8 1.25v-.01zM17.43 14.8c-.3-.15-.1.45-.75-.45-.65-.9-1.15-1.1-1.35-1.15-.2-.05-.35-.05-.5.15-.15.2-.6.75-.75.9-.15.15-.3.15-.6 0-.3-.15-1.25-.45-2.38-1.45-.9-.8-1.5-1.8-1.7-2.1-.2-.3-.02-.45.13-.6.13-.13.3-.35.45-.5.15-.15.2-.25.3-.45.1-.2.05-.35-.02-.5-.07-.15-.65-1.55-.9-2.1-.23-.6-.5-.5-.7-.5h-.6c-.2 0-.5.05-.75.3-.25.25-1 1-1 2.4s1 2.8 1.15 3c.15.2 2 3.05 4.85 4.25.7.3 1.2.5 1.6.65.7.2 1.35.2 1.85.15.55-.08 1.7-.7 1.95-1.35.25-.65.25-1.2.15-1.35-.1-.15-.3-.25-.6-.4z" />
    </svg>
  );
}

function Placeholder({
  src,
  alt,
  sizes,
  priority,
  slot,
}: {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  slot?: string;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      fill
      unoptimized
      data-demo-slot={slot}
      className="object-cover"
      style={{ filter: "contrast(0.95) saturate(0.9)" }}
      sizes={sizes}
      priority={priority}
    />
  );
}

export function BarbeariaEditorial({ data, theme }: SkinProps) {
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
    // Título hero: controles próprios do editor (aba Tema) — "" em
    // heroTitulo.fonte herda fontes.display.
    "--d-hero-font": theme.heroTitulo.fonte || fontes.display,
    "--d-hero-escala": theme.heroTitulo.escala,
    "--d-sec-y": SECTION_PAD[theme.densidade],
    "--d-anim-duration": ANIM_DURATION[theme.animacao],
    "--d-anim-ease": "cubic-bezier(0.16, 1, 0.3, 1)",
    "--d-hover-scale": ANIM_HOVER_SCALE[theme.animacao],
    "--d-hover-lift": ANIM_HOVER_LIFT[theme.animacao],
  } as CSSProperties;
  const HERO_ALINHAMENTO_SELF: Record<string, string> = {
    esquerda: "self-start text-left",
    centro: "self-center text-center",
    direita: "self-end text-right",
  };

  const s = data.secoes;
  const agendar = waHref(data.whatsapp);

  // Estrutura efetiva: ordem + ocultas resolvidas; números pela ordem visível.
  const visiveis = secoesVisiveis(BARBEARIA_SECOES, data);
  const numeros = new Map<string, string>();
  for (const id of visiveis) {
    if (SECOES_NUMERADAS.has(id)) {
      numeros.set(id, String(numeros.size + 1).padStart(2, "0"));
    }
  }
  const centro = (id: string): boolean => s[id]?.alinhamento === "centro";

  /**
   * Animação de entrada resolvida por seção: o override do editor
   * (DemoSecao.animacaoEntrada) vence; sem override vale o default do
   * template. O nível global "nenhuma" desliga tudo (o SectionReveal já
   * se retira sozinho; o typewriter é desligado aqui).
   */
  const entradaDe = (id: string) => s[id]?.animacaoEntrada;
  const typewriter = (id: string): boolean => {
    if (theme.animacao === "nenhuma") return false;
    const entrada = entradaDe(id);
    return entrada === undefined ? TYPEWRITER_DEFAULT.has(id) : entrada === "typewriter";
  };
  // null = sem wrapper. "servicos" sem override fica sem wrapper (sticky
  // interno — ver SectionReveal); com "fade"/"typewriter" o wrapper é só
  // opacidade, que não cria containing block.
  const wrapperTipo = (id: string): RevealTipo | null => {
    const entrada = entradaDe(id);
    if (entrada === undefined) return id === "servicos" ? null : "padrao";
    if (entrada === "nenhuma") return null;
    if (entrada === "deslizar-esquerda") return "esquerda";
    if (entrada === "deslizar-direita") return "direita";
    return "fade"; // "fade" e "typewriter" (typewriter ganha fade no bloco)
  };

  const secoes: Record<string, () => ReactNode> = {
    /* ── Hero (fixa) ─────────────────────────────────────────── */
    hero: () => (
      <section id="topo" className="relative flex min-h-screen items-center overflow-hidden pt-24">
        <div className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-12 px-6 md:grid-cols-[55%_45%]">
          <div className="mt-12 flex flex-col items-start gap-8 md:mt-0">
            <div>
              {data.slogan && (
                <h2
                  data-demo-slot="slogan"
                  className="mb-4 font-[family-name:var(--d-destaque)] text-xl italic text-[var(--d-muted)] md:text-2xl"
                >
                  {data.slogan}
                </h2>
              )}
              <h1
                data-demo-slot="secoes.hero.titulo"
                className={`w-full whitespace-pre-line font-[family-name:var(--d-hero-font)] uppercase leading-[0.9] tracking-tight text-[var(--d-text)] drop-shadow-2xl ${HERO_ALINHAMENTO_SELF[theme.heroTitulo.alinhamento]}`}
                style={{ fontSize: "calc(clamp(3rem, 8vw, 6.5rem) * var(--d-hero-escala))" }}
              >
                <TypewriterText text={s.hero?.titulo ?? data.nome} delay={1800} speed={80} />
              </h1>
            </div>

            {s.hero?.texto && (
              <p
                data-demo-slot="secoes.hero.texto"
                className="max-w-[480px] text-base leading-[1.7] text-[var(--d-text)] md:text-[17px]"
              >
                {s.hero.texto}
              </p>
            )}

            <div className="mt-4 flex flex-col items-center gap-6 sm:flex-row">
              {s.hero?.cta && (
                <a
                  href={agendar}
                  data-demo-slot="secoes.hero.cta"
                  data-cursor="open-scissors"
                  data-cursor-text="AGENDAR →"
                  className="w-full rounded-[var(--d-radius)] bg-[var(--d-accent)] px-8 py-4 text-center font-[family-name:var(--d-display)] text-xs font-bold uppercase tracking-[0.2em] text-[var(--d-accent-ink)] transition-opacity hover:opacity-85 sm:w-auto"
                >
                  {s.hero.cta}
                </a>
              )}
              {s.hero?.ctaSecundaria && (
                <a
                  href="#servicos"
                  data-demo-slot="secoes.hero.ctaSecundaria"
                  className="border-b border-transparent pb-1 font-[family-name:var(--d-mono)] text-xs uppercase tracking-[0.18em] text-[var(--d-text)] transition-colors hover:border-[var(--d-accent)] hover:text-[var(--d-accent)]"
                >
                  {s.hero.ctaSecundaria} →
                </a>
              )}
            </div>

            <div className="mt-8 flex gap-4 text-[var(--d-accent)] opacity-80" aria-hidden>
              <span>★</span>
              <span>★</span>
              <span>★</span>
            </div>
          </div>

          <div
            className="relative h-[60vh] w-full overflow-hidden rounded-[var(--d-radius)] md:h-[80vh]"
            style={{ boxShadow: "0 16px 48px rgba(0,0,0,0.5)" }}
          >
            <Placeholder
              src={data.imagens.hero}
              alt={`Ambiente de ${data.nome}`}
              sizes="(max-width: 768px) 100vw, 45vw"
              priority
              slot="imagens.hero"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--d-bg)]/80 to-transparent" />
          </div>
        </div>
      </section>
    ),

    /* ── Agendamento rápido (QuickBooking) ──────────────────── */
    agendamentoRapido: () =>
      s.agendamentoRapido && (
        <section className="relative border-b border-[var(--d-border)] bg-[var(--d-bg-elev)] py-[60px] md:py-[80px]">
          <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-6 md:grid-cols-[60%_40%]">
            <div className="flex flex-col items-start gap-5">
              <Etiqueta
                texto={s.agendamentoRapido.rotulo}
                slot="secoes.agendamentoRapido.rotulo"
                className="mb-0"
              />
              <div className="space-y-2">
                <h2
                  data-demo-slot="secoes.agendamentoRapido.titulo"
                  className="font-[family-name:var(--d-display)] uppercase leading-[0.95] tracking-tight text-[var(--d-text)]"
                  style={{ fontSize: "clamp(2.5rem, 6vw, 4rem)" }}
                >
                  {s.agendamentoRapido.titulo}
                </h2>
                {s.agendamentoRapido.texto && (
                  <p
                    data-demo-slot="secoes.agendamentoRapido.texto"
                    className="font-[family-name:var(--d-citacao)] text-base italic text-[var(--d-muted)] md:text-lg"
                  >
                    {s.agendamentoRapido.texto}
                  </p>
                )}
              </div>

              <div className="mt-2 flex flex-col gap-2">
                {data.endereco && (
                  <p
                    data-demo-slot="endereco"
                    className="text-[17px] font-medium leading-relaxed text-[var(--d-text)]"
                  >
                    {data.endereco}
                  </p>
                )}
                {data.horarios && (
                  <p
                    data-demo-slot="horarios"
                    className="font-[family-name:var(--d-mono)] text-xs uppercase tracking-wider text-[var(--d-accent)]"
                  >
                    {data.horarios}
                  </p>
                )}
              </div>

              {s.agendamentoRapido.cta && (
                <div className="mt-4 w-full sm:w-auto">
                  <a
                    href={agendar}
                    data-demo-slot="secoes.agendamentoRapido.cta"
                    data-cursor="open-scissors"
                    data-cursor-text="AGENDAR →"
                    className="d-cta inline-flex w-full items-center justify-center gap-3 sm:w-auto"
                  >
                    <WhatsAppIcon />
                    <span>{s.agendamentoRapido.cta} →</span>
                  </a>
                </div>
              )}
            </div>

            <div
              className="relative aspect-square w-full overflow-hidden border border-[var(--d-accent)]/25 md:aspect-[4/3]"
              style={{ boxShadow: "0 16px 48px rgba(0,0,0,0.6)" }}
            >
              <Placeholder
                src={data.imagens["agendamento-rapido"] ?? data.imagens.hero}
                alt="Cliente sendo atendido na cadeira"
                sizes="(max-width: 768px) 100vw, 40vw"
                slot="imagens.agendamento-rapido"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--d-bg)]/70 to-transparent" />
            </div>
          </div>
        </section>
      ),

    /* ── Filosofia ──────────────────────────────────────────── */
    filosofia: () =>
      s.filosofia && (
        <section className="border-b border-[var(--d-border)] py-[var(--d-sec-y)]">
          <div className={`mx-auto max-w-7xl px-6 ${centro("filosofia") ? "text-center" : ""}`}>
            <Etiqueta
              numero={numeros.get("filosofia")}
              texto={s.filosofia.rotulo}
              slot="secoes.filosofia.rotulo"
              caixa
              className="mb-8"
            />
            <div className="mb-16">
              <Headline
                texto={s.filosofia.titulo}
                slot="secoes.filosofia.titulo"
                animado={typewriter("filosofia")}
              />
            </div>
            <div className="grid gap-12 md:grid-cols-3">
              {(s.filosofia.itens ?? []).map((pilar, i) => (
                <div
                  key={pilar.titulo}
                  className={`flex flex-col gap-4 ${centro("filosofia") ? "items-center" : ""}`}
                >
                  {pilar.subtitulo && (
                    <span
                      data-demo-slot={`secoes.filosofia.itens.${i}.subtitulo`}
                      className="font-[family-name:var(--d-mono)] text-sm text-[var(--d-accent)]"
                    >
                      {pilar.subtitulo}
                    </span>
                  )}
                  <h3
                    data-demo-slot={`secoes.filosofia.itens.${i}.titulo`}
                    className="font-[family-name:var(--d-display)] text-2xl uppercase tracking-tight text-[var(--d-text)] md:text-3xl"
                  >
                    {pilar.titulo}
                  </h3>
                  {pilar.texto && (
                    <p
                      data-demo-slot={`secoes.filosofia.itens.${i}.texto`}
                      className="text-sm leading-[1.7] text-[var(--d-muted)] md:text-base"
                    >
                      {pilar.texto}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      ),

    /* ── Serviços ───────────────────────────────────────────── */
    servicos: () => (
      <section
        id="servicos"
        className="relative border-b border-[var(--d-border)] bg-[var(--d-bg)] py-[var(--d-sec-y)]"
      >
        <div className="mx-auto grid max-w-7xl gap-12 px-6 md:grid-cols-12">
          <div className="md:col-span-4">
            <div className="sticky top-32 flex flex-col gap-6">
              <div>
                <Etiqueta
                  numero={numeros.get("servicos")}
                  texto={s.servicos?.rotulo}
                  slot="secoes.servicos.rotulo"
                />
                <div className="mb-8">
                  <Headline
                    texto={s.servicos?.titulo}
                    slot="secoes.servicos.titulo"
                    animado={typewriter("servicos")}
                  />
                </div>
              </div>
              <div
                className="relative aspect-[4/3] w-full overflow-hidden rounded-[var(--d-radius)] border border-[var(--d-border)] md:aspect-[3/4]"
                style={{ boxShadow: "0 16px 48px rgba(0,0,0,0.5)" }}
              >
                <Placeholder
                  src={data.imagens.servicos}
                  alt="Ferramentas do ofício"
                  sizes="(max-width: 768px) 100vw, 25vw"
                  slot="imagens.servicos"
                />
              </div>
            </div>
          </div>

          <div className="md:col-span-8">
            <div className="flex flex-col border-t border-[var(--d-border)]">
              {data.servicos.map((servico, i) => (
                <div
                  key={servico.nome}
                  data-cursor="comb"
                  data-cursor-text="AGENDAR ESSE →"
                  className="group flex flex-col border-b border-[var(--d-border)] py-8 transition-[color,border-color] duration-[var(--d-anim-duration)] hover:border-[var(--d-accent)]/60"
                >
                  <div className="mb-3 flex items-baseline justify-between gap-4">
                    <h3
                      data-demo-slot={`servicos.${i}.nome`}
                      className="font-[family-name:var(--d-display)] text-2xl uppercase tracking-tight text-[var(--d-text)] transition-colors duration-[var(--d-anim-duration)] group-hover:text-[var(--d-accent)] md:text-3xl"
                    >
                      {servico.nome}
                    </h3>
                    <span
                      data-demo-slot={`servicos.${i}.preco`}
                      className="font-[family-name:var(--d-mono)] text-sm font-medium tracking-wider text-[var(--d-accent)]"
                    >
                      {servico.preco}
                    </span>
                  </div>
                  {servico.descricao && (
                    <p
                      data-demo-slot={`servicos.${i}.descricao`}
                      className="max-w-xl text-sm leading-[1.7] text-[var(--d-muted)] md:text-base"
                    >
                      {servico.descricao}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    ),

    /* ── Equipe ─────────────────────────────────────────────── */
    equipe: () =>
      s.equipe &&
      (s.equipe.itens?.length ?? 0) > 0 && (
        <section id="equipe" className="bg-[var(--d-bg-alt)] py-[var(--d-sec-y)]">
          <div className="mx-auto max-w-7xl px-6">
            <div
              className={`mb-20 flex items-start ${
                centro("equipe") ? "justify-center text-center" : "justify-between"
              }`}
            >
              <div>
                <Etiqueta
                  numero={numeros.get("equipe")}
                  texto={s.equipe.rotulo}
                  slot="secoes.equipe.rotulo"
                />
                <Headline
                  texto={s.equipe.titulo}
                  slot="secoes.equipe.titulo"
                  animado={typewriter("equipe")}
                />
              </div>
              {!centro("equipe") && (
                <div className="hidden md:block">
                  <AnimatedScissors />
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {(s.equipe.itens ?? []).map((membro, i) => (
                <div key={membro.titulo} data-demo-slot={`secoes.equipe.itens.${i}.titulo`}>
                  <TeamCard
                    imageSrc={data.imagens[`equipe-${i + 1}`] ?? data.imagens.hero}
                    alt={membro.titulo}
                    nome={membro.titulo}
                    subtitulo={membro.subtitulo}
                    detalhe={membro.detalhe}
                    bio={membro.texto}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      ),

    /* ── Ritual (citação) ───────────────────────────────────── */
    ritual: () =>
      s.ritual?.texto && (
        <section className="border-y border-[var(--d-border)] bg-[var(--d-bg)] py-[var(--d-sec-y)] text-center">
          <div className="mx-auto flex max-w-4xl flex-col items-center px-6">
            <Etiqueta
              numero={numeros.get("ritual")}
              texto={s.ritual.rotulo ?? "RITUAL"}
              slot="secoes.ritual.rotulo"
              caixa
              className="mb-12"
            />
            <p
              data-demo-slot="secoes.ritual.texto"
              className="mb-12 font-[family-name:var(--d-citacao)] text-3xl italic leading-snug text-[var(--d-text)] md:text-4xl"
            >
              &ldquo;
              {typewriter("ritual") ? (
                <TypewriterText text={s.ritual.texto} triggerOnInView speed={50} />
              ) : (
                s.ritual.texto
              )}
              &rdquo;
            </p>
            {/* Acento raro (accent-3 = forest no original) — a única linha decorativa fora da paleta principal. */}
            <div className="mb-12 h-px w-20 bg-[var(--d-accent-3)]" />
            {s.ritual.ctaSecundaria && (
              <span
                data-demo-slot="secoes.ritual.ctaSecundaria"
                className="font-[family-name:var(--d-mono)] text-[11px] uppercase tracking-[0.2em] text-[var(--d-muted)]"
              >
                {s.ritual.ctaSecundaria}
              </span>
            )}
          </div>
        </section>
      ),

    /* ── Depoimentos ────────────────────────────────────────── */
    depoimentos: () =>
      data.depoimentos.length > 0 && (
        <section className="bg-[var(--d-bg-alt)] py-[var(--d-sec-y)]">
          <div className="mx-auto max-w-7xl px-6">
            <div className={`mb-16 ${centro("depoimentos") ? "text-center" : ""}`}>
              {/* Sem número de seção: seção adicional, não existe no material bruto original. */}
              <Etiqueta texto={s.depoimentos?.rotulo} slot="secoes.depoimentos.rotulo" />
              <Headline
                texto={s.depoimentos?.titulo}
                slot="secoes.depoimentos.titulo"
                animado={typewriter("depoimentos")}
              />
            </div>
            <div className="grid gap-8 md:grid-cols-3">
              {data.depoimentos.map((dep, i) => (
                <figure
                  key={dep.autor}
                  className="d-card-hover flex h-full flex-col justify-between gap-6 rounded-[var(--d-radius)] border border-[var(--d-border)] bg-[var(--d-bg)] p-8"
                >
                  <div>
                    {dep.nota !== undefined && (
                      <div
                        className="mb-4 tracking-[0.3em] text-[var(--d-accent)]"
                        aria-label={`${dep.nota} de 5 estrelas`}
                      >
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

    /* ── Agendamento ────────────────────────────────────────── */
    agendamento: () =>
      s.agendamento && (
        <section
          id="agendar"
          className="border-y border-[var(--d-border)] bg-[var(--d-bg)] py-[var(--d-sec-y)]"
        >
          <div className={`mx-auto max-w-7xl px-6 ${centro("agendamento") ? "text-center" : ""}`}>
            <div className="mb-16">
              {/* Sem número: "COMO FUNCIONA" também é sem número no original. */}
              <Etiqueta texto={s.agendamento.rotulo} slot="secoes.agendamento.rotulo" caixa />
              <Headline
                texto={s.agendamento.titulo}
                slot="secoes.agendamento.titulo"
                animado={typewriter("agendamento")}
              />
            </div>
            <div className="mb-16 grid gap-12 md:grid-cols-3">
              {(s.agendamento.itens ?? []).map((passo, i) => (
                <div
                  key={passo.titulo}
                  className={`flex flex-col gap-3 ${centro("agendamento") ? "items-center" : ""}`}
                >
                  {passo.subtitulo && (
                    <span
                      data-demo-slot={`secoes.agendamento.itens.${i}.subtitulo`}
                      className="font-[family-name:var(--d-mono)] text-sm text-[var(--d-accent)]"
                    >
                      {passo.subtitulo}
                    </span>
                  )}
                  <h3
                    data-demo-slot={`secoes.agendamento.itens.${i}.titulo`}
                    className="font-[family-name:var(--d-display)] text-2xl uppercase tracking-tight text-[var(--d-text)]"
                  >
                    {passo.titulo}
                  </h3>
                  {passo.texto && (
                    <p
                      data-demo-slot={`secoes.agendamento.itens.${i}.texto`}
                      className="text-sm leading-[1.7] text-[var(--d-muted)] md:text-base"
                    >
                      {passo.texto}
                    </p>
                  )}
                </div>
              ))}
            </div>
            {s.agendamento.cta && (
              <div className="flex justify-center">
                <a
                  href={agendar}
                  data-demo-slot="secoes.agendamento.cta"
                  data-cursor="open-scissors"
                  data-cursor-text="AGENDAR →"
                  className="d-cta inline-flex items-center justify-center gap-3"
                >
                  <span>{s.agendamento.cta}</span>
                  <span>→</span>
                </a>
              </div>
            )}
          </div>
        </section>
      ),

    /* ── Contato ────────────────────────────────────────────── */
    contato: () => (
      <section
        id="contato"
        data-cursor="shaving-machine"
        data-cursor-text="FALE CONOSCO →"
        className="bg-[var(--d-bg-elev)] py-[var(--d-sec-y)]"
      >
        <div className="mx-auto grid max-w-7xl items-center gap-16 px-6 md:grid-cols-2 md:gap-24">
          <div className="flex flex-col items-start">
            <Etiqueta
              numero={numeros.get("contato")}
              texto={s.contato?.rotulo ?? "CONTATO"}
              slot="secoes.contato.rotulo"
              caixa
              className="mb-8"
            />
            <div className="mb-12">
              <Headline
                texto={s.contato?.titulo}
                slot="secoes.contato.titulo"
                animado={typewriter("contato")}
              />
            </div>

            <div className="flex w-full flex-col gap-8">
              {data.endereco && (
                <div className="flex w-full flex-col border-b border-[var(--d-border)] pb-6">
                  <span className="mb-2 font-[family-name:var(--d-mono)] text-[11px] font-medium tracking-widest text-[var(--d-accent)]">
                    ENDEREÇO
                  </span>
                  <p
                    data-demo-slot="endereco"
                    className="font-[family-name:var(--d-display)] text-2xl tracking-wide text-[var(--d-text)] md:text-3xl"
                  >
                    {data.endereco}
                  </p>
                </div>
              )}
              {data.horarios && (
                <div className="flex w-full flex-col border-b border-[var(--d-border)] pb-6">
                  <span className="mb-2 font-[family-name:var(--d-mono)] text-[11px] font-medium tracking-widest text-[var(--d-accent)]">
                    HORÁRIO
                  </span>
                  <p
                    data-demo-slot="horarios"
                    className="font-[family-name:var(--d-display)] text-2xl tracking-wide text-[var(--d-text)] md:text-3xl"
                  >
                    {data.horarios}
                  </p>
                </div>
              )}
              {data.whatsapp && (
                <div className="flex w-full flex-col border-b border-[var(--d-border)] pb-6">
                  <span className="mb-2 font-[family-name:var(--d-mono)] text-[11px] font-medium tracking-widest text-[var(--d-accent)]">
                    WHATSAPP
                  </span>
                  <a
                    href={agendar}
                    data-demo-slot="whatsapp"
                    className="font-[family-name:var(--d-mono)] text-lg text-[var(--d-text)] hover:text-[var(--d-accent)] md:text-xl"
                  >
                    {data.whatsapp}
                  </a>
                </div>
              )}
              {data.telefone && data.telefone !== data.whatsapp && (
                <div className="flex w-full flex-col border-b border-[var(--d-border)] pb-6">
                  <span className="mb-2 font-[family-name:var(--d-mono)] text-[11px] font-medium tracking-widest text-[var(--d-accent)]">
                    TELEFONE
                  </span>
                  <p
                    data-demo-slot="telefone"
                    className="font-[family-name:var(--d-mono)] text-lg text-[var(--d-text)] md:text-xl"
                  >
                    {data.telefone}
                  </p>
                </div>
              )}
              {data.instagram && (
                <div className="flex w-full flex-col">
                  <span className="mb-2 font-[family-name:var(--d-mono)] text-[11px] font-medium tracking-widest text-[var(--d-accent)]">
                    INSTAGRAM
                  </span>
                  <p
                    data-demo-slot="instagram"
                    className="font-[family-name:var(--d-mono)] text-lg text-[var(--d-text)] md:text-xl"
                  >
                    {data.instagram}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Mapa decorativo (placeholder local — nenhum embed externo). */}
          <div className="group relative aspect-square w-full overflow-hidden rounded-[var(--d-radius)] border border-[var(--d-border)] bg-[var(--d-bg)] p-2 shadow-2xl md:aspect-[4/5]">
            <div className="relative h-full w-full opacity-80 transition-opacity group-hover:opacity-100">
              <Placeholder
                src={data.imagens.mapa}
                alt={data.endereco ? `Mapa de ${data.endereco}` : "Mapa"}
                sizes="(max-width: 768px) 100vw, 50vw"
                slot="imagens.mapa"
              />
            </div>
            {data.endereco && s.contato?.cta && (
              <div className="absolute inset-x-8 bottom-8 z-30">
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(data.endereco)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-demo-slot="secoes.contato.cta"
                  data-cursor="open-scissors"
                  data-cursor-text="TRAÇAR ROTA"
                  className="block w-full rounded-[var(--d-radius)] border border-[var(--d-accent)]/30 bg-[var(--d-bg-alt)]/90 px-6 py-4 text-center font-[family-name:var(--d-mono)] text-[11px] font-medium tracking-widest text-[var(--d-text)] backdrop-blur-sm transition-colors hover:bg-[var(--d-accent)] hover:text-[var(--d-accent-ink)]"
                >
                  {s.contato.cta} →
                </a>
              </div>
            )}
          </div>
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
      className="min-h-screen overflow-x-clip bg-[var(--d-bg)] font-[family-name:var(--d-corpo)] text-[var(--d-text)]"
    >
      {/* Keyframes do poste de barbeiro — escopo próprio da skin. */}
      <style>{`
        @keyframes d-pole { 0% { background-position: 0 0; } 100% { background-position: 40px 0; } }
        .d-pole {
          animation: d-pole 2s linear infinite;
          background-image: linear-gradient(45deg,
            var(--d-accent-2) 25%, var(--d-text) 25%, var(--d-text) 50%,
            var(--d-accent-3) 50%, var(--d-accent-3) 75%, var(--d-accent-2) 75%);
          background-size: 40px 4px;
          background-repeat: repeat-x;
        }
        @media (prefers-reduced-motion: reduce) { .d-pole { animation: none; } }

        /* Pílula de CTA do WhatsApp (QuickBooking + Agendamento). */
        .d-cta {
          font-family: var(--d-display);
          font-size: 18px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--d-accent-ink);
          background: var(--d-accent);
          padding: 20px 40px;
          box-shadow: 0 8px 24px color-mix(in srgb, var(--d-accent) 30%, transparent);
          transition: transform var(--d-anim-duration) var(--d-anim-ease),
            box-shadow var(--d-anim-duration) var(--d-anim-ease);
        }
        .d-cta:hover {
          transform: scale(var(--d-hover-scale)) translateY(var(--d-hover-lift));
          box-shadow: 0 8px 24px color-mix(in srgb, var(--d-accent) 40%, transparent);
        }
        @media (prefers-reduced-motion: reduce) { .d-cta:hover { transform: none; } }

        /* Lift genérico de card (depoimentos) — intensidade por --d-hover-*. */
        .d-card-hover {
          transition: transform var(--d-anim-duration) var(--d-anim-ease),
            box-shadow var(--d-anim-duration) var(--d-anim-ease),
            border-color var(--d-anim-duration) var(--d-anim-ease);
        }
        .d-card-hover:hover {
          transform: translateY(var(--d-hover-lift));
        }
        @media (prefers-reduced-motion: reduce) { .d-card-hover:hover { transform: none; } }

        /* ── Hover do tema (Theme.hover) ─────────────────────────
           "lift" é o default acima; "zoom" e "brilho" sobrescrevem.
           A intensidade continua vindo de --d-hover-* (nível global):
           em "nenhuma" scale=1/lift=0 neutralizam o movimento. */
        [data-d-hover="zoom"] .d-cta:hover {
          transform: scale(var(--d-hover-scale));
        }
        [data-d-hover="zoom"] .d-card-hover:hover {
          transform: scale(var(--d-hover-scale));
        }
        [data-d-hover="brilho"] .d-cta:hover {
          transform: none;
          box-shadow: 0 0 32px color-mix(in srgb, var(--d-accent) 55%, transparent);
        }
        [data-d-hover="brilho"] .d-card-hover:hover {
          transform: none;
          box-shadow: 0 0 24px color-mix(in srgb, var(--d-accent) 30%, transparent);
          border-color: color-mix(in srgb, var(--d-accent) 45%, transparent);
        }
        @media (prefers-reduced-motion: reduce) {
          [data-d-hover] .d-cta:hover, [data-d-hover] .d-card-hover:hover { transform: none; }
        }

        /* ── Animação de clique (Theme.clique) ───────────────────
           Só transform, custo zero; desligada no nível global "nenhuma"
           e em prefers-reduced-motion. */
        [data-d-clique="pressao"]:not([data-d-anim="nenhuma"]) a:active,
        [data-d-clique="pressao"]:not([data-d-anim="nenhuma"]) button:active {
          transform: scale(0.96);
          transition-duration: 90ms;
        }
        @keyframes d-clique-pulso {
          0% { transform: scale(1); }
          40% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
        [data-d-clique="pulso"]:not([data-d-anim="nenhuma"]) a:active,
        [data-d-clique="pulso"]:not([data-d-anim="nenhuma"]) button:active {
          animation: d-clique-pulso 280ms var(--d-anim-ease);
        }
        @media (prefers-reduced-motion: reduce) {
          [data-d-clique] a:active, [data-d-clique] button:active {
            transform: none;
            animation: none;
          }
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

      <LedEdges preset={theme.led} />

      <IntroExperience
        nome={data.nome}
        cidade={data.cidade}
        accent={paleta.destaque}
        ativa={theme.intro !== false}
      >
      {/* ── Header ─────────────────────────────────────────────── */}
      <ScrollHeader
        nome={data.nome}
        ctaHref="#agendar"
        links={[
          s.servicos?.rotulo && { href: "#servicos", label: s.servicos.rotulo },
          s.equipe?.rotulo && { href: "#equipe", label: s.equipe.rotulo },
          s.contato?.rotulo && { href: "#contato", label: s.contato.rotulo },
        ].filter((link): link is { href: string; label: string } => Boolean(link))}
      />

      {/* Seções na ordem efetiva (DemoData.ordemSecoes), sem as ocultas,
          cada uma com a animação de entrada resolvida (override do editor
          ← default do template). "servicos" sem override fica sem wrapper:
          tem sidebar `position: sticky` por dentro, que um wrapper com
          transform quebraria — só "fade"/"typewriter" (sem transform) são
          oferecidos para ela (ver secoes.ts e SectionReveal.tsx). */}
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

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="relative overflow-hidden border-t border-[var(--d-border)] bg-[var(--d-bg)] py-24 text-center md:py-32">
        <div className="d-pole absolute inset-x-0 top-0 h-1 opacity-60 md:h-1.5" aria-hidden />
        <div className="mx-auto flex max-w-4xl flex-col items-center px-6">
          <h2
            data-demo-slot="nome"
            className="mb-6 font-[family-name:var(--d-deco)] leading-none text-[var(--d-accent)]"
            style={{ fontSize: "clamp(3rem, 6vw, 5rem)", letterSpacing: "0.08em" }}
          >
            {data.nome}
          </h2>
          {(data.cidade || data.endereco) && (
            <p
              data-demo-slot={data.cidade ? "cidade" : "endereco"}
              className="mb-12 font-[family-name:var(--d-mono)] text-xs font-medium uppercase tracking-[0.2em] text-[var(--d-muted)] md:text-sm"
            >
              {data.cidade ?? data.endereco}
            </p>
          )}
          {data.slogan && (
            <p
              data-demo-slot="slogan"
              className="mb-24 font-[family-name:var(--d-citacao)] text-lg italic text-[var(--d-muted)] md:text-xl"
            >
              &ldquo;{data.slogan}&rdquo;
            </p>
          )}
          <div className="flex w-full flex-col items-center justify-center border-t border-[var(--d-border)] pt-8 font-[family-name:var(--d-mono)] text-[10px] font-medium tracking-widest text-[var(--d-muted)]">
            <span>
              © {new Date().getFullYear()} {data.nome}. TODOS OS DIREITOS RESERVADOS.
            </span>
          </div>
        </div>
      </footer>
      </IntroExperience>
    </div>
  );
}
