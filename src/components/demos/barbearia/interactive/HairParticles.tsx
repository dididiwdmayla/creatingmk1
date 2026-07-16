"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";

interface Particle {
  id: number;
  left: number;
  dur: number;
  angle: number;
  size: number;
}

/** Fios de cabelo caindo no hover do card — fiel ao original, sem lib externa. */
export function HairParticles({ isHovered }: { isHovered: boolean }) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const idRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const lastAddRef = useRef(0);

  useEffect(() => {
    if (!isHovered) {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      const t = setTimeout(() => setParticles([]), 0);
      return () => clearTimeout(t);
    }

    const loop = (time: number) => {
      if (time - lastAddRef.current > 100) {
        lastAddRef.current = time;
        const novo: Particle = {
          id: idRef.current++,
          left: Math.random() * 90 + 5,
          dur: 1 + Math.random() * 0.5,
          angle: 30 + Math.random() * -60,
          size: 6 + Math.random() * 8,
        };
        setParticles((prev) => [...prev, novo].slice(-20));
      }
      frameRef.current = requestAnimationFrame(loop);
    };
    frameRef.current = requestAnimationFrame(loop);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [isHovered]);

  if (particles.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full bg-[var(--d-bg)]/90"
          style={
            {
              left: `${p.left}%`,
              top: "-20px",
              width: "1px",
              height: `${p.size}px`,
              transform: `rotate(${p.angle}deg)`,
              animation: `d-hair-fall ${p.dur}s linear forwards`,
              "--d-hair-angle": `${p.angle}deg`,
              "--d-hair-angle-end": `${p.angle + 40}deg`,
            } as CSSProperties
          }
        />
      ))}
      <style>{`
        @keyframes d-hair-fall {
          0% { transform: translateY(0) rotate(var(--d-hair-angle)); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 0.8; }
          100% { transform: translateY(400px) rotate(var(--d-hair-angle-end)); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
