"use client";

import { Button } from "./Button";

/** Modal de confirmação genérico (overlay + card) — sem lib externa. */
export function ConfirmModal({
  aberto,
  titulo,
  mensagem,
  confirmarLabel = "Confirmar",
  cancelarLabel = "Cancelar",
  onConfirmar,
  onCancelar,
}: {
  aberto: boolean;
  titulo?: string;
  mensagem: string;
  confirmarLabel?: string;
  cancelarLabel?: string;
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
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancelar}>
            {cancelarLabel}
          </Button>
          <Button variant="primary" onClick={onConfirmar}>
            {confirmarLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
