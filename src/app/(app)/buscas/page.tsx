"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ApiError, api } from "@/lib/api-client";
import type { Busca } from "@/lib/buscas/types";
import { formatDateTime, formatInt } from "@/lib/format";

export default function BuscasPage() {
  const [buscas, setBuscas] = useState<Busca[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

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

  if (erro) {
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
    <ul className="flex flex-col gap-2">
      {buscas.map((busca) => (
        <li key={busca.id}>
          <Link
            href={`/leads?buscaId=${encodeURIComponent(busca.id)}&buscaNome=${encodeURIComponent(busca.nome)}`}
            className="block rounded-lg border border-line bg-surface p-3 hover:border-accent"
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
        </li>
      ))}
    </ul>
  );
}
