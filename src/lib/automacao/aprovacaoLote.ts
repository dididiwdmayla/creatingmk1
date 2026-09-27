import { ValidationError } from "@/lib/errors";
import type { AppDb } from "@/lib/firestore-like";
import { decidirAprovacaoDemo } from "@/lib/leads/repo";

import { APROVACAO_LOTE_MAX, type DecisaoLote, type ResultadoAprovacaoLote } from "./painelTipos";

export { APROVACAO_LOTE_MAX, type DecisaoLote, type ResultadoAprovacaoLote };

/**
 * Aprovar/reprovar demos automáticas EM LOTE — a ação da fila de aprovação
 * do painel "Automação". Um lote de um é a ação individual: a tela não tem
 * dois caminhos.
 *
 * Cada lead passa por `decidirAprovacaoDemo`, o MESMO caminho da rota por
 * lead (`/api/leads/[id]/demo/aprovacao`): reprovar grava
 * `automacaoReprovada` no lead (sai da automação para sempre, continua
 * disponível para demo manual), aprovar tira o portão `aguardandoAprovacao`
 * — e, com a captura ainda gerando, o lead só entra na fila quando o print
 * ficar pronto, pelo portão `capturaNaoPronta` que já existe.
 *
 * Erro de um lead (sumiu, demo manual) não derruba os outros: a resposta
 * diz o que aconteceu com cada um.
 */

export function validarLote(corpo: Record<string, unknown>): { leadIds: string[]; aprovacao: DecisaoLote } {
  const problemas: string[] = [];
  const { leadIds, aprovacao } = corpo;
  if (aprovacao !== "aprovada" && aprovacao !== "reprovada") {
    problemas.push('aprovacao deve ser "aprovada" ou "reprovada"');
  }
  if (!Array.isArray(leadIds) || leadIds.length === 0 || leadIds.some((id) => typeof id !== "string" || !id)) {
    problemas.push("leadIds deve ser uma lista não-vazia de ids");
  } else if (leadIds.length > APROVACAO_LOTE_MAX) {
    problemas.push(`no máximo ${APROVACAO_LOTE_MAX} leads por chamada`);
  }
  if (problemas.length > 0) throw new ValidationError(problemas);
  return { leadIds: [...new Set(leadIds as string[])], aprovacao: aprovacao as DecisaoLote };
}

export async function decidirAprovacaoLote(
  db: AppDb,
  leadIds: string[],
  aprovacao: DecisaoLote,
  por: string,
  now: Date = new Date(),
): Promise<ResultadoAprovacaoLote[]> {
  const resultados: ResultadoAprovacaoLote[] = [];
  for (const leadId of leadIds) {
    try {
      await decidirAprovacaoDemo(db, leadId, aprovacao, por, now);
      resultados.push({ leadId, ok: true });
    } catch (erro) {
      const mensagem =
        erro instanceof ValidationError ? erro.problemas.join("; ") : erro instanceof Error ? erro.message : String(erro);
      resultados.push({ leadId, ok: false, erro: mensagem });
    }
  }
  return resultados;
}
