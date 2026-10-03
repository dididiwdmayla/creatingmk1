import { candidatoEstavel, motivoEstrutural } from "@/lib/fila/candidatos";
import { FILA_ENVIOS_COLLECTION } from "@/lib/fila/envios";
import type { FilaEnvioDoc } from "@/lib/fila/estado";
import type { AppDb } from "@/lib/firestore-like";
import { LEADS_COLLECTION, type Lead } from "@/lib/leads/types";

import { baldeEstoque, estoqueVazio, somarBalde, type BaldeEstoque, type Estoque } from "./balde";
import { loadAutomacaoConfig } from "./config";

/**
 * O ESTOQUE de leads prontos — o número que decide se a automação trabalha.
 *
 * Estoque = PRONTOS + A CAMINHO. "A caminho" é o que já está andando e vai
 * virar pronto sem a automação fazer mais nada: demo automática esperando o
 * operador aprovar, e demo (de qualquer origem) com a captura na fila ou
 * gerando.
 *
 * Contar só os prontos faria a automação, com o operador demorando a
 * aprovar, ver estoque baixo toda noite e criar mais demo — a pilha de
 * pendências cresceria sozinha. Contar "elegíveis AGORA" (dentro da janela
 * de contato) seria pior: a automação roda de madrugada, quando quase todo
 * lead está fora da janela, e o gatilho veria zero sempre. Por isso
 * "pronto" é o filtro ESTRUTURAL da fila — o mesmo que decide quem entra no
 * pool de candidatos —, nunca a janela.
 */

export { demoAutomaticaPendente, type BaldeEstoque, type Estoque } from "./balde";

/**
 * Em qual balde do estoque este lead cai — no MÁXIMO um, para nenhum lead
 * contar duas vezes. Pura. A regra mora em `baldeEstoque` (`balde.ts`),
 * que a varredura do pool também chama; aqui só se resolve o motivo e o
 * envio.
 *
 * - **pronto**: passa em `candidatoEstavel`, exatamente o critério do pool
 *   da fila (inclusive a revisão da claim silenciosa e as tentativas
 *   esgotadas: lead em revisão não é estoque, provavelmente já recebeu).
 * - **capturaEmAndamento**: só falta o print, e ele está na fila ou
 *   gerando. Vem ANTES da aprovação quando as duas coisas faltam — a
 *   ordem do funil da fila, que também para primeiro na captura.
 * - **aguardandoAprovacao**: demo automática PENDENTE parada só pela
 *   aprovação ou pela captura (que falhou ou nem foi pedida). Reprovada não
 *   conta: não está a caminho de lugar nenhum.
 *
 * Todo o resto (contactado, descartado, sem telefone, sem demo, sem fuso)
 * fica fora — nada ali vira pronto sozinho.
 */
export function classificarEstoque(
  lead: Lead,
  envio: FilaEnvioDoc | undefined,
  now: Date,
  corteLegado: string,
): BaldeEstoque | undefined {
  const motivo = motivoEstrutural(lead, corteLegado);
  return baldeEstoque(
    lead,
    motivo,
    motivo === undefined && candidatoEstavel(lead, envio, { corteLegado, now }),
  );
}

/** Soma pura dos baldes — separada para o teste não precisar de banco. */
export function somarEstoque(baldes: Array<BaldeEstoque | undefined>): Estoque {
  const estoque = estoqueVazio();
  for (const balde of baldes) somarBalde(estoque, balde);
  return estoque;
}

/** O que o estoque (e o planejador) lê do banco — uma varredura só. */
export interface BaseEstoque {
  leads: Lead[];
  envios: Map<string, FilaEnvioDoc>;
  /** `config/automacao.corteLegado` — o mesmo corte que o pool da fila aplica. */
  corteLegado: string;
}

/**
 * Lê `/leads` e `/filaEnvios` inteiras UMA vez — a mesma varredura que o
 * pool da fila faz a cada 10 minutos, aqui uma vez por execução da
 * automação (duas: antes e depois). Lead em revisão (claim que venceu sem
 * confirmação) não é estoque: o pool também o barra.
 */
export async function lerBaseEstoque(db: AppDb): Promise<BaseEstoque> {
  const [leadsSnap, enviosSnap, automacaoConfig] = await Promise.all([
    db.collection(LEADS_COLLECTION).get(),
    db.collection(FILA_ENVIOS_COLLECTION).get(),
    loadAutomacaoConfig(db),
  ]);
  return {
    leads: leadsSnap.docs.map((doc) => ({ ...(doc.data() as unknown as Lead), placeId: doc.id })),
    envios: new Map(enviosSnap.docs.map((doc) => [doc.id, doc.data() as unknown as FilaEnvioDoc])),
    // O MESMO corte que o pool da fila aplica: lead legado com demo não é
    // estoque pronto — a fila não o entrega.
    corteLegado: automacaoConfig.corteLegado,
  };
}

export function estoqueDaBase(base: BaseEstoque, now: Date): Estoque {
  return somarEstoque(
    base.leads.map((lead) => classificarEstoque(lead, base.envios.get(lead.placeId), now, base.corteLegado)),
  );
}

/** O estoque AGORA. */
export async function calcularEstoque(db: AppDb, now: Date = new Date()): Promise<Estoque> {
  return estoqueDaBase(await lerBaseEstoque(db), now);
}
