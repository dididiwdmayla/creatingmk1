import Image from "next/image";
import { Fragment, type CSSProperties, type ReactNode } from "react";

import { secoesVisiveis } from "@/lib/demos/estrutura";
import type { Animacao, Densidade, SkinProps } from "@/lib/demos/types";
import { CategoryNav } from "./interactive/CategoryNav";
import { CompactSection } from "./interactive/CompactSection";
import { BurgerCard } from "./interactive/BurgerCard";
import { DecorativeFloat } from "./interactive/DecorativeFloat";
import { Header } from "./interactive/Header";
import { IntroExperience } from "./interactive/IntroExperience";
import { LedEdges } from "./interactive/LedEdges";
import { OrderCta } from "./interactive/OrderCta";
import { SectionReveal, type RevealTipo } from "./interactive/SectionReveal";
import { LANCHERIA_DECORATIVE_FLOATS } from "./decorativeFloats";
import { LANCHERIA_SECOES } from "./secoes";

/**
 * Skin "Chapa Burger" — conversão fiel do material bruto
 * (skins-raw/lancheria): lanchonete artesanal bem-humorada, tipografia
 * poster com contorno grosso, cardápio em cards com o efeito de lente no
 * hover (revela o "prato vazio" sob a foto do lanche), listas horizontais
 * compactas de bebidas/acompanhamentos e rodapé com contato.
 *
 * O material bruto original é full stack (pagamentos Mercado Pago, painel
 * de comandas, carrinho, upsell): só as páginas públicas visuais foram
 * convertidas. Todo botão de ação de pedido virou o CTA neutro `OrderCta`
 * (ver interactive/OrderCta.tsx) — WhatsApp quando `data.whatsapp` existe,
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

function Rotulo({ texto, slot }: { texto?: string; slot?: string }) {
  if (!texto) return null;
  return (
    <span
      data-demo-slot={slot}
      className="mb-1 block font-[family-name:var(--d-mono)] text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--d-accent-2)]"
    >
      {texto}
    </span>
  );
}

export function LancheriaChapaBurger({ data, theme }: SkinProps) {
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
    "--d-anim-ease": "cubic-bezier(0.16, 1, 0.3, 1)",
    "--d-hover-scale": ANIM_HOVER_SCALE[theme.animacao],
    "--d-hover-lift": ANIM_HOVER_LIFT[theme.animacao],
  } as CSSProperties;

  const HERO_ALINHAMENTO: Record<string, string> = {
    esquerda: "items-start text-left",
    centro: "items-center text-center",
    direita: "items-end text-right",
  };

  const s = data.secoes;

  // Um flutuante decorativo por seção que o declara (ver decorativeFloats.ts);
  // a imagem em si é um slot normal de DemoData.imagens, com placeholder.
  const floatDe = (secaoId: string) =>
    LANCHERIA_DECORATIVE_FLOATS.find((f) => f.secaoId === secaoId);

  const visiveis = secoesVisiveis(LANCHERIA_SECOES, data);
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

  // Nav de categorias: só as seções de cardápio, na ordem/rótulo efetivos.
  const categorias = (["cardapio", "bebidas", "acompanhamentos"] as const)
    .filter((id) => visiveis.includes(id))
    .map((id) => ({ id, label: s[id]?.rotulo ?? s[id]?.titulo ?? id }));

  const secoes: Record<string, () => ReactNode> = {
    /* ── Hero (fixa) ─────────────────────────────────────────── */
    hero: () => (
      <section
        id="topo"
        className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden pt-16"
      >
        <div className="absolute inset-0 z-0 bg-[var(--d-bg)]">
          <Placeholder
            src={data.imagens.hero}
            alt={`Ambiente de ${data.nome}`}
            sizes="100vw"
            priority
            slot="imagens.hero"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--d-bg)] via-[var(--d-bg)]/70 to-[var(--d-bg)]/30" />
        </div>

        <div
          className={`relative z-20 flex w-full flex-col px-4 pt-16 ${HERO_ALINHAMENTO[theme.heroTitulo.alinhamento]}`}
        >
          <div className="mb-6 flex flex-col leading-[0.9]">
            <h1
              data-demo-slot="secoes.hero.titulo"
              className="w-full whitespace-pre-line font-[family-name:var(--d-hero-font)] uppercase leading-[0.85] tracking-tight text-[var(--d-accent-2)]"
              style={
                {
                  fontSize: "calc(clamp(3.25rem, 13vw, 9rem) * var(--d-hero-escala))",
                  WebkitTextStroke: "8px var(--d-bg)",
                  filter: "drop-shadow(10px 10px 0px var(--d-bg))",
                  paintOrder: "stroke fill",
                } as CSSProperties
              }
            >
              {s.hero?.titulo ?? data.nome}
            </h1>
          </div>

          {s.hero?.texto && (
            <p
              data-demo-slot="secoes.hero.texto"
              className="mb-10 max-w-xl font-[family-name:var(--d-corpo)] text-lg font-light leading-relaxed text-[var(--d-text)]/85 md:text-2xl"
            >
              {s.hero.texto}
            </p>
          )}

          {s.hero?.cta && (
            <a
              href="#cardapio"
              data-demo-slot="secoes.hero.cta"
              className="d-cta-pill d-cta-pill-lg"
            >
              {s.hero.cta}
            </a>
          )}
        </div>

        <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-2 text-[var(--d-text)]/80">
          <span className="font-[family-name:var(--d-display)] text-sm uppercase tracking-widest">
            ROLE
          </span>
          <span className="d-scroll-bounce" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
        </div>
      </section>
    ),

    /* ── Cardápio (lanches) ─────────────────────────────────── */
    cardapio: () =>
      data.servicos.length > 0 && (
        <section id="cardapio" className="relative z-10 mx-auto max-w-7xl px-4 pb-8 pt-16">
          <div className="mb-12 flex items-end justify-between gap-4 border-b border-[var(--d-border)] pb-4">
            <div>
              <Rotulo texto={s.cardapio?.rotulo} slot="secoes.cardapio.rotulo" />
              <h2
                data-demo-slot="secoes.cardapio.titulo"
                className="font-[family-name:var(--d-display)] text-4xl uppercase italic text-[var(--d-accent-2)] md:text-5xl"
              >
                {s.cardapio?.titulo}
              </h2>
            </div>
          </div>

          <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8 lg:grid-cols-3">
            {data.servicos.map((servico, i) => (
              <BurgerCard
                key={servico.nome}
                servico={servico}
                index={i}
                imageSrc={data.imagens[`lanche-${i + 1}`] ?? data.imagens.hero}
                platoVazioSrc={data.imagens["prato-vazio"]}
                animacao={theme.animacao}
                whatsapp={data.whatsapp}
              />
            ))}
          </div>

          {floatDe("cardapio") && (
            <DecorativeFloat
              def={floatDe("cardapio")!}
              src={data.imagens[floatDe("cardapio")!.slot] ?? data.imagens.hero}
            />
          )}
        </section>
      ),

    /* ── Bebidas ────────────────────────────────────────────── */
    bebidas: () =>
      (s.bebidas?.itens?.length ?? 0) > 0 && (
        <section id="bebidas" className="relative z-10 mx-auto max-w-7xl px-4 pb-12 pt-8">
          <div className="mb-6 flex items-center border-b border-[var(--d-border)] pb-3">
            <div>
              <h2
                data-demo-slot="secoes.bebidas.titulo"
                className="font-[family-name:var(--d-display)] text-2xl uppercase italic tracking-tight text-[var(--d-accent-2)] md:text-3xl"
              >
                {s.bebidas?.titulo}
              </h2>
            </div>
          </div>
          <CompactSection
            id="bebidas"
            secaoId="bebidas"
            itens={s.bebidas?.itens ?? []}
            imagens={data.imagens}
            slotPrefix="bebida"
            whatsapp={data.whatsapp}
          />
          {floatDe("bebidas") && (
            <DecorativeFloat
              def={floatDe("bebidas")!}
              src={data.imagens[floatDe("bebidas")!.slot] ?? data.imagens.hero}
            />
          )}
        </section>
      ),

    /* ── Acompanhamentos ────────────────────────────────────── */
    acompanhamentos: () =>
      (s.acompanhamentos?.itens?.length ?? 0) > 0 && (
        <section id="acompanhamentos" className="relative z-10 mx-auto max-w-7xl px-4 pb-12 pt-8">
          <div className="mb-6 flex items-center border-b border-[var(--d-border)] pb-3">
            <div>
              <h2
                data-demo-slot="secoes.acompanhamentos.titulo"
                className="font-[family-name:var(--d-display)] text-2xl uppercase italic tracking-tight text-[var(--d-accent-2)] md:text-3xl"
              >
                {s.acompanhamentos?.titulo}
              </h2>
            </div>
          </div>
          <CompactSection
            id="acompanhamentos"
            secaoId="acompanhamentos"
            itens={s.acompanhamentos?.itens ?? []}
            imagens={data.imagens}
            slotPrefix="acompanhamento"
            whatsapp={data.whatsapp}
          />
          {floatDe("acompanhamentos") && (
            <DecorativeFloat
              def={floatDe("acompanhamentos")!}
              src={data.imagens[floatDe("acompanhamentos")!.slot] ?? data.imagens.hero}
            />
          )}
        </section>
      ),

    /* ── Contato (rodapé) ──────────────────────────────────── */
    contato: () => (
      <footer
        id="contato"
        className={`relative overflow-hidden border-t-8 border-[var(--d-accent-2)] px-4 pb-8 pt-16 ${
          centro("contato") ? "text-center" : "text-center md:text-left"
        }`}
        style={{ backgroundColor: "var(--d-bg)" }}
      >
        <div
          className={`relative z-10 mx-auto mb-16 flex w-full max-w-4xl flex-col items-center gap-12 md:flex-row md:justify-between ${
            centro("contato") ? "" : "md:items-start"
          }`}
        >
          <div className="flex max-w-xs flex-col items-center md:items-start">
            <h2
              data-demo-slot="nome"
              className="mb-4 font-[family-name:var(--d-deco)] text-3xl uppercase tracking-tight text-[var(--d-accent-2)]"
              style={{
                WebkitTextStroke: "1px var(--d-accent-2)",
                filter: "drop-shadow(2px 2px 0px var(--d-accent))",
              } as CSSProperties}
            >
              {data.nome}
            </h2>
            {data.slogan && (
              <p data-demo-slot="slogan" className="font-[family-name:var(--d-corpo)] text-sm leading-relaxed text-[var(--d-muted)]">
                {data.slogan}
              </p>
            )}
          </div>

          {data.horarios && (
            <div className="flex flex-col items-center md:items-start">
              <h3 className="mb-4 font-[family-name:var(--d-display)] text-xl uppercase tracking-widest text-[var(--d-muted)]">
                Horário
              </h3>
              <p
                data-demo-slot="horarios"
                className="inline-block rounded bg-[var(--d-accent-2)]/10 px-3 py-1 font-[family-name:var(--d-mono)] text-[var(--d-accent-2)]"
              >
                {data.horarios}
              </p>
            </div>
          )}

          <div className="flex flex-col items-center md:items-start">
            <h3
              data-demo-slot="secoes.contato.titulo"
              className="mb-4 font-[family-name:var(--d-display)] text-xl uppercase tracking-widest text-[var(--d-muted)]"
            >
              {s.contato?.titulo ?? "Contato"}
            </h3>
            {(data.endereco || data.cidade) && (
              <p data-demo-slot={data.endereco ? "endereco" : "cidade"} className="mb-4 font-[family-name:var(--d-corpo)] text-sm text-[var(--d-text)]">
                {data.endereco ?? data.cidade}
              </p>
            )}
            {data.telefone && data.telefone !== data.whatsapp && (
              <p data-demo-slot="telefone" className="mb-4 font-[family-name:var(--d-corpo)] text-sm text-[var(--d-text)]">
                {data.telefone}
              </p>
            )}
            {data.instagram && (
              <a
                href={`https://instagram.com/${data.instagram.replace(/^@/, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                data-demo-slot="instagram"
                className="mb-4 font-[family-name:var(--d-corpo)] text-sm text-[var(--d-text)] transition-colors hover:text-[var(--d-accent-2)]"
              >
                {data.instagram}
              </a>
            )}
            {s.contato?.cta && (
              <OrderCta
                whatsapp={data.whatsapp}
                mensagem="Olá! Gostaria de fazer um pedido."
                slot="secoes.contato.cta"
                className="d-cta-outline"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
                </svg>
                {s.contato.cta}
              </OrderCta>
            )}
          </div>
        </div>

        <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center justify-between gap-4 border-t border-[var(--d-border)] pt-8 md:flex-row">
          <p className="font-[family-name:var(--d-mono)] text-xs text-[var(--d-muted)]">
            © {new Date().getFullYear()} {data.nome}. Todos os direitos reservados.
          </p>
          <p className="font-[family-name:var(--d-mono)] text-xs text-[var(--d-muted)]/70">
            FEITO COM OBSESSÃO
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
      {/* Textura de ruído sutil no fundo — mesmo padrão das demais skins. */}
      <div
        className="pointer-events-none fixed inset-0 z-50 opacity-[0.04]"
        style={{
          backgroundImage: `radial-gradient(var(--d-text) 1px, transparent 1px)`,
          backgroundSize: "24px 24px",
        }}
        aria-hidden="true"
      />

      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }

        @keyframes d-scroll-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(8px); } }
        .d-scroll-bounce { display: inline-flex; animation: d-scroll-bounce 1.5s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .d-scroll-bounce { animation: none; } }

        /* Pílulas de CTA (hero + cards) — cor de destaque, cantos = --d-radius. */
        .d-cta-pill {
          display: inline-flex; align-items: center; justify-content: center; gap: 0.75rem;
          font-family: var(--d-display); text-transform: uppercase; letter-spacing: 0.05em;
          color: var(--d-accent-ink); background: var(--d-accent);
          border-radius: var(--d-radius);
          padding: 0.75rem 1.5rem; font-size: 13px;
          box-shadow: 0 8px 24px color-mix(in srgb, var(--d-accent) 30%, transparent);
          transition: transform var(--d-anim-duration) var(--d-anim-ease),
            box-shadow var(--d-anim-duration) var(--d-anim-ease), opacity var(--d-anim-duration) var(--d-anim-ease);
        }
        .d-cta-pill-lg { padding: 1.1rem 2.5rem; font-size: 16px; }
        .d-cta-pill:hover { transform: scale(var(--d-hover-scale)) translateY(var(--d-hover-lift)); opacity: 0.92; }
        @media (prefers-reduced-motion: reduce) { .d-cta-pill:hover { transform: none; } }

        .d-cta-outline {
          display: inline-flex; align-items: center; gap: 0.5rem;
          font-family: var(--d-corpo); font-weight: 700; color: var(--d-accent-3);
          background: color-mix(in srgb, var(--d-accent-3) 10%, transparent);
          border: 1px solid color-mix(in srgb, var(--d-accent-3) 40%, transparent);
          border-radius: 9999px; padding: 0.6rem 1.25rem;
          transition: transform var(--d-anim-duration) var(--d-anim-ease), background var(--d-anim-duration) var(--d-anim-ease);
        }
        .d-cta-outline:hover { transform: translateY(var(--d-hover-lift)); background: color-mix(in srgb, var(--d-accent-3) 18%, transparent); }
        @media (prefers-reduced-motion: reduce) { .d-cta-outline:hover { transform: none; } }

        .d-cta-round {
          display: inline-flex; align-items: center; justify-content: center;
          width: 46px; height: 46px; border-radius: 9999px;
          background: var(--d-accent); color: var(--d-accent-ink);
          box-shadow: 0 4px 14px color-mix(in srgb, var(--d-accent) 40%, transparent);
          transition: transform var(--d-anim-duration) var(--d-anim-ease);
        }
        .d-cta-round-sm { width: 32px; height: 32px; }
        /* Variante "marca" (amarelo) do botão redondo — só o carrinho do
           header, fiel ao original (o resto dos redondos usa a cor de
           ação padrão, laranja). */
        .d-cta-round-alt {
          background: var(--d-accent-2); color: var(--d-bg);
          box-shadow: 0 4px 14px color-mix(in srgb, var(--d-accent-2) 40%, transparent);
        }
        .d-cta-round:hover { transform: scale(var(--d-hover-scale)); }
        @media (prefers-reduced-motion: reduce) { .d-cta-round:hover { transform: none; } }

        .d-cta-pill:active, .d-cta-outline:active, .d-cta-round:active { opacity: 1; }

        /* Lift genérico de card — intensidade por --d-hover-*. */
        .d-card-hover {
          transition: transform var(--d-anim-duration) var(--d-anim-ease),
            box-shadow var(--d-anim-duration) var(--d-anim-ease),
            border-color var(--d-anim-duration) var(--d-anim-ease);
        }
        .d-card-hover:hover { transform: translateY(var(--d-hover-lift)); }
        @media (prefers-reduced-motion: reduce) { .d-card-hover:hover { transform: none; } }

        /* ── Hover do tema (Theme.hover) ────────────────────── */
        [data-d-hover="zoom"] .d-cta-pill:hover, [data-d-hover="zoom"] .d-cta-round:hover { transform: scale(var(--d-hover-scale)); }
        [data-d-hover="zoom"] .d-card-hover:hover { transform: scale(var(--d-hover-scale)); }
        [data-d-hover="brilho"] .d-cta-pill:hover, [data-d-hover="brilho"] .d-cta-round:hover {
          transform: none; box-shadow: 0 0 32px color-mix(in srgb, var(--d-accent) 55%, transparent);
        }
        [data-d-hover="brilho"] .d-card-hover:hover {
          transform: none;
          box-shadow: 0 0 24px color-mix(in srgb, var(--d-accent) 30%, transparent);
          border-color: color-mix(in srgb, var(--d-accent) 45%, transparent);
        }
        @media (prefers-reduced-motion: reduce) {
          [data-d-hover] .d-cta-pill:hover, [data-d-hover] .d-card-hover:hover, [data-d-hover] .d-cta-round:hover { transform: none; }
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

      <IntroExperience
        nome={data.nome}
        accent={paleta.destaque}
        ink={paleta.destaqueInk}
        ativa={theme.intro === true}
      >
        <Header nome={data.nome} whatsapp={data.whatsapp} />

        {visiveis.includes("cardapio") && <CategoryNav categorias={categorias} />}

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
