"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ApiError, api } from "@/lib/api-client";
import { BUSCA_CORES, type Busca } from "@/lib/buscas/types";
import type { NomesUsuarios } from "@/lib/contato-selo";
import { formatInt } from "@/lib/format";
import { CabecalhoBusca } from "@/components/CabecalhoBusca";
import { SkeletonRows } from "@/components/Skeleton";
import { usePreferenciasListas } from "@/components/usePreferenciasListas";

const MENSAGEM_MAX = 1000; // espelha o limite da rota PATCH

function proximaCor(atual: string): string {
  const cores = BUSCA_CORES as readonly string[];
  const index = cores.indexOf(atual);
  return cores[(index + 1) % cores.length];
}

export default function BuscasPage() {
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

  return (
    <div className="flex flex-col gap-2">
      {erro && <p className="text-sm text-critical">{erro}</p>}
      <ul className="flex flex-col gap-1.5">
        {buscas.map((busca) => {
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
    </div>
  );
}
