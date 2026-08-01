import { Fragment, type CSSProperties, type ReactNode } from "react";

import { secoesVisiveis } from "@/lib/demos/estrutura";
import type { Animacao, Densidade, SkinProps } from "@/lib/demos/types";
import { CarFilterGrid } from "./interactive/CarFilterGrid";
import { FooterEgg } from "./interactive/FooterEgg";
import { Hero } from "./interactive/Hero";
import { IntroExperience } from "./interactive/IntroExperience";
import { LedEdges } from "./interactive/LedEdges";
import { Marquee } from "./interactive/Marquee";
import { Nav, type NavLink } from "./interactive/Nav";
import { ProgressBar } from "./interactive/ProgressBar";
import { SectionReveal, type RevealTipo } from "./interactive/SectionReveal";
import { Simulador } from "./interactive/Simulador";
import { StatCounter } from "./interactive/StatCounter";
import { TestimonialCarousel } from "./interactive/TestimonialCarousel";
import { ThemeColorSync } from "./interactive/ThemeColorSync";
import { waHref } from "./interactive/logic";
import { WhatsAppFloat } from "./interactive/WhatsAppFloat";
import { MULTIMARCAS_SECOES } from "./secoes";

/**
 * Skin "Multimarcas Vórtice" — conversão fiel do material bruto
 * (skins-raw/multimarcas): concessionária de seminovos premium, editorial
 * creme-e-vermelho, com estoque filtrável, simulador de financiamento com
 * odômetro de dígitos, velocímetro no preloader e no hero, carrossel de
 * depoimentos arrastável e faixa de marcas em marquee.
 *
 * Componente PURO: todo texto/imagem vem de `data`, toda cor/fonte/raio/
 * densidade vem de `theme` (aplicado como CSS vars no wrapper). Delega
 * toda interatividade a `interactive/*.tsx` ("use client"). Estrutura
 * editável igual às demais skins — ver lib/demos/estrutura.ts.
 *
 * A nav (topo + rodapé) é gerada a partir das seções VISÍVEIS (rótulo
 * efetivo), não uma lista fixa — diferença deliberada do material bruto
 * (que tinha uma lista de links hardcoded, faltando "Depoimentos" e
 * inconsistente entre topo/rodapé): aqui ocultar/reordenar uma seção
 * atualiza a navegação sozinho, sem lista duplicada pra manter em dia.
 * "numeros" fica fora da nav (é um bloco de apoio de "vantagens", não um
 * destino de navegação por si).
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
  sutil: "-3px",
  marcante: "-8px",
};

/**
 * Rótulo curto DEFAULT da nav por seção — estrutura do template (como a
 * numeração "01/FILOSOFIA" de outras skins), usado só quando a seção não
 * tem `rotulo` próprio definido (DemoSecao.rotulo, a etiqueta editorial em
 * cima do título, ex.: "POR QUE A VÓRTICE"). `rotulo` vence este default
 * quando presente — é conteúdo (slot da IA/editor, traduzível pro idioma
 * do lead — ver "Idioma da IA na demo"), enquanto este mapa é só o
 * fallback fiel ao material bruto para quem nunca editou a seção.
 */
const NAV_LABEL: Record<string, string> = {
  estoque: "Estoque",
  vantagens: "Vantagens",
  simulador: "Simulador",
  avaliacao: "Avaliação",
  depoimentos: "Depoimentos",
  contato: "Contato",
};

function Rotulo({ texto, slot }: { texto?: string; slot?: string }) {
  if (!texto) return null;
  return (
    <p data-demo-slot={slot} className="mb-3.5 font-[family-name:var(--d-corpo)] text-[13px] font-semibold tracking-[4px] text-[var(--d-accent)]">
      {texto.toUpperCase()}
    </p>
  );
}

