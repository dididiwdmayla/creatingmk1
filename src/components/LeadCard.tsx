"use client";

import Link from "next/link";
import { useState } from "react";

import { StatusBadge } from "./StatusBadge";
import { ApiError, api } from "@/lib/api-client";
import type { Lead } from "@/lib/leads/types";

const NOTAS_MAX = 500; // espelha o limite da rota PATCH

/** Presença de site: enriquecimento manda; senão vale a busca qualificada. */
function sitePresenca(lead: Lead): boolean | undefined {
  if (lead.enriquecido) return Boolean(lead.detalhes?.site);
  return lead.temSite;
}

function telPresenca(lead: Lead): boolean | undefined {
  if (lead.enriquecido) return Boolean(lead.detalhes?.telefone);
  return undefined;
}

function presencaTexto(presenca: boolean | undefined): string {
  return presenca === undefined ? "?" : presenca ? "sim" : "não";
}

export function LeadCard({
  lead,
  cores,
  onChange,
}: {
  lead: Lead;
  /** buscaId → cor (badge de cor das buscas em que o lead apareceu). */
  cores: Record<string, string>;
  onChange: (lead: Lead) => void;
}) {
  const [editandoNotas, setEditandoNotas] = useState(false);
  const [notasDraft, setNotasDraft] = useState(lead.notas ?? "");
  const [salvandoNotas, setSalvandoNotas] = useState(false);
  const [salvandoFavorito, setSalvandoFavorito] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const site = sitePresenca(lead);
  const semSite = site === false;
  const dots = (lead.buscaId ?? [])
    .map((id) => cores[id])
    .filter(Boolean)
    .slice(0, 3);

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
    <div className="card-lift rounded-lg border border-line bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/leads/${lead.placeId}`} className="min-w-0 flex-1 hover:opacity-80">
          <p className="truncate text-sm font-medium text-foreground">{lead.nome}</p>
          {lead.endereco && (
            <p className="truncate text-xs text-ink-muted">{lead.endereco}</p>
          )}
        </Link>
        <div className="flex shrink-0 items-center gap-2">
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
          {semSite ? (
            <span className="font-semibold text-good">não (lead quente)</span>
          ) : (
            presencaTexto(site)
          )}{" "}
          · tel: {presencaTexto(telPresenca(lead))}
        </span>
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
          <button
            type="button"
            onClick={() => setEditandoNotas(true)}
            className="shrink-0 text-xs text-ink-muted hover:text-accent"
          >
            {lead.notas ? "editar notas" : "+ notas"}
          </button>
        </div>
      )}

      {erro && <p className="mt-1 text-xs text-critical">{erro}</p>}
    </div>
  );
}
