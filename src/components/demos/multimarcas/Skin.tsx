import Image from "next/image";
import { Fragment, type CSSProperties, type ReactNode } from "react";

import { secaoAnimada, secoesVisiveis } from "@/lib/demos/estrutura";
import { microcopiaDemo } from "@/lib/demos/microcopy";
import { HEX_RE, luminancia } from "@/lib/demos/contraste";
import type { DemoMicrocopia } from "@/lib/demos/microcopy";
import type { Animacao, DemoData, Densidade, MultimarcasComposicao, SkinProps } from "@/lib/demos/types";
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
import { FormTroca } from "./interactive/FormTroca";
import { coresDoAvatar, faixasDePreco, rotuloFaixa, waHref } from "./interactive/logic";
import { WhatsAppFloat } from "./interactive/WhatsAppFloat";
import { atributosDaComposicao, MULTIMARCAS_COMPOSICAO_CSS, MULTIMARCAS_COMPOSICAO_PADRAO } from "./composicao";
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

/** Como o estoque se deixa recortar, por desenho (§3/§6 do plano). */
const FILTRO_DO_ESTOQUE: Record<MultimarcasComposicao["estoque"], "categoria" | "faixa" | "nenhum"> = {
  grade: "categoria",
  lista: "faixa",
  // A vitrine é de poucos carros, cada um um evento: não se recorta.
  vitrine: "nenhum",
  tabela: "categoria",
};

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
 * Rótulo curto DEFAULT da nav por seção — estrutura do template, usado só
 * quando a seção não tem `rotulo` próprio (DemoSecao.rotulo, a etiqueta
 * editorial em cima do título). `rotulo` vence quando presente — é
 * conteúdo, traduzido pela IA —, e este fallback é cromo: sai da
 * microcópia no idioma da demo, não de um mapa em português.
 */
function rotuloNavPadrao(id: string, m: DemoMicrocopia): string | undefined {
  const mapa: Record<string, string> = {
    estoque: m.navEstoque,
    vantagens: m.navVantagens,
    destaque: m.navDestaque,
    simulador: m.navSimulador,
    avaliacao: m.navAvaliacao,
    depoimentos: m.navDepoimentos,
    contato: m.contato,
  };
  return mapa[id];
}

/**
 * Rótulo editorial acima do título. Vazio ou só espaço: não existe — o
 * elemento com `data-demo-slot` ficava no documento sem texto nenhum.
 */
function Rotulo({ texto, slot }: { texto?: string; slot?: string }) {
  if (!texto?.trim()) return null;
  return (
    <p data-demo-slot={slot} className="mb-3.5 font-[family-name:var(--d-corpo)] text-[13px] font-semibold tracking-[4px] text-[var(--d-accent)]">
      {texto.toUpperCase()}
    </p>
  );
}

/** Uma linha da escada de identidade (ver `Dados`). */
type LinhaDeDado = { chave: string; rotulo: string; valor: string; slot: string; href?: string };

/**
 * A ESCADA DE IDENTIDADE (§7 do plano), na ordem da chapa: endereço (ou
 * cidade) → horário → telefone → Instagram. Cada linha só existe se o valor
 * existe, e um rótulo nunca aparece sem o valor dele — o exemplo desta skin
 * não tem NENHUM desses campos, então zero linhas é o caso normal. O
 * telefone só entra quando é diferente do WhatsApp (que já está no botão).
 */
function escadaDeDados(data: DemoData, m: DemoMicrocopia): LinhaDeDado[] {
  const linhas: LinhaDeDado[] = [];
  const endereco = data.endereco?.trim();
  const cidade = data.cidade?.trim();
  const local = [endereco, cidade].filter(Boolean).join(" — ");
  if (local) linhas.push({ chave: "local", rotulo: m.endereco, valor: local, slot: endereco ? "endereco" : "cidade" });
  if (data.horarios?.trim()) {
    linhas.push({ chave: "horario", rotulo: m.horario, valor: data.horarios.trim(), slot: "horarios" });
  }
  const telefone = data.telefone?.trim();
  if (telefone && telefone !== data.whatsapp?.trim()) {
    linhas.push({ chave: "telefone", rotulo: m.telefone, valor: telefone, slot: "telefone", href: `tel:${telefone.replace(/[^\d+]/g, "")}` });
  }
  const instagram = data.instagram?.trim();
  if (instagram) {
    linhas.push({
      chave: "instagram",
      rotulo: "Instagram",
      valor: instagram.startsWith("@") ? instagram : `@${instagram}`,
      slot: "instagram",
      href: `https://instagram.com/${instagram.replace(/^@/, "")}`,
    });
  }
  return linhas;
}

