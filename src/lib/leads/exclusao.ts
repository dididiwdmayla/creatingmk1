import {
  removerCapturasDoLead,
  removerImagensDoLead,
  type DemoStorage,
} from "@/lib/demos/imagens";
import { FILA_ENVIOS_COLLECTION } from "@/lib/fila/envios";
import type { AppDb } from "@/lib/firestore-like";

import { LEADS_COLLECTION } from "./types";

/**
 * A EXCLUSÃO DEFINITIVA DE UM LEAD — a única no app que destrói o doc de
 * `/leads`, e por isso tem arquivo próprio.
 *
 * Todo o resto do sistema apaga em volta do lead e nunca o lead: "Excluir
 * demo" tira só o campo `demo` (`deleteDemo`), "Apagar todas do grupo" faz
 * isso em lote, `descartado` é descarte SUAVE e reversível pela ficha. Este
 * caminho é o oposto de todos eles, e existe por um motivo só: o lead
 * antigo sem vestígio nenhum de contato, que o operador revisou na tela de
 * `/config` e decidiu que não vale guardar (ver `semVestigio.ts`).
 *
 * **O QUE ELA DESTRÓI** — a lista completa, porque a confirmação na tela
 * cita esta mesma lista e as duas não podem divergir:
 *
 * 1. **A rota pública `/demo/{leadId}` passa a dar 404.** Se o link já foi
 *    compartilhado, quem tiver o link vê página morta. É por isso que a
 *    tela de revisão traz a coluna "demo aberta por fora" — quem abriu já é
 *    evidência de que há um link circulando.
 * 2. **As capturas e as imagens de demo saem do Storage junto.** Ver a
 *    decisão abaixo.
 * 3. **A penetração por nicho/cidade muda**, porque ela agrega o `temSite`
 *    salvo de cada lead do grupo (`lib/leads/penetracao.ts`). O cache em
 *    `/buscas/{id}.penetracao` NÃO é recalculado aqui — ele já é, por
 *    desenho, "o agregado de quando aquela busca rodou por último", e
 *    recalcular exigiria uma varredura de `/leads` por busca afetada,
 *    deixando as buscas irmãs defasadas do mesmo jeito. O número volta a
 *    ficar certo na próxima vez que a busca rodar.
 * 4. **O doc em `filaEnvios` é removido junto**, senão fica lixo apontando
 *    para lead inexistente — um doc de claim órfão que a varredura dos
 *    retidos e a das pendências de print continuariam lendo para sempre,
 *    com nome vazio.
 *
 * **POR QUE O STORAGE VAI JUNTO, aqui e não no "Excluir demo".** As rotas
 * de demo deixam órfão de propósito ("arquivo órfão custa centavos; demo
 * meio-apagada confunde") — mas lá o LEAD CONTINUA, e a próxima geração
 * sobrescreve o mesmo prefixo. Aqui o dono do arquivo deixa de existir:
 * `demos/{leadId}/` e `capturas/{leadId}/` viram bytes que nenhum caminho
 * do app pode voltar a alcançar, pagos todo mês, para sempre. Nada os
 * regenera porque não há mais lead.
 *
 * O que É copiado daquelas rotas é a ORDEM e a tolerância: a limpeza vem
 * DEPOIS do doc apagado e **nunca derruba a operação** — falha vira log e
 * um contador na resposta. Doc apagado com arquivo sobrando é órfão;
 * arquivo apagado com doc de pé seria demo quebrada, que é pior.
 */

export interface ResultadoExclusao {
  /** Docs de `/leads` de fato apagados. */
  excluidos: number;
  /** Quantos deles tinham doc em `filaEnvios` levado junto. */
  filaEnviosRemovidos: number;
  /**
   * Em quantos a limpeza do Storage falhou. Não é erro da operação (o lead
   * já foi), mas some da tela seria esconder custo que continua correndo.
   */
  storageFalhou: number;
}

/**
 * Apaga UM lead e tudo que só existia por causa dele. Idempotente: id
 * inexistente não é erro (duas abas do painel podem mandar o mesmo lote), e
 * o doc de `filaEnvios` ausente também não.
 *
 * `storage` entra por parâmetro, na interface estrutural mínima
 * `DemoStorage`, pelo mesmo motivo das rotas de imagem: é o que deixa o
 * teste cobrar a limpeza com um fake em memória, sem bucket nenhum.
 */
export async function excluirLeadDefinitivo(
  db: AppDb,
  storage: DemoStorage,
  leadId: string,
): Promise<{ excluido: boolean; filaEnvioRemovido: boolean; storageFalhou: boolean }> {
  const leadRef = db.collection(LEADS_COLLECTION).doc(leadId);
  const existe = (await leadRef.get()).exists;
  if (!existe) return { excluido: false, filaEnvioRemovido: false, storageFalhou: false };

  const envioRef = db.collection(FILA_ENVIOS_COLLECTION).doc(leadId);
  const tinhaEnvio = (await envioRef.get()).exists;

  // Os dois docs primeiro, e nesta ordem: o lead é o que a tela pública lê,
  // então ele some antes; o doc da fila é o lixo que ficaria apontando pra
  // ele. Se a segunda falhar, o erro sobe e o operador vê — um doc de claim
  // órfão é estado que mente, não centavo de arquivo esquecido.
  await leadRef.delete();
  if (tinhaEnvio) await envioRef.delete();

  let storageFalhou = false;
  try {
    await Promise.all([
      removerImagensDoLead(storage, leadId),
      removerCapturasDoLead(storage, leadId),
    ]);
  } catch (error) {
    storageFalhou = true;
    console.error("[radar] falha ao limpar o Storage do lead excluído:", leadId, error);
  }

  return { excluido: true, filaEnvioRemovido: tinhaEnvio, storageFalhou };
}

/**
 * O lote. Sequencial, e não `Promise.all`: são dezenas de exclusões
 * definitivas contra o mesmo banco, e paralelizar destruição só troca
 * tempo de parede por um pico de escrita e por um erro no meio que deixa
 * um subconjunto imprevisível apagado. Sequencial, o que passou passou, na
 * ordem em que veio.
 */
export async function excluirLeadsDefinitivo(
  db: AppDb,
  storage: DemoStorage,
  leadIds: string[],
): Promise<ResultadoExclusao> {
  const total: ResultadoExclusao = { excluidos: 0, filaEnviosRemovidos: 0, storageFalhou: 0 };
  for (const leadId of leadIds) {
    const r = await excluirLeadDefinitivo(db, storage, leadId);
    if (r.excluido) total.excluidos += 1;
    if (r.filaEnvioRemovido) total.filaEnviosRemovidos += 1;
    if (r.storageFalhou) total.storageFalhou += 1;
  }
  return total;
}
