import type { AppConfig } from "@/lib/config";
import type { AppDb } from "@/lib/firestore-like";
import { getLead } from "@/lib/leads/repo";
import type { Lead } from "@/lib/leads/types";
import { digitosTelefone } from "@/lib/wa";

import type { FilaConfig } from "./config";
import { FILA_RESPOSTAS_COLLECTION, type FilaRespostaDoc } from "./estado";
import { gerarRascunhoResposta } from "./rascunhoResposta";
import { criarTarefaResposta, sortearAtrasoSegundos } from "./respostaAutomatica";
import {
  listarGruposPendentes,
  reivindicarGrupoMaduro,
  restaurarGrupoComErro,
  type GrupoPendenteDoc,
  type MensagemGrupo,
} from "./respostasPendentes";

/**
 * A FORMA do rascunho (`filaRespostas/{id}`, coleção PRÓPRIA — não
 * `filaEnvios`, que é doc por leadId e carrega o estado do ENVIO real
 * daquele lead; aqui pode haver várias entradas por lead ao longo do tempo,
 * uma por grupo de mensagens) mora em `estado.ts`, pelo mesmo motivo de
 * `FilaEnvioDoc`: quem desenha o painel é componente client e este módulo lê
 * o Firestore. Reexportada daqui para ninguém precisar saber da divisão.
 */
export {
  FILA_RESPOSTAS_COLLECTION,
  RASCUNHO_ESTADOS,
  type FilaRespostaDoc,
  type RascunhoEstado,
} from "./estado";

/**
 * O rascunho entra no caminho AUTOMÁTICO? Os dois interruptores decidem
 * aqui, uma vez, no instante da geração:
 *
 * - `respostaAutomatica` desligada (o padrão) → nunca, e nem se pergunta o
 *   resto.
 * - `respostaAutomaticaApenasPrimeira` ligada (o padrão) → só se este for o
 *   PRIMEIRO rascunho daquele lead. A primeira resposta é quase sempre a
 *   mesma pergunta; da segunda em diante já é negociação, e negociar sozinho
 *   é outro risco.
 *
 * O custo do "é a primeira?" é uma varredura de `filaRespostas` — a mesma
 * que o painel paga, e aceitável pelo mesmo motivo: acontece quando um lead
 * RESPONDE (algumas vezes por dia), não a cada ciclo do aparelho.
 */
async function decidirAutomatica(
  db: AppDb,
  leadId: string,
  filaConfig: FilaConfig,
): Promise<boolean> {
  if (!filaConfig.respostaAutomatica) return false;
  if (!filaConfig.respostaAutomaticaApenasPrimeira) return true;

  const snap = await db.collection(FILA_RESPOSTAS_COLLECTION).get();
  return !snap.docs.some((doc) => (doc.data() as unknown as FilaRespostaDoc).leadId === leadId);
}

/**
 * Grava o rascunho e, quando os interruptores permitem, a TAREFA que o
 * aparelho vai puxar (`respostaAutomatica.ts`). O rascunho é gravado
 * SEMPRE: ele é o registro; a tarefa é só o caminho automático.
 *
 * Duas razões para um rascunho não virar tarefa:
 *
 * - **os interruptores** (ver `decidirAutomatica`);
 * - **lead sem telefone** — não há conversa para abrir, e a tarefa nasceria
 *   impossível de cumprir. O rascunho fica no painel, onde uma pessoa
 *   decide o que fazer.
 *
 * O ATRASO é sorteado aqui, uma vez por resposta, e vira `disponivelEm` na
 * tarefa: o aparelho não sabe de atraso nenhum — ele pergunta, e a tarefa
 * está lá ou não está.
 */
