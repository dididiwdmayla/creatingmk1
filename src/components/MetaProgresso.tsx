import { formatInt } from "@/lib/format";

/**
 * Barra de progresso de UMA meta (dia OU semana): polaridade oposta ao
 * UsageMeter — aqui mais uso é melhor, não pior, então o preenchimento
 * nunca vira crítico. Só renderiza quando `meta` está definida (indicador
 * opcional — ver ARCHITECTURE.md "Metas de prospecção por integrante").
 */
export function MetaProgresso({
  label,
  usado,
  meta,
}: {
  label: string;
  usado: number;
  meta: number;
}) {
  const pct = meta > 0 ? Math.min(usado / meta, 1) : usado > 0 ? 1 : 0;
  const atingida = usado >= meta;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm text-ink-secondary">{label}</span>
        <span className="font-mono text-sm text-foreground">
          {formatInt(usado)} / {formatInt(meta)}
        </span>
      </div>
      <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--meter-track)]">
        <div
          className={`h-full rounded-full transition-[width] duration-700 ease-out ${
            atingida ? "bg-good" : "bg-accent"
          }`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
      {atingida && <p className="mt-1 text-xs text-good">meta batida</p>}
    </div>
  );
}
