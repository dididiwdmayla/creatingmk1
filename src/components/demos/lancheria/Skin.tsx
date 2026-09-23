import Image from "next/image";
import { type CSSProperties, type ReactNode } from "react";

import { SecaoMarcada } from "@/lib/demos/animacao/SecaoMarcada";
import { secaoAnimada, secoesVisiveis } from "@/lib/demos/estrutura";
import { microcopiaDemo } from "@/lib/demos/microcopy";
import type { DemoMicrocopia } from "@/lib/demos/microcopy";
import type { Animacao, DemoData, Densidade, SkinProps } from "@/lib/demos/types";
import { CategoryNav } from "./interactive/CategoryNav";
import { CompactSection } from "./interactive/CompactSection";
import { BurgerCard } from "./interactive/BurgerCard";
import { DecorativeFloat } from "./interactive/DecorativeFloat";
import { Header } from "./interactive/Header";
import { IntroExperience } from "./interactive/IntroExperience";
import { LedEdges } from "./interactive/LedEdges";
import { OrderCta } from "./interactive/OrderCta";
import { SectionReveal, type RevealTipo } from "./interactive/SectionReveal";
import {
  floatsVisiveis,
  LANCHERIA_COMPOSICAO_CSS,
  LANCHERIA_COMPOSICAO_PADRAO,
  navVisivel,
} from "./composicao";
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
 *
 * As CINCO seções têm um caminho de render só, parametrizado por
 * `theme.chapa` (`ChapaComposicao`): o JSX emite sempre a mesma árvore, com
 * as mesmas classes `ch-*`, e quem decide a FORMA é a folha de
 * ./composicao.ts, lida pelos `data-ch-*` do wrapper. É por isso que as
 * quatro variantes conseguem ser quatro tipos de casa sem que `data-d-secao`
 * deixe de ser garantia (ver __tests__/variantes.test.tsx).
 *
 * Fallback de slot de texto usa `||` com `trim()`, nunca `??`: `??` só
 * cobre `undefined`, e o editor grava STRING VAZIA quando o operador limpa
 * o campo. Com `??`, um `secoes.hero.titulo` salvo vazio fazia o `<h1>`
 * renderizar em branco — e a captura de prospecção do hero, que é a
 * miniatura que chega no WhatsApp, saía sem o nome do negócio.
 *
 * A única decisão de composição que o JSX toma — e toma porque folha de
 * estilo não muda nome de tag — é `contato` virar `<section>` na `praca`:
 * lá o bloco "onde estamos hoje" abre a página, e um `<footer>` no topo
 * seria mentira semântica. Mesmo `data-d-secao`, mesmos slots, mesma âncora.
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

/** Uma linha de dado da escada de identidade (ver `Dados` abaixo). */
type LinhaDeDado = {
  chave: string;
  rotulo: string;
  valor: string;
  slot: string;
  href?: string;
};

/**
 * A ESCADA DE IDENTIDADE, na ordem do plano (§7): endereço (ou cidade) →
 * horário → telefone → instagram.
 *
 * **Cada linha só existe se o valor existe, e um rótulo nunca aparece sem o
 * valor dele.** Não é borda rara: `horarios`, `telefone`, `whatsapp`,
 * `instagram` e `cidade` nunca estiveram no exemplo desta skin, e o harness,
 * a demo avulsa e o lead recém-criado chegam aqui com a lista VAZIA. É o
 * caso normal, e é por isso que quem desenha o cartão é a lista, não o
 * contrário.
 *
 * O telefone só entra quando é DIFERENTE do WhatsApp: repetir o mesmo número
 * que já está atrás do botão de pedido é ocupar uma linha à toa.
 */