async function salvarRascunho(
  db: AppDb,
  lead: Lead,
  mensagens: MensagemGrupo[],
  rascunho: string,
  now: Date,
  filaConfig: FilaConfig,
): Promise<void> {
  // A decisão vem ANTES da gravação: `decidirAutomatica` pergunta se este
  // lead já tem rascunho, e o rascunho que está nascendo agora responderia
  // "já tem" a si mesmo.
  const automatica = await decidirAutomatica(db, lead.placeId, filaConfig);

  const id = crypto.randomUUID();
  const doc: FilaRespostaDoc = {
    id,
    leadId: lead.placeId,
    mensagens,
    rascunho,
    geradoEm: now.toISOString(),
    estado: "pendente",
  };
  await db.collection(FILA_RESPOSTAS_COLLECTION).doc(id).set({ ...doc });

  if (!automatica) return;

  // Mesma precedência de `montarMensagemParaLead` (o enriquecido vence o da
  // busca), com `digitosTelefone` normalizando para dígitos puros com DDI.
  const numero = digitosTelefone(lead.detalhes?.telefoneIntl ?? lead.telefoneIntl ?? "");
  if (!numero) return;

  await criarTarefaResposta(
    db,
    {
      id,
      leadId: lead.placeId,
      numero,
      texto: rascunho,
      atrasoSegundos: sortearAtrasoSegundos(
        filaConfig.respostaDelayMinSegundos,
        filaConfig.respostaDelayMaxSegundos,
      ),
    },
    now,
  );
}

/**
 * Processa UM grupo já reivindicado (`reivindicarGrupoMaduro` já tirou as
 * mensagens do pendente): gera o rascunho e grava em `filaRespostas`, ou —
 * em qualquer falha — devolve as mensagens ao grupo pendente marcadas com o
 * erro (`restaurarGrupoComErro`), retentável no próximo flush.
 *
 * Este `try/catch` é o ISOLAMENTO: nada daqui propaga para quem chamou
 * `flushGruposMaduros` — falha na geração de UM grupo nunca pode impedir os
 * outros grupos maduros de serem processados, nem a resposta de
 * `/api/fila/proximo` ou `/api/fila/mensagem-recebida`.
 */
async function processarGrupoReivindicado(
  db: AppDb,
  claim: GrupoPendenteDoc,
  now: Date,
  filaConfig: FilaConfig,
  appConfig: AppConfig,
): Promise<void> {
  try {
    const lead = await getLead(db, claim.leadId);
    // Lead sumiu no meio do caminho (nunca deveria acontecer — leads não são
    // apagados neste app): sem para onde gerar o rascunho, as mensagens do
    // claim se perdem aqui mesmo, de propósito (não há destino válido).
    if (!lead) return;

    const rascunho = await gerarRascunhoResposta(db, lead, claim.mensagens, appConfig);
    await salvarRascunho(db, lead, claim.mensagens, rascunho, now, filaConfig);
  } catch (error) {
    const motivo = error instanceof Error ? error.message : "falha desconhecida na geração do rascunho";
    await restaurarGrupoComErro(db, claim, motivo);
  }
}

/**
 * Varre `/filaRespostasPendentes` e libera todo grupo que já venceu a
 * janela de silêncio (`respostaAgrupamentoSegundos`) — chamado no INÍCIO de
 * `GET /api/fila/proximo` e de `POST /api/fila/mensagem-recebida` (ver os
 * dois route handlers): como a fila não tem cron nem fila de jobs, é a
 * frequência de chamada dessas duas rotas que garante que nenhum grupo fica
 * preso (a janela é sempre menor que o intervalo de polling do celular).
 *
 * ISOLAMENTO OBRIGATÓRIO: esta função NUNCA lança. Cada grupo é processado
 * em `processarGrupoReivindicado`, que já isola a própria falha; o `try`
 * aqui fora é uma segunda camada, para um erro na PRÓPRIA listagem/claim
 * (ex.: Firestore fora do ar) também não derrubar quem chamou.
 */
export async function flushGruposMaduros(
  db: AppDb,
  now: Date,
  filaConfig: FilaConfig,
  appConfig: AppConfig,
): Promise<void> {
  try {
    const pendentes = await listarGruposPendentes(db);
    for (const pendente of pendentes) {
      const claim = await reivindicarGrupoMaduro(
        db,
        pendente.leadId,
        now,
        filaConfig.respostaAgrupamentoSegundos,
      );
      if (!claim) continue;
      await processarGrupoReivindicado(db, claim, now, filaConfig, appConfig);
    }
  } catch {
    // Isolamento de última linha — ver o comentário da função. Sem `texto`
    // nenhum aqui: nada neste catch tem acesso ao corpo de uma mensagem.
  }
}
