"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ApiError, api } from "@/lib/api-client";
import { BUSCA_CORES, type Busca } from "@/lib/buscas/types";
import { formatDateTime, formatInt } from "@/lib/format";

function proximaCor(atual: string): string {
  const cores = BUSCA_CORES as readonly string[];
  const index = cores.indexOf(atual);
  return cores[(index + 1) % cores.length];
}

export default function BuscasPage() {
  const [buscas, setBuscas] = useState<Busca[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [trocandoCor, setTrocandoCor] = useState<string | null>(null);

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

  async function trocarCor(busca: Busca) {
    setTrocandoCor(busca.id);
    try {
      const { busca: updated } = await api.patchBuscaCor(busca.id, proximaCor(busca.cor));
      setBuscas((current) =>
        current ? current.map((b) => (b.id === updated.id ? updated : b)) : current,
      );
    } catch (error) {
      setErro(error instanceof ApiError ? error.message : "Falha ao trocar a cor.");
    } finally {
      setTrocandoCor(null);
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
            className="rounded-lg border border-line bg-surface p-3 hover:border-accent"
          >
            <div className="flex items-start gap-2.5">
              <button
                type="button"
                onClick={() => trocarCor(busca)}
                disabled={trocandoCor === busca.id}
                title="Trocar a cor da busca (cicla a paleta)"
                aria-label={`Trocar a cor da busca ${busca.nome}`}
                className="mt-1 h-3.5 w-3.5 shrink-0 rounded-full ring-2 ring-transparent transition hover:ring-white/30 disabled:opacity-50"
                style={{ backgroundColor: busca.cor }}
              />
              <Link
                href={`/leads?buscaId=${encodeURIComponent(busca.id)}&buscaNome=${encodeURIComponent(busca.nome)}`}
                className="min-w-0 flex-1"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-medium text-foreground">{busca.nome}</p>
                  <span className="shrink-0 text-xs text-ink-muted">
                    {formatDateTime(busca.criadaEm)}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-ink-secondary">
                  {[busca.nicho, busca.subNicho].filter(Boolean).join(" · ")} — {busca.regiao}
                </p>
                <p className="mt-2 text-xs text-ink-muted">
                  {formatInt(busca.totalCriados)} novo(s) ·{" "}
                  {formatInt(busca.totalExistentes)} já existente(s)
                </p>
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
