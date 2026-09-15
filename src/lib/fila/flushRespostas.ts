import type { AppConfig } from "@/lib/config";
import type { AppDb } from "@/lib/firestore-like";
import { getLead } from "@/lib/leads/repo";

import type { FilaConfig } from "./config";
import { gerarRascunhoResposta } from "./rascunhoResposta";
import {
  listarGruposPendentes,
  reivindicarGrupoMaduro,
  restaurarGrupoComErro,
  type GrupoPendenteDoc,
  type MensagemGrupo,
} from "./respostasPendentes";

/**
 * `filaRespostas/{id}` — o RASCUNHO gerado para um grupo maduro. Coleção
 * PRÓPRIA (não `filaEnvios`, que é doc por leadId e carrega o estado do
 * ENVIO real daquele lead): aqui pode haver várias entradas por lead ao
 * longo do tempo (uma por grupo de mensagens), cada uma com id próprio.
 */
export const FILA_RESPOSTAS_COLLECTION = "filaRespostas";

export const RASCUNHO_ESTADOS = ["pendente", "usada", "descartada"] as const;
export type RascunhoEstado = (typeof RASCUNHO_ESTADOS)[number];

export interface FilaRespostaDoc {
  id: string;
  leadId: string;
  mensagens: MensagemGrupo[];
  rascunho: string;
  geradoEm: string;
  estado: RascunhoEstado;
}

async function salvarRascunho(
  db: AppDb,
  leadId: string,
  mensagens: MensagemGrupo[],
  rascunho: string,
  now: Date,
): Promise<void> {
  const id = crypto.randomUUID();
  const doc: FilaRespostaDoc = {
    id,
    leadId,
    mensagens,
    rascunho,
    geradoEm: now.toISOString(),
    estado: "pendente",
  };
  await db.collection(FILA_RESPOSTAS_COLLECTION).doc(id).set({ ...doc });
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
  appConfig: AppConfig,
): Promise<void> {
  try {
    const lead = await getLead(db, claim.leadId);
    // Lead sumiu no meio do caminho (nunca deveria acontecer — leads não são
    // apagados neste app): sem para onde gerar o rascunho, as mensagens do
    // claim se perdem aqui mesmo, de propósito (não há destino válido).
    if (!lead) return;

    const rascunho = await gerarRascunhoResposta(db, lead, claim.mensagens, appConfig);
    await salvarRascunho(db, claim.leadId, claim.mensagens, rascunho, now);
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
      await processarGrupoReivindicado(db, claim, now, appConfig);
    }
  } catch {
    // Isolamento de última linha — ver o comentário da função. Sem `texto`
    // nenhum aqui: nada neste catch tem acesso ao corpo de uma mensagem.
  }
}
