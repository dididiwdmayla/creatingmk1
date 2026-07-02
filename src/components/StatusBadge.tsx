import type { LeadStatus } from "@/lib/leads/types";

/**
 * Status do lead é ordinal (posição no funil), não identidade — por isso um
 * único hue em degraus de luminância (ver globals.css), não cores
 * categóricas distintas. Cor da letra escolhida por luminância do degrau.
 */
const STYLES: Record<LeadStatus, { label: string; className: string }> = {
  novo: { label: "Novo", className: "bg-status-novo text-white" },
  contactado: { label: "Contactado", className: "bg-status-contactado text-white" },
  respondeu: { label: "Respondeu", className: "bg-status-respondeu text-black" },
  fechado: { label: "Fechado", className: "bg-status-fechado text-black" },
};

export function StatusBadge({ status }: { status: LeadStatus }) {
  const { label, className } = STYLES[status];
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${className}`}
    >
      {label}
    </span>
  );
}
