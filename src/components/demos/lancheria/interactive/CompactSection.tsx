"use client";

import Image from "next/image";

import type { DemoItem } from "@/lib/demos/types";
import { OrderCta } from "./OrderCta";

/**
 * Lista horizontal compacta (bebidas/acompanhamentos), fiel ao
 * `<CompactSection>` do original: cards estreitos com rolagem horizontal
 * e indicadores de fade nas bordas. O botão "+" virou o CTA de pedido
 * neutro (ícone), sem estado de "adicionado" (não há carrinho de verdade).
 */
function CompactCard({
  item,
  imageSrc,
  imageSlot,
  textSlot,
  whatsapp,
  idioma,
}: {
  item: DemoItem;
  imageSrc: string;
  imageSlot: string;
  textSlot: string;
  whatsapp: string | undefined;
  idioma?: string;
}) {
  return (
    <div
      /* Borda em CLASSE pelo mesmo motivo do cartão do cardápio: a carta e a
         linha discreta trocam o cartão por um fio só (ver ../composicao.ts),
         e `style` inline não deixaria. */
      className="ch-item d-card-hover rounded-[var(--d-radius)] border border-[var(--d-border)] bg-[var(--d-bg-elev)] p-3 shadow-lg"
    >
      <div className="ch-item-foto shrink-0 rounded-[calc(var(--d-radius)*0.7)] bg-black/10 p-2">
        <Image
          src={imageSrc}
          alt={item.titulo}
          fill
          unoptimized
          data-demo-slot={`imagens.${imageSlot}`}
          className="object-contain drop-shadow-sm transition-transform group-hover:scale-105"
          sizes="(max-width: 768px) 150px, 180px"
        />
      </div>
      <div className="ch-item-corpo">
        <h3
          data-demo-slot={`${textSlot}.titulo`}
          className="ch-item-titulo mb-2 line-clamp-2 font-[family-name:var(--d-corpo)] text-sm font-bold leading-tight text-[var(--d-text)]"
        >
          {item.titulo}
        </h3>
        <div className="ch-item-rodape">
          {item.subtitulo && (
            <span
              data-demo-slot={`${textSlot}.subtitulo`}
              className="ch-item-sub font-[family-name:var(--d-mono)] text-sm font-bold text-[var(--d-accent-3)]"
            >
              {item.subtitulo}
            </span>
          )}
          <OrderCta
            whatsapp={whatsapp}
            mensagem={`Olá! Quero pedir: ${item.titulo}.`}
            idioma={idioma}
            aria-label={`Adicionar ${item.titulo}`}
            className="ch-item-cta d-cta-round d-cta-round-sm"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </OrderCta>
        </div>
      </div>
    </div>
  );
}

export function CompactSection({
  id,
  secaoId,
  itens,
  imagens,
  slotPrefix,
  whatsapp,
  idioma,
}: {
  id: string;
  secaoId: string;
  itens: DemoItem[];
  imagens: Record<string, string>;
  slotPrefix: string;
  whatsapp: string | undefined;
  idioma?: string;
}) {
  if (itens.length === 0) return null;

  return (
    <div className="ch-lista-caixa relative">
      <div className="ch-lista-fade pointer-events-none absolute inset-y-0 right-0 z-10 hidden w-12 bg-gradient-to-l from-[var(--d-bg)] to-transparent md:block" />
      <div
        className="ch-lista scrollbar-hide snap-x snap-mandatory py-2 pb-6"
        id={`${id}-scroll`}
      >
        {itens.map((item, i) => (
          <CompactCard
            key={item.titulo}
            item={item}
            imageSrc={imagens[`${slotPrefix}-${i + 1}`] ?? imagens.hero}
            imageSlot={`${slotPrefix}-${i + 1}`}
            textSlot={`secoes.${secaoId}.itens.${i}`}
            whatsapp={whatsapp}
            idioma={idioma}
          />
        ))}
      </div>
    </div>
  );
}
