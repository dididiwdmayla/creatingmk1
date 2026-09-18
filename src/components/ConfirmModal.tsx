"use client";

import { createPortal } from "react-dom";

import { Button } from "./Button";

/**
 * Modal de confirmação genérico (overlay + card) — sem lib externa.
 * `filhos` (opcional) entra ENTRE a mensagem e os botões — usado pelo
 * padrão "digite X para confirmar" (ver "apagar todas as demos do grupo"
 * em /demos): quem chama controla o texto digitado e passa
 * `confirmarDesabilitado` calculado por cima, o modal só desenha.
 */
export function ConfirmModal({
  aberto,
  titulo,
  mensagem,
  confirmarLabel = "Confirmar",
  cancelarLabel = "Cancelar",
  confirmarDesabilitado = false,
  filhos,
  onConfirmar,
  onCancelar,
}: {
  aberto: boolean;
  titulo?: string;
  mensagem: string;
  confirmarLabel?: string;
  cancelarLabel?: string;
  confirmarDesabilitado?: boolean;
  filhos?: React.ReactNode;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  if (!aberto || typeof document === "undefined") return null;

  /**
   * PORTAL PARA O `<body>`, e não um `fixed` no lugar onde o modal é
   * escrito. `position: fixed` se ancora na VIEWPORT só enquanto nenhum
   * ancestral tiver `transform`/`filter`/`will-change` — qualquer um deles
   * vira bloco de contenção e o `inset-0` passa a valer sobre o ancestral.
   *
   * E há um: `.page-transition` (o invólucro de toda página do app) roda
   * `radar-fade-in` com `animation-fill-mode: both`, e o último quadro dela
   * é `transform: translateY(0)` — que FICA aplicado depois que a animação
   * termina. Resultado: o overlay cobria a página, não a tela, e numa
   * confirmação longa o campo de confirmação e os botões caíam abaixo da
   * dobra, inalcançáveis. Foi medido em celular e desktop pelo
   * `--so=vestigio`, que hoje cobra a caixa dos três dentro da viewport.
   *
   * Portal resolve na raiz do problema e não custa nada aos chamadores: o
   * modal já era `fixed` e `z-50`, e continua sendo.
   */
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onCancelar}
    >
      <div
        role="dialog"
        aria-modal="true"
        // `max-h` + rolagem, e não só o `p-4` do pai: uma confirmação longa
        // (a da exclusão definitiva de leads cita quatro consequências) passa
        // da altura do celular, e sem isto o CAMPO DE CONFIRMAÇÃO e os botões
        // ficam abaixo da dobra — inalcançáveis, num diálogo que existe
        // justamente para ser lido inteiro antes de destruir. `dvh` porque a
        // barra de endereço do celular come altura da `vh`.
        className="flex max-h-[90dvh] w-full max-w-sm flex-col overflow-y-auto rounded-lg border border-line bg-surface p-4"
        onClick={(event) => event.stopPropagation()}
      >
        {titulo && <h2 className="text-sm font-semibold text-foreground">{titulo}</h2>}
        <p className={`text-sm text-ink-secondary ${titulo ? "mt-1.5" : ""}`}>{mensagem}</p>
        {filhos && <div className="mt-3">{filhos}</div>}
        <div className="mt-4 flex shrink-0 justify-end gap-2">
          <Button variant="secondary" onClick={onCancelar}>
            {cancelarLabel}
          </Button>
          <Button variant="primary" onClick={onConfirmar} disabled={confirmarDesabilitado}>
            {confirmarLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
