"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import { ApiError, api } from "@/lib/api-client";
import {
  agruparBuscas,
  modoAgrupamentoBuscasValido,
  type ModoAgrupamentoBuscas,
} from "@/lib/buscas/agrupar";
import { BUSCA_CORES, type Busca } from "@/lib/buscas/types";
import type { NomesUsuarios } from "@/lib/contato-selo";
import { formatInt } from "@/lib/format";
import { CabecalhoBusca } from "@/components/CabecalhoBusca";
import { SkeletonRows } from "@/components/Skeleton";
import { usePreferenciasListas } from "@/components/usePreferenciasListas";

const MENSAGEM_MAX = 1000; // espelha o limite da rota PATCH

/** Posição de scroll da lista, para restaurar ao voltar dos leads do grupo. */
const SCROLL_KEY = "radar:buscas:scroll";
/**
 * Último agrupamento escolhido nesta sessão. Voltar de `/leads?buscaId=…`
 * pela nav inferior aponta pra "/buscas" fixo, sem querystring — é esta
 * chave que devolve o operador pro agrupamento de onde ele saiu, em vez de
 * resetar pra fila única (mesmo desenho de `radar:leads:query`).
 */
const QUERY_KEY = "radar:buscas:query";

const MODOS: Array<{ value: ModoAgrupamentoBuscas; label: string }> = [
  { value: "nenhum", label: "Sem agrupar" },
  { value: "mes", label: "Agrupar: por mês" },
  { value: "nicho", label: "Agrupar: por nicho" },
];

function proximaCor(atual: string): string {
  const cores = BUSCA_CORES as readonly string[];
  const index = cores.indexOf(atual);
  return cores[(index + 1) % cores.length];
}

export default function BuscasPage() {
  return (
    <Suspense
      fallback={<SkeletonRows count={3} className="h-20 rounded-lg border border-line" />}
    >
      <BuscasPageInner />
    </Suspense>
  );
}

function BuscasPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const agruparParam = searchParams.get("agrupar");
  const modo: ModoAgrupamentoBuscas = modoAgrupamentoBuscasValido(agruparParam)
    ? agruparParam
    : "nenhum";

  function setModo(proximo: ModoAgrupamentoBuscas) {
    router.replace(proximo === "nenhum" ? "/buscas" : `/buscas?agrupar=${proximo}`, {
      scroll: false,
    });
  }

  const [buscas, setBuscas] = useState<Busca[] | null>(null);
  const [nomes, setNomes] = useState<NomesUsuarios>({});
  const [erro, setErro] = useState<string | null>(null);
  const [trocandoCor, setTrocandoCor] = useState<string | null>(null);
  const [editandoMsg, setEditandoMsg] = useState<string | null>(null);
  const [msgDraft, setMsgDraft] = useState("");
  const [salvandoMsg, setSalvandoMsg] = useState(false);
  const [salvandoRecorrente, setSalvandoRecorrente] = useState<string | null>(null);

  // Cada busca é um GRUPO colapsável: fechada, sobra só a faixa do
  // CabecalhoBusca (a mesma de /leads). O estado da dobra é do usuário,
  // não da navegação — ver "Compactação de /leads e /buscas".
  const { preferencias, alternarGrupoLista } = usePreferenciasListas();

  useEffect(() => {
    let ignore = false;
    api
      .listBuscas()
      .then(({ buscas: data }) => {
        if (!ignore) setBuscas(data);
      })
      .catch((error) => {
        if (!ignore) {
          setErro(
            error instanceof ApiError ? error.message : "Falha ao carregar as buscas.",
          );
        }
      });
    api
      .listNomesUsuarios()
      .then(({ usuarios }) => {
        if (!ignore) setNomes(Object.fromEntries(usuarios.map((u) => [u.id, u.nome])));
      })
      .catch(() => {
        // autor cai no fallback "usuário removido" — não é bloqueante
      });
    return () => {
      ignore = true;
    };
  }, []);

  // ── Restauração do agrupamento: "/buscas" limpo (chegada pela nav)
  // recupera o último desta sessão; uma URL já com param nunca é
  // sobrescrita — só o mount inicial em branco dispara a restauração.
  const queryInicial = useRef(true);
  useEffect(() => {
    const qs = searchParams.toString();
    if (queryInicial.current) {
      queryInicial.current = false;
      if (!qs) {
        const salvo = sessionStorage.getItem(QUERY_KEY);
        if (salvo) {
          router.replace(`/buscas?${salvo}`, { scroll: false });
          return;
        }
      }
    }
    if (qs) sessionStorage.setItem(QUERY_KEY, qs);
    else sessionStorage.removeItem(QUERY_KEY);
  }, [searchParams, router]);

  // ── Scroll: voltar dos leads de um grupo cai onde o polegar parou ────
  const scrollRestaurado = useRef(false);
  useEffect(() => {
    if (buscas === null || scrollRestaurado.current) return;
    scrollRestaurado.current = true;
    const salvo = sessionStorage.getItem(SCROLL_KEY);
    if (salvo) window.scrollTo(0, Number(salvo));
  }, [buscas]);

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

  function aplicarUpdate(updated: Busca) {
    setBuscas((current) =>
      current ? current.map((b) => (b.id === updated.id ? updated : b)) : current,
    );
  }

  async function trocarCor(busca: Busca) {
    setTrocandoCor(busca.id);
    try {
      const { busca: updated } = await api.patchBusca(busca.id, {
        cor: proximaCor(busca.cor),
      });
      aplicarUpdate(updated);
    } catch (error) {
      setErro(error instanceof ApiError ? error.message : "Falha ao trocar a cor.");
    } finally {
      setTrocandoCor(null);
    }
  }

  async function toggleRecorrente(busca: Busca) {
    setSalvandoRecorrente(busca.id);
    setErro(null);
    try {
      const { busca: updated } = await api.patchBusca(busca.id, {
        recorrente: !busca.recorrente,
      });
      aplicarUpdate(updated);
    } catch (error) {
      // Inclui o 400 do teto de recorrentes simultâneas — mensagem da API.
      setErro(
        error instanceof ApiError ? error.message : "Falha ao alterar a recorrência.",
      );
    } finally {
      setSalvandoRecorrente(null);
    }
  }

  async function salvarMensagem(busca: Busca) {
    setSalvandoMsg(true);
    setErro(null);
    try {
      const { busca: updated } = await api.patchBusca(busca.id, {
        mensagemPadrao: msgDraft.trim(),
      });
      aplicarUpdate(updated);
      setEditandoMsg(null);
    } catch (error) {
      setErro(error instanceof ApiError ? error.message : "Falha ao salvar a mensagem.");
    } finally {
      setSalvandoMsg(false);
    }
  }

  if (erro && buscas === null) {
    return <p className="text-sm text-critical">{erro}</p>;
  }

  // A dobra só pode pintar depois que a preferência resolve: grupo que
  // nasce aberto e fecha meio segundo depois empurra a lista inteira (é o
  // deslocamento de layout que o portão de CLS reprova).
  if (buscas === null || preferencias === null) {
    return <SkeletonRows count={3} className="h-20 rounded-lg border border-line" />;
  }

  if (buscas.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        Nenhuma busca salva ainda. Faça uma busca na aba{" "}
        <Link href="/leads" className="text-accent">
          Leads
        </Link>
        .
      </p>
    );
  }

  // "nenhum" devolve um grupo único: um caminho de render só para os três
  // modos, em vez de uma lista plana e outra agrupada divergindo com o tempo.
  const grupos = agruparBuscas(buscas, modo);

  return (
    <div className="flex flex-col gap-2">
      {erro && <p className="text-sm text-critical">{erro}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={modo}
          onChange={(event) => setModo(event.target.value as ModoAgrupamentoBuscas)}
          className="rounded border border-line bg-surface-2 px-2 py-1.5 text-xs text-foreground outline-none focus:border-accent"
        >
          {MODOS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {grupos.map((grupo) => {
        const comCabecalho = modo !== "nenhum";
        const grupoFechado =
          comCabecalho && preferencias.gruposFechados.buscas.includes(grupo.chave);
        return (
          <section key={grupo.chave}>
            {comCabecalho && (
              <button
                type="button"
                onClick={() => alternarGrupoLista("buscas", grupo.chave)}
                aria-expanded={!grupoFechado}
                className="flex w-full items-center gap-2 rounded px-1 py-1.5 text-left hover:bg-surface"
              >
                <span aria-hidden className="text-xs text-ink-muted">
                  {grupoFechado ? "▸" : "▾"}
                </span>
                <span className="truncate text-xs font-semibold uppercase tracking-wide text-ink-secondary">
                  {grupo.titulo}
                </span>
                <span
                  title={`${formatInt(grupo.itens.length)} busca(s) neste grupo`}
                  className="ml-auto shrink-0 rounded-full bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-ink-secondary"
                >
                  {formatInt(grupo.itens.length)}
                </span>
              </button>
            )}
            {!grupoFechado && (
              <ul className={`flex flex-col gap-1.5 ${comCabecalho ? "mt-1.5" : ""}`}>
                {grupo.itens.map((busca) => {
                  const fechada = preferencias.gruposFechados.buscas.includes(busca.id);
                  return (
            <li
              key={busca.id}
              className="rounded-lg border border-line bg-surface px-2 py-1"
            >
              <CabecalhoBusca
                titulo={busca.nome}
                cor={busca.cor}
                busca={busca}
                contagem={busca.totalCriados + busca.totalExistentes}
                contagemTitulo={`${formatInt(busca.totalCriados)} novo(s) · ${formatInt(busca.totalExistentes)} já existente(s)`}
                aberto={!fechada}
                onToggle={() => alternarGrupoLista("buscas", busca.id)}
                nomes={nomes}
                onTrocarCor={() => trocarCor(busca)}
                trocandoCor={trocandoCor === busca.id}
                acoes={
                  <Link
                    href={`/leads?buscaId=${encodeURIComponent(busca.id)}&buscaNome=${encodeURIComponent(busca.nome)}`}
                    title={`Ver os leads de ${busca.nome}`}
                    className="shrink-0 rounded px-1.5 py-1 text-xs font-medium text-accent hover:underline"
                  >
                    leads <span aria-hidden>→</span>
                  </Link>
                }
              />

              {!fechada && (
                <div className="border-t border-line px-1 pb-1.5 pt-2">
                  <p className="text-xs text-ink-muted">
                    {formatInt(busca.totalCriados)} novo(s) ·{" "}
                    {formatInt(busca.totalExistentes)} já existente(s)
                  </p>

                  {editandoMsg === busca.id ? (
                    <div className="mt-2">
                      <textarea
                        value={msgDraft}
                        onChange={(event) =>
                          setMsgDraft(event.target.value.slice(0, MENSAGEM_MAX))
                        }
                        rows={3}
                        autoFocus
                        placeholder="Mensagem do WhatsApp deste grupo — {nome} vira o nome do lead, {demo} vira o link da demo, {penetracao} vira o argumento de penetração de site. Vazio volta pra mensagem global."
                        className="w-full rounded border border-line bg-surface-2 px-2 py-1.5 text-xs text-foreground outline-none focus:border-accent"
                      />
                      <div className="mt-1 flex gap-2">
                        <button
                          type="button"
                          onClick={() => salvarMensagem(busca)}
                          disabled={salvandoMsg}
                          className="rounded bg-accent px-2 py-1 text-xs font-semibold text-accent-ink disabled:opacity-50"
                        >
                          {salvandoMsg ? "Salvando…" : "Salvar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditandoMsg(null)}
                          className="text-xs text-ink-muted hover:text-foreground"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
                      {busca.mensagemPadrao ? (
                        <p className="min-w-0 flex-1 truncate text-xs italic text-ink-secondary">
                          ✉ {busca.mensagemPadrao}
                        </p>
                      ) : (
                        <span className="text-xs text-ink-muted">mensagem: global</span>
                      )}
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <button
                          type="button"
                          onClick={() => toggleRecorrente(busca)}
                          disabled={salvandoRecorrente === busca.id}
                          title={
                            busca.recorrente
                              ? "Desligar a re-execução diária desta busca"
                              : "Re-executar esta busca 1x/dia (cron da madrugada)"
                          }
                          className={`text-xs disabled:opacity-50 ${
                            busca.recorrente
                              ? "text-accent hover:text-foreground"
                              : "text-ink-muted hover:text-accent"
                          }`}
                        >
                          {busca.recorrente ? "recorrente ✓" : "tornar recorrente"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditandoMsg(busca.id);
                            setMsgDraft(busca.mensagemPadrao ?? "");
                          }}
                          className="text-xs text-ink-muted hover:text-accent"
                        >
                          {busca.mensagemPadrao ? "editar mensagem" : "+ mensagem do grupo"}
                        </button>
                      </span>
                    </div>
                  )}
                </div>
              )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
