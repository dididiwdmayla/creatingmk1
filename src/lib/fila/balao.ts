import type { AppDb } from "@/lib/firestore-like";
import { updateLeadExtras } from "@/lib/leads/repo";

import { lerPoolBruto } from "./candidatos";
import { loadFilaConfig } from "./config";
import { lerContadorFila } from "./contadores";
import { FILA_ENVIOS_COLLECTION } from "./envios";
import { claimAtiva, type ContadorPainel, type FilaEnvioDoc, type LinhaPendenteManual } from "./estado";
import { contadorDoPainel, linhasPendentesManuais } from "./painel";
import { motivoDeRitmo, type MotivoSemTarefa } from "./selecao";

/**
 * O BALÃO DA FILA — o indicador fixo que fica em TODA tela do app, e por
 * isso o módulo onde o custo de leitura é a decisão de projeto principal.
 *
 * O balão não é um painel: ele está em `/leads`, em `/hoje`, na ficha, em
 * `/mundo`, em tudo. Se ele buscasse a fila inteira a cada navegação,
 * multiplicaria leitura por página aberta — o oposto do que o pool de
 * candidatos existe para fazer. Daí os DOIS estados, com custos diferentes
 * e explícitos:
 *
 * - **FECHADO (`montarResumoBalao`) — 2 leituras de doc**: `config/fila` e
 *   `filaContadores/{dia operacional}`. É tudo que o estado fechado mostra
 *   (quantas mensagens ainda saem hoje, e se a fila está ativa ou pausada),
 *   e é o único custo que a navegação normal paga. O componente vive no
 *   layout do app, então nem remonta ao trocar de aba: são 2 leituras por
 *   CARREGAMENTO de página, não por navegação, e não há polling.
 *
 * - **ABERTO (`montarBalaoFila`) — 3 leituras de doc + 1 por pendente**:
 *   as 2 acima, mais o doc do pool, e uma leitura POR ID de cada pendente
 *   mostrado (no máximo `BALAO_PENDENTES`) — as entradas do pool são
 *   compactas de propósito e não carregam nome. Só no clique que abre.
 *
 * **Quem sai, e quando, NÃO é daqui.** Os próximos do balão aberto são os
 * primeiros da AGENDA (`GET /api/config/fila/agenda?limite=5`, a mesma
 * rota e a mesma simulação do painel "Fila de envio"), buscados em paralelo
 * com esta rota. Antes este módulo montava "Nesta ordem" com
 * `ordenarCandidatos` — só quem sai NESTE minuto, quase sempre vazio fora
 * da janela.
 *
 * **Nunca reconstrói o pool** (`lerPoolBruto`, sem TTL): a varredura de
 * `/leads` é o custo que o pool existe para evitar, e um indicador global
 * não pode ser quem o paga. A agenda do balão segue a mesma regra. A
 * consequência é assumida e fica NA TELA — o retrato do pool vem datado.
 *
 * **NADA aqui dispara envio.** Quem entrega continua sendo o ciclo do
 * aparelho consumindo `GET /api/fila/proximo`; o balão só mostra o que ele
 * vai encontrar quando pedir.
 */

/** Quantos pendentes o balão aberto mostra, pela mesma conta. */
export const BALAO_PENDENTES = 5;

/** O estado FECHADO: o que cabe numa pílula, e custa 2 leituras. */
export interface ResumoBalao {
  /** A fila está ligada? É o botão de pausa, e o fato mais importante aqui. */
  ativo: boolean;
  /** Portão de ritmo em vigor agora (`meta_atingida`, `teto_hora`…), ou null. */
  ritmo: MotivoSemTarefa | null;
  contador: ContadorPainel;
}

/** O estado ABERTO: o resumo mais os pendentes e a data do retrato. */
export interface BalaoFila extends ResumoBalao {
  /** Os marcados à mão a que falta a peça que o envio exige, com o motivo. */
  pendentes: LinhaPendenteManual[];
  /** Quantos pendentes ao todo — ver `manuaisPendentesTotal` no pool. */
  pendentesTotal: number;
  /** Instante do último rebuild do pool (ISO), ou null se nunca houve. */
  poolGeradoEm: string | null;
}

/**
 * O estado FECHADO. Duas leituras, e nenhuma delas toca no pool nem em
 * `/leads` — é o que torna aceitável um indicador que existe em toda tela.
 */
