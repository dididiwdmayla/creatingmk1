"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/Button";
import { ApiError, api } from "@/lib/api-client";
import { DEFAULT_CONFIG, type AppConfig, type FiltroPresenca } from "@/lib/config";
import { SKUS, SKU_LABELS } from "@/lib/sku-labels";

const PRESENCA_OPTIONS: Array<{ value: FiltroPresenca; label: string }> = [
  { value: "qualquer", label: "Qualquer" },
  { value: "com", label: "Com" },
  { value: "sem", label: "Sem" },
];

export default function ConfigPage() {
  const [form, setForm] = useState<AppConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [problemas, setProblemas] = useState<string[]>([]);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    api
      .getConfig()
      .then(({ config }) => setForm(config))
      .catch((error) =>
        setErro(error instanceof ApiError ? error.message : "Falha ao carregar a config."),
      )
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setErro(null);
    setProblemas([]);
    setSalvo(false);
    try {
      const { config } = await api.putConfig(form);
      setForm(config);
      setSalvo(true);
    } catch (error) {
      if (error instanceof ApiError && error.code === "validation_error") {
        setProblemas((error.extra.problemas as string[]) ?? [error.message]);
      } else {
        setErro(error instanceof ApiError ? error.message : "Falha ao salvar.");
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-ink-muted">Carregando…</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 pb-6">
      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Busca</h2>
        <div className="mt-3 flex flex-col gap-3">
          <Field label="Nicho-alvo">
            <input
              value={form.nicho}
              onChange={(e) => setForm({ ...form, nicho: e.target.value })}
              placeholder="ex.: dentista"
              className="w-full rounded border border-line bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            />
          </Field>
          <Field label="Região de busca">
            <input
              value={form.regiao}
              onChange={(e) => setForm({ ...form, regiao: e.target.value })}
              placeholder="ex.: Sarandi PR"
              className="w-full rounded border border-line bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Filtro: tem site?">
              <select
                value={form.filtros.temSite}
                onChange={(e) =>
                  setForm({
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
                  setForm({
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
      </section>

      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Mensagem padrão
        </h2>
        <p className="mt-1 text-xs text-ink-muted">
          Use <code className="font-mono">{"{nome}"}</code> para o nome do lead.
        </p>
        <textarea
          value={form.mensagemPadrao}
          onChange={(e) => setForm({ ...form, mensagemPadrao: e.target.value })}
          rows={4}
          className="mt-2 w-full rounded border border-line bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
        />
      </section>

      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Tetos mensais por SKU
        </h2>
        <div className="mt-3 flex flex-col gap-3">
          {SKUS.map((sku) => (
            <Field key={sku} label={SKU_LABELS[sku]}>
              <input
                type="number"
                min={0}
                step={1}
                value={form.caps[sku]}
                onChange={(e) =>
                  setForm({
                    ...form,
                    caps: { ...form.caps, [sku]: Number(e.target.value) || 0 },
                  })
                }
                className="w-full rounded border border-line bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
              />
            </Field>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Preços e câmbio
        </h2>
        <div className="mt-3 flex flex-col gap-3">
          <Field label="Câmbio USD → BRL">
            <input
              type="number"
              min={0}
              step={0.01}
              value={form.precos.usdBrl}
              onChange={(e) =>
                setForm({
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
                    setForm({
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
                    setForm({
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
      </section>

      {problemas.length > 0 && (
        <ul className="rounded border border-critical/40 bg-critical/10 p-3 text-sm text-critical">
          {problemas.map((problema) => (
            <li key={problema}>{problema}</li>
          ))}
        </ul>
      )}
      {erro && <p className="text-sm text-critical">{erro}</p>}
      {salvo && <p className="text-sm text-good">Configuração salva.</p>}

      <Button type="submit" loading={saving}>
        Salvar
      </Button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-ink-secondary">{label}</span>
      {children}
    </label>
  );
}
