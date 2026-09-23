"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

import { microcopiaDemo } from "@/lib/demos/microcopy";
import type { DemoServico } from "@/lib/demos/types";
import { CarCard } from "./CarCard";
import {
  categoriasDoEstoque,
  faixaDoHash,
  faixasDePreco,
  rotuloFaixa,
  TODAS_CATEGORIAS,
  valorNaFaixa,
} from "./logic";

/**
 * Como o estoque se deixa recortar (§3 do plano: "o estoque sempre se
 * deixa recortar" — por categoria OU por faixa de preço, conforme a
 * variante; a vitrine da Garagem, de poucos carros, não recorta).
 */
export type ModoFiltro = "categoria" | "faixa" | "nenhum";

/**
 * Pills de filtro (com pílula ativa que desliza via `layoutId`, shared
 * layout animation do `motion` — substitui o `positionPill`/FLIP manual do
 * material bruto por transform) + grid de veículos que reflui suavemente
 * ao filtrar (`layout` em cada card + saída animada via AnimatePresence).
 */
export function CarFilterGrid({
  servicos,
  imagens,
  imagensAlt,
  ctaDetalhes,
  ctaInteresse,
  textoGarantia,
  whatsapp,
  idioma,
  moeda,
  modoFiltro = "categoria",
}: {
  servicos: DemoServico[];
  imagens: Record<string, string>;
  /** Texto alternativo por slot (ver DemoData.imagensAlt). */
  imagensAlt?: Record<string, string>;
  ctaDetalhes?: string;
  ctaInteresse?: string;
  textoGarantia?: string;
  whatsapp?: string;
  idioma?: string;
  moeda?: string;
  modoFiltro?: ModoFiltro;
}) {
  const m = microcopiaDemo(idioma);
  const faixas = faixasDePreco(servicos);
  const opcoes =
    modoFiltro === "categoria"
      ? categoriasDoEstoque(servicos).map((id) => ({ id, rotulo: id === TODAS_CATEGORIAS ? m.todos : id }))
      : modoFiltro === "faixa" && faixas.length > 0
        ? [
            { id: TODAS_CATEGORIAS, rotulo: m.todos },
            ...faixas.map((f) => ({ id: f.id, rotulo: rotuloFaixa(f, m, idioma, moeda) })),
          ]
        : [];
  const [filtro, setFiltro] = useState(TODAS_CATEGORIAS);

  // Busca por faixa: o hash `#faixa-N` (os botões da abertura do Pátio são
  // links para ele) escolhe a faixa — na chegada e a cada troca de hash.
  // Sem JavaScript, o mesmo link cai nas âncoras abaixo e mostra o estoque
  // inteiro, que é o comportamento certo sem filtro.
  useEffect(() => {
    if (modoFiltro !== "faixa") return;
    const lerHash = () => {
      const id = faixaDoHash(window.location.hash, faixasDePreco(servicos));
      if (id) setFiltro(id);
    };
    lerHash();
    window.addEventListener("hashchange", lerHash);
    return () => window.removeEventListener("hashchange", lerHash);
  }, [modoFiltro, servicos]);

  const comIndice = servicos.map((servico, index) => ({ servico, index }));
  const faixaAtiva = faixas.find((f) => f.id === filtro);
  const filtrados =
    filtro === TODAS_CATEGORIAS || modoFiltro === "nenhum"
      ? comIndice
      : faixaAtiva
        ? comIndice.filter(({ servico }) => valorNaFaixa(servico.precoValor, faixaAtiva))
        : comIndice.filter(({ servico }) => servico.categoria === filtro);

  return (
    <div>
      {/* Alvos das âncoras de faixa — caixa zero, no topo do estoque. */}
      {faixas.map((f) => (
        <span key={f.id} id={f.id} aria-hidden="true" className="block scroll-mt-28" />
      ))}
      {opcoes.length > 1 && (
        <div className="relative mb-[30px]">
          <div
            role="group"
            aria-label={modoFiltro === "faixa" ? m.faixaDePreco : undefined}
            className="flex gap-1.5 overflow-x-auto p-1"
            style={{
              maskImage: "linear-gradient(90deg, transparent, #000 20px, #000 calc(100% - 20px), transparent)",
              scrollbarWidth: "none",
            }}
          >
            {opcoes.map(({ id, rotulo }) => {
              const ativo = id === filtro;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => setFiltro(id)}
                  className="relative z-[1] flex-none whitespace-nowrap rounded-full border px-5 py-[11px] font-[family-name:var(--d-corpo)] text-[13px] font-semibold tracking-[0.5px] transition-colors"
                  style={{
                    borderColor: ativo ? "transparent" : "var(--d-border)",
                    color: ativo ? "var(--d-accent)" : "var(--d-muted)",
                  }}
                >
                  {ativo && (
                    <motion.span
                      layoutId="d-filtro-pill"
                      className="absolute inset-0 -z-[1] rounded-full border"
                      style={{
                        background: "color-mix(in srgb, var(--d-accent) 8%, transparent)",
                        borderColor: "color-mix(in srgb, var(--d-accent) 55%, transparent)",
                      }}
                      transition={{ type: "spring", stiffness: 400, damping: 34 }}
                    />
                  )}
                  {rotulo}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(288px,1fr))] gap-[22px]">
        {/* `initial={false}`: o estoque que chega no HTML do servidor já
            está no estado FINAL (opacidade 1, escala 1). Sem isso o motion
            serializa o `initial` de cada card no documento servido e, sem
            JavaScript, os nove carros saíam transparentes. A entrada
            animada continua valendo para o que ENTRA depois, ao filtrar. */}
        <AnimatePresence initial={false}>
          {filtrados.map(({ servico, index }) => (
            <motion.div
              key={servico.nome}
              layout
              initial={{ opacity: 0, scale: 0.86 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.86 }}
              transition={{ duration: 0.35, ease: [0.2, 0.9, 0.25, 1] }}
            >
              <CarCard
                servico={servico}
                index={index}
                imagem={imagens[`carro-${index + 1}`] ?? Object.values(imagens)[0]}
                alt={imagensAlt?.[`carro-${index + 1}`]}
                ctaDetalhes={ctaDetalhes}
                ctaInteresse={ctaInteresse}
                textoGarantia={textoGarantia}
                whatsapp={whatsapp}
                idioma={idioma}
                moeda={moeda}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
