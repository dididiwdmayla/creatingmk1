"use client";

import Image from "next/image";
import { useState } from "react";

import { formatarPrecoServico, simboloMoeda } from "@/lib/demos/precos";
import type { DemoServico } from "@/lib/demos/types";
import { StatCounter } from "./StatCounter";
import { waHref } from "./logic";

/**
 * Card de veículo: imagem do slot, badge de categoria, botão "Detalhes"
 * que sobe no hover (fino) e o painel expansível (clique) com a
 * descrição + CTA de interesse via WhatsApp — fiel ao `enhanceCards`/
 * `toggleExpand` do material bruto. O preço conta a partir de zero quando
 * entra no viewport (`StatCounter`).
 */
export function CarCard({
  servico,
  index,
  imagem,
  ctaDetalhes,
  ctaInteresse,
  textoGarantia,
  whatsapp,
  idioma,
  moeda,
}: {
  servico: DemoServico;
  index: number;
  imagem: string;
  ctaDetalhes?: string;
  ctaInteresse?: string;
  textoGarantia?: string;
  whatsapp?: string;
  idioma?: string;
  moeda?: string;
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <article
      data-car
      className="d-card-hover flex cursor-pointer flex-col overflow-hidden border"
      style={{
        background: "var(--d-bg-elev)",
        borderColor: "var(--d-border)",
        borderRadius: "var(--d-radius)",
      }}
      onClick={() => setAberto((v) => !v)}
    >
      <div className="group/img relative aspect-[16/10] overflow-hidden border-b" style={{ borderColor: "var(--d-border)" }}>
        <Image
          src={imagem}
          alt={servico.nome}
          fill
          unoptimized
          data-demo-slot={`imagens.carro-${index + 1}`}
          className="object-cover transition-transform duration-[800ms]"
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
        />
        {servico.categoria && (
          <span
            className="absolute left-3.5 top-3.5 rounded-full border px-3 py-1.5 font-[family-name:var(--d-mono)] text-[11px] font-medium tracking-[2.5px] backdrop-blur-[6px]"
            style={{
              background: "color-mix(in srgb, var(--d-bg-elev) 85%, transparent)",
              borderColor: "var(--d-border)",
              color: "var(--d-text)",
            }}
          >
            {servico.categoria.toUpperCase()}
          </span>
        )}
        {ctaDetalhes && (
          <span
            className="d-card-detalhes absolute inset-x-3.5 bottom-3.5 rounded-lg px-3 py-3 text-center font-[family-name:var(--d-corpo)] text-[13px] font-bold tracking-[1.5px]"
            style={{
              background: "var(--d-accent)",
              color: "var(--d-accent-ink)",
              boxShadow: "0 8px 22px color-mix(in srgb, var(--d-accent) 30%, transparent)",
            }}
          >
            {ctaDetalhes.toUpperCase()}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-3 p-[18px] pb-5">
        <h3 className="font-[family-name:var(--d-display)] text-xl font-bold uppercase tracking-tight text-[var(--d-text)]">
          {servico.nome}
        </h3>
        <div className="flex items-baseline gap-1.5">
          <span className="font-[family-name:var(--d-mono)] text-sm font-medium text-[var(--d-accent)]">
            {simboloMoeda(idioma, moeda)}
          </span>
          <StatCounter
            valor={
              servico.precoValor !== undefined
                ? String(servico.precoValor)
                : servico.preco.replace(/^R\$\s*/, "")
            }
            className="font-[family-name:var(--d-mono)] text-[30px] font-semibold leading-none tabular-nums tracking-[0.5px] text-[var(--d-text)]"
          />
        </div>
        {servico.destaques && servico.destaques.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {servico.destaques.map((chip, i) => (
              <span
                key={i}
                className="whitespace-nowrap rounded-full border px-2.5 py-1.5 font-[family-name:var(--d-corpo)] text-[11.5px] font-semibold"
                style={{
                  borderColor: "var(--d-border)",
                  background: "color-mix(in srgb, var(--d-text) 3%, transparent)",
                  color: "var(--d-muted)",
                }}
              >
                {chip}
              </span>
            ))}
          </div>
        )}

        <div
          className="grid transition-[grid-template-rows] duration-[550ms] ease-[cubic-bezier(.3,1.3,.4,1)]"
          style={{ gridTemplateRows: aberto ? "1fr" : "0fr" }}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="flex flex-col gap-3.5 border-t pt-3.5" style={{ borderColor: "var(--d-border)" }}>
              {(servico.descricao || textoGarantia) && (
                <p className="font-[family-name:var(--d-corpo)] text-sm text-[var(--d-muted)]">
                  {[servico.descricao, textoGarantia].filter(Boolean).join(" · ")}
                </p>
              )}
              {ctaInteresse && (
                <a
                  href={waHref(
                    whatsapp,
                    `Olá! Tenho interesse no ${servico.nome} (${formatarPrecoServico(servico, idioma, moeda)}). Ainda está disponível?`,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  data-demo-slot="secoes.estoque.cta"
                  className="d-press flex items-center justify-center gap-2.5 rounded-lg py-[15px] font-[family-name:var(--d-corpo)] text-sm font-bold tracking-[1px]"
                  style={{
                    background: "var(--d-accent)",
                    color: "var(--d-accent-ink)",
                    boxShadow: "0 8px 22px color-mix(in srgb, var(--d-accent) 25%, transparent)",
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2Zm-3 6.2c.2-.5.5-.6.8-.6h.7c.2 0 .5.1.7.6l.9 1.9c.1.3.1.5-.1.7l-.6.8c.6 1.1 1.9 2.4 3.1 3l.9-.6c.2-.2.5-.2.7-.1l1.9 1c.4.2.5.4.5.7-.1.8-.9 1.9-2.2 1.9-2.4 0-7.3-3.2-8-7.3-.2-1 .3-1.7.7-2Z" />
                  </svg>
                  {ctaInteresse}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
