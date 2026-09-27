import Link from "next/link";

import type { CronStatusResponse } from "@/lib/api-client";
import { CRON_MAX_DURATION_S, ROTULO_ETAPA, situacaoCron, type SituacaoCron } from "@/lib/buscas/cron-estado";
import { formatDateTime, formatInt } from "@/lib/format";

/**
 * Widget "Buscas recorrentes" do dashboard: a última rodada do cron.
 *
 * O ponto dele é não mentir por omissão. Antes, uma rodada que morria não
 * gravava nada e o painel continuava mostrando a última BEM-SUCEDIDA — o
 * operador lia "rodou" sobre uma madrugada em que nada rodou. Agora o
 * estado vem sempre ESCRITO num selo (palavra + ícone, nunca só a cor), e
 * falha muda também a borda do cartão.
 */

const SELO: Record<Exclude<SituacaoCron["tipo"], "nunca">, { texto: string; cls: string }> = {
  rodou: { texto: "✓ Rodou", cls: "bg-good/15 text-good" },
  rodando: { texto: "● Rodando", cls: "bg-surface-2 text-ink-secondary" },
  falhou: { texto: "✕ Falhou", cls: "bg-critical/15 text-critical" },
  "nao-concluiu": { texto: "✕ Não concluiu", cls: "bg-critical/15 text-critical" },
};

export function CronStatusCard({ cron, now }: { cron: CronStatusResponse | null; now: Date }) {
  const situacao = situacaoCron(cron?.ultima ?? null, now);
  const falha = situacao.tipo === "falhou" || situacao.tipo === "nao-concluiu";
  const selo = situacao.tipo === "nunca" ? undefined : SELO[situacao.tipo];

  return (
    <section
      data-cron-estado={situacao.tipo}
      className={`rounded-lg border bg-surface p-4 ${falha ? "border-critical/60" : "border-line"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Buscas recorrentes · cron da madrugada
        </h2>
        {selo && (
          <span
            data-cron-selo
            className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${selo.cls}`}
          >
            {selo.texto}
          </span>
        )}
      </div>

      <Corpo situacao={situacao} />

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
  );
}

function Corpo({ situacao }: { situacao: SituacaoCron }) {
  switch (situacao.tipo) {
    case "nunca":
      return <p className="mt-2 text-sm text-ink-muted">O cron ainda não rodou.</p>;

    case "rodando":
      return (
        <p className="mt-2 text-sm text-foreground">
          Em andamento desde {formatDateTime(situacao.execucao.em)}.
        </p>
      );

    case "nao-concluiu":
      return (
        <div className="mt-2">
          <p className="text-sm text-foreground">
            A rodada de {formatDateTime(situacao.execucao.em)} começou e não registrou o fim.
          </p>
          <p className="mt-1 text-xs text-ink-secondary">
            Passou do tempo máximo da função ({CRON_MAX_DURATION_S}s) ou foi derrubada antes de
            gravar o resultado — o que ela chegou a fazer não foi registrado.
          </p>
        </div>
      );

    case "falhou": {
      const { execucao, falha } = situacao;
      return (
        <div className="mt-2">
          <p className="text-sm text-foreground">
            A rodada de {formatDateTime(execucao.em)} parou na etapa{" "}
            <span className="font-semibold">{ROTULO_ETAPA[falha.etapa]}</span>.
          </p>
          <p
            data-cron-mensagem
            className="mt-1 break-words rounded border border-critical/40 bg-critical/10 px-2 py-1 font-mono text-xs text-critical"
          >
            {falha.mensagem}
          </p>
          <p className="mt-1 text-xs text-ink-secondary">
            Falha registrada em {formatDateTime(falha.em)}
            {execucao.buscas.length > 0
              ? ` · antes dela: ${formatInt(execucao.totalNovos)} novo(s) · ${formatInt(
                  execucao.totalExistentes,
                )} já existente(s) em ${formatInt(execucao.buscas.length)} busca(s).`
              : "."}
          </p>
        </div>
      );
    }

    case "rodou": {
      const { execucao } = situacao;
      return (
        <div className="mt-2">
          <p className="text-sm text-foreground">
            Última execução: {formatDateTime(execucao.em)} —{" "}
            <span className="font-semibold">{formatInt(execucao.totalNovos)} novo(s)</span> ·{" "}
            {formatInt(execucao.totalExistentes)} já existente(s) em{" "}
            {formatInt(execucao.buscas.length)} busca(s)
          </p>
          {execucao.interrompida && (
            <p className="mt-1 text-xs text-warning">
              Interrompida{execucao.interrompida.nome ? ` em "${execucao.interrompida.nome}"` : ""}:{" "}
              {execucao.interrompida.motivo}
            </p>
          )}
          {execucao.buscas.some((b) => b.erro) && (
            <p className="mt-1 text-xs text-critical">
              {execucao.buscas
                .filter((b) => b.erro)
                .map((b) => `"${b.nome}" falhou`)
                .join(" · ")}
            </p>
          )}
        </div>
      );
    }
  }
}
