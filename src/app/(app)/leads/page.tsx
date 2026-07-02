"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/Button";
import { StatusBadge } from "@/components/StatusBadge";
import { ApiError, api } from "@/lib/api-client";
import type { FiltroPresenca } from "@/lib/config";
import type { Lead, LeadStatus } from "@/lib/leads/types";

const STATUS_OPTIONS: Array<{ value: LeadStatus | ""; label: string }> = [
  { value: "", label: "Todos os status" },
  { value: "novo", label: "Novo" },
  { value: "contactado", label: "Contactado" },
  { value: "respondeu", label: "Respondeu" },
  { value: "fechado", label: "Fechado" },
];

const PRESENCA_OPTIONS: Array<{ value: FiltroPresenca; label: string }> = [
  { value: "qualquer", label: "Qualquer" },
  { value: "com", label: "Com" },
  { value: "sem", label: "Sem" },
];

function siteInfo(lead: Lead): string {
  if (!lead.enriquecido) return "site: ?";
  return lead.detalhes?.site ? "site: sim" : "site: não";
}

function telefoneInfo(lead: Lead): string {
  if (!lead.enriquecido) return "tel: ?";
  return lead.detalhes?.telefone ? "tel: sim" : "tel: não";
}

/** Fetcher puro (não mexe em estado) — reaproveitado pelo efeito de filtro e pela busca. */
function fetchLeads(filters: {
  status: LeadStatus | "";
  temSite: FiltroPresenca;
  temTelefone: FiltroPresenca;
}): Promise<Lead[]> {
  return api.listLeads(filters).then((res) => res.leads);
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [status, setStatus] = useState<LeadStatus | "">("");
  const [temSite, setTemSite] = useState<FiltroPresenca>("qualquer");
  const [temTelefone, setTemTelefone] = useState<FiltroPresenca>("qualquer");
  const [erroLista, setErroLista] = useState<string | null>(null);

  const [nicho, setNicho] = useState("");
  const [regiao, setRegiao] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [buscaMsg, setBuscaMsg] = useState<string | null>(null);
  const [buscaErro, setBuscaErro] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    fetchLeads({ status, temSite, temTelefone })
      .then((data) => {
        if (ignore) return;
        setLeads(data);
        setErroLista(null);
      })
      .catch((error) => {
        if (ignore) return;
        setErroLista(error instanceof ApiError ? error.message : "Falha ao carregar leads.");
      });
    return () => {
      ignore = true;
    };
  }, [status, temSite, temTelefone]);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBuscando(true);
    setBuscaMsg(null);
    setBuscaErro(null);
    try {
      const body: { nicho?: string; regiao?: string } = {};
      if (nicho.trim()) body.nicho = nicho.trim();
      if (regiao.trim()) body.regiao = regiao.trim();
      const result = await api.search(body);
      setBuscaMsg(`${result.criados} novo(s), ${result.existentes} já existente(s).`);
      const data = await fetchLeads({ status, temSite, temTelefone });
      setLeads(data);
      setErroLista(null);
    } catch (error) {
      if (error instanceof ApiError && error.code === "quota_exceeded") {
        setBuscaErro(
          `Teto mensal atingido para ${error.extra.sku} (${error.extra.used}/${error.extra.cap} em ${error.extra.period}).`,
        );
      } else if (error instanceof ApiError && error.code === "places_error") {
        setBuscaErro(`Erro do Google: ${error.extra.detail ?? error.message}`);
      } else {
        setBuscaErro(error instanceof ApiError ? error.message : "Falha na busca.");
      }
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={handleSearch}
        className="rounded-lg border border-line bg-surface p-4"
      >
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Nova busca
        </h2>
        <div className="mt-3 flex flex-col gap-2">
          <input
            value={nicho}
            onChange={(event) => setNicho(event.target.value)}
            placeholder="Nicho (padrão: da config)"
            className="w-full rounded border border-line bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
          />
          <input
            value={regiao}
            onChange={(event) => setRegiao(event.target.value)}
            placeholder="Região (padrão: da config)"
            className="w-full rounded border border-line bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
          />
          <Button type="submit" loading={buscando}>
            Buscar
          </Button>
        </div>
        {buscaMsg && <p className="mt-2 text-sm text-good">{buscaMsg}</p>}
        {buscaErro && <p className="mt-2 text-sm text-critical">{buscaErro}</p>}
      </form>

      <div className="grid grid-cols-3 gap-2">
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as LeadStatus | "")}
          className="rounded border border-line bg-surface-2 px-2 py-1.5 text-xs text-foreground outline-none focus:border-accent"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          value={temSite}
          onChange={(event) => setTemSite(event.target.value as FiltroPresenca)}
          className="rounded border border-line bg-surface-2 px-2 py-1.5 text-xs text-foreground outline-none focus:border-accent"
        >
          {PRESENCA_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              Site: {opt.label}
            </option>
          ))}
        </select>
        <select
          value={temTelefone}
          onChange={(event) => setTemTelefone(event.target.value as FiltroPresenca)}
          className="rounded border border-line bg-surface-2 px-2 py-1.5 text-xs text-foreground outline-none focus:border-accent"
        >
          {PRESENCA_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              Tel: {opt.label}
            </option>
          ))}
        </select>
      </div>

      {erroLista && <p className="text-sm text-critical">{erroLista}</p>}

      {leads === null ? (
        <p className="text-sm text-ink-muted">Carregando…</p>
      ) : leads.length === 0 ? (
        <p className="text-sm text-ink-muted">
          Nenhum lead encontrado. Ajuste os filtros ou faça uma busca.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {leads.map((lead) => (
            <li key={lead.placeId}>
              <Link
                href={`/leads/${lead.placeId}`}
                className="block rounded-lg border border-line bg-surface p-3 hover:border-accent"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {lead.nome}
                    </p>
                    {lead.endereco && (
                      <p className="truncate text-xs text-ink-muted">{lead.endereco}</p>
                    )}
                  </div>
                  <StatusBadge status={lead.status} />
                </div>
                <p className="mt-2 text-xs text-ink-secondary">
                  {siteInfo(lead)} · {telefoneInfo(lead)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
