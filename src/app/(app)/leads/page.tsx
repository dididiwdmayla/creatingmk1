"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/Button";
import { CotaIndicador, cotaEsgotada } from "@/components/CotaIndicador";
import { LeadCard } from "@/components/LeadCard";
import { PrecificacaoCard } from "@/components/PrecificacaoCard";
import { RadarSweep } from "@/components/RadarSweep";
import { ApiError, api } from "@/lib/api-client";
import { penetracaoParaLead } from "@/lib/buscas/penetracao";
import type { Busca } from "@/lib/buscas/types";
import type { FiltroPresenca } from "@/lib/config";
import type { NomesUsuarios } from "@/lib/contato-selo";
import type { UsoUsuario } from "@/lib/costs";
import { formatDateTime } from "@/lib/format";
import { argumentoForte } from "@/lib/leads/penetracao";
import { calculaScore } from "@/lib/leads/score";
import type { Lead, LeadStatus } from "@/lib/leads/types";

/** Quantos leads (por lista/grupo) ganham o 🎯 na ordenação por prioridade. */
const TOP_SCORE_N = 3;

/** IDs dos leads mais bem pontuados dentro da lista dada (badge 🎯 do card). */
function topScoreIds(leads: Lead[], n = TOP_SCORE_N): Set<string> {
  return new Set(
    [...leads]
      .filter((lead) => !lead.descartado)
      .sort((a, b) => calculaScore(b) - calculaScore(a))
      .slice(0, n)
      .map((lead) => lead.placeId),
  );
}

/** Descartados sempre no fim; por prioridade ordena o resto por score desc. */
function ordenarPorPrioridade(leads: Lead[]): Lead[] {
  return [...leads].sort(
    (a, b) =>
      Number(a.descartado === true) - Number(b.descartado === true) ||
      calculaScore(b) - calculaScore(a) ||
      b.criadoEm.localeCompare(a.criadoEm),
  );
}

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
/** Posição de scroll da lista, para restaurar ao voltar da ficha. */
const SCROLL_KEY = "radar:leads:scroll";

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

