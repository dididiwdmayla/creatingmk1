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

/**
 * Três tamanhos, um significado. Nas densidades altas da grade não cabe
 * "CONTACTADO" escrito ao lado do nome — mas encolher NÃO pode virar "só a
 * cor decide", que é a regra que este componente existe para segurar. Por
 * isso o que sai é o texto VISÍVEL, nunca os outros dois canais: o glifo de
 * progresso (○◐◑●) e a forma (quadrada no começo do funil, pill no fim)
 * continuam nos três, e o rótulo por extenso segue legível por leitor de
 * tela e por `title`.
 */
export type VarianteStatus = "completo" | "glifo" | "ponto";

export function StatusBadge({
  status,
  variante = "completo",
}: {
  status: LeadStatus;
  variante?: VarianteStatus;
}) {
  const { label, className, shape, mark } = STYLES[status];

  if (variante === "completo") {
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

  // Caixa com altura e largura EXPLÍCITAS: o glifo sozinho não dá corpo ao
  // elemento, e um selo de caixa zerada some da tela sem quebrar nada (ver
  // [data-ponto-busca] e o portão de --so=listas).
  const caixa = variante === "ponto" ? "h-3.5 w-3.5 text-[7px]" : "h-5 w-5 text-[10px]";
  return (
    <span
      title={label}
      className={`inline-flex shrink-0 items-center justify-center leading-none ${caixa} ${shape} ${className}`}
    >
      <span aria-hidden>{mark}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
