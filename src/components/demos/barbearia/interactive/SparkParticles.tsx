"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";

interface Spark {
  id: number;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  delay: number;
}

/** Fagulhas que estouram quando a navalha corta a tela (fiel ao original). */
export function SparkParticles({ accent }: { accent: string }) {
  const [sparks, setSparks] = useState<Spark[]>([]);

  useEffect(() => {
    const t = setTimeout(() => {
      setSparks(
        Array.from({ length: 9 }).map((_, i) => ({
          id: i,
          x: (Math.random() - 0.5) * 400,
          y: (Math.random() - 0.5) * 60,
          scale: Math.random() * 0.8 + 0.4,
          rotation: Math.random() * 360,
          delay: Math.random() * 0.2,
        })),
      );
    }, 0);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center">
      {sparks.map((spark) => (
        <motion.div
          key={spark.id}
          initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
          animate={{
            opacity: [0, 1, 0],
            x: spark.x,
            y: spark.y,
            scale: spark.scale,
            rotate: spark.rotation,
          }}
          transition={{ duration: 0.6, delay: 1.3 + spark.delay, ease: "easeOut" }}
          className="absolute h-0.5 w-2"
          style={{ background: accent, boxShadow: `0 0 8px ${accent}` }}
        />
      ))}
    </div>
  );
}
