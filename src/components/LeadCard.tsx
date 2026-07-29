"use client";

import Link from "next/link";
import { useState } from "react";

import { StatusBadge } from "./StatusBadge";
import { ApiError, api } from "@/lib/api-client";
import { estadoAtual } from "@/lib/leads/horarios";
import type { Lead } from "@/lib/leads/types";

const NOTAS_MAX = 500; // espelha o limite da rota PATCH

function telPresenca(lead: Lead): boolean | undefined {
  if (lead.enriquecido) return Boolean(lead.detalhes?.telefone);
  return lead.temTelefone;
}

function presencaTexto(presenca: boolean | undefined): string {
  return presenca === undefined ? "?" : presenca ? "sim" : "não";
}

export function LeadCard({
  lead,
  cores,
  score,
  destaque,
  argumentoForte,
  onChange,
}: {
  lead: Lead;
  /** buscaId → cor (badge de cor das buscas em que o lead apareceu). */
  cores: Record<string, string>;
  /** Score de priorização (calculaScore) — badge no card. */
  score: number;
  /** Está entre os top-scored da lista/grupo atual — ganha o 🎯. */
  destaque?: boolean;
  /** Penetração de site do nicho dele é >60% — argumento forte (badge discreto). */
  argumentoForte?: boolean;
  onChange: (lead: Lead) => void;
}) {
  const [editandoNotas, setEditandoNotas] = useState(false);
  const [notasDraft, setNotasDraft] = useState(lead.notas ?? "");
  const [salvandoNotas, setSalvandoNotas] = useState(false);
  const [salvandoFavorito, setSalvandoFavorito] = useState(false);
  const [salvandoDescarte, setSalvandoDescarte] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // siteProprio vem derivado do servidor (asLead): true = site próprio;
  // false = sem site OU só rede social (lead quente); undefined = desconhecido.
  const siteProprio = lead.siteProprio;
  const soRedeSocial = siteProprio === false && lead.temSite === true;
  const dots = (lead.buscaId ?? [])
    .map((id) => cores[id])
    .filter(Boolean)
    .slice(0, 3);
  const estado = estadoAtual(lead.horarios);

  async function toggleFavorito() {
    setSalvandoFavorito(true);
    setErro(null);
    try {
      const { lead: updated } = await api.patchLead(lead.placeId, {
        favorito: !lead.favorito,
      });
      onChange(updated);
    } catch (error) {
      setErro(error instanceof ApiError ? error.message : "Falha ao favoritar.");
    } finally {
      setSalvandoFavorito(false);
    }
  }

  async function toggleDescarte() {
    setSalvandoDescarte(true);
    setErro(null);
    try {
      const { lead: updated } = await api.patchLead(lead.placeId, {
        descartado: !lead.descartado,
      });
      onChange(updated);
    } catch (error) {
      setErro(error instanceof ApiError ? error.message : "Falha ao descartar.");
    } finally {
      setSalvandoDescarte(false);
    }
  }

  async function salvarNotas() {
    setSalvandoNotas(true);
    setErro(null);
    try {
      const { lead: updated } = await api.patchLead(lead.placeId, {
        notas: notasDraft.trim(),
      });
      onChange(updated);
      setEditandoNotas(false);
    } catch (error) {
      setErro(error instanceof ApiError ? error.message : "Falha ao salvar as notas.");
    } finally {
      setSalvandoNotas(false);
    }
  }

  return (
    <div
      className={`card-lift rounded-lg border border-line bg-surface p-3 ${
        lead.descartado ? "lead-descartado" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <Link href={`/leads/${lead.placeId}`} className="min-w-0 flex-1 hover:opacity-80">
          <p className="truncate text-sm font-medium text-foreground">{lead.nome}</p>
          {lead.endereco && (
            <p className="truncate text-xs text-ink-muted">{lead.endereco}</p>
          )}
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <span
            title="Score de priorização"
            className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
              destaque
                ? "bg-warning/15 text-warning"
                : "bg-surface-2 text-ink-muted"
            }`}
          >
            {destaque && <span aria-hidden>🎯</span>}
            {score > 0 ? `+${score}` : score}
          </span>
          <StatusBadge status={lead.status} />
          <button
            type="button"
            onClick={toggleFavorito}
            disabled={salvandoFavorito}
            aria-label={lead.favorito ? "Remover dos favoritos" : "Favoritar"}
            className={`text-lg leading-none disabled:opacity-50 ${
              lead.favorito ? "text-warning" : "text-ink-muted hover:text-warning"
            }`}
          >
            {lead.favorito ? "★" : "☆"}
          </button>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
        <span className="text-ink-secondary">
          site:{" "}
          {siteProprio === false ? (
            <span className="font-semibold text-good">
              {soRedeSocial ? "só rede social (lead quente)" : "não (lead quente)"}
            </span>
          ) : (
            presencaTexto(siteProprio)
          )}{" "}
          · tel: {presencaTexto(telPresenca(lead))}
        </span>
        {argumentoForte && (
          <span
            title="Mais de 60% da concorrência do nicho já tem site — argumento forte"
            className="shrink-0 rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold text-warning"
          >
            argumento forte
          </span>
        )}
        {dots.length > 0 && (
          <span className="flex shrink-0 gap-1" aria-hidden>
            {dots.map((cor, i) => (
              <span
                key={`${cor}-${i}`}
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: cor }}
              />
            ))}
          </span>
        )}
      </div>

      {estado && (
        <p className={`mt-1 text-xs ${estado.aberto ? "font-medium text-good" : "text-ink-muted"}`}>
          {estado.texto}
        </p>
      )}

      {editandoNotas ? (
        <div className="mt-2">
          <textarea
            value={notasDraft}
            onChange={(event) => setNotasDraft(event.target.value.slice(0, NOTAS_MAX))}
            rows={2}
            autoFocus
            placeholder="Nota curta sobre o lead…"
            className="w-full rounded border border-line bg-surface-2 px-2 py-1.5 text-xs text-foreground outline-none focus:border-accent"
          />
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={salvarNotas}
              disabled={salvandoNotas}
              className="rounded bg-accent px-2 py-1 text-xs font-semibold text-accent-ink disabled:opacity-50"
            >
              {salvandoNotas ? "Salvando…" : "Salvar"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditandoNotas(false);
                setNotasDraft(lead.notas ?? "");
              }}
              className="text-xs text-ink-muted hover:text-foreground"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex items-baseline justify-between gap-2">
          {lead.notas ? (
            <p className="min-w-0 truncate text-xs italic text-ink-secondary">{lead.notas}</p>
          ) : (
            <span />
          )}
          <span className="flex shrink-0 gap-3">
            <button
              type="button"
              onClick={() => setEditandoNotas(true)}
              className="text-xs text-ink-muted hover:text-accent"
            >
              {lead.notas ? "editar notas" : "+ notas"}
            </button>
            <button
              type="button"
              onClick={toggleDescarte}
              disabled={salvandoDescarte}
              className={`relative z-10 text-xs disabled:opacity-50 ${
                lead.descartado
                  ? "text-foreground hover:text-accent"
                  : "text-ink-muted hover:text-critical"
              }`}
            >
              {lead.descartado ? "restaurar" : "descartar"}
            </button>
          </span>
        </div>
      )}

      {erro && <p className="mt-1 text-xs text-critical">{erro}</p>}
    </div>
  );
}
