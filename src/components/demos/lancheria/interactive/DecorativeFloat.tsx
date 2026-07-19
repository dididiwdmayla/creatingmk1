"use client";

import Image from "next/image";
import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";

import type { DecorativeFloatDef } from "@/lib/demos/types";

/**
 * Imagem de comida flutuando na lateral de uma seção, com parallax sutil
 * no scroll — fiel ao `<DecorativeElement>` do original (tomate/queijo/
 * bacon caindo pela borda). Ancorada à BORDA INFERIOR da seção (fora do
 * fluxo, -z-10 pra ficar sempre atrás do conteúdo), igual ao spacer fino
 * entre seções do original, sem precisar de um wrapper dedicado que
 * quebraria ao reordenar seções no editor.
 *
 * Sangra pra fora da seção por design (translate-x-1/3) — contido pelo
 * `overflow-x-clip` da raiz da skin (ver Skin.tsx), que evita o vazamento
 * lateral vira scroll horizontal no mobile.
 */
export function DecorativeFloat({ def, src }: { def: DecorativeFloatDef; src: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [24, -24]);
  const sideClass = def.lado === "direita" ? "right-0 translate-x-1/3" : "left-0 -translate-x-1/3";

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={`pointer-events-none absolute -z-10 bottom-0 translate-y-1/2 select-none ${sideClass}`}
      style={{ width: `clamp(70px, 14vw, ${def.tamanho}px)`, height: `clamp(70px, 14vw, ${def.tamanho}px)` }}
    >
      <motion.div
        style={{ y, rotate: def.rotacao, filter: "drop-shadow(8px 8px 0px var(--d-bg))" }}
        className="relative h-full w-full motion-reduce:transform-none"
      >
        <Image
          src={src}
          alt=""
          fill
          unoptimized
          data-demo-slot={`imagens.${def.slot}`}
          className="object-contain"
          sizes="220px"
        />
      </motion.div>
    </div>
  );
}
