import {
  removerCapturasDoLead,
  removerImagensDoLead,
  type DemoStorage,
} from "@/lib/demos/imagens";
import type { FilaConfig } from "@/lib/fila/config";
import { FILA_ENVIOS_COLLECTION } from "@/lib/fila/envios";
import { motivoDeSaude } from "@/lib/fila/saude";
import type { AppDb } from "@/lib/firestore-like";
import { modificarLead, toDoc } from "@/lib/leads/repo";
import { LEADS_COLLECTION, type Lead } from "@/lib/leads/types";

import { motivoNaoExpira, type MotivoNaoExpira } from "./expiracao";

/**
 * A VARREDURA das demos automáticas vencidas — uma etapa da execução
 * diária da automação, dentro do `planejar` (`motor.ts`), com a trava da
 * execução tomada e ANTES do estoque: as demos apagadas deixam de contar, e
 * a mesma noite repõe. Nenhum cron novo.
 *
 * O critério de quem pode ser apagado é `motivoNaoExpira`
 * (`expiracao.ts`); aqui mora a parte com banco e Storage. Ver
 * "Expiração das demos automáticas não enviadas" em ARCHITECTURE.md.
 */

/**
 * Teto de exclusões por execução: cada uma é uma leitura de ciclos, uma
 * transação e duas limpezas de prefixo no Storage, e tudo isso roda dentro
 * dos 300 s do `planejar`. O que passar fica para a noite seguinte
 * (`restantes`) — em regime, vencem no máximo umas `alvoEstoque` por noite.
 */
export const VARREDURA_MAX = 40;

/** Por que uma candidata da varredura foi pulada na releitura. */
export type MotivoPuloVarredura = MotivoNaoExpira | "leadSumiu" | "erro";

/** O que a varredura gravou na execução da automação. */
export interface ResultadoVarredura {
  prazoHoras: number;
  /** Por que a varredura não apagou nada nesta execução. Ausente = rodou. */
  naoRodou?: string;
  /** Vencidas e sem proteção na leitura de `/leads` — o que ela TENTOU. */
  candidatas: number;
  apagadas: number;
  /** Candidatas que a releitura na transação protegeu (ou que deram erro). */
  puladas: number;
  porMotivo: Partial<Record<MotivoPuloVarredura, number>>;
  /** Candidatas além do teto da execução: ficam para a próxima. */
  restantes: number;
  /** Limpezas de Storage que falharam — o lead fica marcado e a próxima tenta de novo. */
  storageFalhou: number;
  /** Limpezas que tinham ficado pendentes em execuções anteriores e terminaram agora. */
  storageConcluido: number;
  /** Os leads cuja demo foi apagada nesta execução. */
  apagados: string[];
  /** A primeira mensagem de erro, quando houve. */
  erro?: string;
}

function resultadoVazio(prazoHoras: number): ResultadoVarredura {
  return {
    prazoHoras,
    candidatas: 0,
    apagadas: 0,
    puladas: 0,
    porMotivo: {},
    restantes: 0,
    storageFalhou: 0,
    storageConcluido: 0,
    apagados: [],
  };
}

type Ambiente = Record<string, string | undefined>;

/**
 * Por que a varredura NÃO apaga nada agora, ou `undefined`. Pura — o painel
 * diz o mesmo motivo ao lado da contagem.
 *
 * O prazo mede "a fila teve a chance de mandar e não mandou". Fila pausada
 * (o botão, ou o aparelho) ou bloqueada por config ausente (a saúde da
 * fila) não teve chance nenhuma: apagar ali queimaria o lead para a
 * automação por um motivo que não é dele. Na dúvida, não apaga.
 */
export function motivoParaNaoVarrer(
  filaConfig: Pick<FilaConfig, "ativo">,
  env: Ambiente = process.env,
): string | undefined {
  if (!filaConfig.ativo) return "fila de envio pausada (sem chance de mandar, nada vence)";
  if (motivoDeSaude(env)) return "fila de envio bloqueada por config ausente (sem chance de mandar, nada vence)";
  return undefined;
}

/**
 * As candidatas: vencidas e sem proteção, a mais velha primeiro (desempate
 * pelo id, para a ordem não depender de como o Firestore devolveu os docs).
 * Sem os ciclos — a releitura de cada uma os lê.
 */
