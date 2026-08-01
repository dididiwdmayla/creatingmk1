import { getUsoUsuario } from "@/lib/costs/userQuota";
import type { UsageDb } from "@/lib/firestore-like";
import type { MetasUsuario } from "./types";

export interface ProgressoJanela {
  usado: number;
  /** Ausente = sem meta configurada nesta janela (a UI não mostra nada). */
  meta?: number;
}

export interface ProgressoMetas {
  dia: ProgressoJanela;
  semana: ProgressoJanela;
}

/**
 * Progresso da meta de prospecção de um usuário. "Prospecção" reaproveita
 * o contador `buscas` de usage_users (ver MetasUsuario) — mesma leitura
 * dia/semana em America/Sao_Paulo que getUsoUsuario já faz para as cotas
 * individuais. `usado` sempre vem preenchido (mesmo sem meta definida); é
 * quem chama (UI) que decide não renderizar uma janela sem `meta`.
 */
export async function getProgressoMetaUsuario(
  db: UsageDb,
  userId: string,
  metas: MetasUsuario | undefined,
  now: Date = new Date(),
): Promise<ProgressoMetas> {
  const uso = await getUsoUsuario(db, userId, "buscas", undefined, now);
  return {
    dia: { usado: uso.dia.usado, meta: metas?.prospeccoesDia },
    semana: { usado: uso.semana.usado, meta: metas?.prospeccoesSemana },
  };
}
