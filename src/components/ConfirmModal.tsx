"use client";

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
  if (!aberto) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onCancelar}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm rounded-lg border border-line bg-surface p-4"
        onClick={(event) => event.stopPropagation()}
      >
        {titulo && <h2 className="text-sm font-semibold text-foreground">{titulo}</h2>}
        <p className={`text-sm text-ink-secondary ${titulo ? "mt-1.5" : ""}`}>{mensagem}</p>
        {filhos && <div className="mt-3">{filhos}</div>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancelar}>
            {cancelarLabel}
          </Button>
          <Button variant="primary" onClick={onConfirmar} disabled={confirmarDesabilitado}>
            {confirmarLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
