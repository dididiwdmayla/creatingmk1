import Image from "next/image";
import type { CSSProperties } from "react";

import type { Densidade, SkinProps } from "@/lib/demos/types";
import { ScrollHeader } from "./interactive/ScrollHeader";
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
 */

const SECTION_PAD: Record<Densidade, string> = {
  compacta: "4.5rem",
  confortavel: "7rem",
  arejada: "9rem",
};

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
  className = "mb-6",
}: {
  numero?: string;
  texto?: string;
  caixa?: boolean;
  className?: string;
}) {
  if (!texto) return null;
  const label = numero ? `${numero} / ${texto}` : texto;
  if (caixa) {
    return (
      <span
        className={`${className} inline-block border border-[var(--d-accent)]/25 bg-[var(--d-bg)]/40 px-4 py-1.5 font-[family-name:var(--d-mono)] text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--d-accent)] backdrop-blur-sm md:text-xs`}
      >
        {label}
      </span>
    );
  }
  return (
    <span
      className={`${className} block font-[family-name:var(--d-mono)] text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--d-accent)] md:text-xs`}
    >
      {label}
    </span>
  );
}

/** `animado` reproduz a máquina de escrever do original (só nas seções que a usavam). */
function Headline({ texto, animado }: { texto?: string; animado?: boolean }) {
  if (!texto) return null;
  return (
    <h2 className="font-[family-name:var(--d-display)] text-4xl uppercase leading-tight tracking-tight text-[var(--d-text)] md:text-5xl">
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
}: {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      fill
      unoptimized
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
    "--d-sec-y": SECTION_PAD[theme.densidade],
  } as CSSProperties;

  const s = data.secoes;
  const agendar = waHref(data.whatsapp);

  return (
    <div
      style={vars}
      className="min-h-screen bg-[var(--d-bg)] font-[family-name:var(--d-corpo)] text-[var(--d-text)]"
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
          transition: transform 0.3s, box-shadow 0.3s;
        }
        .d-cta:hover {
          transform: scale(1.03);
          box-shadow: 0 8px 24px color-mix(in srgb, var(--d-accent) 40%, transparent);
        }
        @media (prefers-reduced-motion: reduce) { .d-cta:hover { transform: none; } }
      `}</style>

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

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section id="topo" className="relative flex min-h-screen items-center overflow-hidden pt-24">
        <div className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-12 px-6 md:grid-cols-[55%_45%]">
          <div className="mt-12 flex flex-col items-start gap-8 md:mt-0">
            <div>
              {data.slogan && (
                <h2 className="mb-4 font-[family-name:var(--d-destaque)] text-xl italic text-[var(--d-muted)] md:text-2xl">
                  {data.slogan}
                </h2>
              )}
              <h1
                className="font-[family-name:var(--d-display)] uppercase leading-[0.9] tracking-tight text-[var(--d-text)] drop-shadow-2xl"
                style={{ fontSize: "clamp(3rem, 8vw, 6.5rem)" }}
              >
                <TypewriterText text={s.hero?.titulo ?? data.nome} delay={1800} speed={80} />
              </h1>
            </div>

            {s.hero?.texto && (
              <p className="max-w-[480px] text-base leading-[1.7] text-[var(--d-text)] md:text-[17px]">
                {s.hero.texto}
              </p>
            )}

            <div className="mt-4 flex flex-col items-center gap-6 sm:flex-row">
              {s.hero?.cta && (
                <a
                  href={agendar}
                  className="w-full rounded-[var(--d-radius)] bg-[var(--d-accent)] px-8 py-4 text-center font-[family-name:var(--d-display)] text-xs font-bold uppercase tracking-[0.2em] text-[var(--d-accent-ink)] transition-opacity hover:opacity-85 sm:w-auto"
                >
                  {s.hero.cta}
                </a>
              )}
              {s.hero?.ctaSecundaria && (
                <a
                  href="#servicos"
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
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--d-bg)]/80 to-transparent" />
          </div>
        </div>
      </section>

      {/* ── Agendamento rápido (QuickBooking) ──────────────────── */}
      {s.agendamentoRapido && (
        <section className="relative border-b border-[var(--d-border)] bg-[var(--d-bg-elev)] py-[60px] md:py-[80px]">
          <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-6 md:grid-cols-[60%_40%]">
            <div className="flex flex-col items-start gap-5">
              <Etiqueta texto={s.agendamentoRapido.rotulo} className="mb-0" />
              <div className="space-y-2">
                <h2
                  className="font-[family-name:var(--d-display)] uppercase leading-[0.95] tracking-tight text-[var(--d-text)]"
                  style={{ fontSize: "clamp(2.5rem, 6vw, 4rem)" }}
                >
                  {s.agendamentoRapido.titulo}
                </h2>
                {s.agendamentoRapido.texto && (
                  <p className="font-[family-name:var(--d-citacao)] text-base italic text-[var(--d-muted)] md:text-lg">
                    {s.agendamentoRapido.texto}
                  </p>
                )}
              </div>

              <div className="mt-2 flex flex-col gap-2">
                {data.endereco && (
                  <p className="text-[17px] font-medium leading-relaxed text-[var(--d-text)]">
                    {data.endereco}
                  </p>
                )}
                {data.horarios && (
                  <p className="font-[family-name:var(--d-mono)] text-xs uppercase tracking-wider text-[var(--d-accent)]">
                    {data.horarios}
                  </p>
                )}
              </div>

              {s.agendamentoRapido.cta && (
                <div className="mt-4 w-full sm:w-auto">
                  <a href={agendar} className="d-cta inline-flex w-full items-center justify-center gap-3 sm:w-auto">
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
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--d-bg)]/70 to-transparent" />
            </div>
          </div>
        </section>
      )}

      {/* ── Filosofia ──────────────────────────────────────────── */}
      {s.filosofia && (
        <section className="border-b border-[var(--d-border)] py-[var(--d-sec-y)]">
          <div className="mx-auto max-w-7xl px-6">
            <Etiqueta numero="01" texto={s.filosofia.rotulo} caixa className="mb-8" />
            <div className="mb-16">
              <Headline texto={s.filosofia.titulo} animado />
            </div>
            <div className="grid gap-12 md:grid-cols-3">
              {(s.filosofia.itens ?? []).map((pilar) => (
                <div key={pilar.titulo} className="flex flex-col gap-4">
                  {pilar.subtitulo && (
                    <span className="font-[family-name:var(--d-mono)] text-sm text-[var(--d-accent)]">
                      {pilar.subtitulo}
                    </span>
                  )}
                  <h3 className="font-[family-name:var(--d-display)] text-2xl uppercase tracking-tight text-[var(--d-text)] md:text-3xl">
                    {pilar.titulo}
                  </h3>
                  {pilar.texto && (
                    <p className="text-sm leading-[1.7] text-[var(--d-muted)] md:text-base">
                      {pilar.texto}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Serviços ───────────────────────────────────────────── */}
      <section id="servicos" className="relative border-b border-[var(--d-border)] bg-[var(--d-bg)] py-[var(--d-sec-y)]">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 md:grid-cols-12">
          <div className="md:col-span-4">
            <div className="sticky top-32 flex flex-col gap-6">
              <div>
                <Etiqueta numero="02" texto={s.servicos?.rotulo} />
                <div className="mb-8">
                  <Headline texto={s.servicos?.titulo} animado />
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
                />
              </div>
            </div>
          </div>

          <div className="md:col-span-8">
            <div className="flex flex-col border-t border-[var(--d-border)]">
              {data.servicos.map((servico) => (
                <div
                  key={servico.nome}
                  className="group flex flex-col border-b border-[var(--d-border)] py-8 transition-colors hover:border-[var(--d-accent)]/60"
                >
                  <div className="mb-3 flex items-baseline justify-between gap-4">
                    <h3 className="font-[family-name:var(--d-display)] text-2xl uppercase tracking-tight text-[var(--d-text)] transition-colors group-hover:text-[var(--d-accent)] md:text-3xl">
                      {servico.nome}
                    </h3>
                    <span className="font-[family-name:var(--d-mono)] text-sm font-medium tracking-wider text-[var(--d-accent)]">
                      {servico.preco}
                    </span>
                  </div>
                  {servico.descricao && (
                    <p className="max-w-xl text-sm leading-[1.7] text-[var(--d-muted)] md:text-base">
                      {servico.descricao}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Equipe ─────────────────────────────────────────────── */}
      {s.equipe && (s.equipe.itens?.length ?? 0) > 0 && (
        <section id="equipe" className="bg-[var(--d-bg-alt)] py-[var(--d-sec-y)]">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mb-20">
              <Etiqueta numero="03" texto={s.equipe.rotulo} />
              <Headline texto={s.equipe.titulo} animado />
            </div>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {(s.equipe.itens ?? []).map((membro, i) => (
                <div
                  key={membro.titulo}
                  className="group flex h-full flex-col overflow-hidden rounded-[var(--d-radius)] border border-[var(--d-border)] bg-[var(--d-bg)] p-4 pb-8 transition-transform duration-500 hover:-translate-y-2"
                  style={{ boxShadow: "0 16px 48px rgba(0,0,0,0.4)" }}
                >
                  <div className="relative mb-6 aspect-[3/4] w-full overflow-hidden rounded-[var(--d-radius)]">
                    <Placeholder
                      src={data.imagens[`equipe-${i + 1}`] ?? data.imagens.hero}
                      alt={membro.titulo}
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--d-bg)] to-transparent" />
                  </div>
                  <div className="px-2">
                    <h3 className="mb-1 font-[family-name:var(--d-display)] text-3xl tracking-tight text-[var(--d-text)] transition-colors group-hover:text-[var(--d-accent)] md:text-4xl">
                      {membro.titulo}
                    </h3>
                    {membro.subtitulo && (
                      <span className="mb-4 block font-[family-name:var(--d-mono)] text-[10px] font-medium uppercase tracking-widest text-[var(--d-accent)] md:text-xs">
                        {membro.subtitulo}
                      </span>
                    )}
                    {membro.texto && (
                      <p className="font-[family-name:var(--d-serif)] text-sm leading-[1.7] text-[var(--d-muted)] md:text-base">
                        {membro.texto}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Ritual (citação) ───────────────────────────────────── */}
      {s.ritual?.texto && (
        <section className="border-y border-[var(--d-border)] bg-[var(--d-bg)] py-[var(--d-sec-y)] text-center">
          <div className="mx-auto flex max-w-4xl flex-col items-center px-6">
            <Etiqueta numero="04" texto={s.ritual.rotulo ?? "RITUAL"} caixa className="mb-12" />
            <p className="mb-12 font-[family-name:var(--d-citacao)] text-3xl italic leading-snug text-[var(--d-text)] md:text-4xl">
              &ldquo;<TypewriterText text={s.ritual.texto} triggerOnInView speed={50} />&rdquo;
            </p>
            {/* Acento raro (accent-3 = forest no original) — a única linha decorativa fora da paleta principal. */}
            <div className="mb-12 h-px w-20 bg-[var(--d-accent-3)]" />
            {s.ritual.ctaSecundaria && (
              <span className="font-[family-name:var(--d-mono)] text-[11px] uppercase tracking-[0.2em] text-[var(--d-muted)]">
                {s.ritual.ctaSecundaria}
              </span>
            )}
          </div>
        </section>
      )}

      {/* ── Depoimentos ────────────────────────────────────────── */}
      {data.depoimentos.length > 0 && (
        <section className="bg-[var(--d-bg-alt)] py-[var(--d-sec-y)]">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mb-16">
              {/* Sem número de seção: seção adicional, não existe no material bruto original. */}
              <Etiqueta texto={s.depoimentos?.rotulo} />
              <Headline texto={s.depoimentos?.titulo} />
            </div>
            <div className="grid gap-8 md:grid-cols-3">
              {data.depoimentos.map((dep) => (
                <figure
                  key={dep.autor}
                  className="flex h-full flex-col justify-between gap-6 rounded-[var(--d-radius)] border border-[var(--d-border)] bg-[var(--d-bg)] p-8"
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
                    <blockquote className="font-[family-name:var(--d-serif)] text-lg italic leading-relaxed text-[var(--d-text)]">
                      &ldquo;{dep.texto}&rdquo;
                    </blockquote>
                  </div>
                  <figcaption className="font-[family-name:var(--d-mono)] text-[11px] uppercase tracking-[0.18em] text-[var(--d-muted)]">
                    — {dep.autor}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Agendamento ────────────────────────────────────────── */}
      {s.agendamento && (
        <section id="agendar" className="border-y border-[var(--d-border)] bg-[var(--d-bg)] py-[var(--d-sec-y)]">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mb-16">
              {/* Sem número: "COMO FUNCIONA" também é sem número no original. */}
              <Etiqueta texto={s.agendamento.rotulo} caixa />
              <Headline texto={s.agendamento.titulo} />
            </div>
            <div className="mb-16 grid gap-12 md:grid-cols-3">
              {(s.agendamento.itens ?? []).map((passo) => (
                <div key={passo.titulo} className="flex flex-col gap-3">
                  {passo.subtitulo && (
                    <span className="font-[family-name:var(--d-mono)] text-sm text-[var(--d-accent)]">
                      {passo.subtitulo}
                    </span>
                  )}
                  <h3 className="font-[family-name:var(--d-display)] text-2xl uppercase tracking-tight text-[var(--d-text)]">
                    {passo.titulo}
                  </h3>
                  {passo.texto && (
                    <p className="text-sm leading-[1.7] text-[var(--d-muted)] md:text-base">
                      {passo.texto}
                    </p>
                  )}
                </div>
              ))}
            </div>
            {s.agendamento.cta && (
              <div className="flex justify-center">
                <a href={agendar} className="d-cta inline-flex items-center justify-center gap-3">
                  <span>{s.agendamento.cta}</span>
                  <span>→</span>
                </a>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Contato ────────────────────────────────────────────── */}
      <section id="contato" className="bg-[var(--d-bg-elev)] py-[var(--d-sec-y)]">
        <div className="mx-auto grid max-w-7xl items-center gap-16 px-6 md:grid-cols-2 md:gap-24">
          <div className="flex flex-col items-start">
            <Etiqueta numero="05" texto={s.contato?.rotulo ?? "CONTATO"} caixa className="mb-8" />
            <div className="mb-12">
              <Headline texto={s.contato?.titulo} animado />
            </div>

            <div className="flex w-full flex-col gap-8">
              {data.endereco && (
                <div className="flex w-full flex-col border-b border-[var(--d-border)] pb-6">
                  <span className="mb-2 font-[family-name:var(--d-mono)] text-[11px] font-medium tracking-widest text-[var(--d-accent)]">
                    ENDEREÇO
                  </span>
                  <p className="font-[family-name:var(--d-display)] text-2xl tracking-wide text-[var(--d-text)] md:text-3xl">
                    {data.endereco}
                  </p>
                </div>
              )}
              {data.horarios && (
                <div className="flex w-full flex-col border-b border-[var(--d-border)] pb-6">
                  <span className="mb-2 font-[family-name:var(--d-mono)] text-[11px] font-medium tracking-widest text-[var(--d-accent)]">
                    HORÁRIO
                  </span>
                  <p className="font-[family-name:var(--d-display)] text-2xl tracking-wide text-[var(--d-text)] md:text-3xl">
                    {data.horarios}
                  </p>
                </div>
              )}
              {data.whatsapp && (
                <div className="flex w-full flex-col border-b border-[var(--d-border)] pb-6">
                  <span className="mb-2 font-[family-name:var(--d-mono)] text-[11px] font-medium tracking-widest text-[var(--d-accent)]">
                    WHATSAPP
                  </span>
                  <a href={agendar} className="font-[family-name:var(--d-mono)] text-lg text-[var(--d-text)] hover:text-[var(--d-accent)] md:text-xl">
                    {data.whatsapp}
                  </a>
                </div>
              )}
              {data.telefone && data.telefone !== data.whatsapp && (
                <div className="flex w-full flex-col border-b border-[var(--d-border)] pb-6">
                  <span className="mb-2 font-[family-name:var(--d-mono)] text-[11px] font-medium tracking-widest text-[var(--d-accent)]">
                    TELEFONE
                  </span>
                  <p className="font-[family-name:var(--d-mono)] text-lg text-[var(--d-text)] md:text-xl">
                    {data.telefone}
                  </p>
                </div>
              )}
              {data.instagram && (
                <div className="flex w-full flex-col">
                  <span className="mb-2 font-[family-name:var(--d-mono)] text-[11px] font-medium tracking-widest text-[var(--d-accent)]">
                    INSTAGRAM
                  </span>
                  <p className="font-[family-name:var(--d-mono)] text-lg text-[var(--d-text)] md:text-xl">
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
              />
            </div>
            {data.endereco && s.contato?.cta && (
              <div className="absolute inset-x-8 bottom-8 z-30">
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(data.endereco)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full rounded-[var(--d-radius)] border border-[var(--d-accent)]/30 bg-[var(--d-bg-alt)]/90 px-6 py-4 text-center font-[family-name:var(--d-mono)] text-[11px] font-medium tracking-widest text-[var(--d-text)] backdrop-blur-sm transition-colors hover:bg-[var(--d-accent)] hover:text-[var(--d-accent-ink)]"
                >
                  {s.contato.cta} →
                </a>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="relative overflow-hidden border-t border-[var(--d-border)] bg-[var(--d-bg)] py-24 text-center md:py-32">
        <div className="d-pole absolute inset-x-0 top-0 h-1 opacity-60 md:h-1.5" aria-hidden />
        <div className="mx-auto flex max-w-4xl flex-col items-center px-6">
          <h2
            className="mb-6 font-[family-name:var(--d-deco)] leading-none text-[var(--d-accent)]"
            style={{ fontSize: "clamp(3rem, 6vw, 5rem)", letterSpacing: "0.08em" }}
          >
            {data.nome}
          </h2>
          {(data.cidade || data.endereco) && (
            <p className="mb-12 font-[family-name:var(--d-mono)] text-xs font-medium uppercase tracking-[0.2em] text-[var(--d-muted)] md:text-sm">
              {data.cidade ?? data.endereco}
            </p>
          )}
          {data.slogan && (
            <p className="mb-24 font-[family-name:var(--d-citacao)] text-lg italic text-[var(--d-muted)] md:text-xl">
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
    </div>
  );
}