export function MultimarcasVortice({ data, theme }: SkinProps) {
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

  const s = data.secoes;
  const visiveis = secoesVisiveis(MULTIMARCAS_SECOES, data);
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

  const navLinks: NavLink[] = visiveis
    .filter((id) => id !== "hero" && id !== "numeros")
    .map((id) => ({ id, rotulo: s[id]?.rotulo ?? NAV_LABEL[id] ?? s[id]?.titulo ?? id }));

  const linkWaMain = waHref(data.whatsapp, `Olá! Vim pelo site da ${data.nome} e quero mais informações.`);

  const secoes: Record<string, () => ReactNode> = {
    /* ── Estoque ─────────────────────────────────────────────── */
    estoque: () =>
      data.servicos.length > 0 && (
        <section id="estoque" className="mx-auto max-w-[1200px] px-[max(24px,5vw)] py-[var(--d-sec-y)]">
          <div className="mb-[34px]">
            <Rotulo texto={s.estoque?.rotulo} slot="secoes.estoque.rotulo" />
            <h2
              data-demo-slot="secoes.estoque.titulo"
              className="font-[family-name:var(--d-display)] text-[clamp(34px,5.4vw,60px)] font-extrabold uppercase leading-[1.05] tracking-[0.5px] text-[var(--d-text)]"
            >
              {s.estoque?.titulo}
            </h2>
          </div>
          <CarFilterGrid
            servicos={data.servicos}
            imagens={data.imagens}
            ctaDetalhes={s.estoque?.ctaSecundaria}
            ctaInteresse={s.estoque?.cta}
            textoGarantia={s.estoque?.texto}
            whatsapp={data.whatsapp}
          />
        </section>
      ),

    /* ── Vantagens ───────────────────────────────────────────── */
    vantagens: () =>
      (s.vantagens?.itens?.length ?? 0) > 0 && (
        <section
          id="vantagens"
          className="border-t px-[max(24px,5vw)] pb-10 pt-[var(--d-sec-y)]"
          style={{ background: "var(--d-bg-alt)", borderColor: "var(--d-border)" }}
        >
          <div className="mx-auto max-w-[1200px]">
            <div className="mb-11">
              <Rotulo texto={s.vantagens?.rotulo} slot="secoes.vantagens.rotulo" />
              <h2
                data-demo-slot="secoes.vantagens.titulo"
                className="font-[family-name:var(--d-display)] text-[clamp(34px,5.4vw,60px)] font-extrabold uppercase leading-[1.05] tracking-[0.5px] text-[var(--d-text)]"
              >
                {s.vantagens?.titulo}
              </h2>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-[18px]">
              {s.vantagens?.itens?.map((item, i) => (
                <SectionReveal key={item.titulo} animacao={theme.animacao} tipo="padrao" delay={i * 0.09}>
                  <div
                    className="flex h-full flex-col gap-4 border p-7"
                    style={{ background: "var(--d-bg-elev)", borderColor: "var(--d-border)", borderRadius: "var(--d-radius)" }}
                  >
                    <span
                      className="flex h-[54px] w-[54px] items-center justify-center rounded-full border-[2.5px] font-[family-name:var(--d-mono)] text-[22px] font-semibold"
                      style={{ borderColor: "var(--d-accent)", background: "var(--d-bg)", color: "var(--d-text)" }}
                      aria-hidden="true"
                    >
                      {i + 1}
                    </span>
                    <h3
                      data-demo-slot={`secoes.vantagens.itens.${i}.titulo`}
                      className="font-[family-name:var(--d-display)] text-xl font-bold uppercase tracking-[0.5px] text-[var(--d-text)]"
                    >
                      {item.titulo}
                    </h3>
                    <p
                      data-demo-slot={`secoes.vantagens.itens.${i}.texto`}
                      className="font-[family-name:var(--d-corpo)] text-sm leading-relaxed text-[var(--d-muted)]"
                    >
                      {item.texto}
                    </p>
                  </div>
                </SectionReveal>
              ))}
            </div>
          </div>
        </section>
      ),

    /* ── Números (contadores) ───────────────────────────────── */
    numeros: () =>
      (s.numeros?.itens?.length ?? 0) > 0 && (
        <section
          id="numeros"
          className="border-b px-[max(24px,5vw)] pb-[var(--d-sec-y)] pt-3"
          style={{ background: "var(--d-bg-alt)", borderColor: "var(--d-border)" }}
        >
          <div className="mx-auto flex max-w-[1200px] flex-wrap gap-[clamp(28px,6vw,80px)]">
            {s.numeros?.itens?.map((item, i) => (
              <div key={i}>
                <p className="font-[family-name:var(--d-mono)] text-[clamp(38px,4.6vw,56px)] font-semibold leading-none tabular-nums text-[var(--d-text)]">
                  <StatCounter valor={item.titulo} corDestaque={paleta.destaque} />
                </p>
                {item.detalhe && (
                  <p className="mt-2 font-[family-name:var(--d-corpo)] text-[13px] font-semibold tracking-[1px] text-[var(--d-muted)]">
                    {item.detalhe}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      ),

    /* ── Simulador de financiamento ─────────────────────────── */
    simulador: () => (
      <section id="simulador" className="mx-auto max-w-[1200px] px-[max(24px,5vw)] py-[var(--d-sec-y)]">
        <div className="mb-11">
          <Rotulo texto={s.simulador?.rotulo} slot="secoes.simulador.rotulo" />
          <h2
            data-demo-slot="secoes.simulador.titulo"
            className="font-[family-name:var(--d-display)] text-[clamp(34px,5.4vw,60px)] font-extrabold uppercase leading-[1.05] tracking-[0.5px] text-[var(--d-text)]"
          >
            {s.simulador?.titulo}
          </h2>
          {s.simulador?.texto && (
            <p
              data-demo-slot="secoes.simulador.texto"
              className="mt-3 font-[family-name:var(--d-corpo)] text-[15px] text-[var(--d-muted)]"
            >
              {s.simulador.texto}
            </p>
          )}
        </div>
        <Simulador whatsapp={data.whatsapp} ctaLabel={s.simulador?.cta} />
      </section>
    ),

    /* ── Avaliação (venda seu carro) ─────────────────────────── */
    avaliacao: () => (
      <section
        id="avaliacao"
        className={`overflow-hidden pt-[clamp(60px,8vw,100px)] ${centro("avaliacao") ? "text-center" : ""}`}
        style={{ background: "var(--d-accent)", color: "var(--d-accent-ink)" }}
      >
        <div
          className={`mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-7 px-[max(24px,5vw)] ${
            centro("avaliacao") ? "justify-center text-center" : ""
          }`}
        >
          <div>
            <p
              data-demo-slot="secoes.avaliacao.rotulo"
              className="mb-3.5 font-[family-name:var(--d-corpo)] text-[13px] font-semibold tracking-[4px] opacity-75"
            >
              {s.avaliacao?.rotulo?.toUpperCase()}
            </p>
            <h2
              data-demo-slot="secoes.avaliacao.titulo"
              className="font-[family-name:var(--d-display)] text-[clamp(38px,6.4vw,74px)] font-extrabold uppercase leading-none tracking-[0.5px]"
            >
              {s.avaliacao?.titulo}
            </h2>
            {s.avaliacao?.texto && (
              <p
                data-demo-slot="secoes.avaliacao.texto"
                className="mt-4 max-w-[440px] text-pretty font-[family-name:var(--d-corpo)] text-[15px] font-medium leading-relaxed opacity-85"
              >
                {s.avaliacao.texto}
              </p>
            )}
          </div>
          {s.avaliacao?.cta && (
            <a
              href={waHref(data.whatsapp, "Olá! Quero uma avaliação do meu carro.")}
              target="_blank"
              rel="noopener noreferrer"
              data-demo-slot="secoes.avaliacao.cta"
              className="d-press flex-none rounded-full px-10 py-5 font-[family-name:var(--d-corpo)] text-[15px] font-bold tracking-[1.5px] transition-transform"
              style={{ background: "var(--d-text)", color: "var(--d-bg)" }}
            >
              {s.avaliacao.cta.toUpperCase()}
            </a>
          )}
        </div>
        <Marquee marcas={(s.avaliacao?.itens ?? []).map((i) => i.titulo)} />
      </section>
    ),

    /* ── Depoimentos ─────────────────────────────────────────── */
    depoimentos: () =>
      data.depoimentos.length > 0 && (
        <section id="depoimentos" className="mx-auto max-w-[1200px] px-[max(24px,5vw)] py-[var(--d-sec-y)]">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-5">
            <div>
              <Rotulo texto={s.depoimentos?.rotulo} slot="secoes.depoimentos.rotulo" />
              <h2
                data-demo-slot="secoes.depoimentos.titulo"
                className="font-[family-name:var(--d-display)] text-[clamp(34px,5.4vw,60px)] font-extrabold uppercase leading-[1.05] tracking-[0.5px] text-[var(--d-text)]"
              >
                {s.depoimentos?.titulo}
              </h2>
            </div>
          </div>
          <TestimonialCarousel depoimentos={data.depoimentos} animacao={theme.animacao} />
        </section>
      ),

    /* ── Contato (rodapé) ───────────────────────────────────── */
    contato: () => (
      <footer id="contato" style={{ background: "var(--d-bg-alt)" }}>
        <section
          className={`px-[max(24px,5vw)] pb-[clamp(50px,6vw,80px)] pt-[var(--d-sec-y)] ${
            centro("contato") ? "text-center" : ""
          }`}
        >
          <div
            className={`mx-auto grid max-w-[1200px] gap-10 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))] ${
              centro("contato") ? "justify-items-center" : ""
            }`}
          >
            <div>
              <Rotulo texto={s.contato?.rotulo} slot="secoes.contato.rotulo" />
              <h2
                data-demo-slot="secoes.contato.titulo"
                className="mb-6 font-[family-name:var(--d-display)] text-[clamp(34px,5.4vw,58px)] font-extrabold uppercase leading-[1.05] tracking-[0.5px] text-[var(--d-text)]"
              >
                {s.contato?.titulo}
              </h2>
              {(data.endereco || data.cidade) && (
                <p
                  data-demo-slot={data.endereco ? "endereco" : "cidade"}
                  className="font-[family-name:var(--d-corpo)] text-base font-medium leading-relaxed text-[var(--d-text)]/80"
                >
                  {data.endereco}
                  {data.endereco && data.cidade && <br />}
                  {data.cidade}
                </p>
              )}
              {data.horarios && (
                <p
                  data-demo-slot="horarios"
                  className="mt-3 font-[family-name:var(--d-corpo)] text-sm font-medium text-[var(--d-muted)]"
                >
                  {data.horarios}
                </p>
              )}
              {data.telefone && data.telefone !== data.whatsapp && (
                <p
                  data-demo-slot="telefone"
                  className="mt-3 font-[family-name:var(--d-corpo)] text-sm font-medium text-[var(--d-muted)]"
                >
                  {data.telefone}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-3">
              {data.endereco && (
                <a
                  href={`https://waze.com/ul?q=${encodeURIComponent(`${data.endereco} ${data.cidade ?? ""}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="d-press flex items-center justify-between rounded-lg border px-6 py-5 font-[family-name:var(--d-corpo)] text-[15px] font-bold text-[var(--d-text)] transition-colors"
                  style={{ background: "var(--d-bg-elev)", borderColor: "var(--d-border)" }}
                >
                  <span>Abrir no Waze</span>
                  <span style={{ color: "var(--d-accent)" }}>→</span>
                </a>
              )}
              {data.endereco && (
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(`${data.endereco} ${data.cidade ?? ""}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="d-press flex items-center justify-between rounded-lg border px-6 py-5 font-[family-name:var(--d-corpo)] text-[15px] font-bold text-[var(--d-text)] transition-colors"
                  style={{ background: "var(--d-bg-elev)", borderColor: "var(--d-border)" }}
                >
                  <span>Abrir no Google Maps</span>
                  <span style={{ color: "var(--d-accent)" }}>→</span>
                </a>
              )}
              {s.contato?.cta && (
                <a
                  href={linkWaMain}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-demo-slot="secoes.contato.cta"
                  className="d-press flex items-center justify-between rounded-lg px-6 py-5 font-[family-name:var(--d-corpo)] text-[15px] font-bold"
                  style={{ background: "var(--d-accent)", color: "var(--d-accent-ink)" }}
                >
                  <span>{s.contato.cta}</span>
                  <span>→</span>
                </a>
              )}
            </div>
          </div>

          <div className="mx-auto mt-[clamp(60px,8vw,100px)] flex max-w-[1200px] flex-wrap items-center justify-between gap-6 border-t pt-[34px]" style={{ borderColor: "var(--d-border)" }}>
            <FooterEgg nome={data.nome} accent={paleta.destaque} />
            <div className="flex flex-wrap gap-6">
              {navLinks.map((l) => (
                <a
                  key={l.id}
                  href={`#${l.id}`}
                  className="font-[family-name:var(--d-corpo)] text-xs font-semibold tracking-[1.5px] text-[var(--d-muted)]"
                >
                  {l.rotulo.toUpperCase()}
                </a>
              ))}
            </div>
            <div className="flex gap-3.5">
              {[
                {
                  label: "Instagram",
                  href: data.instagram ? `https://instagram.com/${data.instagram.replace(/^@/, "")}` : "#topo",
                  path: "M3 3h18v18H3V3Zm9 4.8a4.2 4.2 0 1 0 0 8.4 4.2 4.2 0 0 0 0-8.4Zm5.4-.6a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0Z",
                },
                { label: "Facebook", href: "#topo", path: "M15 3h-3a4 4 0 0 0-4 4v3H5v4h3v7h4v-7h3l1-4h-4V7a1 1 0 0 1 1-1h2Z" },
                { label: "YouTube", href: "#topo", path: "M2.5 6h19v12h-19Zm7.5 3.5v5l4.5-2.5Z" },
              ].map((rede) => (
                <a
                  key={rede.label}
                  href={rede.href}
                  target={rede.href.startsWith("http") ? "_blank" : undefined}
                  rel={rede.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  aria-label={rede.label}
                  className="d-press flex h-[42px] w-[42px] items-center justify-center rounded-full border transition-colors"
                  style={{ borderColor: "var(--d-border)" }}
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d={rede.path} fill={rede.label === "YouTube" ? "currentColor" : "none"} stroke={rede.label === "YouTube" ? "none" : "currentColor"} />
                  </svg>
                </a>
              ))}
            </div>
            <p className="w-full font-[family-name:var(--d-corpo)] text-xs text-[var(--d-muted)]">
              © {new Date().getFullYear()} {data.nome}. Conteúdo ilustrativo.
            </p>
          </div>
        </section>
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
        ::selection { background: var(--d-accent); color: var(--d-accent-ink); }

        .d-press { transition: transform var(--d-anim-duration) var(--d-anim-ease); }
        [data-d-clique="pressao"]:not([data-d-anim="nenhuma"]) .d-press:active { transform: scale(0.96); transition-duration: 90ms; }
        @keyframes d-clique-pulso { 0% { transform: scale(1); } 40% { transform: scale(1.05); } 100% { transform: scale(1); } }
        [data-d-clique="pulso"]:not([data-d-anim="nenhuma"]) .d-press:active { animation: d-clique-pulso 280ms var(--d-anim-ease); }
        @media (prefers-reduced-motion: reduce) { .d-press:active { transform: none; animation: none; } }

        .d-card-hover { transition: transform var(--d-anim-duration) var(--d-anim-ease), box-shadow var(--d-anim-duration) var(--d-anim-ease), border-color var(--d-anim-duration) var(--d-anim-ease); }
        .d-card-hover:hover { transform: translateY(var(--d-hover-lift)); border-color: color-mix(in srgb, var(--d-accent) 45%, transparent); box-shadow: 0 26px 55px rgba(60,30,10,.16); }
        .d-card-hover:hover img { transform: scale(1.08); }
        .d-card-detalhes { transform: translateY(150%); transition: transform 400ms cubic-bezier(.2,.9,.2,1); }
        .d-card-hover:hover .d-card-detalhes { transform: translateY(0); }
        @media (prefers-reduced-motion: reduce) { .d-card-hover:hover, .d-card-hover:hover img { transform: none; } }

        .d-cta-gradiente {
          color: var(--d-accent-ink);
          background-image: linear-gradient(105deg, var(--d-text) 0%, var(--d-text) 50%, var(--d-accent) 50%, var(--d-accent) 100%);
          background-size: 230% 100%; background-position: 100% 0;
          transition: background-position 450ms cubic-bezier(.6,0,.2,1);
          box-shadow: 0 10px 26px color-mix(in srgb, var(--d-accent) 25%, transparent);
        }
        .d-cta-gradiente:hover { background-position: 0 0; color: var(--d-accent-ink); }

        [data-d-hover="zoom"] .d-card-hover:hover { transform: scale(var(--d-hover-scale)); }
        [data-d-hover="brilho"] .d-card-hover:hover { transform: none; box-shadow: 0 0 28px color-mix(in srgb, var(--d-accent) 40%, transparent); }
        @media (prefers-reduced-motion: reduce) { [data-d-hover] .d-card-hover:hover { transform: none; } }

        @keyframes d-marquee { to { transform: translateX(-50%); } }
        .d-marquee-track { animation: d-marquee 28s linear infinite; }
        @keyframes d-chev { 0%, 100% { opacity: .15; transform: translateY(0); } 50% { opacity: 1; transform: translateY(5px); } }
        .d-chev { animation: d-chev 1.6s ease infinite; }
        @keyframes d-waping { 0% { transform: scale(1); opacity: .6; } 100% { transform: scale(2); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) { .d-marquee-track, .d-chev { animation: none; } }

        .d-range { -webkit-appearance: none; appearance: none; background: transparent; cursor: pointer; height: 44px; touch-action: none; }
        .d-range::-webkit-slider-runnable-track { height: 10px; border-radius: 999px; background: linear-gradient(90deg, var(--d-accent) var(--fill,20%), var(--d-border) var(--fill,20%)); }
        .d-range::-webkit-slider-thumb { -webkit-appearance: none; width: 30px; height: 30px; border-radius: 50%; background: var(--d-bg-elev); border: 5px solid var(--d-accent); margin-top: -10px; box-shadow: 0 6px 18px rgba(60,30,10,.3); }
        .d-range::-moz-range-track { height: 10px; border-radius: 999px; background: linear-gradient(90deg, var(--d-accent) var(--fill,20%), var(--d-border) var(--fill,20%)); }
        .d-range::-moz-range-thumb { width: 30px; height: 30px; border-radius: 50%; background: var(--d-bg-elev); border: 5px solid var(--d-accent); box-shadow: 0 6px 18px rgba(60,30,10,.3); }

        .d-led-edges { position: fixed; inset: 0; z-index: 45; pointer-events: none; --d-led-scroll: 0; }
        .d-led-bar { position: absolute; top: 0; bottom: 0; width: 3px; background: linear-gradient(to bottom, transparent 0%, color-mix(in srgb, var(--d-accent) 65%, transparent) calc(var(--d-led-scroll) * 100% - 18%), var(--d-accent) calc(var(--d-led-scroll) * 100%), color-mix(in srgb, var(--d-accent) 65%, transparent) calc(var(--d-led-scroll) * 100% + 18%), transparent 100%); box-shadow: 0 0 10px 1px color-mix(in srgb, var(--d-accent) 55%, transparent); opacity: 0.5; transition: opacity 200ms ease, box-shadow 200ms ease; }
        [data-d-led="marcante"] .d-led-bar { width: 4px; opacity: 0.85; box-shadow: 0 0 20px 3px color-mix(in srgb, var(--d-accent) 70%, transparent); }
        .d-led-left { left: 0; } .d-led-right { right: 0; }
        @keyframes d-led-pulso { 0% { filter: brightness(1); } 30% { filter: brightness(1.8); } 100% { filter: brightness(1); } }
        .d-led-pulse .d-led-bar { animation: d-led-pulso 500ms ease-out; }
        @media (prefers-reduced-motion: reduce) { .d-led-bar { transition: none; } .d-led-pulse .d-led-bar { animation: none; } }
      `}</style>

      <LedEdges preset={theme.led} />
      <ProgressBar accent={paleta.destaque} />
      <ThemeColorSync corInicial={paleta.fundo} />

      <IntroExperience nome={data.nome} accent={paleta.destaque} ativa={theme.intro === true}>
        <Nav nome={data.nome} links={navLinks} whatsapp={data.whatsapp} />

        <div data-themec={paleta.fundo}>
          <Hero nome={data.nome} hero={s.hero} alinhamento={theme.heroTitulo.alinhamento} waHref={linkWaMain} />
        </div>

        <div
          aria-hidden="true"
          className="h-[5px] border-b-[6px] border-t-2"
          style={{ borderColor: "var(--d-accent)" }}
        />

        {visiveis
          .filter((id) => id !== "hero")
          .map((id) => {
            const tipo = wrapperTipo(id);
            const corTema = id === "avaliacao" ? paleta.destaque : id === "vantagens" || id === "numeros" ? paleta.fundoAlt : paleta.fundo;
            const conteudo =
              tipo === null ? (
                <Fragment key={id}>{secoes[id]?.()}</Fragment>
              ) : (
                <SectionReveal key={id} animacao={theme.animacao} tipo={tipo}>
                  {secoes[id]?.()}
                </SectionReveal>
              );
            return (
              <div key={id} data-themec={corTema}>
                {conteudo}
                {id === "depoimentos" && (
                  <div aria-hidden="true" className="h-[5px] border-b-[6px] border-t-2" style={{ borderColor: "var(--d-accent)" }} />
                )}
              </div>
            );
          })}
      </IntroExperience>

      <WhatsAppFloat whatsapp={data.whatsapp} />
    </div>
  );
}
