import type { ReserveQuotaOptions } from "@/lib/costs";
import type { LimitesUsuario } from "@/lib/usuarios/types";

/**
 * Contexto de usuário passado a toda função que gera conteúdo via Gemini
 * (sugestão de demo, tradução de frase por skin, análise interna do grupo).
 * `limites` alimenta a cota individual PRÓPRIA dessas três ações
 * (`geracoesIA`, ver src/lib/costs/userQuota.ts) — nunca a de buscas/
 * enriquecimentos, mesmo usuário.
 */
export interface CtxIA {
  userId?: string;
  isAdmin?: boolean;
  limites?: LimitesUsuario;
  /**
   * Avisado a cada chamada REAL ao Gemini (depois da reserva de cota) — o
   * retry de resposta inválida conta de novo. Só a automação do estoque
   * usa: ela tem teto próprio de chamadas por noite e precisa do número
   * exato, que a função de geração não devolve.
   */
  contarChamada?: () => void;
}

/**
 * Monta as opções de reserveQuota para uma chamada de IA: além do
 * userId/isAdmin de sempre, toda chamada real ao Gemini destas três ações
 * também disputa a cota individual `geracoesIA` — um contador só para
 * geração de texto da demo, tradução de frase por skin e análise interna,
 * mesmo padrão de "buscas" somar toda página do Text Search.
 */
export function reserveQuotaOptsIA(ctx: CtxIA): ReserveQuotaOptions {
  return {
    userId: ctx.userId,
    isAdmin: ctx.isAdmin,
    userQuota: { tipo: "geracoesIA", limites: ctx.limites },
  };
}
