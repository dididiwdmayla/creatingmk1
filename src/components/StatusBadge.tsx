import type { LeadStatus } from "@/lib/leads/types";

/**
 * Status do lead é ordinal (posição no funil), não identidade — por isso um
 * único hue em degraus de luminância (ver globals.css), não cores
 * categóricas distintas. Cor da letra escolhida por luminância do degrau.
 * A FORMA do badge é o segundo canal (além do texto): quadrada e discreta
 * no início do funil, ganhando "abertura" (pill) e um marcador de progresso
 * conforme o lead avança — nunca só a cor carrega o degrau.
 */
const STYLES: Record<
  LeadStatus,
  { label: string; className: string; shape: string; mark: string }
> = {
  novo: {
    label: "Novo",
    className: "bg-status-novo text-white",
    shape: "rounded-[3px]",
    mark: "○",
  },
  contactado: {
    label: "Contactado",
    className: "bg-status-contactado text-white",
    shape: "rounded-[3px]",
    mark: "◐",
  },
  respondeu: {
    label: "Respondeu",
    className: "bg-status-respondeu text-black",
    shape: "rounded-full",
    mark: "◑",
  },
  fechado: {
    label: "Fechado",
    className: "bg-status-fechado text-black",
    shape: "rounded-full",
    mark: "●",
  },
};

export function StatusBadge({ status }: { status: LeadStatus }) {
  const { label, className, shape, mark } = STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${shape} ${className}`}
    >
      <span aria-hidden className="text-[0.65rem] leading-none">
        {mark}
      </span>
      {label}
    </span>
  );
}
