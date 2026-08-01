/**
 * Selo discreto e fixo mostrado só quando o SERVIDOR classificou a visita
 * como interna (ver requestEhInterna/classificarVisitaInterna) — nunca
 * calculado no cliente, nunca "talvez": sem certeza de que é interna, este
 * componente simplesmente não é renderizado (decisão de quem monta
 * <SeloVisitaInterna> em [leadId]/page.tsx, não deste componente).
 * Markup + estilo inline (sem depender de nenhuma classe Tailwind/CSS var
 * da skin) — a skin de baixo pode ter qualquer reset, este selo precisa
 * ficar legível em cima de qualquer uma delas.
 */
export function SeloVisitaInterna({ nomeUsuario }: { nomeUsuario?: string }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        bottom: "12px",
        right: "12px",
        zIndex: 2147483647,
        pointerEvents: "none",
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "6px 10px",
        borderRadius: "999px",
        background: "rgba(17, 17, 17, 0.72)",
        color: "#f5f5f5",
        fontSize: "11px",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        lineHeight: 1.2,
        letterSpacing: "0.01em",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        boxShadow: "0 1px 4px rgba(0, 0, 0, 0.25)",
      }}
    >
      <span style={{ width: "6px", height: "6px", borderRadius: "999px", background: "#f5a623" }} />
      <span>Vendo como membro{nomeUsuario ? ` · ${nomeUsuario}` : ""}</span>
    </div>
  );
}
