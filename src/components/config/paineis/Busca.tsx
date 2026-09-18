"use client";

import { PainelColapsavel } from "@/components/config/PainelColapsavel";
import { Field } from "@/components/config/comum";
import type { PainelFormProps } from "@/components/config/tipos";
import type { FiltroPresenca } from "@/lib/config";

/** Chave da persistência deste painel — ver `PainelColapsavel`. */
export const PAINEL_BUSCA = "busca";

const PRESENCA_OPTIONS: Array<{ value: FiltroPresenca; label: string }> = [
  { value: "qualquer", label: "Qualquer" },
  { value: "com", label: "Com" },
  { value: "sem", label: "Sem" },
];

/**
 * Nicho-alvo, região e os dois filtros de LISTAGEM — eles não entram na
 * query do Text Search (ver "/config/app" no ARCHITECTURE.md).
 */
export function PainelBusca({ form, onChange }: PainelFormProps) {
  return (
    <PainelColapsavel
      id={PAINEL_BUSCA}
      titulo="Busca"
      resumo={`${form.nicho || "sem nicho"} · ${form.regiao || "sem região"}`}
    >
      <div className="mt-3 flex flex-col gap-3">
        <Field label="Nicho-alvo">
          <input
            value={form.nicho}
            onChange={(e) => onChange({ ...form, nicho: e.target.value })}
            placeholder="ex.: dentista"
            className="w-full rounded border border-line bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
          />
        </Field>
        <Field label="Região de busca">
          <input
            value={form.regiao}
            onChange={(e) => onChange({ ...form, regiao: e.target.value })}
            placeholder="ex.: Sarandi PR"
            className="w-full rounded border border-line bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Filtro: tem site?">
            <select
              value={form.filtros.temSite}
              onChange={(e) =>
                onChange({
                  ...form,
                  filtros: { ...form.filtros, temSite: e.target.value as FiltroPresenca },
                })
              }
              className="w-full rounded border border-line bg-surface-2 px-2 py-2 text-sm text-foreground outline-none focus:border-accent"
            >
              {PRESENCA_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Filtro: tem telefone?">
            <select
              value={form.filtros.temTelefone}
              onChange={(e) =>
                onChange({
                  ...form,
                  filtros: {
                    ...form.filtros,
                    temTelefone: e.target.value as FiltroPresenca,
                  },
                })
              }
              className="w-full rounded border border-line bg-surface-2 px-2 py-2 text-sm text-foreground outline-none focus:border-accent"
            >
              {PRESENCA_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>
    </PainelColapsavel>
  );
}