export async function montarResumoBalao(db: AppDb, now: Date): Promise<ResumoBalao> {
  const config = await loadFilaConfig(db);
  const contador = await lerContadorFila(db, now, config.inicioDiaOperacionalHora);
  return {
    ativo: config.ativo,
    ritmo: motivoDeRitmo(config, contador) ?? null,
    contador: contadorDoPainel(config, contador, now),
  };
}

/**
 * O estado ABERTO. Acrescenta ao resumo os pendentes de demo e a data do
 * retrato do pool — quem sai e quando vem da agenda (ver o topo).
 */
export async function montarBalaoFila(db: AppDb, now: Date): Promise<BalaoFila> {
  const config = await loadFilaConfig(db);
  const contador = await lerContadorFila(db, now, config.inicioDiaOperacionalHora);
  const resumo: ResumoBalao = {
    ativo: config.ativo,
    ritmo: motivoDeRitmo(config, contador) ?? null,
    contador: contadorDoPainel(config, contador, now),
  };

  const pool = await lerPoolBruto(db);
  if (!pool) {
    // O celular nunca pediu tarefa: não há pool, e inventar listas vazias
    // sem dizer isso faria "fila vazia" e "nunca varrido" parecerem a mesma
    // coisa. `poolGeradoEm: null` é o que a tela lê para ter texto próprio.
    return { ...resumo, pendentes: [], pendentesTotal: 0, poolGeradoEm: null };
  }

  return {
    ...resumo,
    pendentes: await linhasPendentesManuais(db, pool.manuaisPendentes.slice(0, BALAO_PENDENTES)),
    pendentesTotal: pool.manuaisPendentesTotal,
    poolGeradoEm: pool.geradoEm,
  };
}

/** Por que a remoção foi recusada — estruturado, para a linha poder DIZER. */
export type RecusaRemocao = "claim_ativa";

export type RemocaoDaFila =
  | { ok: true }
  | {
      ok: false;
      motivo: RecusaRemocao;
      /** Quando a claim viva morre sozinha — a tela mostra a hora. */
      expiraEm: string;
    };

/**
 * REMOVER DA FILA — a única ação do balão, e é o `descartado` que já existe
 * (`updateLeadExtras`), não um campo novo: já reversível pela ficha, já
 * exclui o lead do pool na próxima reconstrução, e já é o que a visão da
 * /config faz.
 *
 * **O que ela acrescenta é a GUARDA.** Remover um lead que está com CLAIM
 * ATIVA não cancela o envio em andamento — o aparelho pode estar com o
 * WhatsApp aberto neste segundo, e nada do lado do servidor alcança a tela
 * dele. Então a ação é RECUSADA, com o motivo e a hora visíveis, que é a
 * mesma regra (e a mesma função, `claimAtiva`) das ações da revisão.
 * Recusa sem explicação faz o operador clicar de novo.
 *
 * Note o que a guarda NÃO promete: ela recusa o caso ÓBVIO, não é atômica
 * entre coleções. Se `/proximo` reservar o lead entre esta leitura e a
 * escrita, o descarte acontece assim mesmo — e isso já é situação prevista e
 * tratada: `POST /api/fila/confirmar` continua aceitando confirmação de lead
 * removido da fila pelo painel (o lead vira `contactado` E continua
 * `descartado`), porque recusar seria pior, deixando como não contactado
 * quem recebeu a mensagem. Uma transação aqui não mudaria nada disso: a
 * escrita é em `/leads` e a claim está em `filaEnvios`.
 *
 * `filaManual` fica INTACTO de propósito. O descarte é reversível pela
 * ficha, e restaurar um lead que o operador tinha escolhido à mão deve
 * devolvê-lo como ele estava — apagar a escolha junto seria decidir por ele.
 */
export async function removerDaFila(
  db: AppDb,
  leadId: string,
  now: Date,
): Promise<RemocaoDaFila> {
  const envio = (await db.collection(FILA_ENVIOS_COLLECTION).doc(leadId).get()).data() as
    | FilaEnvioDoc
    | undefined;
  if (claimAtiva(envio, now)) {
    return { ok: false, motivo: "claim_ativa", expiraEm: (envio as FilaEnvioDoc).expiraEm };
  }
  // `updateLeadExtras` já é 404 para lead inexistente (`modificarLead`) — um
  // leadId errado não pode plantar doc nenhum.
  await updateLeadExtras(db, leadId, { descartado: true }, now);
  return { ok: true };
}