/**
 * A REGRA DO VAZIO: com zero linhas nada é renderizado — nem borda, nem
 * fundo, nem grade de rótulos. Com uma linha, altura natural.
 */
function Dados({ linhas, className }: { linhas: LinhaDeDado[]; className: string }) {
  if (linhas.length === 0) return null;
  return (
    <dl className={`${className} m-0 flex flex-col gap-3 font-[family-name:var(--d-corpo)]`}>
      {linhas.map((linha) => (
        <div key={linha.chave} className="mm-dado flex flex-col gap-0.5">
          <dt className="text-[11px] font-semibold uppercase tracking-[2px] text-[var(--d-muted)]">{linha.rotulo}</dt>
          <dd data-demo-slot={linha.slot} className="m-0 text-base font-medium leading-relaxed text-[var(--d-text)]">
            {linha.href ? (
              <a href={linha.href} {...(linha.href.startsWith("http") && { target: "_blank", rel: "noopener noreferrer" })}>
                {linha.valor}
              </a>
            ) : (
              linha.valor
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** `<h2>` de seção que não nasce vazio (mesma regra do `Rotulo`). */
function Titulo({ texto, slot, className }: { texto?: string; slot: string; className: string }) {
  if (!texto?.trim()) return null;
  return (
    <h2 data-demo-slot={slot} className={className}>
      {texto}
    </h2>
  );
}

export function MultimarcasVortice({ data, theme, idioma, moeda }: SkinProps) {
  const { paleta, fontes } = theme;
  const fundoClaro = HEX_RE.test(paleta.fundo) ? luminancia(paleta.fundo) > 0.4 : true;
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
    // Sombra por token (§1 do plano): `rgba(60,30,10,…)` era calibrada para
    // o creme — em fundo escuro sumia ou sujava. Fundo claro: a tinta da
    // própria paleta, diluída; fundo escuro: preto, mais denso (sombra
    // clara sobre escuro vira brilho, não profundidade).
    "--mm-sombra": fundoClaro
      ? "color-mix(in srgb, var(--d-text) 16%, transparent)"
      : "rgba(0, 0, 0, 0.45)",
    "--mm-sombra-forte": fundoClaro
      ? "color-mix(in srgb, var(--d-text) 28%, transparent)"
      : "rgba(0, 0, 0, 0.6)",
  } as CSSProperties;

  const comp = theme.multimarcas ?? MULTIMARCAS_COMPOSICAO_PADRAO;
  const m = microcopiaDemo(idioma);
  const linhasDeDado = escadaDeDados(data, m);
  // A escada aparece UMA vez por página: na busca (Pátio) ela sobe para a
  // abertura, e o contato não a repete.
  const dadosNoContato = comp.abertura === "busca" ? [] : linhasDeDado;
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
    .map((id) => ({ id, rotulo: s[id]?.rotulo?.trim() || rotuloNavPadrao(id, m) || s[id]?.titulo?.trim() || id }));

  // `waHref` devolve undefined sem número — cada CTA de WhatsApp some
  // junto, em vez de virar link morto (ver interactive/logic.ts).
  const linkWaMain = waHref(data.whatsapp, m.maisInformacoesDe(data.nome));
  const linkWaAvaliacao = waHref(data.whatsapp, m.trocaMensagem);
  const linkWaDestaque = waHref(
    data.whatsapp,
    m.interesseNoDestaque(s.destaque?.titulo?.trim() || m.veiculoEmDestaque, data.nome),
  );

  const marcas = (s.avaliacao?.itens ?? []).map((i) => i.titulo).filter((t) => t?.trim());
  const titulo2 =
    "font-[family-name:var(--d-display)] text-[clamp(34px,5.4vw,60px)] font-extrabold uppercase leading-[1.05] tracking-[0.5px] text-[var(--d-text)]";

  const secoes: Record<string, () => ReactNode> = {
    /* ── Estoque ─────────────────────────────────────────────── */
    estoque: () =>
      data.servicos.length > 0 && (
        <section id="estoque" className="mm-estoque mm-caixa px-[max(24px,5vw)] py-[var(--d-sec-y)]">
          <div className="mm-cabeca">
            <Rotulo texto={s.estoque?.rotulo} slot="secoes.estoque.rotulo" />
            <Titulo texto={s.estoque?.titulo} slot="secoes.estoque.titulo" className={titulo2} />
          </div>
          <CarFilterGrid
            servicos={data.servicos}
            imagens={data.imagens}
            imagensAlt={data.imagensAlt}
            ctaDetalhes={s.estoque?.ctaSecundaria}
            ctaInteresse={s.estoque?.cta}
            textoGarantia={s.estoque?.texto}
            whatsapp={data.whatsapp}
            idioma={idioma}
            moeda={moeda}
            simulavel={visiveis.includes("simulador")}
            desenho={comp.estoque}
            modoFiltro={FILTRO_DO_ESTOQUE[comp.estoque]}
          />
        </section>
      ),

    /* ── Vantagens ───────────────────────────────────────────── */
    vantagens: () =>
      (s.vantagens?.itens?.length ?? 0) > 0 && (
        <section
          id="vantagens"
          className="mm-vantagens border-t"
          style={{ background: "var(--d-bg-alt)", borderColor: "var(--d-border)" }}
        >
          <div className="mm-caixa">
            <div className="mm-cabeca">
              <Rotulo texto={s.vantagens?.rotulo} slot="secoes.vantagens.rotulo" />
              <Titulo texto={s.vantagens?.titulo} slot="secoes.vantagens.titulo" className={titulo2} />
            </div>
            <div className="mm-vant-lista">
              {s.vantagens?.itens?.map((item, i) => (
                <SectionReveal key={item.titulo} animacao={theme.animacao} tipo="padrao" delay={i * 0.09}>
                  <div className="mm-vant-item">
                    <span className="mm-vant-num font-[family-name:var(--d-mono)] font-semibold" aria-hidden="true">
                      {i + 1}
                    </span>
                    <div className="mm-vant-textos">
                      <h3
                        data-demo-slot={`secoes.vantagens.itens.${i}.titulo`}
                        className="mm-vant-titulo font-[family-name:var(--d-display)] text-xl font-bold uppercase tracking-[0.5px] text-[var(--d-text)]"
                      >
                        {item.titulo}
                      </h3>
                      {item.texto?.trim() && (
                        <p
                          data-demo-slot={`secoes.vantagens.itens.${i}.texto`}
                          className="mt-4 font-[family-name:var(--d-corpo)] text-sm leading-relaxed text-[var(--d-muted)]"
                        >
                          {item.texto}
                        </p>
                      )}
                    </div>
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
          className="mm-numeros border-b"
          style={{ background: "var(--d-bg-alt)", borderColor: "var(--d-border)" }}
        >
          <div className="mm-caixa mm-num-lista">
            {s.numeros?.itens?.map((item, i) => (
              <div key={i} className="mm-num-item">
                <p
                  data-demo-slot={`secoes.numeros.itens.${i}.titulo`}
                  className="mm-num-valor font-[family-name:var(--d-mono)] font-semibold tabular-nums text-[var(--d-text)]"
                >
                  <StatCounter valor={item.titulo} corDestaque={paleta.destaque} idioma={idioma} />
                </p>
                {item.detalhe && (
                  <p
                    data-demo-slot={`secoes.numeros.itens.${i}.detalhe`}
                    className="mm-num-detalhe mt-2 font-[family-name:var(--d-corpo)] text-[13px] font-semibold tracking-[1px] text-[var(--d-muted)]"
                  >
                    {item.detalhe}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      ),

    /* ── Destaque (ficha técnica) ──────────────────────────────── */
    destaque: () => (
      <section id="destaque" className="mm-destaque">
        <div className="mm-caixa mm-dest-grade">
          <div className="mm-dest-foto border" style={{ borderColor: "var(--d-border)", borderRadius: "var(--d-radius)" }}>
            <Image
              src={data.imagens.destaque}
              alt={data.imagensAlt?.destaque ?? ""}
              fill
              unoptimized
              data-demo-slot="imagens.destaque"
              className="object-cover"
              sizes="(min-width: 768px) 50vw, 100vw"
            />
          </div>
          <div className="mm-dest-corpo">
            <Rotulo texto={s.destaque?.rotulo} slot="secoes.destaque.rotulo" />
            <Titulo
              texto={s.destaque?.titulo}
              slot="secoes.destaque.titulo"
              className="mm-dest-titulo font-[family-name:var(--d-display)] font-extrabold uppercase leading-[1.05] tracking-[0.5px] text-[var(--d-text)]"
            />
            {s.destaque?.texto?.trim() && (
              <p
                data-demo-slot="secoes.destaque.texto"
                className="mm-dest-texto mt-3 font-[family-name:var(--d-corpo)] text-[15px] leading-relaxed text-[var(--d-muted)]"
              >
                {s.destaque.texto}
              </p>
            )}
            {(s.destaque?.itens?.length ?? 0) > 0 && (
              <dl className="mm-ficha border-t" style={{ borderColor: "var(--d-border)" }}>
                {s.destaque?.itens?.map((item, i) => (
                  <div key={i} className="mm-ficha-linha">
                    <dt
                      data-demo-slot={`secoes.destaque.itens.${i}.titulo`}
                      className="font-[family-name:var(--d-corpo)] text-[13px] font-semibold tracking-[1px] text-[var(--d-muted)]"
                    >
                      {item.titulo}
                    </dt>
                    <dd
                      data-demo-slot={`secoes.destaque.itens.${i}.texto`}
                      className="font-[family-name:var(--d-mono)] text-[15px] text-[var(--d-text)]"
                    >
                      {item.texto}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            {s.destaque?.cta?.trim() && linkWaDestaque && (
              <a
                href={linkWaDestaque}
                target="_blank"
                rel="noopener noreferrer"
                data-demo-slot="secoes.destaque.cta"
                className="d-press mt-7 inline-flex items-center justify-center gap-2.5 rounded-lg px-7 py-4 font-[family-name:var(--d-corpo)] text-sm font-bold tracking-[1px]"
                style={{
                  background: "var(--d-accent)",
                  color: "var(--d-accent-ink)",
                  boxShadow: "0 8px 22px color-mix(in srgb, var(--d-accent) 25%, transparent)",
                }}
              >
                {s.destaque.cta}
              </a>
            )}
          </div>
        </div>
      </section>
    ),

    /* ── Simulador de financiamento ─────────────────────────── */
    simulador: () => (
      <section id="simulador" className="mm-simulador">
        <div className="mm-caixa mm-sim-secao">
          <div className="mm-cabeca mm-sim-cabeca">
            <Rotulo texto={s.simulador?.rotulo} slot="secoes.simulador.rotulo" />
            <Titulo texto={s.simulador?.titulo} slot="secoes.simulador.titulo" className={titulo2} />
            {s.simulador?.texto?.trim() && (
              <p
                data-demo-slot="secoes.simulador.texto"
                className="mt-3 font-[family-name:var(--d-corpo)] text-[15px] text-[var(--d-muted)]"
              >
                {s.simulador.texto}
              </p>
            )}
          </div>
          <Simulador
            whatsapp={data.whatsapp}
            telefone={data.telefone}
            ctaLabel={s.simulador?.cta}
            servicos={data.servicos}
            idioma={idioma}
            moeda={moeda}
          />
        </div>
      </section>
    ),

    /* ── Avaliação (venda seu carro) ─────────────────────────── */
    avaliacao: () => (
      <section
        id="avaliacao"
        className={`mm-avaliacao ${centro("avaliacao") ? "text-center" : ""}`}
      >
        <div className={`mm-caixa mm-aval-caixa ${centro("avaliacao") ? "justify-center text-center" : ""}`}>
          <div className="mm-aval-texto">
            {s.avaliacao?.rotulo?.trim() && (
              <p
                data-demo-slot="secoes.avaliacao.rotulo"
                className="mb-3.5 font-[family-name:var(--d-corpo)] text-[13px] font-semibold tracking-[4px]"
              >
                {s.avaliacao.rotulo.toUpperCase()}
              </p>
            )}
            <Titulo
              texto={s.avaliacao?.titulo}
              slot="secoes.avaliacao.titulo"
              className="mm-aval-titulo font-[family-name:var(--d-display)] font-extrabold uppercase tracking-[0.5px]"
            />
            {s.avaliacao?.texto?.trim() && (
              <p
                data-demo-slot="secoes.avaliacao.texto"
                className="mt-4 max-w-[440px] text-pretty font-[family-name:var(--d-corpo)] text-[15px] font-medium leading-relaxed"
              >
                {s.avaliacao.texto}
              </p>
            )}
          </div>
          {comp.avaliacao === "formulario" ? (
            <div className="mm-aval-form">
              <FormTroca whatsapp={data.whatsapp} cta={s.avaliacao?.cta} marcas={marcas} idioma={idioma} />
            </div>
          ) : (
            s.avaliacao?.cta?.trim() &&
            linkWaAvaliacao && (
            <a
              href={linkWaAvaliacao}
              target="_blank"
              rel="noopener noreferrer"
              data-demo-slot="secoes.avaliacao.cta"
              className="mm-aval-acao d-press rounded-full px-10 py-5 font-[family-name:var(--d-corpo)] text-[15px] font-bold tracking-[1.5px] transition-transform"
              style={{ background: "var(--d-text)", color: "var(--d-bg)" }}
            >
              {s.avaliacao.cta.toUpperCase()}
            </a>
            )
          )}
        </div>
        {/* As marcas correm só na faixa e na linha; na tarja e no
            formulário ficam paradas, numa lista — nenhuma composição
            esconde o texto delas. */}
        {comp.avaliacao === "faixa" || comp.avaliacao === "linha" ? (
          <Marquee marcas={marcas} />
        ) : (
          marcas.length > 0 && (
            <ul className="mm-caixa mm-marcas font-[family-name:var(--d-mono)] font-semibold tracking-[2px]">
              {marcas.map((marca, i) => (
                <li key={`${marca}-${i}`}>{marca.toUpperCase()}</li>
              ))}
            </ul>
          )
        )}
      </section>
    ),

    /* ── Depoimentos ─────────────────────────────────────────── */
    depoimentos: () =>
      data.depoimentos.length > 0 && (
        <section id="depoimentos" className="mm-depoimentos">
          <div className="mm-caixa">
            <div className="mm-cabeca">
              <Rotulo texto={s.depoimentos?.rotulo} slot="secoes.depoimentos.rotulo" />
              <Titulo texto={s.depoimentos?.titulo} slot="secoes.depoimentos.titulo" className={titulo2} />
            </div>
            <TestimonialCarousel
              depoimentos={data.depoimentos}
              animacao={theme.animacao}
              coresAvatar={coresDoAvatar(paleta)}
              desenho={comp.depoimentos}
            />
          </div>
        </section>
      ),

    /* ── Contato (rodapé) ───────────────────────────────────────
       A regra do vazio (§7): a grade de duas colunas só existe se há o
       que pôr nela — a escada de identidade de um lado, rota e WhatsApp
       do outro. Zero dado é o caso NORMAL (harness, avulsa, lead recém-
       criado): aí o rodapé é título + um link para o estoque. */
    contato: () => {
      const temAcoes = Boolean(data.endereco || (s.contato?.cta?.trim() && linkWaMain));
      const temGrade = dadosNoContato.length > 0 || temAcoes;
      const rota = data.endereco ? encodeURIComponent(`${data.endereco} ${data.cidade ?? ""}`.trim()) : "";
      return (
        <footer id="contato" className="mm-contato" style={{ background: "var(--d-bg-alt)" }}>
          <section className={`mm-contato-secao ${centro("contato") ? "text-center" : ""}`}>
            <div
              className={`mm-caixa mm-contato-caixa ${temGrade ? "" : "mm-sem-grade"} ${
                centro("contato") ? "justify-items-center" : ""
              }`}
            >
              <div className="mm-contato-marca">
                <Rotulo texto={s.contato?.rotulo} slot="secoes.contato.rotulo" />
                <Titulo
                  texto={s.contato?.titulo}
                  slot="secoes.contato.titulo"
                  className="mm-contato-titulo mb-6 font-[family-name:var(--d-display)] text-[clamp(34px,5.4vw,58px)] font-extrabold uppercase leading-[1.05] tracking-[0.5px] text-[var(--d-text)]"
                />
                <Dados linhas={dadosNoContato} className="mm-dados" />
                {!temGrade && s.hero?.cta?.trim() && visiveis.includes("estoque") && (
                  <a
                    href="#estoque"
                    data-demo-slot="secoes.hero.cta"
                    className="d-press d-cta-gradiente inline-flex items-center justify-center rounded-full px-[30px] py-4 font-[family-name:var(--d-corpo)] text-sm font-bold tracking-[1.5px]"
                  >
                    {s.hero.cta.toUpperCase()}
                  </a>
                )}
              </div>
              {temAcoes && (
                <div className="mm-contato-acoes">
                  {data.endereco && (
                    <a
                      href={`https://waze.com/ul?q=${rota}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="d-press flex items-center justify-between rounded-lg border px-6 py-5 font-[family-name:var(--d-corpo)] text-[15px] font-bold text-[var(--d-text)] transition-colors"
                      style={{ background: "var(--d-bg-elev)", borderColor: "var(--d-border)" }}
                    >
                      <span>{m.abrirNoWaze}</span>
                      <span style={{ color: "var(--d-accent)" }}>→</span>
                    </a>
                  )}
                  {data.endereco && (
                    <a
                      href={`https://maps.google.com/?q=${rota}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="d-press flex items-center justify-between rounded-lg border px-6 py-5 font-[family-name:var(--d-corpo)] text-[15px] font-bold text-[var(--d-text)] transition-colors"
                      style={{ background: "var(--d-bg-elev)", borderColor: "var(--d-border)" }}
                    >
                      <span>{m.abrirNoMaps}</span>
                      <span style={{ color: "var(--d-accent)" }}>→</span>
                    </a>
                  )}
                  {s.contato?.cta?.trim() && linkWaMain && (
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
              )}
            </div>

            <div className="mm-caixa mm-contato-barra border-t" style={{ borderColor: "var(--d-border)" }}>
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
              {/* Rede social só com o dado do lead. Facebook e YouTube saíram:
                  não existe campo para eles em DemoData, e os dois apontavam
                  sempre para #topo — ícone que parece link e não leva a nada. */}
              {data.instagram?.trim() && (
                <a
                  href={`https://instagram.com/${data.instagram.trim().replace(/^@/, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  data-demo-slot="instagram"
                  className="d-press flex h-[42px] w-[42px] items-center justify-center rounded-full border transition-colors"
                  style={{ borderColor: "var(--d-border)" }}
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M3 3h18v18H3V3Zm9 4.8a4.2 4.2 0 1 0 0 8.4 4.2 4.2 0 0 0 0-8.4Zm5.4-.6a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0Z" />
                  </svg>
                </a>
              )}
              <p className="w-full font-[family-name:var(--d-corpo)] text-xs text-[var(--d-muted)]">
                © {new Date().getFullYear()} {data.nome}.
                {/* Sem fallback: "Conteúdo ilustrativo." cravado aqui saía em
                    português em toda demo, em qualquer idioma. */}
                {s.contato?.texto?.trim() && (
                  <>
                    {" "}
                    <span data-demo-slot="secoes.contato.texto">{s.contato.texto.trim()}</span>
                  </>
                )}
              </p>
            </div>
          </section>
        </footer>
      );
    },
  };

  return (
    <div
      style={vars}
      {...atributosDaComposicao(comp)}
      data-d-hover={theme.hover}
      data-d-clique={theme.clique}
      data-d-anim={theme.animacao}
      className="mm min-h-screen overflow-x-clip bg-[var(--d-bg)] font-[family-name:var(--d-corpo)] text-[var(--d-text)] selection:bg-[var(--d-accent)] selection:text-[var(--d-accent-ink)]"
    >
      <style>{MULTIMARCAS_COMPOSICAO_CSS}</style>
      <style>{`
        html { scroll-behavior: smooth; }
        /* A nav é fixa: sem margem, um salto de âncora (#simulador, #faixa-N)
           deixava o rótulo da seção embaixo dela. */
        section[id], footer[id] { scroll-margin-top: 88px; }
        ::selection { background: var(--d-accent); color: var(--d-accent-ink); }

        .d-press { transition: transform var(--d-anim-duration) var(--d-anim-ease); }
        [data-d-clique="pressao"]:not([data-d-anim="nenhuma"]) .d-press:active { transform: scale(0.96); transition-duration: 90ms; }
        @keyframes d-clique-pulso { 0% { transform: scale(1); } 40% { transform: scale(1.05); } 100% { transform: scale(1); } }
        [data-d-clique="pulso"]:not([data-d-anim="nenhuma"]) .d-press:active { animation: d-clique-pulso 280ms var(--d-anim-ease); }
        @media (prefers-reduced-motion: reduce) { .d-press:active { transform: none; animation: none; } }

        .d-card-hover { transition: transform var(--d-anim-duration) var(--d-anim-ease), box-shadow var(--d-anim-duration) var(--d-anim-ease), border-color var(--d-anim-duration) var(--d-anim-ease); }
        .d-card-hover:hover { transform: translateY(var(--d-hover-lift)); border-color: color-mix(in srgb, var(--d-accent) 45%, transparent); box-shadow: 0 26px 55px var(--mm-sombra); }
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
        .d-range::-webkit-slider-thumb { -webkit-appearance: none; width: 30px; height: 30px; border-radius: 50%; background: var(--d-bg-elev); border: 5px solid var(--d-accent); margin-top: -10px; box-shadow: 0 6px 18px var(--mm-sombra-forte); }
        .d-range::-moz-range-track { height: 10px; border-radius: 999px; background: linear-gradient(90deg, var(--d-accent) var(--fill,20%), var(--d-border) var(--fill,20%)); }
        .d-range::-moz-range-thumb { width: 30px; height: 30px; border-radius: 50%; background: var(--d-bg-elev); border: 5px solid var(--d-accent); box-shadow: 0 6px 18px var(--mm-sombra-forte); }

      `}</style>

      <LedEdges
        preset={theme.led}
        estilo={theme.ledEstilo}
        cores={theme.ledCores}
        corBase={paleta.destaque}
      />
      <ProgressBar accent={paleta.destaque} />

      <IntroExperience nome={data.nome} accent={paleta.destaque} ativa={theme.intro === true} idioma={idioma}>
        <Nav nome={data.nome} links={navLinks} whatsapp={data.whatsapp} idioma={idioma} />

        {/* O hero é renderizado FORA do `visiveis.map` (é fixo e vem antes
            da régua de acento), mas continua precisando do marcador de
            seção: é a única âncora presente em toda skin, e sem ele o
            enquadramento de captura não acha o hero desta (ver
            "Capturas por âncora de seção" em ARCHITECTURE.md). A div que a
            skin já tinha é a que recebe o marcador — sem envelope extra. */}
        <div data-d-secao="hero" data-d-secao-anim={secaoAnimada(data, "hero") ? "1" : "0"}>
          <Hero
            nome={data.nome}
            hero={s.hero}
            alinhamento={theme.heroTitulo.alinhamento}
            waHref={linkWaMain}
            idioma={idioma}
            abertura={comp.abertura}
            foto={data.imagens.hero ? { src: data.imagens.hero, alt: data.imagensAlt?.hero ?? "" } : undefined}
            faixas={
              visiveis.includes("estoque")
                ? faixasDePreco(data.servicos).map((f) => ({ id: f.id, rotulo: rotuloFaixa(f, m, idioma, moeda) }))
                : []
            }
            identidade={
              comp.abertura === "busca" && linhasDeDado.length > 0 ? (
                <Dados linhas={linhasDeDado} className="mm-dados mm-dados-barra" />
              ) : undefined
            }
            ctaTroca={
              comp.abertura === "dividida" && visiveis.includes("avaliacao") && s.avaliacao?.cta?.trim()
                ? { rotulo: s.avaliacao.cta, href: "#avaliacao" }
                : undefined
            }
          />
        </div>

        <div
          aria-hidden="true"
          className="h-[5px] border-b-[6px] border-t-2"
          style={{ borderColor: "var(--d-accent)" }}
        />

        {visiveis
          .filter((id) => id !== "hero")
          .map((id) => {
            // Animação desligada nesta seção (aba Estrutura): sem wrapper de
            // entrada nenhum — o mesmo que o nível global "nenhuma" faz.
            const animada = secaoAnimada(data, id);
            const tipo = animada ? wrapperTipo(id) : null;
            const conteudo =
              tipo === null ? (
                <Fragment key={id}>{secoes[id]?.()}</Fragment>
              ) : (
                <SectionReveal key={id} animacao={theme.animacao} tipo={tipo}>
                  {secoes[id]?.()}
                </SectionReveal>
              );
            return (
              // A div que esta skin já tinha por seção é a que recebe o
              // marcador — sem envelope extra.
              <div key={id} data-d-secao={id} data-d-secao-anim={animada ? "1" : "0"}>
                {conteudo}
                {id === "depoimentos" && (
                  <div aria-hidden="true" className="h-[5px] border-b-[6px] border-t-2" style={{ borderColor: "var(--d-accent)" }} />
                )}
              </div>
            );
          })}
      </IntroExperience>

      <WhatsAppFloat whatsapp={data.whatsapp} idioma={idioma} />
    </div>
  );
}
