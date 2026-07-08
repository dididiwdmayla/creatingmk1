import { useEffect, useState } from "react";

import { formatInt } from "@/lib/format";

/**
 * Meter: "uma razão contra um limite" (skill de dataviz). O preenchimento
 * carrega a severidade (accent → warning → critical); a trilha é um wash
 * neutro sobre a surface. Nunca só cor: o estado também vem como palavra.
 */
export function UsageMeter({
  label,
  used,
  cap,
  freeQuota,
}: {
  label: string;
  used: number;
  cap: number;
  freeQuota: number;
}) {
  const pct = cap > 0 ? Math.min(used / cap, 1) : used > 0 ? 1 : 0;
  const blocked = cap <= 0 || used >= cap;
  const nearCap = !blocked && cap > 0 && used / cap >= 0.8;
  const fillClass = blocked ? "bg-critical" : nearCap ? "bg-warning" : "bg-accent";
  const statusWord = blocked ? "No limite" : nearCap ? "Perto do teto" : "OK";
  const statusClass = blocked ? "text-critical" : nearCap ? "text-warning" : "text-ink-muted";
  const freeQuotaPct = cap > 0 ? Math.min(freeQuota / cap, 1) * 100 : 0;

  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm text-ink-secondary">{label}</span>
        <span className="font-mono text-sm text-foreground">
          {formatInt(used)} / {formatInt(cap)}
        </span>
      </div>
      <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--meter-track)]">
        <div
          className={`h-full rounded-full transition-[width] duration-700 ease-out ${fillClass} ${
            blocked ? "pulse-critical" : nearCap ? "pulse-warning" : ""
          }`}
          style={{ width: grown ? `${pct * 100}%` : "0%" }}
        />
        {freeQuota > 0 && freeQuota < cap && (
          <div
            className="absolute inset-y-0 w-px bg-[var(--meter-mark)]"
            style={{ left: `${freeQuotaPct}%` }}
          />
        )}
      </div>
      <div className="mt-1 flex items-center justify-between text-xs">
        <span className={statusClass}>{statusWord}</span>
        <span className="text-ink-muted">cota grátis: {formatInt(freeQuota)}</span>
      </div>
    </div>
  );
}
