"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  ApiError,
  api,
  type CronStatusResponse,
  type MetricsResponse,
  type UsageResponse,
} from "@/lib/api-client";
import { formatBRL, formatDateTime, formatInt, formatPercent, formatUSD } from "@/lib/format";
import { SKUS, SKU_LABELS } from "@/lib/sku-labels";
import { RadarSweep } from "@/components/RadarSweep";
import { UsageMeter } from "@/components/UsageMeter";

/** Fetcher puro (não mexe em estado) — reaproveitado pelo efeito de carga e pelo retry. */
async function fetchDashboardData(): Promise<{
  usage: UsageResponse;
  metrics: MetricsResponse;
  cron: CronStatusResponse;
}> {
  const [usage, metrics, cron] = await Promise.all([
    api.getUsage(),
    api.getMetrics(),
    api.cronStatus(),
  ]);
  return { usage, metrics, cron };
}

export default function DashboardPage() {
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [cron, setCron] = useState<CronStatusResponse | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    fetchDashboardData()
      .then((data) => {
        if (ignore) return;
        setUsage(data.usage);
        setMetrics(data.metrics);
        setCron(data.cron);
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
        setCron(data.cron);
        setErro(null);
      })
      .catch((error) => {
        setErro(error instanceof ApiError ? error.message : "Falha ao carregar o painel.");
      })
      .finally(() => setLoading(false));
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-16">
        <RadarSweep size={88} />
        <p className="text-sm text-ink-muted">Varrendo o painel…</p>
      </div>
    );
  }

  if (erro || !usage || !metrics) {
    return (
      <div className="rounded border border-critical/40 bg-critical/10 p-4 text-sm text-critical">
        <p>{erro ?? "Falha ao carregar o painel."}</p>
        <button
          type="button"
          onClick={retry}
          className="mt-3 rounded bg-critical px-3 py-1.5 text-xs font-medium text-critical-ink"
        >
          Tentar de novo
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section>
        <p className="text-xs uppercase tracking-[0.15em] text-ink-muted">
          Custo projetado este mês · {usage.period}
        </p>
        <p className="mt-1 font-display text-6xl font-bold leading-none tracking-tight text-foreground">
          {formatBRL(usage.custoProjetado.brl)}
        </p>
        <p className="mt-2 font-mono text-xs text-ink-muted">
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
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Hoje" value={formatInt(metrics.contatosHoje)} />
          <StatTile label="Últimos 7 dias" value={formatInt(metrics.contatosSemana)} />
          <StatTile label="Taxa de resposta" value={formatPercent(metrics.taxaResposta)} />
          <StatTile label="Fechamentos do mês" value={formatInt(metrics.fechamentosMes)} />
        </div>
      </section>

      {/* Só o admin recebe a quebra por usuário (membro vê só o próprio uso acima). */}
      {Boolean(usage.porUsuario?.length || metrics.porUsuario?.length) && (
        <section className="rounded-lg border border-line bg-surface p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Por usuário
          </h2>
          <div className="mt-3 flex flex-col gap-3">
            {(metrics.porUsuario ?? []).map((u) => {
              const uso = usage.porUsuario?.find((x) => x.userId === u.userId)?.usage;
              const requests = uso ? SKUS.reduce((soma, sku) => soma + uso[sku], 0) : 0;
              return (
                <div key={u.userId} className="rounded border border-line p-3">
                  <p className="text-sm font-semibold text-foreground">{u.nome}</p>
                  <div className="mt-2 grid grid-cols-5 gap-2 text-center">
                    <MiniStat label="Requests" value={formatInt(requests)} />
                    <MiniStat label="Buscas" value={formatInt(u.buscas)} />
                    <MiniStat label="Demos" value={formatInt(u.demos)} />
                    <MiniStat label="Contatos" value={formatInt(u.contatos)} />
                    <MiniStat label="Fechamentos" value={formatInt(u.fechamentosMes)} />
                  </div>
                  {uso && requests > 0 && (
                    <p className="mt-2 font-mono text-[10px] text-ink-muted">
                      {SKUS.filter((sku) => uso[sku] > 0)
                        .map((sku) => `${SKU_LABELS[sku]}: ${formatInt(uso[sku])}`)
                        .join(" · ")}
                    </p>
                  )}
                </div>
              );
            })}
            {/* Usuários com requests mas sem ação-chave carimbada ainda. */}
            {(usage.porUsuario ?? [])
              .filter((x) => !(metrics.porUsuario ?? []).some((u) => u.userId === x.userId))
              .map((x) => (
                <div key={x.userId} className="rounded border border-line p-3">
                  <p className="text-sm font-semibold text-foreground">{x.nome}</p>
                  <p className="mt-1 font-mono text-[10px] text-ink-muted">
                    {SKUS.filter((sku) => x.usage[sku] > 0)
                      .map((sku) => `${SKU_LABELS[sku]}: ${formatInt(x.usage[sku])}`)
                      .join(" · ") || "sem requests este mês"}
                  </p>
                </div>
              ))}
          </div>
        </section>
      )}

      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Buscas recorrentes · cron da madrugada
        </h2>
        {cron?.ultima ? (
          <div className="mt-2">
            <p className="text-sm text-foreground">
              Última execução: {formatDateTime(cron.ultima.em)} —{" "}
              <span className="font-semibold">{formatInt(cron.ultima.totalNovos)} novo(s)</span> ·{" "}
              {formatInt(cron.ultima.totalExistentes)} já existente(s) em{" "}
              {formatInt(cron.ultima.buscas.length)} busca(s)
            </p>
            {cron.ultima.interrompida && (
              <p className="mt-1 text-xs text-warning">
                Interrompida{cron.ultima.interrompida.nome ? ` em "${cron.ultima.interrompida.nome}"` : ""}:{" "}
                {cron.ultima.interrompida.motivo}
              </p>
            )}
            {cron.ultima.buscas.some((b) => b.erro) && (
              <p className="mt-1 text-xs text-critical">
                {cron.ultima.buscas
                  .filter((b) => b.erro)
                  .map((b) => `"${b.nome}" falhou`)
                  .join(" · ")}
              </p>
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm text-ink-muted">O cron ainda não rodou.</p>
        )}
        <p className="mt-2 text-xs text-ink-muted">
          {cron
            ? `${formatInt(cron.recorrentes)} busca(s) recorrente(s) ligada(s) — gerencie em `
            : "Gerencie as recorrências em "}
          <Link href="/buscas" className="text-accent">
            Buscas
          </Link>
          .
        </p>
      </section>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Forja de Demos
        </h2>
        <Link
          href="/demos"
          className="card-lift mt-3 flex items-center justify-between rounded-lg border border-line bg-surface p-4"
        >
          <div>
            <p className="text-xs text-ink-muted">Demos criadas</p>
            <p className="mt-1 font-display text-3xl font-bold text-foreground">
              {formatInt(metrics.demosCriadas)}
            </p>
          </div>
          <span className="text-xs text-accent">Ver todas →</span>
        </Link>
      </section>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-display text-xl font-bold text-foreground">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-ink-muted">{label}</p>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-lift rounded-lg border border-line bg-surface p-3">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold text-foreground">{value}</p>
    </div>
  );
}
