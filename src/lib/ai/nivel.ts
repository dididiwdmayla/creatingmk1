/**
 * Nível de intervenção da IA na Forja: quanto a sugestão pode mexer antes
 * do usuário revisar, escolhido ANTES da chamada (checkbox do passo de
 * escolha de skin, seletor do botão "Gerar com IA"). Entra na instrução E
 * no schema enviados ao Gemini — o modelo só recebe/devolve os campos do
 * nível escolhido, nunca os de um nível mais largo (ver ./sugestao.ts).
 *
 * - "toque-leve": só paleta e fonte — nenhum texto.
 * - "equilibrado": paleta, fonte, animação + slogan e descrição curta do
 *   hero + título das seções não-fixas (comportamento histórico da IA na
 *   Forja, antes deste nível existir).
 * - "completo": tudo do equilibrado + reescreve rótulo/título/texto/CTAs
 *   de toda seção não-fixa, no tom do nicho e no idioma da região do lead.
 *
 * Separado num módulo próprio (sem dependências) para ser importável tanto
 * por `lib/ai` quanto por `lib/usuarios` (persistência do último nível
 * escolhido por usuário) sem criar ciclo entre os dois.
 */
export const NIVEIS_IA = ["toque-leve", "equilibrado", "completo"] as const;

export type NivelIA = (typeof NIVEIS_IA)[number];

export const NIVEL_IA_PADRAO: NivelIA = "equilibrado";

export function nivelIaValido(valor: unknown): valor is NivelIA {
  return typeof valor === "string" && (NIVEIS_IA as readonly string[]).includes(valor);
}
