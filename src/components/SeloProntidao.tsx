"use client";

import { useState } from "react";

import { pendenciasProntidao } from "@/lib/demos/prontidao";
import type { SkinDefinition } from "@/lib/demos/types";
import type { Lead } from "@/lib/leads/types";

/**
 * Selo de prontidão de UMA demo já salva: o que ainda está em estado
 * padrão (sem Instagram/horário/telefone, imagens ainda genéricas, textos
 * ainda no idioma do template). Nada se `lead.demo` estiver ausente (sem
 * skin resolvida também não há o que checar). Compacto por padrão — clique
 * expande a lista.
 */
export function SeloProntidao({ lead, skin }: { lead: Lead; skin: SkinDefinition | undefined }) {
  const [aberto, setAberto] = useState(false);
  if (!lead.demo || !skin) return null;

  const pendencias = pendenciasProntidao(lead, skin);

  if (pendencias.length === 0) {
    return (
      <span className="inline-flex w-fit items-center gap-1 rounded-full bg-good/15 px-2 py-0.5 text-[11px] font-medium text-good">
        ✓ Pronta pra enviar
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="inline-flex w-fit items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning hover:bg-warning/25"
      >
        ⚠ {pendencias.length} pendência{pendencias.length === 1 ? "" : "s"}
        {" · "}
        {aberto ? "ocultar" : "ver"}
      </button>
      {aberto && (
        <ul className="flex flex-col gap-0.5 pl-1 text-[11px] text-ink-muted">
          {pendencias.map((pendencia) => (
            <li key={pendencia.chave}>· {pendencia.rotulo}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
