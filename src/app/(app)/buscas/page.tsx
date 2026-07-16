"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ApiError, api } from "@/lib/api-client";
import { BUSCA_CORES, type Busca } from "@/lib/buscas/types";
import { formatDateTime, formatInt } from "@/lib/format";

const MENSAGEM_MAX = 1000; // espelha o limite da rota PATCH

function proximaCor(atual: string): string {
  const cores = BUSCA_CORES as readonly string[];
  const index = cores.indexOf(atual);
  return cores[(index + 1) % cores.length];
}

export default function BuscasPage() {
  const [buscas, setBuscas] = useState<Busca[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [trocandoCor, setTrocandoCor] = useState<string | null>(null);
  const [editandoMsg, setEditandoMsg] = useState<string | null>(null);
  const [msgDraft, setMsgDraft] = useState("");
  const [salvandoMsg, setSalvandoMsg] = useState(false);

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

  if (buscas === null) {
    return <p className="text-sm text-ink-muted">Carregando…</p>;
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
      <ul className="flex flex-col gap-2">
        {buscas.map((busca) => (
          <li
            key={busca.id}
            className="card-lift rounded-lg border border-line bg-surface p-3"
          >
            <div className="flex items-start gap-2.5">
              <button
                type="button"
                onClick={() => trocarCor(busca)}
                disabled={trocandoCor === busca.id}
                title="Trocar a cor da busca (cicla a paleta)"
                aria-label={`Trocar a cor da busca ${busca.nome}`}
                className="mt-1 h-3.5 w-3.5 shrink-0 rounded-full ring-2 ring-transparent transition hover:ring-[var(--ring-soft)] disabled:opacity-50"
                style={{ backgroundColor: busca.cor }}
              />
              <div className="min-w-0 flex-1">
                <Link
                  href={`/leads?buscaId=${encodeURIComponent(busca.id)}&buscaNome=${encodeURIComponent(busca.nome)}`}
                  className="block"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-medium text-foreground">
                      {busca.nome}
                    </p>
                    <span className="shrink-0 text-xs text-ink-muted">
                      {formatDateTime(busca.criadaEm)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-ink-secondary">
                    {[busca.nicho, busca.subNicho].filter(Boolean).join(" · ")} —{" "}
                    {busca.regiao}
                  </p>
                  <p className="mt-2 text-xs text-ink-muted">
                    {formatInt(busca.totalCriados)} novo(s) ·{" "}
                    {formatInt(busca.totalExistentes)} já existente(s)
                  </p>
                </Link>

                {editandoMsg === busca.id ? (
                  <div className="mt-2">
                    <textarea
                      value={msgDraft}
                      onChange={(event) =>
                        setMsgDraft(event.target.value.slice(0, MENSAGEM_MAX))
                      }
                      rows={3}
                      autoFocus
                      placeholder="Mensagem do WhatsApp deste grupo — {nome} vira o nome do lead, {demo} vira o link da demo. Vazio volta pra mensagem global."
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
                  <div className="mt-2 flex items-baseline justify-between gap-2">
                    {busca.mensagemPadrao ? (
                      <p className="min-w-0 truncate text-xs italic text-ink-secondary">
                        ✉ {busca.mensagemPadrao}
                      </p>
                    ) : (
                      <span className="text-xs text-ink-muted">mensagem: global</span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setEditandoMsg(busca.id);
                        setMsgDraft(busca.mensagemPadrao ?? "");
                      }}
                      className="shrink-0 text-xs text-ink-muted hover:text-accent"
                    >
                      {busca.mensagemPadrao ? "editar mensagem" : "+ mensagem do grupo"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
