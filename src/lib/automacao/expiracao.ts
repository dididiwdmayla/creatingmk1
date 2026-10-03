import { emAndamento, semNoticia } from "@/lib/demos/capturas/estado";
import { canalDoEnvio } from "@/lib/demos/envio";
import { prefixoDoLead } from "@/lib/demos/imagens";
import type { LeadDemo } from "@/lib/demos/types";
import type { Lead } from "@/lib/leads/types";

import { AUTOMACAO_USER_ID } from "./autor";

/**
 * EXPIRAÇÃO das demos que a automação criou e a fila nunca mandou — QUEM
 * PODE ser apagado. Puro, sem banco e sem nenhuma dependência da fila: a
 * varredura do pool (`construirPool`, `lib/fila/candidatos.ts`) chama isto
 * na mesma passada para o painel contar as que vencem, e `candidatos.ts`
 * não pode ser importado daqui (o mesmo motivo de `balde.ts`).
 *
 * **O princípio: apagar não tem volta; manter custa só armazenamento. Na
 * dúvida, NÃO apaga.** Por isso a regra é escrita ao contrário — tudo o que
 * PROTEGE a demo vem primeiro, cada coisa com o próprio motivo, e só sobra
 * para apagar a demo que não tem rastro nenhum de ter saído.
 *
 * Ver "Expiração das demos automáticas não enviadas" em ARCHITECTURE.md.
 */

/**
 * Por que a demo NÃO pode ser apagada — qualquer prazo. A ordem é a da
 * avaliação, e o primeiro que casar é o que vale:
 *
 * - `semDemo`, `leadDeTeste`;
 * - `origemNaoComprovada`: demo manual, ou automática sem as três marcas;
 * - os rastros de ENVIO: `status`, `contato`, `visita`, `tokenConsumido`,
 *   `filaEnvios`, `ciclo`;
 * - os rastros de MÃO HUMANA: `filaManual`, `midiaDoOperador`;
 * - `capturaEmAndamento`: o workflow subiria arquivo depois da exclusão;
 * - `criadoEmInvalido`: sem data, não há como provar a idade.
 */
export type MotivoProtecaoDemo =
  | "semDemo"
  | "leadDeTeste"
  | "origemNaoComprovada"
  | "status"
  | "contato"
  | "visita"
  | "tokenConsumido"
  | "filaEnvios"
  | "ciclo"
  | "filaManual"
  | "midiaDoOperador"
  | "capturaEmAndamento"
  | "criadoEmInvalido";

/** Protegida, ou só ainda não venceu. `undefined` = pode apagar. */
export type MotivoNaoExpira = MotivoProtecaoDemo | "dentroDoPrazo";

/**
 * O que vem de FORA do doc do lead — `/filaEnvios`.
 *
 * - `temDocFila`: há doc em `filaEnvios/{leadId}`, em QUALQUER estado —
 *   inclusive a claim em revisão (venceu sem confirmação: pode ter saído) e
 *   a devolvida. Todo doc dali nasce de uma reserva.
 * - `temCiclo`: há algum `filaEnvios/{leadId}/ciclos/*`. `undefined` = não
 *   lido: a varredura do pool não lê subcoleção. Por construção não existe
 *   ciclo sem o doc principal (`reservarLead` cria os dois na mesma
 *   transação, e só a exclusão definitiva do lead apaga o principal — e
 *   leva os ciclos junto); quem APAGA lê os ciclos mesmo assim.
 */
export interface SinaisFila {
  temDocFila: boolean;
  temCiclo?: boolean;
}

/**
 * A demo foi criada pela automação — e dá para PROVAR. As três marcas que
 * a unidade "demo" grava no MESMO primeiro save (`processarUnidadeDemo`):
 * `origem`, `criadoPor` e `execucaoAutomacao`. Faltou qualquer uma, conta
 * como manual — demo de antes da automação não tem `origem`, e demo manual
 * nunca é apagada.
 */
export function origemAutomaticaComprovada(demo: LeadDemo): boolean {
  return (
    demo.origem === "automacao" &&
    demo.criadoPor === AUTOMACAO_USER_ID &&
    typeof demo.execucaoAutomacao === "string" &&
    demo.execucaoAutomacao.length > 0
  );
}

/**
 * Algum token de envio foi CONSUMIDO. Ter token não prova nada — toda demo
 * nasce com um por canal (`garantirEnviosCanais` no `saveDemo`). O que fica
 * gravado quando um link é usado é a rotação: a visita não interna que bate
 * o token vigente de um canal empurra um token novo do MESMO canal
 * (`aplicarVisita`, `lib/demos/visitas.ts`). Mais de uma entrada num canal
 * é esse rastro.
 */
