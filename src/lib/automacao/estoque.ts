import { emAndamento } from "@/lib/demos/capturas/estado";
import type { LeadDemo } from "@/lib/demos/types";
import { candidatoEstavel, motivoEstrutural } from "@/lib/fila/candidatos";
import { loadFilaConfig } from "@/lib/fila/config";
import { FILA_ENVIOS_COLLECTION } from "@/lib/fila/envios";
import { retencaoMsDeHoras, type FilaEnvioDoc } from "@/lib/fila/estado";
import type { AppDb } from "@/lib/firestore-like";
import { LEADS_COLLECTION, type Lead } from "@/lib/leads/types";

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
 * Em qual balde do estoque este lead cai — no MÁXIMO um, para nenhum lead
 * contar duas vezes. Pura.
 *
 * - **pronto**: passa em `candidatoEstavel`, exatamente o critério do pool
 *   da fila (inclusive a retenção por claim silenciosa e as tentativas
 *   esgotadas: lead retido não é estoque, provavelmente já recebeu).
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
  retencaoMs: number,
): BaldeEstoque | undefined {
  if (lead.leadDeTeste === true) return undefined;
  const pendente = demoAutomaticaPendente(lead.demo);
  const motivo = motivoEstrutural(lead);

  if (motivo === undefined) {
    if (pendente) return "aguardandoAprovacao";
    // Reprovada: não está a caminho de lugar nenhum.
    if (lead.demo?.origem === "automacao" && lead.demo.aprovacao !== "aprovada") return undefined;
    return candidatoEstavel(lead, envio, now, retencaoMs) ? "pronto" : undefined;
  }
  if (motivo === "capturaNaoPronta") {
    if (emAndamento(lead.capturas?.estado)) return "capturaEmAndamento";
    if (pendente) return "aguardandoAprovacao";
  }
  return undefined;
}

/** Soma pura dos baldes — separada para o teste não precisar de banco. */
export function somarEstoque(baldes: Array<BaldeEstoque | undefined>): Estoque {
  const estoque: Estoque = { prontos: 0, aguardandoAprovacao: 0, capturasEmAndamento: 0, total: 0 };
  for (const balde of baldes) {
    if (balde === "pronto") estoque.prontos += 1;
    else if (balde === "aguardandoAprovacao") estoque.aguardandoAprovacao += 1;
    else if (balde === "capturaEmAndamento") estoque.capturasEmAndamento += 1;
    else continue;
    estoque.total += 1;
  }
  return estoque;
}

/**
 * O estoque AGORA. Lê `/leads` e `/filaEnvios` inteiras UMA vez — a mesma
 * varredura que o pool da fila faz a cada 10 minutos, aqui uma vez por
 * execução da automação (duas: antes e depois). A retenção é a política em
 * vigor na config da fila, a mesma que o pool usa.
 */
export async function calcularEstoque(db: AppDb, now: Date = new Date()): Promise<Estoque> {
  const [leadsSnap, enviosSnap, filaConfig] = await Promise.all([
    db.collection(LEADS_COLLECTION).get(),
    db.collection(FILA_ENVIOS_COLLECTION).get(),
    loadFilaConfig(db),
  ]);
  const envios = new Map<string, FilaEnvioDoc>(
    enviosSnap.docs.map((doc) => [doc.id, doc.data() as unknown as FilaEnvioDoc]),
  );
  const retencaoMs = retencaoMsDeHoras(filaConfig.retencaoEnvioHoras);
  return somarEstoque(
    leadsSnap.docs.map((doc) => {
      const lead = doc.data() as unknown as Lead;
      return classificarEstoque(lead, envios.get(lead.placeId ?? doc.id), now, retencaoMs);
    }),
  );
}