/** Penetração do nicho dele é >60% — badge "argumento forte" no card. */
function leadArgumentoForte(lead: Lead, buscas: Busca[]): boolean {
  const info = penetracaoParaLead(lead, buscas);
  return info !== undefined && argumentoForte(info.penetracao);
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

  // ── Estado da LISTA na URL (voltar da ficha restaura tudo) ────────────
  const buscaId = searchParams.get("buscaId") ?? undefined;
  const buscaNome = searchParams.get("buscaNome") ?? undefined;
  const status = (searchParams.get("status") ?? "") as LeadStatus | "";
  const temSite = (searchParams.get("site") ?? "qualquer") as FiltroPresenca;
  const temTelefone = (searchParams.get("tel") ?? "qualquer") as FiltroPresenca;
  const soFavoritos = searchParams.get("fav") === "1";
  const agrupar = searchParams.get("plano") !== "1";
  const ordem = (searchParams.get("ordem") ?? "recentes") as "recentes" | "prioridade";
  const fechados = useMemo(
    () => new Set((searchParams.get("fechados") ?? "").split(",").filter(Boolean)),
    [searchParams],
  );

  function updateParams(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    const qs = params.toString();
    router.replace(qs ? `/leads?${qs}` : "/leads", { scroll: false });
  }

  /** Grava o param com o valor, ou remove quando é o default (URL limpa). */
  function setParam(key: string, value: string | null) {
    updateParams((params) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
  }

  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [buscas, setBuscas] = useState<Busca[]>([]);
  const [nomes, setNomes] = useState<NomesUsuarios>({});
  const [erroLista, setErroLista] = useState<string | null>(null);

  const [nicho, setNicho] = useState("");
  const [subNicho, setSubNicho] = useState("");
  const [regiao, setRegiao] = useState("");
  const [nomeBusca, setNomeBusca] = useState("");
  const [quantidade, setQuantidade] = useState(20);
  const [soSemSite, setSoSemSite] = useState(false);
  const [autoEnrich, setAutoEnrich] = useState(false);
  const [autoEnrichN, setAutoEnrichN] = useState(3);
  const [buscando, setBuscando] = useState(false);
  const [buscaMsg, setBuscaMsg] = useState<string | null>(null);
  const [buscaAviso, setBuscaAviso] = useState<string | null>(null);
  const [buscaErro, setBuscaErro] = useState<string | null>(null);

  // "Buscando em: X" — região resolvida pelo geocoding (com cache no servidor).
  const [regiaoDefault, setRegiaoDefault] = useState("");
  const [regiaoResolvida, setRegiaoResolvida] = useState<string | null>(null);
  const [regiaoErro, setRegiaoErro] = useState<string | null>(null);

  // Análise de grupo com IA (só existe na página de um grupo, buscaId setado).
  const [iaDisponivel, setIaDisponivel] = useState(false);
  const [analisando, setAnalisando] = useState(false);
  const [iaErro, setIaErro] = useState<string | null>(null);

  // Cota individual de buscas — indicador permanente, atualizado após cada busca.
  const [cotaBuscas, setCotaBuscas] = useState<UsoUsuario | null>(null);
  function recarregarCotaBuscas() {
    api
      .getCotas()
      .then(({ buscas: uso }) => setCotaBuscas(uso))
      .catch(() => {
        // indicador é cortesia — o bloqueio real é do servidor
      });
  }

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
    api
      .getConfig()
      .then(({ config }) => {
        if (!ignore) setRegiaoDefault(config.regiao);
      })
      .catch(() => {
        // placeholder fica genérico; a busca ainda resolve no servidor
      });
    api
      .iaStatus()
      .then(({ disponivel }) => {
        if (!ignore) setIaDisponivel(disponivel);
      })
      .catch(() => {
        if (!ignore) setIaDisponivel(false);
      });
    api
      .getCotas()
      .then(({ buscas: uso }) => {
        if (!ignore) setCotaBuscas(uso);
      })
      .catch(() => {
        // indicador é cortesia — o bloqueio real é do servidor
      });
    api
      .listNomesUsuarios()
      .then(({ usuarios }) => {
        if (!ignore) {
          setNomes(Object.fromEntries(usuarios.map((u) => [u.id, u.nome])));
        }
      })
      .catch(() => {
        // selo cai no fallback "usuário removido" — não é bloqueante
      });
    return () => {
      ignore = true;
    };
  }, []);

  async function analisarGrupoComIA() {
    if (!buscaId || analisando) return;
    setAnalisando(true);
    setIaErro(null);
    try {
      const { busca: atualizada } = await api.gerarAnaliseBusca(buscaId);
      setBuscas((atual) => atual.map((b) => (b.id === atualizada.id ? atualizada : b)));
    } catch (error) {
      if (error instanceof ApiError && error.code === "quota_exceeded") {
        setIaErro(
          `Teto mensal atingido para ${error.extra.sku} (${error.extra.used}/${error.extra.cap} em ${error.extra.period}).`,
        );
      } else {
        setIaErro(error instanceof ApiError ? error.message : "Falha ao analisar com IA.");
      }
    } finally {
      setAnalisando(false);
    }
  }

  // Resolve a região efetiva (campo ou default da config) para mostrar
  // "Buscando em: X" antes de confirmar. Roda no blur do campo e quando o
  // default carrega; o cache do servidor faz o hit custar zero.
  function resolverRegiao(texto: string) {
    const efetiva = texto.trim() || regiaoDefault.trim();
    if (!efetiva) {
      setRegiaoResolvida(null);
      return;
    }
    setRegiaoErro(null);
    api
      .geocode(efetiva)
      .then((geo) => setRegiaoResolvida(geo.endereco))
      .catch((error) => {
        setRegiaoResolvida(null);
        setRegiaoErro(
          error instanceof ApiError && error.code === "validation_error"
            ? `Região não encontrada: "${efetiva}".`
            : null, // erro transitório: some em silêncio, a busca reporta
        );
      });
  }

  useEffect(() => {
    if (!regiaoDefault) return;
    let ignore = false;
    api
      .geocode(regiaoDefault)
      .then((geo) => {
        if (!ignore) setRegiaoResolvida((atual) => atual ?? geo.endereco);
      })
      .catch(() => {
        // silencioso: o campo em branco só perde o hint
      });
    return () => {
      ignore = true;
    };
  }, [regiaoDefault]);

  // ── Scroll restoration: volta da ficha exatamente onde estava ─────────
  const scrollRestaurado = useRef(false);
  useEffect(() => {
    if (leads === null || scrollRestaurado.current) return;
    scrollRestaurado.current = true;
    const salvo = sessionStorage.getItem(SCROLL_KEY);
    if (salvo) window.scrollTo(0, Number(salvo));
  }, [leads]);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
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
    const next = new Set(fechados);
    if (next.has(chave)) next.delete(chave);
    else next.add(chave);
    setParam("fechados", [...next].join(","));
  }

  // Guarda sincrona contra reenvio (toque duplo/triplo no mobile antes do
  // re-render desabilitar o botão): checada e setada ANTES de qualquer
  // await, então nenhuma segunda chamada síncrona passa.
  const buscandoRef = useRef(false);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (buscandoRef.current) return;
    buscandoRef.current = true;
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
      if (soSemSite) body.soSemSite = true;
      const result = await api.search(body);
      setRegiaoResolvida(result.regiaoResolvida);

      const partes = [
        `Busca "${result.busca.nome}" em ${result.regiaoResolvida}: ` +
          `${result.criados} novo(s), ${result.existentes} já existente(s) ` +
          `em ${result.paginas} página(s).`,
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
      } else if (error instanceof ApiError && error.code === "user_quota_exceeded") {
        const janela = error.extra.janela as string;
        const janelaLabel = janela === "dia" ? "diário" : janela === "semana" ? "semanal" : "mensal";
        setBuscaErro(
          `Limite ${janelaLabel} de buscas atingido (${error.extra.used}/${error.extra.limite}). ` +
            `Reseta em ${formatDateTime(error.extra.resetaEm as string)}.`,
        );
      } else if (error instanceof ApiError && error.code === "places_error") {
        setBuscaErro(`Erro do Google: ${error.extra.detail ?? error.message}`);
      } else if (error instanceof ApiError && error.code === "validation_error") {
        setBuscaErro(error.message);
      } else {
        setBuscaErro(error instanceof ApiError ? error.message : "Falha na busca.");
      }
    } finally {
      buscandoRef.current = false;
      setBuscando(false);
      recarregarCotaBuscas();
    }
  }

  const cores: Record<string, string> = Object.fromEntries(
    buscas.map((busca) => [busca.id, busca.cor]),
  );
  const agrupado = agrupar && !buscaId;
  const leadsOrdenados =
    ordem === "prioridade" && leads ? ordenarPorPrioridade(leads) : leads;
  const grupos = agrupado && leadsOrdenados ? agruparPorBusca(leadsOrdenados, buscas) : [];
  // Top da lista toda quando plana; top DENTRO de cada grupo quando agrupado.
  const topFlat = !agrupado && leadsOrdenados ? topScoreIds(leadsOrdenados) : new Set<string>();
  const buscaAtual = buscaId ? buscas.find((b) => b.id === buscaId) : undefined;

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSearch} className="rounded-lg border border-line bg-surface p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Nova busca
          </h2>
          {cotaBuscas && <CotaIndicador titulo="Sua cota" uso={cotaBuscas} />}
        </div>
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
            onBlur={(event) => resolverRegiao(event.target.value)}
            placeholder={
              regiaoDefault ? `Região (padrão: ${regiaoDefault})` : "Região (padrão: da config)"
            }
            className="w-full rounded border border-line bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
          />
          {regiaoResolvida && !regiaoErro && (
            <p className="text-xs text-ink-muted">
              Buscando em: <span className="text-ink-secondary">{regiaoResolvida}</span>{" "}
              <span aria-hidden>·</span> só resultados dentro da região
            </p>
          )}
          {regiaoErro && <p className="text-xs text-critical">{regiaoErro}</p>}
          <input
            value={nomeBusca}
            onChange={(event) => setNomeBusca(event.target.value)}
            placeholder={`Nome da busca (padrão: ${nomeDefaultHint(nicho)})`}
            className="w-full rounded border border-line bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
          />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-1 text-sm text-ink-secondary">
            <label className="flex items-center gap-2">
              <span>Novos</span>
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
              <span className="text-xs text-ink-muted">
                (pagina até juntar N inéditos; cada página = 1 request)
              </span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={soSemSite}
                onChange={(event) => setSoSemSite(event.target.checked)}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              <span>
                Só sem site{" "}
                <span className="text-xs text-ink-muted">
                  (qualificada: site + telefone de graça, tier Enterprise — quem tem site
                  próprio nem entra no resultado)
                </span>
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
          <Button type="submit" loading={buscando} disabled={cotaEsgotada(cotaBuscas)}>
            Buscar
          </Button>
        </div>
        {buscando && (
          <div className="mt-3 flex items-center gap-3 rounded border border-line bg-surface-2 p-3">
            <RadarSweep size={44} />
            <div className="min-w-0">
              <p className="text-sm text-foreground">Varrendo a região…</p>
              {regiaoResolvida && (
                <p className="truncate text-xs text-ink-muted">Buscando em: {regiaoResolvida}</p>
              )}
            </div>
          </div>
        )}
        {buscaMsg && <p className="mt-2 text-sm text-good">{buscaMsg}</p>}
        {buscaAviso && <p className="mt-2 text-sm text-warning">{buscaAviso}</p>}
        {buscaErro && <p className="mt-2 text-sm text-critical">{buscaErro}</p>}
      </form>

      {buscaId && (
        <div className="flex flex-col gap-2 rounded border border-accent/40 bg-accent/10 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm text-ink-secondary">
              Mostrando leads da busca{" "}
              <span className="font-medium text-foreground">{buscaNome ?? buscaId}</span>
            </p>
            <button
              type="button"
              onClick={() =>
                updateParams((params) => {
                  params.delete("buscaId");
                  params.delete("buscaNome");
                })
              }
              className="shrink-0 text-xs font-medium text-accent hover:underline"
            >
              Limpar
            </button>
          </div>

          {buscaAtual?.penetracao && (
            <div className="border-t border-accent/20 pt-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Penetração de site
              </h3>
              {buscaAtual.penetracao.percentuais ? (
                <p className="mt-1 text-sm text-ink-secondary">
                  Neste nicho nesta cidade:{" "}
                  <strong className="font-semibold text-foreground">
                    {buscaAtual.penetracao.percentuais.comSiteProprio}%
                  </strong>{" "}
                  têm site próprio · {buscaAtual.penetracao.percentuais.soRedeSocial}% só rede
                  social · {buscaAtual.penetracao.percentuais.semNada}% sem presença{" "}
                  <span className="text-xs text-ink-muted">
                    (base: {buscaAtual.penetracao.total} estabelecimento
                    {buscaAtual.penetracao.total === 1 ? "" : "s"})
                  </span>
                </p>
              ) : (
                <p className="mt-1 text-xs text-ink-muted">
                  Base pequena demais ({buscaAtual.penetracao.total} estabelecimento
                  {buscaAtual.penetracao.total === 1 ? "" : "s"} mapeado
                  {buscaAtual.penetracao.total === 1 ? "" : "s"}) para mostrar percentual.
                </p>
              )}
              {buscaAtual.penetracao.desconhecidos > 0 && (
                <p className="mt-1 text-xs text-ink-muted">
                  + {buscaAtual.penetracao.desconhecidos} lead(s) com site desconhecido (ainda
                  não enriquecido nem de busca qualificada).
                </p>
              )}
            </div>
          )}

          {iaDisponivel && (
            <div className="border-t border-accent/20 pt-2">
              {analisando ? (
                <p className="text-xs text-ink-muted">Analisando o grupo com IA…</p>
              ) : buscaAtual?.analiseIA ? (
                <div className="flex flex-col gap-1.5">
                  <p className="text-sm text-ink-secondary">{buscaAtual.analiseIA.texto}</p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-ink-muted">
                      Gerada em {formatDateTime(buscaAtual.analiseIA.geradaEm)}
                    </span>
                    <button
                      type="button"
                      onClick={analisarGrupoComIA}
                      className="shrink-0 text-xs font-medium text-accent hover:underline"
                    >
                      Regenerar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={analisarGrupoComIA}
                  className="text-xs font-medium text-accent hover:underline"
                >
                  ✨ Analisar com IA
                </button>
              )}
              {iaErro && <p className="mt-1 text-xs text-critical">{iaErro}</p>}
            </div>
          )}
        </div>
      )}

      {buscaAtual && (
        <PrecificacaoCard
          key={buscaAtual.id}
          nicho={buscaAtual.nicho}
          regiaoTexto={buscaAtual.regiao}
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={status}
          onChange={(event) => setParam("status", event.target.value || null)}
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
          onChange={(event) =>
            setParam("site", event.target.value === "qualquer" ? null : event.target.value)
          }
          className="rounded border border-line bg-surface-2 px-2 py-1.5 text-xs text-foreground outline-none focus:border-accent"
        >
          {PRESENCA_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              Site próprio: {opt.label}
            </option>
          ))}
        </select>
        <select
          value={temTelefone}
          onChange={(event) =>
            setParam("tel", event.target.value === "qualquer" ? null : event.target.value)
          }
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
          onClick={() => setParam("fav", soFavoritos ? null : "1")}
          aria-pressed={soFavoritos}
          className={`rounded border px-2 py-1.5 text-xs ${
            soFavoritos
              ? "border-warning/60 bg-warning/10 text-warning"
              : "border-line bg-surface-2 text-ink-secondary hover:text-foreground"
          }`}
        >
          ★ Favoritos
        </button>
        <select
          value={ordem}
          onChange={(event) =>
            setParam("ordem", event.target.value === "recentes" ? null : event.target.value)
          }
          className="rounded border border-line bg-surface-2 px-2 py-1.5 text-xs text-foreground outline-none focus:border-accent"
        >
          <option value="recentes">Ordenar: mais recentes</option>
          <option value="prioridade">Ordenar: por prioridade</option>
        </select>
        {!buscaId && (
          <label className="ml-auto flex items-center gap-1.5 text-xs text-ink-secondary">
            <input
              type="checkbox"
              checked={agrupar}
              onChange={(event) => setParam("plano", event.target.checked ? null : "1")}
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
            const fechado = fechados.has(grupo.chave);
            const topDoGrupo = topScoreIds(grupo.leads);
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
                        <LeadCard
                          lead={lead}
                          cores={cores}
                          score={calculaScore(lead)}
                          destaque={topDoGrupo.has(lead.placeId)}
                          argumentoForte={leadArgumentoForte(lead, buscas)}
                          nomes={nomes}
                          onChange={onLeadChange}
                        />
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
          {(leadsOrdenados ?? []).map((lead) => (
            <li key={lead.placeId}>
              <LeadCard
                lead={lead}
                cores={cores}
                score={calculaScore(lead)}
                destaque={topFlat.has(lead.placeId)}
                argumentoForte={leadArgumentoForte(lead, buscas)}
                nomes={nomes}
                onChange={onLeadChange}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
