"use client";

import { PainelColapsavel } from "@/components/config/PainelColapsavel";
import { Field } from "@/components/config/comum";
import type { PainelFormProps } from "@/components/config/tipos";
import { formatBRL } from "@/lib/format";
import { SKUS, SKU_LABELS } from "@/lib/sku-labels";

/** Chave da persistência deste painel — ver `PainelColapsavel`. */
export const PAINEL_PRECOS = "precos-cambio";

/** Override dos preços de `skus.ts` + o câmbio do custo projetado. */
export function PainelPrecosCambio({ form, onChange }: PainelFormProps) {
  return (
    <PainelColapsavel
      id={PAINEL_PRECOS}
      titulo="Preços e câmbio"
      resumo={`US$ 1 = ${formatBRL(form.precos.usdBrl)}`}
    >
      <div className="mt-3 flex flex-col gap-3">
        <Field label="Câmbio USD → BRL">
          <input
            type="number"
            min={0}
            step={0.01}
            value={form.precos.usdBrl}
            onChange={(e) =>
              onChange({
                ...form,
                precos: { ...form.precos, usdBrl: Number(e.target.value) || 0 },
              })
            }
            className="w-full rounded border border-line bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
          />
        </Field>
        {SKUS.map((sku) => (
          <div key={sku} className="grid grid-cols-2 gap-3">
            <Field label={`${SKU_LABELS[sku]} · US$/1.000`}>
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.precos.usdPor1000[sku]}
                onChange={(e) =>
                  onChange({
                    ...form,
                    precos: {
                      ...form.precos,
                      usdPor1000: {
                        ...form.precos.usdPor1000,
                        [sku]: Number(e.target.value) || 0,
                      },
                    },
                  })
                }
                className="w-full rounded border border-line bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
              />
            </Field>
            <Field label="Cota grátis/mês">
              <input
                type="number"
                min={0}
                step={1}
                value={form.precos.cotaGratis[sku]}
                onChange={(e) =>
                  onChange({
                    ...form,
                    precos: {
                      ...form.precos,
                      cotaGratis: {
                        ...form.precos.cotaGratis,
                        [sku]: Number(e.target.value) || 0,
                      },
                    },
                  })
                }
                className="w-full rounded border border-line bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
              />
            </Field>
          </div>
        ))}
      </div>
    </PainelColapsavel>
  );
}
