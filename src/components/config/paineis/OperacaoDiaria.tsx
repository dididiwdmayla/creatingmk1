"use client";

import { PainelColapsavel } from "@/components/config/PainelColapsavel";
import { Field } from "@/components/config/comum";
import type { PainelFormProps } from "@/components/config/tipos";

/** Chave da persistência deste painel — ver `PainelColapsavel`. */
export const PAINEL_OPERACAO = "operacao-diaria";

/** Os dois números que o cron da madrugada e a fila de /hoje consultam. */
export function PainelOperacaoDiaria({ form, onChange }: PainelFormProps) {
  return (
    <PainelColapsavel
      id={PAINEL_OPERACAO}
      titulo="Operação diária"
      resumo={`follow-up ${form.followUpDias}d · ${form.maxBuscasRecorrentes} recorrentes`}
    >
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Field label="Follow-up após (dias sem resposta)">
          <input
            type="number"
            min={1}
            step={1}
            value={form.followUpDias}
            onChange={(e) =>
              onChange({ ...form, followUpDias: Number(e.target.value) || 0 })
            }
            className="w-full rounded border border-line bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
          />
        </Field>
        <Field label="Teto de buscas recorrentes">
          <input
            type="number"
            min={0}
            step={1}
            value={form.maxBuscasRecorrentes}
            onChange={(e) =>
              onChange({ ...form, maxBuscasRecorrentes: Number(e.target.value) || 0 })
            }
            className="w-full rounded border border-line bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
          />
        </Field>
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        O cron da madrugada re-executa as buscas marcadas como recorrentes (até o teto) e a
        fila do dia (/hoje) marca follow-up quem está contactado sem resposta há mais dias
        que o limite.
      </p>
    </PainelColapsavel>
  );
}
