import { skinsDoNicho } from "@/lib/demos/nicho";
import { ehLegado } from "@/lib/leads/legado";
import type { Lead } from "@/lib/leads/types";

/**
 * Quem pode ganhar uma demo da automação — a primeira fonte de trabalho do
 * planejador, antes de qualquer busca paga. Puro.
 *
 * A regra é a da tela "sem vestígio" (`lib/leads/semVestigio.ts`) virada do
 * avesso: lá, o lead ANTIGO sem vestígio vai para revisão humana; aqui, só
 * o lead NOVO sem vestígio entra.
 */

export type MotivoInelegivel =
  | "leadDeTeste"
  | "status"
  | "vestigio"
  | "descartado"
  | "telefoneInvalido"
  | "semTelefone"
  | "reprovado"
  | "expirada"
  | "temDemo"
  | "nichoSemSkin"
  | "legado";

/**
 * O motivo de o lead NÃO servir, ou `undefined` quando serve.
 *
 * - **vestígio** são os mesmos três campos que `motivoEstrutural` lê em
 *   `contactadoForaDaFila` MAIS um doc em `/filaEnvios` (`temDocFila`): toda
 *   claim nasce de uma reserva, e a claim que expirou sem confirmação é
 *   tratada pela revisão como "provavelmente saiu". A lição é do bloco
 *   "sem vestígio", e vale igual aqui.
 * - **reprovado**: o operador reprovou uma demo automática deste lead — a
 *   marca é do LEAD (`automacaoReprovada`), então apagar a demo não o traz
 *   de volta.
 * - **expirada**: a demo automática deste lead venceu sem ser enviada e a
 *   varredura a apagou (`automacaoExpirada`) — do mesmo jeito que o
 *   reprovado, senão a automação refaria a demo na noite seguinte, para
 *   sempre.
 * - **legado**: criado ANTES da data de corte (dia em São Paulo). Sem
 *   vestígio não quer dizer sem contato: antes de `registrosEnvio` existir,
 *   quem foi abordado à mão não deixou rastro. Demo para ele é mensagem
 *   repetida, a causa número um de denúncia no WhatsApp. `>= corte` entra —
 *   o complemento exato do `< corte` da tela de revisão.
 */
export function motivoInelegivelAutomacao(
  lead: Lead,
  temDocFila: boolean,
  corteLegado: string,
): MotivoInelegivel | undefined {
  if (lead.leadDeTeste === true) return "leadDeTeste";
  if (lead.status !== "novo") return "status";
  if (
    lead.seloContato !== undefined ||
    (lead.registrosEnvio?.length ?? 0) > 0 ||
    lead.contato?.primeiroContatoEm !== undefined ||
    temDocFila
  ) {
    return "vestigio";
  }
  if (lead.descartado === true) return "descartado";
  if (lead.telefoneInvalido === true) return "telefoneInvalido";
  if (!(lead.detalhes?.telefoneIntl ?? lead.telefoneIntl)) return "semTelefone";
  if (lead.automacaoReprovada) return "reprovado";
  if (lead.automacaoExpirada) return "expirada";
  if (lead.demo) return "temDemo";
  if (!lead.busca?.nicho || skinsDoNicho(lead.busca.nicho).length === 0) return "nichoSemSkin";
  if (ehLegado(lead, corteLegado)) return "legado";
  return undefined;
}

/**
 * Os leads existentes que servem, na ordem justa da fila (quem entrou na
 * base primeiro, desempate por id), cortados em `limite`.
 */
export function leadsParaDemo(
  leads: Lead[],
  idsComDocFila: ReadonlySet<string>,
  corteLegado: string,
  limite: number,
): Lead[] {
  if (limite <= 0) return [];
  return leads
    .filter((lead) => !motivoInelegivelAutomacao(lead, idsComDocFila.has(lead.placeId), corteLegado))
    .sort((a, b) => a.criadoEm.localeCompare(b.criadoEm) || a.placeId.localeCompare(b.placeId))
    .slice(0, limite);
}
