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