export function selecionarExpiraveis(
  leads: Lead[],
  idsComDocFila: ReadonlySet<string>,
  opcoes: { now: Date; prazoHoras: number },
): Lead[] {
  return leads
    .filter((lead) => motivoNaoExpira(lead, { temDocFila: idsComDocFila.has(lead.placeId) }, opcoes) === undefined)
    .sort(
      (a, b) =>
        (a.demo?.criadoEm ?? "").localeCompare(b.demo?.criadoEm ?? "") || a.placeId.localeCompare(b.placeId),
    );
}

/**
 * O lead SEM a demo vencida: some `demo` (e com ela os tokens de envio) e
 * `capturas` (o estado da captura — os arquivos saem do Storage logo
 * depois), e entra `automacaoExpirada`, a marca que tira o lead do
 * planejador. `storagePendente` nasce `true`: só a limpeza bem-sucedida o
 * apaga. Puro.
 */
export function leadSemDemoExpirada(lead: Lead, opcoes: { now: Date; execucaoId: string }): Lead {
  const demo = lead.demo;
  const resto = { ...lead };
  delete resto.demo;
  delete resto.capturas;
  const em = opcoes.now.toISOString();
  return {
    ...resto,
    automacaoExpirada: {
      em,
      demoCriadaEm: demo?.criadoEm ?? "",
      skinId: demo?.skinId ?? "",
      ...(demo?.aprovacao && { aprovacao: demo.aprovacao }),
      execucaoId: opcoes.execucaoId,
      storagePendente: true,
    },
    atualizadoEm: em,
  };
}

/**
 * Apaga UMA demo vencida — ou diz por que não. A decisão é refeita sobre o
 * lead e o `filaEnvios/{id}` RELIDOS na mesma transação que apaga: entre a
 * seleção e aqui, o aparelho pode ter reservado o lead, o operador pode ter
 * clicado no WhatsApp. Uma reserva que chega depois da leitura muda o doc
 * de `filaEnvios` que esta transação leu, e o commit falha e roda de novo
 * (o Firestore garante; o fake também) — aí o lead está protegido. Se a
 * exclusão vence, `/proximo` relê o lead depois de reservar e devolve a
 * claim (não acha a demo).
 *
 * Os ciclos (subcoleção) são lidos ANTES, fora da transação, que só lê doc:
 * não existe ciclo sem o doc principal, e uma reserva nova cria os dois
 * juntos — o doc principal na transação é o portão.
 */
export async function apagarDemoExpirada(
  db: AppDb,
  leadId: string,
  opcoes: { now: Date; prazoHoras: number; execucaoId: string },
): Promise<{ lead: Lead } | { motivo: MotivoPuloVarredura }> {
  const ciclos = await db.collection(`${FILA_ENVIOS_COLLECTION}/${leadId}/ciclos`).get();
  const temCiclo = ciclos.docs.length > 0;
  return db.runTransaction(async (tx): Promise<{ lead: Lead } | { motivo: MotivoPuloVarredura }> => {
    const refLead = db.collection(LEADS_COLLECTION).doc(leadId);
    const refEnvio = db.collection(FILA_ENVIOS_COLLECTION).doc(leadId);
    const dados = (await tx.get(refLead)).data();
    const temDocFila = (await tx.get(refEnvio)).exists;
    if (!dados) return { motivo: "leadSumiu" };
    const lead = { ...(dados as unknown as Lead), placeId: leadId };
    const motivo = motivoNaoExpira(lead, { temDocFila, temCiclo }, opcoes);
    if (motivo) return { motivo };
    const apagado = leadSemDemoExpirada(lead, opcoes);
    tx.set(refLead, toDoc(apagado));
    return { lead: apagado };
  });
}

function semPendencia(marca: NonNullable<Lead["automacaoExpirada"]>): NonNullable<Lead["automacaoExpirada"]> {
  const limpa = { ...marca };
  delete limpa.storagePendente;
  return limpa;
}

/**
 * Tira do Storage o que a demo deixou — as capturas (`capturas/{id}/`) e os
 * uploads do editor (`demos/{id}/`) — e só então limpa `storagePendente`.
 * Falhou: o lead continua marcado e a próxima varredura tenta de novo.
 * Nunca lança.
 */
async function limparStorage(db: AppDb, storage: DemoStorage, leadId: string): Promise<boolean> {
  try {
    await Promise.all([removerCapturasDoLead(storage, leadId), removerImagensDoLead(storage, leadId)]);
    await modificarLead(
      db,
      leadId,
      (lead) => {
        if (!lead.automacaoExpirada?.storagePendente) return undefined;
        return { ...lead, automacaoExpirada: semPendencia(lead.automacaoExpirada) };
      },
      { opcional: true },
    );
    return true;
  } catch (erro) {
    console.error("[radar] varredura: falha ao limpar o Storage da demo expirada:", leadId, erro);
    return false;
  }
}

