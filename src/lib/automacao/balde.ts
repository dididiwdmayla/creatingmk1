import { emAndamento } from "@/lib/demos/capturas/estado";
import type { LeadDemo } from "@/lib/demos/types";
import type { Lead } from "@/lib/leads/types";

/**
 * A decisão do BALDE do estoque, pura e sem nenhuma dependência da fila —
 * para poder ser chamada de DENTRO da varredura do pool
 * (`construirPool`, `lib/fila/candidatos.ts`) sem ciclo de import:
 * `estoque.ts` importa `candidatos.ts`, e `candidatos.ts` importa isto.
 *
 * Quem decide o motivo estrutural e se o lead passa no pool é o chamador
 * (os dois já estão em mãos na varredura); daqui sai só a regra dos baldes.
 * `classificarEstoque` (`estoque.ts`) delega para cá — um dono só.
 */

export type BaldeEstoque = "pronto" | "aguardandoAprovacao" | "capturaEmAndamento";

export interface Estoque {
  prontos: number;
  aguardandoAprovacao: number;
  capturasEmAndamento: number;
  total: number;
}

/** Demo automática esperando o operador (aprovação ausente vale pendente). */
export function demoAutomaticaPendente(demo: LeadDemo | undefined): boolean {
  return demo?.origem === "automacao" && (demo.aprovacao ?? "pendente") === "pendente";
}

/**
 * - `motivo`: o de `motivoEstrutural(lead)` (string solta para não importar
 *   o tipo da fila);
 * - `passaNoPool`: sem motivo estrutural, o envio deixa o lead no pool
 *   (`!envioImpedePool`) — só é lido quando `motivo` é `undefined`.
 */
export function baldeEstoque(
  lead: Lead,
  motivo: string | undefined,
  passaNoPool: boolean,
): BaldeEstoque | undefined {
  if (lead.leadDeTeste === true) return undefined;
  const pendente = demoAutomaticaPendente(lead.demo);
  if (motivo === "aguardandoAprovacao") return pendente ? "aguardandoAprovacao" : undefined;
  if (motivo === undefined) return passaNoPool ? "pronto" : undefined;
  if (motivo === "capturaNaoPronta") {
    if (emAndamento(lead.capturas?.estado)) return "capturaEmAndamento";
    if (pendente) return "aguardandoAprovacao";
  }
  return undefined;
}

export function estoqueVazio(): Estoque {
  return { prontos: 0, aguardandoAprovacao: 0, capturasEmAndamento: 0, total: 0 };
}

/** Soma um balde no estoque (mutável — é o laço da varredura). */
export function somarBalde(estoque: Estoque, balde: BaldeEstoque | undefined): void {
  if (balde === "pronto") estoque.prontos += 1;
  else if (balde === "aguardandoAprovacao") estoque.aguardandoAprovacao += 1;
  else if (balde === "capturaEmAndamento") estoque.capturasEmAndamento += 1;
  else return;
  estoque.total += 1;
}

/**
 * O lead entra na FILA DE APROVAÇÃO do painel? Demo automática pendente que
 * está no funil — esperando só o operador, ou com a captura andando. A que
 * saiu do funil por outro motivo (contactado, descartado) não está a
 * caminho de lugar nenhum e não pede decisão.
 */
export function naFilaDeAprovacao(lead: Lead, balde: BaldeEstoque | undefined): boolean {
  return (
    demoAutomaticaPendente(lead.demo) &&
    (balde === "aguardandoAprovacao" || balde === "capturaEmAndamento")
  );
}
