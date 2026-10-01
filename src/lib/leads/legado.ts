import { saoPauloDateKey } from "@/lib/costs/periodoUsuario";

import type { Lead } from "./types";

/**
 * O LEAD É LEGADO: criado ANTES da data de corte (dia em São Paulo,
 * "YYYY-MM-DD"). Antes de `registrosEnvio` existir (e de `seloContato`, um
 * pouco antes), quem foi abordado à mão não deixou rastro nenhum — e "sem
 * vestígio" não quer dizer "sem contato". `>= corte` entra: o complemento
 * exato do `< corte` da tela de revisão de leads sem vestígio.
 *
 * `criadoEm` ausente ou inválido conta como legado: sem data não há como
 * provar que o lead é novo, e na dúvida não se manda.
 *
 * UMA função, dois chamadores que precisam concordar: o planejador da
 * automação (`motivoInelegivelAutomacao` — quem ganha demo) e a
 * elegibilidade da fila (`motivoEstrutural` — quem recebe mensagem). Os dois
 * leem o MESMO campo, `config/automacao.corteLegado`.
 */
export function ehLegado(lead: Pick<Lead, "criadoEm">, corteLegado: string): boolean {
  if (typeof lead.criadoEm !== "string") return true;
  const criado = new Date(lead.criadoEm);
  return Number.isNaN(criado.getTime()) || saoPauloDateKey(criado) < corteLegado;
}
