"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

import type { DemoServico } from "@/lib/demos/types";
import { CarCard } from "./CarCard";
import { categoriasDoEstoque } from "./logic";

/**
 * Pills de filtro (com pílula ativa que desliza via `layoutId`, shared
 * layout animation do `motion` — substitui o `positionPill`/FLIP manual do
 * material bruto por transform) + grid de veículos que reflui suavemente
 * ao filtrar (`layout` em cada card + saída animada via AnimatePresence).
 */
export function CarFilterGrid({
  servicos,
  imagens,
  ctaDetalhes,
  ctaInteresse,
  textoGarantia,
  whatsapp,
}: {
  servicos: DemoServico[];
  imagens: Record<string, string>;
  ctaDetalhes?: string;
  ctaInteresse?: string;
  textoGarantia?: string;
  whatsapp?: string;
}) {
  const categorias = categoriasDoEstoque(servicos);
  const [filtro, setFiltro] = useState("Todos");

  const comIndice = servicos.map((servico, index) => ({ servico, index }));
  const filtrados =
    filtro === "Todos" ? comIndice : comIndice.filter(({ servico }) => servico.categoria === filtro);

  return (
    <div>
      {categorias.length > 1 && (
        <div className="relative mb-[30px]">
          <div
            className="flex gap-1.5 overflow-x-auto p-1"
            style={{
              maskImage: "linear-gradient(90deg, transparent, #000 20px, #000 calc(100% - 20px), transparent)",
              scrollbarWidth: "none",
            }}
          >
            {categorias.map((cat) => {
              const ativo = cat === filtro;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFiltro(cat)}
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
                  {cat}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(288px,1fr))] gap-[22px]">
        <AnimatePresence>
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
                ctaDetalhes={ctaDetalhes}
                ctaInteresse={ctaInteresse}
                textoGarantia={textoGarantia}
                whatsapp={whatsapp}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
