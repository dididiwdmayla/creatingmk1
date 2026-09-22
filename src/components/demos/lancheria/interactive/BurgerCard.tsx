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
import type { Animacao, ChapaComposicao, DemoServico } from "@/lib/demos/types";
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

/** Raio de reserva: o mesmo 56px do material bruto, se o token sumir. */
const RAIO_PADRAO = 56;

export function BurgerCard({
  servico,
  index,
  composicao,
  imageSrc,
  imageAlt,
  platoVazioSrc,
  platoVazioAlt,
  animacao,
  whatsapp,
  idioma,
  moeda,
}: {
  servico: DemoServico;
  index: number;
  /** Knob do cardápio: decide o ALVO do ponteiro (ver `naLinha` abaixo). */
  composicao: ChapaComposicao["cardapio"];
  imageSrc: string;
  /** Alt do slot `lanche-N` — conteúdo do lead, não derivado do nome. */
  imageAlt: string;
  platoVazioSrc: string;
  platoVazioAlt: string;
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
  const fotoRef = useRef<HTMLDivElement>(null);

  /**
   * Na comanda o alvo do ponteiro é a LINHA inteira, não a miniatura: um
   * dedo mira a linha do lanche, e 64px de foto é alvo pequeno demais no
   * celular. Nas outras três o alvo é a própria caixa da foto, como no
   * material bruto.
   */
  const naLinha = composicao === "comanda";

  /**
   * O raio vem de `--d-lente-raio`, que a composição troca (ver
   * ../composicao.ts): as caixas de foto mudam de tamanho entre as quatro,
   * e um círculo de 56px dentro de uma miniatura de 64px não revela nada —
   * cobre a foto toda de uma vez.
   */
  const raioDaLente = () => {
    const el = fotoRef.current;
    if (!el) return RAIO_PADRAO;
    const valor = parseFloat(getComputedStyle(el).getPropertyValue("--d-lente-raio"));
    return Number.isFinite(valor) && valor > 0 ? valor : RAIO_PADRAO;
  };

  /**
   * O ponto do ponteiro DENTRO da caixa da foto. Quando ele cai fora dela
   * — o que na comanda é o caso comum, porque o alvo é a linha —, a origem
   * do círculo é o centro da miniatura: senão um toque na descrição abriria
   * a lente num ponto onde não há foto nenhuma, e nada seria revelado.
   */
  const pontoNaFoto = (e: React.PointerEvent<HTMLElement>) => {
    const el = fotoRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const dentro = x >= 0 && y >= 0 && x <= r.width && y <= r.height;
    return dentro ? { x, y } : { x: r.width / 2, y: r.height / 2 };
  };

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

  const handlePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType === "touch" || e.pointerType === "pen") {
      if (isLensActive) return;
      shufflePhrase();
      const { x, y } = pontoNaFoto(e);
      mouseX.set(x);
      mouseY.set(y);
      radius.set(raioDaLente());
      setIsLensActive(true);
      setTimeout(() => {
        radius.set(0);
        setIsLensActive(false);
      }, 800);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType === "touch" || e.pointerType === "pen") return;
    const { x, y } = pontoNaFoto(e);
    mouseX.set(x);
    mouseY.set(y);
  };

  const handlePointerEnter = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType === "touch" || e.pointerType === "pen") return;
    shufflePhrase();
    radius.set(raioDaLente());
    setIsLensActive(true);
  };

  const handlePointerLeave = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType === "touch" || e.pointerType === "pen") return;
    radius.set(0);
    setIsLensActive(false);
  };

  const gatilho = {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerEnter: handlePointerEnter,
    onPointerLeave: handlePointerLeave,
  };

  const entradaAtiva = animacao !== "nenhuma" && !shouldReduceMotion;
  const preset = ENTRADA[animacao === "marcante" ? "marcante" : "sutil"];

  return (
    <motion.div
      initial={entradaAtiva ? { opacity: 0, y: preset.dist } : false}
      whileInView={entradaAtiva ? { opacity: 1, y: 0 } : undefined}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: preset.duration, ease: "easeOut" }}
      /* A borda é CLASSE, não `style` inline: inline vence folha de estilo,
         e a comanda/o editorial precisam trocá-la por um fio só embaixo
         (ver ../composicao.ts). */
      className="ch-prato d-card-hover group overflow-hidden rounded-[var(--d-radius)] border border-[var(--d-border)] bg-[var(--d-bg-elev)] p-4 shadow-2xl"
      {...(naLinha ? gatilho : {})}
    >
      <div
        ref={fotoRef}
        className="ch-prato-foto shrink-0 cursor-crosshair rounded-[calc(var(--d-radius)*0.7)] bg-[var(--ch-foto-lavagem)]"
        {...(naLinha ? {} : gatilho)}
      >
        <div className="absolute inset-0">
          <Image
            src={imageSrc}
            alt={imageAlt}
            fill
            unoptimized
            data-demo-slot={`imagens.lanche-${index + 1}`}
            className="object-cover p-2 drop-shadow-md"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        </div>

        <motion.div className="ch-prato-lente pointer-events-none absolute inset-0 z-10" style={{ clipPath }}>
          <Image
            src={platoVazioSrc}
            alt={platoVazioAlt}
            fill
            unoptimized
            data-demo-slot="imagens.prato-vazio"
            className="object-cover p-2"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        </motion.div>
      </div>

      <div className="ch-prato-corpo">
        <h3
          data-demo-slot={`servicos.${index}.nome`}
          className="ch-prato-nome font-[family-name:var(--d-display)] text-xl uppercase italic text-[var(--d-text)]"
        >
          {servico.nome}
        </h3>
        {servico.descricao && (
          <p
            data-demo-slot={`servicos.${index}.descricao`}
            className="ch-prato-desc mt-1 font-[family-name:var(--d-corpo)] text-xs leading-tight text-[var(--d-muted)]"
          >
            {servico.descricao}
          </p>
        )}
      </div>

      <div className="ch-prato-rodape">
        <span
          data-demo-slot={`servicos.${index}.preco`}
          className="ch-prato-preco font-[family-name:var(--d-mono)] text-lg font-bold text-[var(--d-accent-3)]"
        >
          {formatarPrecoServico(servico, idioma, moeda)}
        </span>
        <OrderCta
          whatsapp={whatsapp}
          mensagem={`Olá! Quero pedir: ${servico.nome}.`}
          idioma={idioma}
          aria-label={`Escolher ${servico.nome}`}
          className="ch-prato-cta d-cta-pill"
        >
          ESCOLHER
        </OrderCta>
      </div>

      {/* A frase do hover é irmã da foto, não filha: na comanda ela precisa
          sair de uma miniatura de 64px e ir para o lado da linha, e a caixa
          da foto tem `overflow: hidden`. Ela ocupa a MESMA área de grade da
          foto (ver .ch-prato-frase em ../composicao.ts), então sobrepõe sem
          depender de coordenada. */}
      <AnimatePresence>
        {isLensActive && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="ch-prato-frase pointer-events-none"
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
    </motion.div>
  );
}