function escadaDeDados(data: DemoData, m: DemoMicrocopia): LinhaDeDado[] {
  const linhas: LinhaDeDado[] = [];
  const local = data.endereco ?? data.cidade;
  if (local) {
    linhas.push({
      chave: "local",
      rotulo: m.endereco,
      valor: local,
      slot: data.endereco ? "endereco" : "cidade",
    });
  }
  if (data.horarios) {
    linhas.push({ chave: "horario", rotulo: m.horario, valor: data.horarios, slot: "horarios" });
  }
  if (data.telefone && data.telefone !== data.whatsapp) {
    linhas.push({ chave: "telefone", rotulo: m.telefone, valor: data.telefone, slot: "telefone" });
  }
  if (data.instagram) {
    linhas.push({
      chave: "instagram",
      rotulo: m.redes,
      valor: data.instagram,
      slot: "instagram",
      href: `https://instagram.com/${data.instagram.replace(/^@/, "")}`,
    });
  }
  return linhas;
}

/**
 * A REGRA DO VAZIO: com zero linhas, nada é renderizado — nem borda, nem
 * fundo elevado, nem grade de rótulos, nem divisória. A ficha do balcão
 * degrada para o tratamento tipográfico puro (nome + frase + CTA), que é
 * exatamente o que a pilha faz. Nada de caixa vazia, nada de "Endereço não
 * informado", nada de espaço reservado.
 *
 * Com UMA linha, o cartão tem uma linha e altura natural: quem manda no
 * tamanho é o conteúdo.
 */
