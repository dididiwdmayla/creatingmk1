import type { Lead } from "@/lib/leads/types";

import { pendenciasProntidao, type ChavePendencia, type PendenciaProntidao } from "./prontidao";
import type { LeadDemo, OrigemDemo, SkinDefinition } from "./types";

/**
 * Origem e aprovação de demo — o que separa a demo que o OPERADOR fez da
 * que a AUTOMAÇÃO do estoque fez (ver `lib/automacao`), e o critério da
 * aprovação automática.
 */

/** Demo sem `origem` é manual — toda demo de antes da automação. */
export function origemDaDemo(demo: Pick<LeadDemo, "origem"> | undefined): OrigemDemo {
  return demo?.origem === "automacao" ? "automacao" : "manual";
}

/**
 * As pendências de prontidão que IMPEDEM a aprovação automática. É um
 * RECORTE de `pendenciasDaDemo`, não a prontidão inteira: aquela acusa todo
 * slot de imagem sem foto do lead e a falta de Instagram, e a automação
 * nunca sobe foto nem descobre Instagram — com a prontidão inteira,
 * nenhuma demo passaria, nunca. O que sobra é o que faria a demo mentir ou
 * falhar diante do lead: sem telefone (o botão de contato da demo não
 * funciona), sem horário (a seção mostra vazio) e texto no idioma errado.
 * As imagens ficam de fora porque toda skin tem foto própria para 100% dos
 * slots.
 */
export const PENDENCIAS_QUE_BARRAM_APROVACAO: readonly ChavePendencia[] = [
  "telefone",
  "horario",
  "idioma",
];

/** Pura, sobre as pendências já calculadas — o recorte, e nada mais. */
export function criterioAprovacaoAutomatica(pendencias: readonly PendenciaProntidao[]): boolean {
  return !pendencias.some((p) => PENDENCIAS_QUE_BARRAM_APROVACAO.includes(p.chave));
}

/**
 * A demo salva do lead passa no critério? Reusa `pendenciasProntidao` —
 * a MESMA montagem do selo da ficha (exemplo ← lead ← edições) —, então o
 * que é aprovado é o que a página publicada de fato mostra.
 */
export function passaCriterioAprovacaoAutomatica(lead: Lead, skin: SkinDefinition): boolean {
  if (!lead.demo) return false;
  return criterioAprovacaoAutomatica(pendenciasProntidao(lead, skin));
}
