import type { UsoUsuario } from "@/lib/costs";

const LABEL_JANELA: Record<"dia" | "semana" | "mes", string> = {
  dia: "hoje",
  semana: "semana",
  mes: "mês",
};

/**
 * Alguma janela CONFIGURADA já bateu no limite? Cortesia de UI para
 * desabilitar o botão antes de tentar — o bloqueio real é sempre do
 * servidor (esta função nunca é a fonte da verdade).
 */
export function cotaEsgotada(uso: UsoUsuario | null | undefined): boolean {
  if (!uso) return false;
  return (["dia", "semana", "mes"] as const).some((janela) => {
    const { usado, limite } = uso[janela];
    return limite !== undefined && usado >= limite;
  });
}

/**
 * Cota individual restante (buscas ou enriquecimentos) — indicador
 * permanente na tela de busca e na ficha do lead. Só mostra as janelas que
 * TÊM limite configurado (sem nenhuma = "sem limite", nunca escondido —
 * o usuário precisa ver que o recurso existe mesmo destravado).
 */
export function CotaIndicador({ titulo, uso }: { titulo: string; uso: UsoUsuario }) {
  const janelas = (["dia", "semana", "mes"] as const).filter(
    (janela) => uso[janela].limite !== undefined,
  );

  if (janelas.length === 0) {
    return (
      <p className="text-xs text-ink-muted">
        {titulo}: <span className="text-ink-secondary">sem limite</span>
      </p>
    );
  }

  return (
    <p className="text-xs text-ink-muted">
      {titulo}:{" "}
      {janelas.map((janela, i) => {
        const { usado, limite } = uso[janela];
        const noLimite = limite !== undefined && usado >= limite;
        const perto = !noLimite && limite !== undefined && limite > 0 && usado / limite >= 0.8;
        return (
          <span key={janela}>
            {i > 0 && " · "}
            {LABEL_JANELA[janela]}:{" "}
            <span
              className={
                noLimite
                  ? "font-medium text-critical"
                  : perto
                    ? "font-medium text-warning"
                    : "text-ink-secondary"
              }
            >
              {usado}/{limite}
            </span>
          </span>
        );
      })}
    </p>
  );
}
