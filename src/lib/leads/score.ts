import { presenca } from "./repo";
import type { Lead } from "./types";

/**
 * Score de priorização (sem IA — só regras). Positivo puxa pro topo da
 * lista, negativo empurra pro fim; nunca bloqueia nada, é só ordenação e
 * o badge do card. `presenca()` já cobre a derivação de docs antigos sem
 * `siteProprio`/`temTelefone` gravado.
 */
export function calculaScore(lead: Lead): number {
  let score = 0;
  if (presenca(lead, "site") === false) score += 3;
  if (presenca(lead, "telefone") === true) score += 2;
  if ((lead.detalhes?.rating ?? 0) >= 4.5) score += 2;
  if ((lead.detalhes?.totalAvaliacoes ?? 0) >= 50) score += 1;
  if (lead.descartado) score -= 10;
  if (lead.status !== "novo") score -= 5;
  return score;
}
