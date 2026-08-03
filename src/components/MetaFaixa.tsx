"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { api, type MetaProprioResponse } from "@/lib/api-client";
import { formatInt } from "@/lib/format";

function pct(usado: number, meta: number): number {
  if (meta <= 0) return usado > 0 ? 1 : 0;
  return Math.min(usado / meta, 1);
}

function MiniBarra({ label, usado, meta }: { label: string; usado: number; meta: number }) {
  const atingida = usado >= meta;
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline justify-between gap-1.5">
        <span className="text-[11px] text-ink-muted">{label}</span>
        <span className="font-mono text-[11px] text-ink-secondary">
          {formatInt(usado)}/{formatInt(meta)}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--meter-track)]">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ease-out ${
            atingida ? "bg-good" : "bg-accent"
          }`}
          style={{ width: `${pct(usado, meta) * 100}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Faixa fixa de progresso da PRÓPRIA meta de prospecção, no topo de todo
 * o app autenticado — não só /hoje. Sem NENHUMA janela configurada, não
 * renderiza nada (ver ARCHITECTURE.md "Metas de prospecção por
 * integrante"). O botão de minimizar reduz a um indicador de uma linha;
 * o estado é persistido por usuário (self-service, sobrevive a
 * navegação/dispositivo) via PUT /api/metas/proprio.
 */
export function MetaFaixa() {
  const pathname = usePathname();
  const [estado, setEstado] = useState<MetaProprioResponse | null>(null);
  const [alternando, setAlternando] = useState(false);

  // Refetch a cada troca de rota (progresso muda ao voltar de uma busca em
  // /leads, por exemplo) — mas preserva a escolha local de minimizada
  // entre navegações para não "piscar" de volta enquanto o PUT do toggle
  // ainda está em voo (ver alternarMinimizada).
  useEffect(() => {
    let ignore = false;
    api
      .metaProprio()
      .then((data) => {
        if (ignore) return;
        setEstado((atual) =>
          atual ? { ...data, minimizada: atual.minimizada } : data,
        );
      })
      .catch(() => {
        // faixa é acessório: falha de rede não pode quebrar a navegação
      });
    return () => {
      ignore = true;
    };
  }, [pathname]);

  if (!estado) return null;
  const { dia, semana } = estado;
  if (dia.meta === undefined && semana.meta === undefined) return null;

  async function alternarMinimizada() {
    if (!estado) return;
    const minimizada = !estado.minimizada;
    setEstado({ ...estado, minimizada });
    setAlternando(true);
    try {
      await api.salvarMetaFaixaMinimizada(minimizada);
    } catch {
      setEstado((atual) => (atual ? { ...atual, minimizada: !minimizada } : atual));
    } finally {
      setAlternando(false);
    }
  }

  if (estado.minimizada) {
    return (
      <div className="cromo-linha cromo-linha-baixo sticky top-0 z-20 bg-surface px-4 py-1.5">
        <button
          type="button"
          onClick={alternarMinimizada}
          disabled={alternando}
          aria-label="Expandir faixa de metas"
          className="mx-auto flex w-full max-w-lg items-center justify-between gap-2 text-[11px] text-ink-muted transition hover:text-foreground disabled:opacity-50"
        >
          <span className="flex min-w-0 items-center gap-2 truncate">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
            <span className="shrink-0">Meta</span>
            {dia.meta !== undefined && (
              <span className="truncate font-mono text-ink-secondary">
                {formatInt(dia.usado)}/{formatInt(dia.meta)} hoje
              </span>
            )}
            {semana.meta !== undefined && (
              <span className="truncate font-mono text-ink-secondary">
                {formatInt(semana.usado)}/{formatInt(semana.meta)} semana
              </span>
            )}
          </span>
          <span aria-hidden className="shrink-0">
            ▾
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="cromo-linha cromo-linha-baixo sticky top-0 z-20 bg-surface px-4 py-2">
      <div className="mx-auto flex w-full max-w-lg items-center gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          {dia.meta !== undefined && <MiniBarra label="hoje" usado={dia.usado} meta={dia.meta} />}
          {semana.meta !== undefined && (
            <MiniBarra label="semana" usado={semana.usado} meta={semana.meta} />
          )}
        </div>
        <button
          type="button"
          onClick={alternarMinimizada}
          disabled={alternando}
          title="Minimizar"
          aria-label="Minimizar faixa de metas"
          className="shrink-0 text-ink-muted transition hover:text-foreground disabled:opacity-50"
        >
          ▴
        </button>
      </div>
    </div>
  );
}
