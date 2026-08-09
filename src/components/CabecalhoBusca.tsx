"use client";

import type { ReactNode } from "react";

import { nomeUsuario, type NomesUsuarios } from "@/lib/contato-selo";
import type { Busca } from "@/lib/buscas/types";
import { formatDateShort, formatInt } from "@/lib/format";

/**
 * Cabeçalho de um GRUPO DE BUSCA, compartilhado por `/leads` (o grupo é a
 * seção colapsável de leads daquela busca) e `/buscas` (o grupo é o card da
 * própria busca, que dobra para virar só esta faixa).
 *
 * Ele existe porque, fechado, o grupo é a ÚNICA coisa na tela — então
 * precisa carregar sozinho tudo que identifica a busca: cor, nome, nicho e
 * região, data, autor e a contagem de leads. Duas linhas densas em vez do
 * card de seis: a primeira é o que se lê de relance (cor, nome, contagem),
 * a segunda é a procedência (nicho·sub-nicho — região · data · autor).
 *
 * A cor é sempre reforço redundante, nunca canal único (ver BUSCA_CORES):
 * o nome está escrito ao lado do ponto, e o triângulo diz o estado da
 * dobra sem depender de cor nenhuma.
 */
export function CabecalhoBusca({
  titulo,
  cor,
  busca,
  contagem,
  contagemTitulo,
  aberto,
  onToggle,
  nomes,
  onTrocarCor,
  trocandoCor,
  acoes,
}: {
  /** Nome do grupo — o da busca, ou "Sem busca" no resto. */
  titulo: string;
  cor?: string;
  /** Busca de origem (ausente no grupo "Sem busca": não há procedência). */
  busca?: Busca;
  contagem: number;
  /** `title` da contagem — o que ela conta muda entre as duas telas. */
  contagemTitulo: string;
  aberto: boolean;
  onToggle: () => void;
  nomes: NomesUsuarios;
  /** Só em /buscas: tocar no ponto cicla a paleta e persiste. */
  onTrocarCor?: () => void;
  trocandoCor?: boolean;
  /** Ações à direita do cabeçalho (fora do botão de dobrar). */
  acoes?: ReactNode;
}) {
  const procedencia = busca
    ? [
        [busca.nicho, busca.subNicho].filter(Boolean).join(" · "),
        busca.regiao,
      ]
        .filter(Boolean)
        .join(" — ")
    : "";
  const autor = busca
    ? busca.userId
      ? nomeUsuario(nomes, busca.userId)
      : "autor não registrado"
    : "";

  const ponto = (
    <span
      aria-hidden
      className="h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: cor ?? "var(--ink-muted)" }}
    />
  );

  return (
    <div className="flex items-center gap-1.5">
      {onTrocarCor ? (
        <button
          type="button"
          onClick={onTrocarCor}
          disabled={trocandoCor}
          title="Trocar a cor da busca (cicla a paleta)"
          aria-label={`Trocar a cor da busca ${titulo}`}
          className="shrink-0 rounded-full p-1 ring-2 ring-transparent transition hover:ring-[var(--ring-soft)] disabled:opacity-50"
        >
          {ponto}
        </button>
      ) : null}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={aberto}
        className="flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-1.5 text-left hover:bg-surface-2"
      >
        <span aria-hidden className="shrink-0 text-xs text-ink-muted">
          {aberto ? "▾" : "▸"}
        </span>
        {onTrocarCor ? null : ponto}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium text-foreground">{titulo}</span>
            {busca?.recorrente && (
              <span
                title="Busca recorrente: o cron re-executa 1x/dia"
                className="shrink-0 rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent"
              >
                recorrente
              </span>
            )}
          </span>
          {busca && (
            <span className="mt-0.5 block truncate text-[11px] text-ink-muted">
              {procedencia} <span aria-hidden>·</span> {formatDateShort(busca.criadaEm)}{" "}
              <span aria-hidden>·</span> {autor}
            </span>
          )}
        </span>
        <span
          title={contagemTitulo}
          className="shrink-0 rounded-full bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-ink-secondary"
        >
          {formatInt(contagem)}
        </span>
      </button>
      {acoes}
    </div>
  );
}