export function tokenConsumido(demo: LeadDemo): boolean {
  const porCanal = new Map<string, number>();
  for (const envio of demo.envios ?? []) {
    const canal = canalDoEnvio(envio);
    porCanal.set(canal, (porCanal.get(canal) ?? 0) + 1);
  }
  return [...porCanal.values()].some((n) => n > 1);
}

/**
 * O operador subiu foto ou vídeo nesta demo. A automação nunca sobe mídia:
 * o que ela grava em `dados.imagens` (o `montarPatch` do texto por IA pode
 * gravar a foto de uma variante) é caminho RELATIVO do próprio app
 * (`/demos/<skin>/foto/<slot>.webp`). Upload é URL do Storage no prefixo do
 * lead (`demos/{leadId}/`); e, na dúvida, qualquer URL absoluta conta —
 * nada que a automação produz é uma.
 */
export function midiaDoOperador(lead: Lead): boolean {
  const dados = lead.demo?.dados;
  if (!dados) return false;
  const prefixo = prefixoDoLead(lead.placeId);
  const valores = [...Object.values(dados.imagens ?? {}), ...Object.values(dados.videos ?? {})];
  return valores.some(
    (valor) => typeof valor === "string" && (valor.includes(prefixo) || /^https?:\/\//i.test(valor)),
  );
}

/** `demo.criadoEm` em ms, ou `undefined` quando não é uma data. */
function criadoEmMs(demo: LeadDemo): number | undefined {
  const ms = Date.parse(demo.criadoEm);
  return Number.isFinite(ms) ? ms : undefined;
}

/**
 * O que protege a demo, INDEPENDENTE do prazo — ou `undefined` quando nada
 * protege. `now` só serve à captura (em andamento E viva: a que estourou o
 * limite de silêncio já morreu e não sobe mais nada).
 */
export function protecaoDaDemo(lead: Lead, sinais: SinaisFila, now: Date): MotivoProtecaoDemo | undefined {
  const demo = lead.demo;
  if (!demo) return "semDemo";
  if (lead.leadDeTeste === true) return "leadDeTeste";
  if (!origemAutomaticaComprovada(demo)) return "origemNaoComprovada";

  // Rastros de ENVIO — qualquer um conta como enviada.
  if (lead.status !== "novo") return "status";
  // Os mesmos três campos que `motivoEstrutural` lê em `contactadoForaDaFila`.
  if (
    lead.seloContato !== undefined ||
    (lead.registrosEnvio?.length ?? 0) > 0 ||
    lead.contato?.primeiroContatoEm !== undefined
  ) {
    return "contato";
  }
  // Interna também: só abre com `?t=` quem tem o link, e quem tem o link
  // copiou — talvez para mandar.
  if ((lead.demoVisitas?.length ?? 0) > 0) return "visita";
  if (tokenConsumido(demo)) return "tokenConsumido";
  if (sinais.temDocFila) return "filaEnvios";
  if (sinais.temCiclo === true) return "ciclo";

  // Rastros de MÃO HUMANA.
  if (lead.filaManual === true) return "filaManual";
  if (midiaDoOperador(lead)) return "midiaDoOperador";

  if (emAndamento(lead.capturas?.estado) && !semNoticia(lead.capturas, now.getTime())) {
    return "capturaEmAndamento";
  }
  if (criadoEmMs(demo) === undefined) return "criadoEmInvalido";
  return undefined;
}

/**
 * Quando a demo vence: `criadoEm + prazoHoras`, em ms. `undefined` sem
 * demo ou com data inválida (que nunca vence).
 */
export function vencimentoDaDemo(demo: LeadDemo | undefined, prazoHoras: number): number | undefined {
  if (!demo) return undefined;
  const criado = criadoEmMs(demo);
  return criado === undefined ? undefined : criado + prazoHoras * 3_600_000;
}

/**
 * A decisão inteira, no instante `now`: o motivo de a demo NÃO poder ser
 * apagada agora, ou `undefined` quando pode. Vencer é `criadoEm + prazo <=
 * now` — "apagada na primeira varredura DEPOIS do prazo".
 */
export function motivoNaoExpira(
  lead: Lead,
  sinais: SinaisFila,
  opcoes: { now: Date; prazoHoras: number },
): MotivoNaoExpira | undefined {
  const protecao = protecaoDaDemo(lead, sinais, opcoes.now);
  if (protecao) return protecao;
  const vence = vencimentoDaDemo(lead.demo, opcoes.prazoHoras) as number;
  return vence <= opcoes.now.getTime() ? undefined : "dentroDoPrazo";
}
