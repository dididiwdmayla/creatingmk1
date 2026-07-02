"use client";

import { useEffect, useState } from "react";

import { ApiError, api, type UsageResponse } from "@/lib/api-client";
import { formatBRL, formatInt, formatPercent, formatUSD } from "@/lib/format";
import type { Metrics } from "@/lib/leads/metrics";
import { SKUS, SKU_LABELS } from "@/lib/sku-labels";
import { UsageMeter } from "@/components/UsageMeter";

/** Fetcher puro (não mexe em estado) — reaproveitado pelo efeito de carga e pelo retry. */
async function fetchDashboardData(): Promise<{ usage: UsageResponse; metrics: Metrics }> {
  const [usage, metrics] = await Promise.all([api.getUsage(), api.getMetrics()]);
  return { usage, metrics };
}

export default function DashboardPage() {
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    fetchDashboardData()
      .then((data) => {
        if (ignore) return;
        setUsage(data.usage);
        setMetrics(data.metrics);
        setErro(null);
      })
      .catch((error) => {
        if (ignore) return;
        setErro(error instanceof ApiError ? error.message : "Falha ao carregar o painel.");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  function retry() {
    setLoading(true);
    fetchDashboardData()
      .then((data) => {
        setUsage(data.usage);
        setMetrics(data.metrics);
        setErro(null);
      })
      .catch((error) => {
        setErro(error instanceof ApiError ? error.message : "Falha ao carregar o painel.");
      })
      .finally(() => setLoading(false));
  }

  if (loading) {
    return <p className="text-sm text-ink-muted">Carregando…</p>;
  }

  if (erro || !usage || !metrics) {
    return (
      <div className="rounded border border-critical/40 bg-critical/10 p-4 text-sm text-critical">
        <p>{erro ?? "Falha ao carregar o painel."}</p>
        <button
          type="button"
          onClick={retry}
          className="mt-3 rounded bg-critical px-3 py-1.5 text-xs font-medium text-white"
        >
          Tentar de novo
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section>
        <p className="text-xs text-ink-muted">Custo projetado este mês · {usage.period}</p>
        <p className="mt-1 font-mono text-5xl font-semibold tracking-tight text-foreground">
          {formatBRL(usage.custoProjetado.brl)}
        </p>
        <p className="mt-1 text-xs text-ink-muted">
          {formatUSD(usage.custoProjetado.usd)} · excedente além da cota grátis
        </p>
      </section>

      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Uso vs. teto por SKU
        </h2>
        <div className="mt-4 flex flex-col gap-4">
          {SKUS.map((sku) => (
            <UsageMeter
              key={sku}
              label={SKU_LABELS[sku]}
              used={usage.usage[sku]}
              cap={usage.caps[sku]}
              freeQuota={usage.cotaGratis[sku]}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Prospecção
        </h2>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <StatTile label="Hoje" value={formatInt(metrics.contatosHoje)} />
          <StatTile label="Últimos 7 dias" value={formatInt(metrics.contatosSemana)} />
          <StatTile label="Taxa de resposta" value={formatPercent(metrics.taxaResposta)} />
        </div>
      </section>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="mt-1 font-mono text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
