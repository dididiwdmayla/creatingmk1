"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/Button";
import { LeadCard } from "@/components/LeadCard";
import { ApiError, api } from "@/lib/api-client";
import type { Busca } from "@/lib/buscas/types";
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

const AUTO_ENRICH_MAX = 5;
const QUANTIDADE_MAX = 40;

/** Placeholder do nome da busca, espelhando o default do servidor. */
function nomeDefaultHint(nicho: string): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return `${nicho || "nicho"} ${dd}/${mm}`;
}

interface LeadFiltersState {
  status: LeadStatus | "";
  temSite: FiltroPresenca;
  temTelefone: FiltroPresenca;
  soFavoritos: boolean;
  buscaId?: string;
}

/** Fetcher puro (não mexe em estado) — reaproveitado pelo efeito de filtro e pela busca. */
function fetchLeads(filters: LeadFiltersState): Promise<Lead[]> {
  return api
    .listLeads({
      status: filters.status,
      temSite: filters.temSite,
      temTelefone: filters.temTelefone,
      buscaId: filters.buscaId,
      favorito: filters.soFavoritos ? "1" : undefined,
    })
    .then((res) => res.leads);
}

/**
 * Enriquecimento automático em série via POST /enrich (cada chamada passa
 * pelo reserveQuota do servidor). Para no teto ou no primeiro erro e
 * devolve o resumo do que aconteceu.
 */
async function autoEnrichSerial(
  leads: Lead[],
  n: number,
): Promise<{ feitos: number; alvo: number; parou?: string }> {
  const alvos = leads.filter((lead) => !lead.enriquecido).slice(0, n);
  let feitos = 0;
  for (const lead of alvos) {
    try {
      await api.enrichLead(lead.placeId);
      feitos += 1;
    } catch (error) {
      if (error instanceof ApiError && error.code === "quota_exceeded") {
        return { feitos, alvo: alvos.length, parou: "teto mensal atingido" };
      }
      return {
        feitos,
        alvo: alvos.length,
        parou: error instanceof ApiError ? error.message : "erro no enriquecimento",
      };
    }
  }
  return { feitos, alvo: alvos.length };
}

interface Grupo {
  chave: string;
  titulo: string;
  cor?: string;
  leads: Lead[];
}

/** Um grupo por busca (desc por criadaEm) + "Sem busca" para o resto. */
function agruparPorBusca(leads: Lead[], buscas: Busca[]): Grupo[] {
  const grupos: Grupo[] = [];
  const agrupados = new Set<string>();
  for (const busca of buscas) {
    const doGrupo = leads.filter((lead) => (lead.buscaId ?? []).includes(busca.id));
    if (doGrupo.length === 0) continue;
    doGrupo.forEach((lead) => agrupados.add(lead.placeId));
    grupos.push({ chave: busca.id, titulo: busca.nome, cor: busca.cor, leads: doGrupo });
  }
  const semBusca = leads.filter((lead) => !agrupados.has(lead.placeId));
  if (semBusca.length > 0) {
    grupos.push({ chave: "__sem_busca__", titulo: "Sem busca", leads: semBusca });
  }
  return grupos;
}

export default function LeadsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-muted">Carregando…</p>}>
      <LeadsPageInner />
    </Suspense>
  );
}

function LeadsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const buscaId = searchParams.get("buscaId") ?? undefined;
  const buscaNome = searchParams.get("buscaNome") ?? undefined;

  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [buscas, setBuscas] = useState<Busca[]>([]);
  const [status, setStatus] = useState<LeadStatus | "">("");
  const [temSite, setTemSite] = useState<FiltroPresenca>("qualquer");
  const [temTelefone, setTemTelefone] = useState<FiltroPresenca>("qualquer");
  const [soFavoritos, setSoFavoritos] = useState(false);
  const [agrupar, setAgrupar] = useState(true);
  const [colapsados, setColapsados] = useState<Set<string>>(new Set());
  const [erroLista, setErroLista] = useState<string | null>(null);

  const [nicho, setNicho] = useState("");
  const [subNicho, setSubNicho] = useState("");
  const [regiao, setRegiao] = useState("");
  const [nomeBusca, setNomeBusca] = useState("");
  const [quantidade, setQuantidade] = useState(20);
  const [qualificada, setQualificada] = useState(false);
  const [autoEnrich, setAutoEnrich] = useState(false);
  const [autoEnrichN, setAutoEnrichN] = useState(3);
  const [buscando, setBuscando] = useState(false);
  const [buscaMsg, setBuscaMsg] = useState<string | null>(null);
  const [buscaAviso, setBuscaAviso] = useState<string | null>(null);
  const [buscaErro, setBuscaErro] = useState<string | null>(null);

  const filters: LeadFiltersState = { status, temSite, temTelefone, soFavoritos, buscaId };

  useEffect(() => {
    let ignore = false;
    fetchLeads({ status, temSite, temTelefone, soFavoritos, buscaId })
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
  }, [status, temSite, temTelefone, soFavoritos, buscaId]);

  useEffect(() => {
    let ignore = false;
    api
      .listBuscas()
      .then(({ buscas: data }) => {
        if (!ignore) setBuscas(data);
      })
      .catch(() => {
        // agrupamento/cores degradam para a lista plana; sem erro fatal
      });
    return () => {
      ignore = true;
    };
  }, []);

  function onLeadChange(updated: Lead) {
    setLeads((current) =>
      current
        ? current.map((lead) => (lead.placeId === updated.placeId ? updated : lead))
        : current,
    );
  }

  function toggleColapsado(chave: string) {
    setColapsados((current) => {
      const next = new Set(current);
      if (next.has(chave)) next.delete(chave);
      else next.add(chave);
      return next;
    });
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBuscando(true);
    setBuscaMsg(null);
    setBuscaAviso(null);
    setBuscaErro(null);
    try {
      const body: Parameters<typeof api.search>[0] = {};
      if (nicho.trim()) body.nicho = nicho.trim();
      if (subNicho.trim()) body.subNicho = subNicho.trim();
      if (regiao.trim()) body.regiao = regiao.trim();
      if (nomeBusca.trim()) body.nome = nomeBusca.trim();
      body.quantidade = Math.min(Math.max(quantidade, 1), QUANTIDADE_MAX);
      if (qualificada) body.qualificada = true;
      const result = await api.search(body);

      const partes = [
        `Busca "${result.busca.nome}": ${result.criados} novo(s), ` +
          `${result.existentes} já existente(s) em ${result.paginas} página(s).`,
      ];
      if (result.aviso) setBuscaAviso(`Busca parcial: ${result.aviso}.`);
      if (autoEnrich) {
        const n = Math.min(Math.max(autoEnrichN, 1), AUTO_ENRICH_MAX);
        const resumo = await autoEnrichSerial(result.leads, n);
        if (resumo.alvo === 0) {
          partes.push("Nada a enriquecer.");
        } else if (resumo.parou) {
          setBuscaErro(
            `Enriquecimento automático parou (${resumo.parou}): ${resumo.feitos} de ${resumo.alvo} feito(s).`,
          );
        } else {
          partes.push(`${resumo.feitos} enriquecido(s) automaticamente.`);
        }
      }
      setBuscaMsg(partes.join(" "));

      const [data, buscasData] = await Promise.all([fetchLeads(filters), api.listBuscas()]);
      setLeads(data);
      setBuscas(buscasData.buscas);
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

  const cores: Record<string, string> = Object.fromEntries(
    buscas.map((busca) => [busca.id, busca.cor]),
  );
  const agrupado = agrupar && !buscaId;
  const grupos = agrupado && leads ? agruparPorBusca(leads, buscas) : [];

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSearch} className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Nova busca
        </h2>
        <div className="mt-3 flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              value={nicho}
              onChange={(event) => setNicho(event.target.value)}
              placeholder="Nicho (padrão: da config)"
              className="w-full rounded border border-line bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            />
            <input
              value={subNicho}
              onChange={(event) => setSubNicho(event.target.value)}
              placeholder="Sub-nicho (opcional)"
              className="w-full rounded border border-line bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            />
          </div>
          <input
            value={regiao}
            onChange={(event) => setRegiao(event.target.value)}
            placeholder="Região (padrão: da config)"
            className="w-full rounded border border-line bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
          />
          <input
            value={nomeBusca}
            onChange={(event) => setNomeBusca(event.target.value)}
            placeholder={`Nome da busca (padrão: ${nomeDefaultHint(nicho)})`}
            className="w-full rounded border border-line bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
          />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-1 text-sm text-ink-secondary">
            <label className="flex items-center gap-2">
              <span>Resultados</span>
              <input
                type="number"
                min={1}
                max={QUANTIDADE_MAX}
                value={quantidade}
                onChange={(event) =>
                  setQuantidade(
                    Math.min(Math.max(Number(event.target.value) || 1, 1), QUANTIDADE_MAX),
                  )
                }
                className="w-16 rounded border border-line bg-surface-2 px-2 py-1 text-center text-sm text-foreground outline-none focus:border-accent"
              />
              <span className="text-xs text-ink-muted">(21–40 = 2 requests)</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={qualificada}
                onChange={(event) => setQualificada(event.target.checked)}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              <span>
                Só sem site{" "}
                <span className="text-xs text-ink-muted">(busca qualificada, tier Enterprise)</span>
              </span>
            </label>
          </div>
          <label className="flex items-center gap-2 py-1 text-sm text-ink-secondary">
            <input
              type="checkbox"
              checked={autoEnrich}
              onChange={(event) => setAutoEnrich(event.target.checked)}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            <span>Enriquecer os primeiros</span>
            <input
              type="number"
              min={1}
              max={AUTO_ENRICH_MAX}
              value={autoEnrichN}
              disabled={!autoEnrich}
              onChange={(event) =>
                setAutoEnrichN(
                  Math.min(Math.max(Number(event.target.value) || 1, 1), AUTO_ENRICH_MAX),
                )
              }
              className="w-14 rounded border border-line bg-surface-2 px-2 py-1 text-center text-sm text-foreground outline-none focus:border-accent disabled:opacity-50"
            />
            <span>automaticamente (máx. {AUTO_ENRICH_MAX})</span>
          </label>
          <Button type="submit" loading={buscando}>
            Buscar
          </Button>
        </div>
        {buscaMsg && <p className="mt-2 text-sm text-good">{buscaMsg}</p>}
        {buscaAviso && <p className="mt-2 text-sm text-warning">{buscaAviso}</p>}
        {buscaErro && <p className="mt-2 text-sm text-critical">{buscaErro}</p>}
      </form>

      {buscaId && (
        <div className="flex items-center justify-between gap-2 rounded border border-accent/40 bg-accent/10 px-3 py-2">
          <p className="truncate text-sm text-ink-secondary">
            Mostrando leads da busca{" "}
            <span className="font-medium text-foreground">{buscaNome ?? buscaId}</span>
          </p>
          <button
            type="button"
            onClick={() => router.replace("/leads")}
            className="shrink-0 text-xs font-medium text-accent hover:underline"
          >
            Limpar
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
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
        <button
          type="button"
          onClick={() => setSoFavoritos((v) => !v)}
          aria-pressed={soFavoritos}
          className={`rounded border px-2 py-1.5 text-xs ${
            soFavoritos
              ? "border-warning/60 bg-warning/10 text-warning"
              : "border-line bg-surface-2 text-ink-secondary hover:text-foreground"
          }`}
        >
          ★ Favoritos
        </button>
        {!buscaId && (
          <label className="ml-auto flex items-center gap-1.5 text-xs text-ink-secondary">
            <input
              type="checkbox"
              checked={agrupar}
              onChange={(event) => setAgrupar(event.target.checked)}
              className="h-3.5 w-3.5 accent-[var(--accent)]"
            />
            Agrupar por busca
          </label>
        )}
      </div>

      {erroLista && <p className="text-sm text-critical">{erroLista}</p>}

      {leads === null ? (
        <p className="text-sm text-ink-muted">Carregando…</p>
      ) : leads.length === 0 ? (
        <p className="text-sm text-ink-muted">
          Nenhum lead encontrado. Ajuste os filtros ou faça uma busca.
        </p>
      ) : agrupado ? (
        <div className="flex flex-col gap-3">
          {grupos.map((grupo) => {
            const fechado = colapsados.has(grupo.chave);
            return (
              <section key={grupo.chave}>
                <button
                  type="button"
                  onClick={() => toggleColapsado(grupo.chave)}
                  aria-expanded={!fechado}
                  className="flex w-full items-center gap-2 rounded px-1 py-1.5 text-left hover:bg-surface"
                >
                  <span className="text-xs text-ink-muted">{fechado ? "▸" : "▾"}</span>
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: grupo.cor ?? "var(--ink-muted)" }}
                  />
                  <span className="truncate text-sm font-medium text-foreground">
                    {grupo.titulo}
                  </span>
                  <span className="ml-auto shrink-0 text-xs text-ink-muted">
                    {grupo.leads.length}
                  </span>
                </button>
                {!fechado && (
                  <ul className="mt-1.5 flex flex-col gap-2">
                    {grupo.leads.map((lead) => (
                      <li key={`${grupo.chave}-${lead.placeId}`}>
                        <LeadCard lead={lead} cores={cores} onChange={onLeadChange} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {leads.map((lead) => (
            <li key={lead.placeId}>
              <LeadCard lead={lead} cores={cores} onChange={onLeadChange} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
