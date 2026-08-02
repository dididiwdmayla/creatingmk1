"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "motion/react";

import { formatarPrecoServico } from "@/lib/demos/precos";
import type { Animacao, DemoServico } from "@/lib/demos/types";
import { OrderCta } from "./OrderCta";

/** Chrome fixo do card — frases decorativas do hover, fiéis ao material bruto (nenhuma cita a marca). */
const HOVER_PHRASES = [
  "CUIDADO, LANCHE VICIANTE!",
  "PEDE LOGO, É UMA DELÍCIA!",
  "PEDE O SEU, QUE ESSE JÁ É MEU 😏",
];

const ENTRADA: Record<"sutil" | "marcante", { dist: number; duration: number }> = {
  sutil: { dist: 14, duration: 0.3 },
  marcante: { dist: 24, duration: 0.4 },
};

export function BurgerCard({
  servico,
  index,
  imageSrc,
  platoVazioSrc,
  animacao,
  whatsapp,
  idioma,
  moeda,
}: {
  servico: DemoServico;
  index: number;
  imageSrc: string;
  platoVazioSrc: string;
  animacao: Animacao;
  whatsapp: string | undefined;
  idioma?: string;
  moeda?: string;
}) {
  const shouldReduceMotion = useReducedMotion();
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const radius = useMotionValue(0);
  const [isLensActive, setIsLensActive] = useState(false);
  const [currentPhrase, setCurrentPhrase] = useState(HOVER_PHRASES[0]);
  const lastPhraseIndex = useRef(0);

  const smoothRadius = useSpring(radius, { stiffness: 400, damping: 30 });
  const clipPath = useMotionTemplate`circle(${shouldReduceMotion ? radius : smoothRadius}px at ${mouseX}px ${mouseY}px)`;

  const shufflePhrase = () => {
    let nextIndex: number;
    do {
      nextIndex = Math.floor(Math.random() * HOVER_PHRASES.length);
    } while (nextIndex === lastPhraseIndex.current);
    lastPhraseIndex.current = nextIndex;
    setCurrentPhrase(HOVER_PHRASES[nextIndex]);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch" || e.pointerType === "pen") {
      if (isLensActive) return;
      shufflePhrase();
      const rect = e.currentTarget.getBoundingClientRect();
      mouseX.set(e.clientX - rect.left);
      mouseY.set(e.clientY - rect.top);
      radius.set(56);
      setIsLensActive(true);
      setTimeout(() => {
        radius.set(0);
        setIsLensActive(false);
      }, 800);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch" || e.pointerType === "pen") return;
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  };

  const handlePointerEnter = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch" || e.pointerType === "pen") return;
    shufflePhrase();
    radius.set(56);
    setIsLensActive(true);
  };

  const handlePointerLeave = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch" || e.pointerType === "pen") return;
    radius.set(0);
    setIsLensActive(false);
  };

  const entradaAtiva = animacao !== "nenhuma" && !shouldReduceMotion;
  const preset = ENTRADA[animacao === "marcante" ? "marcante" : "sutil"];

  return (
    <motion.div
      initial={entradaAtiva ? { opacity: 0, y: preset.dist } : false}
      whileInView={entradaAtiva ? { opacity: 1, y: 0 } : undefined}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: preset.duration, ease: "easeOut" }}
      className="d-card-hover group relative flex flex-col gap-4 overflow-hidden rounded-[var(--d-radius)] bg-[var(--d-bg-elev)] p-4 shadow-2xl sm:flex-row"
      style={{ border: "1px solid var(--d-border)" }}
    >
      <div
        className="relative h-48 w-full shrink-0 cursor-crosshair overflow-hidden rounded-[calc(var(--d-radius)*0.7)] bg-black/10 sm:h-28 sm:w-28"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
      >
        <AnimatePresence>
          {isLensActive && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-none absolute top-2 z-20 flex w-full justify-center"
            >
              <span
                className="rotate-[-6deg] font-[family-name:var(--d-display)] text-sm text-[var(--d-accent-2)] md:text-base"
                style={{ WebkitTextStroke: "1px var(--d-bg)" } as React.CSSProperties}
              >
                {currentPhrase}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="absolute inset-0">
          <Image
            src={imageSrc}
            alt={servico.nome}
            fill
            unoptimized
            data-demo-slot={`imagens.lanche-${index + 1}`}
            className="object-cover p-2 drop-shadow-md"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        </div>

        <motion.div className="pointer-events-none absolute inset-0 z-10" style={{ clipPath }}>
          <Image
            src={platoVazioSrc}
            alt=""
            fill
            unoptimized
            data-demo-slot="imagens.prato-vazio"
            className="object-cover p-2"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        </motion.div>
      </div>

      <div className="flex flex-1 flex-col justify-center">
        <h3
          data-demo-slot={`servicos.${index}.nome`}
          className="font-[family-name:var(--d-display)] text-xl uppercase italic text-[var(--d-text)]"
        >
          {servico.nome}
        </h3>
        {servico.descricao && (
          <p
            data-demo-slot={`servicos.${index}.descricao`}
            className="mb-3 flex-grow font-[family-name:var(--d-corpo)] text-xs leading-tight text-[var(--d-muted)]"
          >
            {servico.descricao}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between gap-3">
          <span
            data-demo-slot={`servicos.${index}.preco`}
            className="font-[family-name:var(--d-mono)] text-lg font-bold text-[var(--d-accent-3)]"
          >
            {formatarPrecoServico(servico, idioma, moeda)}
          </span>
          <OrderCta
            whatsapp={whatsapp}
            mensagem={`Olá! Quero pedir: ${servico.nome}.`}
            idioma={idioma}
            aria-label={`Escolher ${servico.nome}`}
            className="d-cta-pill"
          >
            ESCOLHER
          </OrderCta>
        </div>
      </div>
    </motion.div>
  );
}