function mensagem(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro);
}

export interface EntradaVarredura {
  now: Date;
  prazoHoras: number;
  execucaoId: string;
  filaConfig: Pick<FilaConfig, "ativo">;
  /** Fábrica do Storage: sem ele não há como apagar sem deixar órfão — a varredura não roda. */
  storage: () => DemoStorage;
  env?: Ambiente;
}

/**
 * A varredura inteira sobre a leitura que o `planejar` já fez (`leads` +
 * ids com doc em `filaEnvios`). Devolve o resultado e a lista de leads
 * ATUALIZADA (os apagados trocados pelo doc gravado), para o estoque e o
 * plano da mesma execução já enxergarem a exclusão sem varrer `/leads` de
 * novo. Nunca lança: o que der errado vira `erro`/`naoRodou` no resultado,
 * e o planejamento segue.
 */
export async function varrerDemosExpiradas(
  db: AppDb,
  leads: Lead[],
  idsComDocFila: ReadonlySet<string>,
  entrada: EntradaVarredura,
): Promise<{ resultado: ResultadoVarredura; leads: Lead[] }> {
  const resultado = resultadoVazio(entrada.prazoHoras);
  const porId = new Map(leads.map((lead) => [lead.placeId, lead]));
  const devolver = () => ({ resultado, leads: [...porId.values()] });

  let storage: DemoStorage;
  try {
    storage = entrada.storage();
  } catch (erro) {
    resultado.naoRodou = "Storage indisponível — apagar sem limpar as capturas deixaria arquivo órfão";
    resultado.erro = mensagem(erro);
    return devolver();
  }

  // Primeiro, o que ficou pela metade em execuções anteriores. Não é apagar
  // demo nenhuma (a demo já saiu), então não depende da fila estar ativa.
  const pendentes = leads.filter((lead) => lead.automacaoExpirada?.storagePendente === true);
  for (const lead of pendentes.slice(0, VARREDURA_MAX)) {
    if (await limparStorage(db, storage, lead.placeId)) resultado.storageConcluido += 1;
    else resultado.storageFalhou += 1;
  }

  const naoVarrer = motivoParaNaoVarrer(entrada.filaConfig, entrada.env);
  if (naoVarrer) {
    resultado.naoRodou = naoVarrer;
    return devolver();
  }

  const opcoes = { now: entrada.now, prazoHoras: entrada.prazoHoras, execucaoId: entrada.execucaoId };
  const candidatas = selecionarExpiraveis(leads, idsComDocFila, opcoes);
  resultado.candidatas = candidatas.length;
  resultado.restantes = Math.max(candidatas.length - VARREDURA_MAX, 0);

  // Sequencial, como a exclusão definitiva: destruição em paralelo troca
  // tempo por um erro no meio que deixa um subconjunto imprevisível apagado.
  for (const candidata of candidatas.slice(0, VARREDURA_MAX)) {
    let saida: Awaited<ReturnType<typeof apagarDemoExpirada>>;
    try {
      saida = await apagarDemoExpirada(db, candidata.placeId, opcoes);
    } catch (erro) {
      console.error("[radar] varredura: falha ao apagar a demo expirada:", candidata.placeId, erro);
      resultado.erro ??= mensagem(erro);
      saida = { motivo: "erro" };
    }
    if ("motivo" in saida) {
      resultado.puladas += 1;
      resultado.porMotivo[saida.motivo] = (resultado.porMotivo[saida.motivo] ?? 0) + 1;
      continue;
    }
    resultado.apagadas += 1;
    resultado.apagados.push(candidata.placeId);
    // A ordem da exclusão definitiva: o doc primeiro, os arquivos depois.
    // Doc sem demo com arquivo sobrando é órfão (e fica marcado para a
    // próxima); arquivo apagado com a demo de pé seria demo quebrada.
    const limpo = await limparStorage(db, storage, candidata.placeId);
    if (!limpo) resultado.storageFalhou += 1;
    porId.set(
      candidata.placeId,
      limpo ? { ...saida.lead, automacaoExpirada: semPendencia(saida.lead.automacaoExpirada!) } : saida.lead,
    );
  }
  return devolver();
}
