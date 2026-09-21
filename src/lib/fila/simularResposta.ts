import { NotFoundError, ValidationError } from "@/lib/errors";
import type { AppConfig } from "@/lib/config";
import type { AppDb } from "@/lib/firestore-like";
import { getLead } from "@/lib/leads/repo";

import { gerarRascunhoResposta, type ContextoRascunho } from "./rascunhoResposta";

/**
 * SIMULAR MENSAGEM — o ensaio que testa a IA, e só a IA.
 *
 * Até aqui o único teste da metade "resposta" da fila era o NÚMERO DE
 * EXCEÇÃO, que exercita duas coisas ao mesmo tempo e devagar: o caminho do
 * CELULAR (notificação, macro, rota, casamento por telefone, dedupe,
 * agrupamento) e a QUALIDADE da IA (contexto do lead, documento comercial,
 * prompt). São problemas de natureza diferente e de ritmo diferente — o
 * primeiro se acerta uma vez e fica; no segundo o operador itera dezenas de
 * vezes, mudando uma linha do contexto comercial e olhando o que muda.
 *
 * Esta função separa os dois. Ela PULA a captura, o casamento de número, o
 * dedupe e a janela de agrupamento: a mensagem vem digitada na tela, e o
 * rascunho sai na hora.
 *
 * O que ela NÃO pula é a GERAÇÃO. Chama `gerarRascunhoResposta` — a mesma
 * função da produção, com a mesma montagem de prompt, a mesma reserva de
 * cota e a mesma chamada de IA. Uma cópia "para testar" provaria apenas a
 * si mesma: o que se quer exercitar aqui é o caminho REAL do rascunho, e
 * há teste comparando os dois prompts byte a byte.
 *
 * E ela NÃO ESCREVE NADA. Nem `filaRespostas` (o rascunho não vira
 * pendência de aprovação), nem `filaRespostasTarefas` (não vira tarefa de
 * envio, com `respostaAutomatica` ligada ou não), nem
 * `leads/{id}/respostas` (o lead não escreveu nada), nem o status do lead.
 * A única marca que ela deixa no banco é a RESERVA DE COTA, dentro de
 * `gerarRascunhoResposta` — porque a chamada de IA de fato aconteceu, e
 * cobrar por ela é a mesma regra de todo o resto do app.
 *
 * Isso é uma garantia mais forte que a do número de exceção, que grava o
 * rascunho com `teste: true` e depende de três filtros para não vazar
 * (`decidirAutomatica`, `listarRespostasPendentes`, `salvarRascunho`).
 * Aqui não há doc para vazar.
 */
export interface SimulacaoResposta {
  rascunho: string;
  /** O que a IA recebeu — montado por quem gerou, nunca recomputado aqui. */
  contexto: ContextoRascunho;
  leadId: string;
}

/** Limite do que o operador digita — o mesmo espírito do teto do rascunho. */
export const SIMULACAO_TEXTO_MAX = 2000;

export async function simularRespostaDeLead(
  db: AppDb,
  leadId: unknown,
  texto: unknown,
  appConfig: AppConfig,
  now: Date,
): Promise<SimulacaoResposta> {
  const problemas: string[] = [];
  if (typeof leadId !== "string" || !leadId.trim()) {
    problemas.push("leadId deve ser string não vazia");
  }
  if (typeof texto !== "string" || !texto.trim()) {
    problemas.push("texto deve ser string não vazia");
  } else if (texto.length > SIMULACAO_TEXTO_MAX) {
    problemas.push(`texto deve ter no máximo ${SIMULACAO_TEXTO_MAX} caracteres`);
  }
  if (problemas.length > 0) throw new ValidationError(problemas);

  const id = (leadId as string).trim();
  const lead = await getLead(db, id);
  // 404 explícito, e não o silêncio do flush ("lead sumiu, mensagem
  // perdida"): ali ninguém está olhando; aqui há uma pessoa esperando na
  // tela, e ela precisa saber que o placeId está errado.
  if (!lead) throw new NotFoundError(`Lead "${id}" não encontrado.`);

  // O grupo de UMA mensagem, na mesma forma que o agrupamento produziria —
  // é por isso que o prompt sai idêntico ao da produção.
  const { rascunho, contexto } = await gerarRascunhoResposta(
    db,
    lead,
    [{ texto: (texto as string).trim(), recebidoEm: now.toISOString() }],
    appConfig,
  );

  return { rascunho, contexto, leadId: id };
}
