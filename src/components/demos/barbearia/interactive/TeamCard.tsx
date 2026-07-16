"use client";

import Image from "next/image";
import { useState } from "react";

import { HairParticles } from "./HairParticles";

/** Card de um membro da equipe — hover dispara fios de cabelo caindo (fiel ao original). */
export function TeamCard({
  imageSrc,
  alt,
  nome,
  subtitulo,
  detalhe,
  bio,
}: {
  imageSrc: string;
  alt: string;
  nome: string;
  subtitulo?: string;
  detalhe?: string;
  bio?: string;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      data-cursor="razor"
      data-cursor-text="VER PERFIL →"
      className="group flex h-full flex-col overflow-hidden rounded-[var(--d-radius)] border border-[var(--d-border)] bg-[var(--d-bg)] p-4 pb-8 transition-transform duration-500 hover:-translate-y-2"
      style={{ boxShadow: "0 16px 48px rgba(0,0,0,0.4)" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="relative mb-6 aspect-[3/4] w-full overflow-hidden rounded-[var(--d-radius)]">
        <HairParticles isHovered={hovered} />
        <Image
          src={imageSrc}
          alt={alt}
          fill
          unoptimized
          className="object-cover transition-transform duration-700 group-hover:scale-105"
          style={{ filter: "contrast(0.95) saturate(0.9)" }}
          sizes="(max-width: 768px) 100vw, 33vw"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--d-bg)] to-transparent" />
      </div>
      <div className="px-2">
        <h3 className="mb-1 font-[family-name:var(--d-display)] text-3xl tracking-tight text-[var(--d-text)] transition-colors group-hover:text-[var(--d-accent)] md:text-4xl">
          {nome}
        </h3>
        {(subtitulo || detalhe) && (
          <div className="mb-4 flex flex-col gap-1">
            {subtitulo && (
              <span className="font-[family-name:var(--d-mono)] text-[10px] font-medium uppercase tracking-widest text-[var(--d-accent)] md:text-xs">
                {subtitulo}
              </span>
            )}
            {detalhe && (
              <span className="font-[family-name:var(--d-mono)] text-[10px] font-medium uppercase tracking-wider text-[var(--d-muted)] md:text-[11px]">
                {detalhe}
              </span>
            )}
          </div>
        )}
        {bio && (
          <p className="font-[family-name:var(--d-serif)] text-sm leading-[1.7] text-[var(--d-muted)] md:text-base">
            {bio}
          </p>
        )}
      </div>
    </div>
  );
}