function Dados({ linhas, className }: { linhas: LinhaDeDado[]; className: string }) {
  if (linhas.length === 0) return null;
  return (
    <dl className={`${className} font-[family-name:var(--d-corpo)] text-sm`}>
      {linhas.map((linha) => (
        <div key={linha.chave} className="ch-dado">
          <dt className="ch-dado-rotulo font-[family-name:var(--d-display)] text-[11px] uppercase tracking-widest text-[var(--d-muted)]">
            {linha.rotulo}
          </dt>
          <dd className="ch-dado-valor text-[var(--d-text)]">
            {linha.href ? (
              <a
                href={linha.href}
                target="_blank"
                rel="noopener noreferrer"
                data-demo-slot={linha.slot}
                className="transition-colors hover:text-[var(--d-accent-2)]"
              >
                {linha.valor}
              </a>
            ) : (
              <span data-demo-slot={linha.slot}>{linha.valor}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function LancheriaChapaBurger({ data, theme, idioma, moeda }: SkinProps) {
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
    "--d-anim-ease": "cubic-bezier(0.16, 1, 0.3, 1)",
    "--d-hover-scale": ANIM_HOVER_SCALE[theme.animacao],
    "--d-hover-lift": ANIM_HOVER_LIFT[theme.animacao],
  } as CSSProperties;

  /**
   * A composição desta variante. Tema sem `chapa` (demo antiga, preset
   * cru, harness sem preset) cai no desenho do material bruto — a skin
   * nunca fica sem forma.
   */
  const comp = theme.chapa ?? LANCHERIA_COMPOSICAO_PADRAO;

  /**
   * A escada de dados aparece UMA vez por página, e quem a carrega é a
   * ficha quando ela existe. Não é "esconder texto" do contato: é não
   * imprimir o mesmo endereço duas vezes numa página de cinco seções. As
   * outras três aberturas não têm bloco de identidade, então a escada fica
   * onde sempre esteve — no contato.
   */
  const linhasDeDado = escadaDeDados(data, m);
  const dadosNaAbertura = comp.abertura === "ficha";

  const s = data.secoes;

  // Um flutuante decorativo por seção que o declara (ver decorativeFloats.ts);
  // a imagem em si é um slot normal de DemoData.imagens, com placeholder.
  // Composição que não usa decoração flutuante NÃO RENDERIZA o elemento —
  // esconder por CSS deixaria caixa medível, e o portão de `imagensOcultas`
  // exige zero (ver `floatsVisiveis` em ./composicao.ts).
  const comFloats = floatsVisiveis(comp);
  const floatDe = (secaoId: string) =>
    comFloats ? LANCHERIA_DECORATIVE_FLOATS.find((f) => f.secaoId === secaoId) : undefined;

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
        className="ch-hero relative min-h-screen w-full overflow-hidden pt-16"
      >
        <div className="ch-hero-fundo bg-[var(--d-bg)]">
          <Placeholder
            src={data.imagens.hero}
            alt={data.imagensAlt?.hero ?? ""}
            sizes="100vw"
            priority
            slot="imagens.hero"
          />
          <div className="ch-hero-veu" />
        </div>

        <div className="ch-hero-corpo px-4 pt-16">
          <div className="mb-6 flex flex-col leading-[0.9]">
            <h1
              data-demo-slot="secoes.hero.titulo"
              className="ch-hero-titulo w-full whitespace-pre-line font-[family-name:var(--d-hero-font)] uppercase leading-[0.85] tracking-tight"
              style={
                {
                  fontSize: "calc(var(--ch-hero-tam) * var(--d-hero-escala))",
                  color: "var(--ch-hero-cor)",
                  WebkitTextStroke: "var(--ch-hero-traco) var(--d-bg)",
                  filter: "var(--ch-hero-sombra)",
                  paintOrder: "stroke fill",
                } as CSSProperties
              }
            >
              {s.hero?.titulo?.trim() || data.nome}
            </h1>
          </div>

          {s.hero?.texto && (
            <p
              data-demo-slot="secoes.hero.texto"
              className="ch-hero-texto mb-10 max-w-xl font-[family-name:var(--d-corpo)] text-lg font-light leading-relaxed text-[var(--d-text)]/85 md:text-2xl"
            >
              {s.hero.texto}
            </p>
          )}

          {s.hero?.cta && (
            <a
              href="#cardapio"
              data-demo-slot="secoes.hero.cta"
              className="ch-hero-cta d-cta-pill d-cta-pill-lg"
            >
              {s.hero.cta}
            </a>
          )}

          {dadosNaAbertura && <Dados linhas={linhasDeDado} className="ch-ficha ch-dados" />}
        </div>

        <div className="ch-hero-role flex flex-col items-center gap-2 text-[var(--d-text)]/80">
          <span className="font-[family-name:var(--d-display)] text-sm uppercase tracking-widest">
            {m.role}
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
        <section id="cardapio" className="ch-cardapio relative z-10 mx-auto max-w-7xl px-4 pb-8 pt-16">
          <div className="ch-cabeca mb-12 flex items-end justify-between gap-4 border-b border-[var(--d-border)] pb-4">
            <div>
              <Rotulo texto={s.cardapio?.rotulo} slot="secoes.cardapio.rotulo" />
              <h2
                data-demo-slot="secoes.cardapio.titulo"
                className="ch-titulo font-[family-name:var(--d-display)] text-4xl uppercase italic text-[var(--d-accent-2)] md:text-5xl"
              >
                {s.cardapio?.titulo}
              </h2>
            </div>
          </div>

          <div className="ch-cardapio-lista mb-8">
            {data.servicos.map((servico, i) => (
              <BurgerCard
                key={servico.nome}
                servico={servico}
                index={i}
                composicao={comp.cardapio}
                imageSrc={data.imagens[`lanche-${i + 1}`] ?? data.imagens.hero}
                platoVazioSrc={data.imagens["prato-vazio"]}
                imageAlt={data.imagensAlt?.[`lanche-${i + 1}`] ?? ""}
                platoVazioAlt={data.imagensAlt?.["prato-vazio"] ?? ""}
                animacao={theme.animacao}
                whatsapp={data.whatsapp}
                idioma={idioma}
                moeda={moeda}
              />
            ))}
          </div>

          {floatDe("cardapio") && (
            <DecorativeFloat
              def={floatDe("cardapio")!}
              src={data.imagens[floatDe("cardapio")!.slot] ?? data.imagens.hero}
              alt={data.imagensAlt?.[floatDe("cardapio")!.slot] ?? ""}
            />
          )}
        </section>
      ),

    /* ── Bebidas ────────────────────────────────────────────── */
    bebidas: () =>
      (s.bebidas?.itens?.length ?? 0) > 0 && (
        <section id="bebidas" className="ch-bebidas relative z-10 mx-auto max-w-7xl px-4 pb-12 pt-8">
          <div className="ch-cabeca mb-6 flex items-center border-b border-[var(--d-border)] pb-3">
            <div>
              <h2
                data-demo-slot="secoes.bebidas.titulo"
                className="ch-titulo font-[family-name:var(--d-display)] text-2xl uppercase italic tracking-tight text-[var(--d-accent-2)] md:text-3xl"
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
            alts={data.imagensAlt}
            slotPrefix="bebida"
            whatsapp={data.whatsapp}
            idioma={idioma}
          />
          {floatDe("bebidas") && (
            <DecorativeFloat
              def={floatDe("bebidas")!}
              src={data.imagens[floatDe("bebidas")!.slot] ?? data.imagens.hero}
              alt={data.imagensAlt?.[floatDe("bebidas")!.slot] ?? ""}
            />
          )}
        </section>
      ),

    /* ── Acompanhamentos ────────────────────────────────────── */
    acompanhamentos: () =>
      (s.acompanhamentos?.itens?.length ?? 0) > 0 && (
        <section id="acompanhamentos" className="ch-acomp relative z-10 mx-auto max-w-7xl px-4 pb-12 pt-8">
          <div className="ch-cabeca mb-6 flex items-center border-b border-[var(--d-border)] pb-3">
            <div>
              <h2
                data-demo-slot="secoes.acompanhamentos.titulo"
                className="ch-titulo font-[family-name:var(--d-display)] text-2xl uppercase italic tracking-tight text-[var(--d-accent-2)] md:text-3xl"
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
            alts={data.imagensAlt}
            slotPrefix="acompanhamento"
            whatsapp={data.whatsapp}
            idioma={idioma}
          />
          {floatDe("acompanhamentos") && (
            <DecorativeFloat
              def={floatDe("acompanhamentos")!}
              src={data.imagens[floatDe("acompanhamentos")!.slot] ?? data.imagens.hero}
              alt={data.imagensAlt?.[floatDe("acompanhamentos")!.slot] ?? ""}
            />
          )}
        </section>
      ),

    /* ── Contato ───────────────────────────────────────────── */
    contato: () => {
      /**
       * `<section>` na `praca`, `<footer>` nas outras três: lá o bloco
       * "onde estamos hoje" é a PRIMEIRA coisa da página (ver a ordem da
       * variante), e rodapé no topo seria mentira semântica. É a única
       * decisão de composição que o JSX toma — folha de estilo não troca
       * nome de tag.
       */
      const Caixa = comp.contato === "bloco" ? "section" : "footer";
      return (
        <Caixa
          id="contato"
          className={`ch-contato relative overflow-hidden border-t-8 border-[var(--d-accent-2)] px-4 pb-8 pt-16 ${
            centro("contato") ? "text-center" : "text-center md:text-left"
          }`}
          style={{ backgroundColor: "var(--d-bg)" }}
        >
          <div
            className={`ch-contato-caixa relative z-10 mx-auto mb-16 w-full max-w-4xl ${
              centro("contato") ? "" : "md:items-start"
            }`}
          >
            <div className="ch-contato-marca flex max-w-xs flex-col items-center md:items-start">
              <h2
                data-demo-slot="nome"
                className="ch-contato-nome mb-4 font-[family-name:var(--d-deco)] text-3xl uppercase tracking-tight text-[var(--d-accent-2)]"
                style={{
                  WebkitTextStroke: "1px var(--d-accent-2)",
                  filter: "drop-shadow(2px 2px 0px var(--d-accent))",
                } as CSSProperties}
              >
                {data.nome}
              </h2>
              {data.slogan && (
                <p data-demo-slot="slogan" className="ch-contato-slogan font-[family-name:var(--d-corpo)] text-sm leading-relaxed text-[var(--d-muted)]">
                  {data.slogan}
                </p>
              )}
            </div>

            {!dadosNaAbertura && <Dados linhas={linhasDeDado} className="ch-dados" />}

            <div className="ch-contato-acao flex flex-col items-center md:items-start">
              <h3
                data-demo-slot="secoes.contato.titulo"
                className="ch-contato-titulo mb-4 font-[family-name:var(--d-display)] text-xl uppercase tracking-widest text-[var(--d-muted)]"
              >
                {s.contato?.titulo?.trim() || m.contato}
              </h3>
              {s.contato?.cta && (
                <OrderCta
                  whatsapp={data.whatsapp}
                  mensagem={m.pedidoMensagem}
                  idioma={idioma}
                  slot="secoes.contato.cta"
                  className="ch-contato-cta d-cta-outline"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
                  </svg>
                  {s.contato.cta}
                </OrderCta>
              )}
            </div>
          </div>

          <div className="ch-contato-rodape relative z-10 mx-auto w-full max-w-4xl border-t border-[var(--d-border)] pt-8">
            <p className="ch-copy font-[family-name:var(--d-mono)] text-xs text-[var(--d-muted)]">
              © {new Date().getFullYear()} {data.nome}. {m.direitosReservados}
            </p>
            {/* Sem fallback: "FEITO COM OBSESSÃO" era VOZ DE MARCA cravada no
                componente — a assinatura de uma casa específica, inventada
                pela skin para toda casa que abrisse a demo. Slot vazio não
                desenha linha nenhuma, como qualquer outro. */}
            {s.contato?.texto && (
              <p
                data-demo-slot="secoes.contato.texto"
                className="ch-assinatura font-[family-name:var(--d-mono)] text-xs text-[var(--d-muted)]/70"
              >
                {s.contato.texto}
              </p>
            )}
          </div>
        </Caixa>
      );
    },
  };

  return (
    <div
      style={vars}
      data-d-hover={theme.hover}
      data-d-clique={theme.clique}
      data-d-anim={theme.animacao}
      data-ch-abertura={comp.abertura}
      data-ch-cardapio={comp.cardapio}
      data-ch-bebidas={comp.bebidas}
      data-ch-acomp={comp.acompanhamentos}
      data-ch-contato={comp.contato}
      data-ch-hero-al={theme.heroTitulo.alinhamento}
      className="ch min-h-screen overflow-x-clip bg-[var(--d-bg)] font-[family-name:var(--d-corpo)] text-[var(--d-text)] selection:bg-[var(--d-accent)] selection:text-[var(--d-accent-ink)]"
    >
      <style>{LANCHERIA_COMPOSICAO_CSS}</style>
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

      `}</style>

      <LedEdges
        preset={theme.led}
        estilo={theme.ledEstilo}
        cores={theme.ledCores}
        corBase={paleta.destaque}
      />

      <IntroExperience
        nome={data.nome}
        accent={paleta.destaque}
        ink={paleta.destaqueInk}
        ativa={theme.intro === true}
      >
        <Header nome={data.nome} whatsapp={data.whatsapp} idioma={idioma} />

        {navVisivel(comp) && visiveis.includes("cardapio") && (
          <CategoryNav categorias={categorias} />
        )}

        {visiveis.map((id) => {
          const animada = secaoAnimada(data, id);
          // Animação desligada nesta seção (aba Estrutura): sem wrapper de
          // entrada nenhum — o mesmo que o nível global "nenhuma" faz.
          const tipo = animada ? wrapperTipo(id) : null;
          return (
            <SecaoMarcada key={id} id={id} animada={animada}>
              {tipo === null ? (
                secoes[id]?.()
              ) : (
                <SectionReveal animacao={theme.animacao} tipo={tipo}>
                  {secoes[id]?.()}
                </SectionReveal>
              )}
            </SecaoMarcada>
          );
        })}
      </IntroExperience>
    </div>
  );
}
