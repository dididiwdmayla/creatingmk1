"use client";

import { PainelColapsavel } from "@/components/config/PainelColapsavel";
import { Field } from "@/components/config/comum";
import type { PainelFormProps } from "@/components/config/tipos";
import { formatInt } from "@/lib/format";
import { SKUS, SKU_LABELS } from "@/lib/sku-labels";

/** Chave da persistência deste painel — ver `PainelColapsavel`. */
export const PAINEL_TETOS = "tetos-sku";

/**
 * O teto de SEGURANÇA por SKU (hard stop do `reserveQuota`) — o que
 * impede o app de gastar sem alguém aumentar o número conscientemente.
 */
export function PainelTetosSku({ form, onChange }: PainelFormProps) {
  // Quanto o mês inteiro pode custar em requests, e quantos SKUs estão
  // TRAVADOS em zero — um teto zerado é um caminho pago desligado, e o
  // cabeçalho fechado precisa dizer isso sem o admin abrir e conferir seis
  // campos.
  const total = SKUS.reduce((soma, sku) => soma + form.caps[sku], 0);
  const zerados = SKUS.filter((sku) => form.caps[sku] === 0).length;

  return (
    <PainelColapsavel
      id={PAINEL_TETOS}
      titulo="Tetos mensais por SKU"
      resumo={`${formatInt(total)}/mês${zerados > 0 ? ` · ${zerados} zerado(s)` : ""}`}
    >
      <div className="mt-3 flex flex-col gap-3">
        {SKUS.map((sku) => (
          <Field key={sku} label={SKU_LABELS[sku]}>
            <input
              type="number"
              min={0}
              step={1}
              value={form.caps[sku]}
              onChange={(e) =>
                onChange({
                  ...form,
                  caps: { ...form.caps, [sku]: Number(e.target.value) || 0 },
                })
              }
              className="w-full rounded border border-line bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            />
          </Field>
        ))}
      </div>
    </PainelColapsavel>
  );
}
