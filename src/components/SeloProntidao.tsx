"use client";

import { useState } from "react";

import { pendenciasProntidao, type PendenciaProntidao } from "@/lib/demos/prontidao";
import type { SkinDefinition } from "@/lib/demos/types";
import type { Lead } from "@/lib/leads/types";

/**
 * Selo de prontidão de UMA demo já salva: o que ainda está em estado
 * padrão (sem Instagram/horário/telefone, imagens ainda genéricas, textos
 * ainda no idioma do template). Compacto por padrão — clique expande a
 * lista.
 *
 * Recebe as PENDÊNCIAS já calculadas, não o registro: a demo de lead e a
 * demo avulsa chegam à mesma lista por caminhos diferentes
 * (`pendenciasProntidao` × `pendenciasDaDemo`), e o selo em si é só
 * apresentação. `null` esconde o selo por completo (sem demo salva, ou
 * sem skin resolvida — não há o que checar).
 */
export function SeloProntidao({ pendencias }: { pendencias: PendenciaProntidao[] | null }) {
  const [aberto, setAberto] = useState(false);
  if (!pendencias) return null;

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

/** Atalho para a demo de um LEAD — o caso mais comum na ficha e em /demos. */
export function SeloProntidaoLead({
  lead,
  skin,
}: {
  lead: Lead;
  skin: SkinDefinition | undefined;
}) {
  return <SeloProntidao pendencias={lead.demo && skin ? pendenciasProntidao(lead, skin) : null} />;
}
