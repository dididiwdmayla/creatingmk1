import { loadConfig } from "@/lib/config";
import type { AppDb } from "@/lib/firestore-like";
import { updateLeadExtras } from "@/lib/leads/repo";

import { lerPoolBruto } from "./candidatos";
import { loadFilaConfig } from "./config";
import { lerContadorFila } from "./contadores";
import { FILA_ENVIOS_COLLECTION } from "./envios";
import {
  claimAtiva,
  type ContadorPainel,
  type FilaEnvioDoc,
  type LinhaFilaPainel,
  type LinhaPendenteManual,
} from "./estado";
import { contadorDoPainel, linhasDoPainel, linhasPendentesManuais } from "./painel";
import { motivoDeRitmo, niveisAceitos, ordenarCandidatos, type MotivoSemTarefa } from "./selecao";

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
 * - **ABERTO (`montarBalaoFila`) — 4 leituras de doc + 1 por linha
 *   mostrada**: as 2 acima, mais `config/app` (as janelas de contato, que a
 *   seleção precisa) e o doc do pool. Depois, uma leitura POR ID de cada
 *   lead que a tela mostra — no máximo `BALAO_LINHAS` da fila mais
 *   `BALAO_PENDENTES` — pelo mesmo motivo do painel da /config: as entradas
 *   do pool são compactas de propósito e não carregam nome. Teto de 19
 *   leituras, e só no clique que abre.
 *
 * **Nunca reconstrói o pool** (`lerPoolBruto`, sem TTL): a varredura de
 * `/leads` é o custo que o pool existe para evitar, e um indicador global
 * não pode ser quem o paga. A consequência é assumida e fica NA TELA — o
 * retrato do pool vem datado.
 *
 * **NADA aqui dispara envio.** Quem entrega continua sendo o ciclo do
 * aparelho consumindo `GET /api/fila/proximo`; o balão só mostra o que ele
 * vai encontrar quando pedir.
 *
 * **A ordem é a de `ordenarCandidatos`**, nunca uma reimplementação: é a
 * mesma função que `/proximo` e o painel da /config usam. Três telas com
 * três ordenações seriam três verdades sobre quem é o próximo.
 */

/** Quantos leads da fila o balão aberto mostra — e, portanto, quantos docs lê. */
export const BALAO_LINHAS = 10;

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

/** O estado ABERTO: o resumo mais as duas listas. */
export interface BalaoFila extends ResumoBalao {
  /**
   * A sequência na ordem em que os leads SERÃO ENTREGUES — o que o aparelho
   * vai encontrar quando pedir a próxima tarefa.
   */
  fila: LinhaFilaPainel[];
  /** Quantos elegíveis existem ao todo (a lista acima é uma janela sobre a fila). */
  elegiveis: number;
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
 * O estado ABERTO. Acrescenta ao resumo as duas listas que o operador abriu
 * o balão para ver.
 *
 * O ritmo NÃO impede de calcular a fila, de propósito: "pausada e com 6 na
 * fila" e "pausada e vazia" são situações diferentes, e quem abre o balão
 * com a fila pausada está justamente perguntando o que vai sair quando ela
 * voltar. Mesma escolha deliberada de `decidirFila`.
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
    return {
      ...resumo,
      fila: [],
      elegiveis: 0,
      pendentes: [],
      pendentesTotal: 0,
      poolGeradoEm: null,
    };
  }

  const app = await loadConfig(db);
  // A MESMA função de `/proximo` e do painel. `coletarBloqueados` fica
  // desligado: o balão mostra quem VAI SAIR, e montar a lista de quem está
  // parado na janela custaria memória para ninguém ler.
  const { escolhido } = ordenarCandidatos(pool.candidatos, config, app.janelasContato, now);

  const [fila, pendentes] = await Promise.all([
    linhasDoPainel(db, pool.candidatos, escolhido.slice(0, BALAO_LINHAS), {
      janelas: app.janelasContato,
      niveisAceitos: niveisAceitos(config),
      now,
      // Todo mundo desta lista está em janela AGORA; "quando entra" é
      // pergunta de quem está bloqueado, e o balão não mostra bloqueados.
      comProximaFaixa: false,
    }),
    linhasPendentesManuais(db, pool.manuaisPendentes.slice(0, BALAO_PENDENTES)),
  ]);

  return {
    ...resumo,
    fila,
    elegiveis: escolhido.length,
    pendentes,
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
 * mesma regra (e a mesma função, `claimAtiva`) da liberação manual de um
 * retido. Recusa sem explicação faz o operador clicar de novo.
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
  // `updateLeadExtras` já é 404 para lead inexistente (`requireLead`) — um
  // leadId errado não pode plantar doc nenhum.
  await updateLeadExtras(db, leadId, { descartado: true }, now);
  return { ok: true };
}
