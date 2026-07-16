"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { Button } from "@/components/Button";
import { LeadCard } from "@/components/LeadCard";
import { RadarSweep } from "@/components/RadarSweep";
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
  // Grupos iniciam COLAPSADOS por padrão — o param guarda os EXPANDIDOS
  // explicitamente (ausente da URL = colapsado).
  const abertos = useMemo(
    () => new Set((searchParams.get("abertos") ?? "").split(",").filter(Boolean)),
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
  const [erroLista, setErroLista] = useState<string | null>(null);

  const [nicho, setNicho] = useState("");
  const [subNicho, setSubNicho] = useState("");
  const [regiao, setRegiao] = useState("");
  const [nomeBusca, setNomeBusca] = useState("");
  const [quantidade, setQuantidade] = useState(20);
  const [qualificada, setQualificada] = useState(false);
  const [soComTelefone, setSoComTelefone] = useState(false);
  const [autoEnrich, setAutoEnrich] = useState(false);
  const [autoEnrichN, setAutoEnrichN] = useState(3);
  const [buscando, setBuscando] = useState(false);
  const [buscaMsg, setBuscaMsg] = useState<string | null>(null);
  const [buscaAviso, setBuscaAviso] = useState<string | null>(null);
  const [buscaErro, setBuscaErro] = useState<string | null>(null);

  // "Buscando em: X" — região resolvida pelo geocoding (com cache no
  // servidor E no cliente, por texto normalizado — evita regeocodificar a
  // mesma região a cada blur). Região não confirmada bloqueia a busca.
  const [regiaoDefault, setRegiaoDefault] = useState("");
  const [regiaoResolvida, setRegiaoResolvida] = useState<string | null>(null);
  const [regiaoErro, setRegiaoErro] = useState<string | null>(null);
  const [regiaoStatus, setRegiaoStatus] = useState<"idle" | "resolvendo" | "ok" | "erro">(
    "idle",
  );
  const regiaoCacheRef = useRef(
    new Map<string, { ok: true; endereco: string } | { ok: false; mensagem: string }>(),
  );
  /** Texto (normalizado) para o qual `regiaoStatus === "ok"` é válido. */
  const [regiaoConfirmadaPara, setRegiaoConfirmadaPara] = useState<string | null>(null);

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

  const [buscasProntas, setBuscasProntas] = useState(false);
  useEffect(() => {
    let ignore = false;
    api
      .listBuscas()
      .then(({ buscas: data }) => {
        if (!ignore) setBuscas(data);
      })
      .catch(() => {
        // agrupamento/cores degradam para a lista plana; sem erro fatal
      })
      .finally(() => {
        if (!ignore) setBuscasProntas(true);
      });
    api
      .getConfig()
      .then(({ config }) => {
        if (!ignore) setRegiaoDefault(config.regiao);
      })
      .catch(() => {
        // placeholder fica genérico; a busca ainda resolve no servidor
      });
    return () => {
      ignore = true;
    };
  }, []);

  /** Chave normalizada do cache client-side de geocodificação por texto. */
  function chaveRegiao(texto: string): string {
    return texto.trim().toLowerCase();
  }

  /**
   * Resolve a região efetiva (campo ou default da config) para mostrar
   * "Buscando em: X" antes de confirmar. Roda no blur do campo e quando o
   * default carrega. Cacheada por texto no cliente (Map em ref) — além do
   * cache permanente do servidor, evita regeocodificar a cada blur na
   * mesma região; só erro de validação (região não encontrada) é
   * cacheado, erro transitório é reconsultado na próxima tentativa.
   */
  function resolverRegiao(textoBruto: string) {
    const efetiva = textoBruto.trim() || regiaoDefault.trim();
    if (!efetiva) {
      setRegiaoStatus("idle");
      setRegiaoResolvida(null);
      setRegiaoErro(null);
      setRegiaoConfirmadaPara(null);
      return;
    }
    const chave = chaveRegiao(efetiva);
    const emCache = regiaoCacheRef.current.get(chave);
    if (emCache) {
      if (emCache.ok) {
        setRegiaoConfirmadaPara(chave);
        setRegiaoStatus("ok");
        setRegiaoResolvida(emCache.endereco);
        setRegiaoErro(null);
      } else {
        setRegiaoConfirmadaPara(null);
        setRegiaoStatus("erro");
        setRegiaoResolvida(null);
        setRegiaoErro(emCache.mensagem);
      }
      return;
    }
    setRegiaoStatus("resolvendo");
    setRegiaoErro(null);
    api
      .geocode(efetiva)
      .then((geo) => {
        regiaoCacheRef.current.set(chave, { ok: true, endereco: geo.endereco });
        setRegiaoConfirmadaPara(chave);
        setRegiaoStatus("ok");
        setRegiaoResolvida(geo.endereco);
      })
      .catch((error) => {
        const naoEncontrada = error instanceof ApiError && error.code === "validation_error";
        const mensagem = naoEncontrada
          ? `Região não encontrada: "${efetiva}".`
          : "Não foi possível confirmar a região agora. Tente sair e voltar no campo.";
        if (naoEncontrada) {
          regiaoCacheRef.current.set(chave, { ok: false, mensagem });
        }
        setRegiaoConfirmadaPara(null);
        setRegiaoStatus("erro");
        setRegiaoResolvida(null);
        setRegiaoErro(mensagem);
      });
  }

  /** Descarta a confirmação anterior assim que o texto muda (até o próximo blur). */
  function onRegiaoChange(valor: string) {
    setRegiao(valor);
    const chave = chaveRegiao(valor || regiaoDefault);
    if (regiaoConfirmadaPara !== chave) {
      setRegiaoStatus("idle");
      setRegiaoResolvida(null);
      setRegiaoErro(null);
    }
  }

  useEffect(() => {
    if (!regiaoDefault || regiao.trim()) return; // o usuário já digitou algo — não pisa
    let ignore = false;
    const chave = chaveRegiao(regiaoDefault);
    const emCache = regiaoCacheRef.current.get(chave);
    if (emCache?.ok) {
      setRegiaoConfirmadaPara(chave);
      setRegiaoStatus("ok");
      setRegiaoResolvida(emCache.endereco);
      return;
    }
    setRegiaoStatus("resolvendo");
    api
      .geocode(regiaoDefault)
      .then((geo) => {
        if (ignore) return;
        regiaoCacheRef.current.set(chave, { ok: true, endereco: geo.endereco });
        setRegiaoConfirmadaPara(chave);
        setRegiaoStatus("ok");
        setRegiaoResolvida(geo.endereco);
      })
      .catch(() => {
        // silencioso: o campo em branco só perde o hint; o blur reconfirma
        if (!ignore) setRegiaoStatus("idle");
      });
    return () => {
      ignore = true;
    };
  }, [regiaoDefault, regiao]);

  const regiaoEfetivaAtual = chaveRegiao(regiao || regiaoDefault);
  const regiaoConfirmada =
    regiaoStatus === "ok" &&
    regiaoConfirmadaPara === regiaoEfetivaAtual &&
    regiaoEfetivaAtual.length > 0;

  // ── Scroll restoration: volta da ficha exatamente onde estava ─────────
  // A posição salva é aplicada em useLayoutEffect (síncrono, ANTES do
  // paint) — não useEffect, que só roda depois que o browser já pintou a
  // lista no topo (o "pisca no topo antes de descer" do bug). Como a
  // lista só atinge a altura certa depois que `leads` carrega (fetch
  // assíncrono), um overlay de sweep cobre a tela nesse intervalo. O
  // overlay é ligado/desligado via manipulação direta do DOM (ref), não
  // useState — setState síncrono dentro de efeito é proibido pelo lint do
  // React Compiler (ver ARCHITECTURE.md).
  const overlayRef = useRef<HTMLDivElement>(null);
  const scrollAlvoRef = useRef(0);
  const temPosicaoSalvaRef = useRef(false);
  const scrollAplicadoRef = useRef(false);

  useLayoutEffect(() => {
    const salvo = Number(sessionStorage.getItem(SCROLL_KEY) ?? 0);
    if (salvo > 0) {
      scrollAlvoRef.current = salvo;
      temPosicaoSalvaRef.current = true;
      if (overlayRef.current) overlayRef.current.style.display = "flex";
      window.scrollTo(0, 0);
    }
  }, []);

  useLayoutEffect(() => {
    if (!temPosicaoSalvaRef.current || scrollAplicadoRef.current) return;
    if (leads === null && erroLista === null) return; // ainda carregando
    // No modo agrupado, a lista só chega na altura final depois que
    // `buscas` também carrega (senão tudo cai temporariamente no grupo
    // "Sem busca", que pode estar colapsado) — espera as duas fontes
    // assentarem antes de medir/restaurar, senão o alvo fica fora do
    // scrollHeight disponível e a posição se perde.
    if (agrupar && !buscaId && !buscasProntas) return;
    scrollAplicadoRef.current = true;
    window.scrollTo(0, scrollAlvoRef.current);
    if (overlayRef.current) overlayRef.current.style.display = "none";
  }, [leads, erroLista, buscasProntas, agrupar, buscaId]);

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
    const next = new Set(abertos);
    if (next.has(chave)) next.delete(chave);
    else next.add(chave);
    setParam("abertos", [...next].join(","));
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBuscaMsg(null);
    setBuscaAviso(null);
    setBuscaErro(null);
    if (!regiaoConfirmada) {
      setBuscaErro(
        regiaoStatus === "resolvendo"
          ? "Aguarde a confirmação da região antes de buscar."
          : "Região não confirmada. Preencha o campo região e saia dele (blur) para confirmar.",
      );
      return;
    }
    setBuscando(true);
    try {
      const body: Parameters<typeof api.search>[0] = {};
      if (nicho.trim()) body.nicho = nicho.trim();
      if (subNicho.trim()) body.subNicho = subNicho.trim();
      if (regiao.trim()) body.regiao = regiao.trim();
      if (nomeBusca.trim()) body.nome = nomeBusca.trim();
      body.quantidade = Math.min(Math.max(quantidade, 1), QUANTIDADE_MAX);
      if (qualificada) body.qualificada = true;
      if (qualificada && soComTelefone) body.soComTelefone = true;
      const result = await api.search(body);
      setRegiaoResolvida(result.regiaoResolvida);

      const partes = [
        `Busca "${result.busca.nome}" em ${result.regiaoResolvida}: ` +
          `${result.criados} novo(s), ${result.existentes} já existente(s) ` +
          `em ${result.paginas} página(s).`,
      ];
      if (result.validos !== undefined) {
        partes.push(`${result.validos} válido(s) em ${result.paginas} página(s).`);
      }
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
      } else if (error instanceof ApiError && error.code === "validation_error") {
        setBuscaErro(error.message);
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
      <div
        ref={overlayRef}
        style={{ display: "none" }}
        className="fixed inset-0 z-50 flex-col items-center justify-center gap-3 bg-background"
      >
        <RadarSweep size={64} />
        <p className="text-sm text-ink-muted">Restaurando posição…</p>
      </div>
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
            onChange={(event) => onRegiaoChange(event.target.value)}
            onBlur={(event) => resolverRegiao(event.target.value)}
            placeholder={
              regiaoDefault ? `Região (padrão: ${regiaoDefault})` : "Região (padrão: da config)"
            }
            className="w-full rounded border border-line bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
          />
          {regiaoConfirmada && regiaoResolvida && (
            <p className="flex items-center gap-1.5 text-xs text-ink-muted">
              <span aria-hidden className="font-semibold text-good">
                ✓
              </span>
              Buscando em: <span className="text-ink-secondary">{regiaoResolvida}</span>{" "}
              <span aria-hidden>·</span> só resultados dentro da região
            </p>
          )}
          {regiaoStatus === "resolvendo" && (
            <p className="text-xs text-ink-muted">Confirmando região…</p>
          )}
          {regiaoStatus === "erro" && regiaoErro && (
            <p className="text-xs text-critical">⚠ {regiaoErro}</p>
          )}
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
                checked={qualificada}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setQualificada(checked);
                  if (!checked) setSoComTelefone(false); // só faz sentido com a qualificada
                }}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              <span>
                Só sem site{" "}
                <span className="text-xs text-ink-muted">
                  (qualificada: site + telefone de graça, tier Enterprise)
                </span>
              </span>
            </label>
            {qualificada && (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={soComTelefone}
                  onChange={(event) => setSoComTelefone(event.target.checked)}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                <span>
                  Só com telefone{" "}
                  <span className="text-xs text-ink-muted">
                    (descarta sem telefone; pagina até completar N válidos)
                  </span>
                </span>
              </label>
            )}
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
          <Button type="submit" loading={buscando} disabled={!regiaoConfirmada}>
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
        <div className="flex items-center justify-between gap-2 rounded border border-accent/40 bg-accent/10 px-3 py-2">
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
            const fechado = !abertos.has(grupo.chave);
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
