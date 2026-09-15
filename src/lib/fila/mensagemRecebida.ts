import type { AppDb } from "@/lib/firestore-like";
import { aplicarTransicao, toDoc as leadToDoc } from "@/lib/leads/repo";
import { LEADS_COLLECTION, VALID_TRANSITIONS, type Lead } from "@/lib/leads/types";
import { digitosTelefone } from "@/lib/wa";

import { adicionarMensagemAoGrupo } from "./respostasPendentes";

/**
 * `POST /api/fila/mensagem-recebida` — o terceiro pilar da fila: a macro do
 * MacroDroid captura cada notificação do WhatsApp Business no celular
 * PESSOAL do operador e manda para cá. Este módulo é o CASAMENTO com o lead
 * e o REGISTRO; o agrupamento em rascunho fica em `respostasPendentes.ts` +
 * `flushRespostas.ts`.
 *
 * PRIVACIDADE — REQUISITO DE SEGURANÇA, NÃO DE EFICIÊNCIA: o aparelho manda
 * TODA notificação do WhatsApp Business, inclusive de conversas que não são
 * prospecção. Sem lead correspondente ou canal de grupo, descarta em
 * silêncio — nada é persistido, nada entra na fila de rascunho. E NUNCA
 * logar `corpo.texto`, em nenhum caminho, nem em erro: um log de exceção com
 * o corpo da requisição colocaria mensagem privada do operador no log da
 * Vercel. Precisando logar falha, logue só a chave e o motivo — nunca o
 * texto.
 */

/**
 * Canal de notificação do WhatsApp Business para conversa INDIVIDUAL, tal
 * como o MacroDroid captura no aparelho (comportamento testado no celular,
 * não suposto). Comparação por IGUALDADE (whitelist) em vez de tentar
 * reconhecer todo formato de canal de GRUPO: o aparelho só manda os canais
 * que o Android de fato usa, e uma lista de permissão erra para o lado
 * seguro (descarta o que não reconhece) — o mesmo espírito da privacidade
 * acima.
 */
export const CANAL_INDIVIDUAL = "individual_chat_defaults_1";

export interface CorpoMensagemRecebida {
  remetente: string;
  texto: string;
  canal: string;
  /**
   * Carimbo DA NOTIFICAÇÃO, capturado UMA VEZ no aparelho — NUNCA o instante
   * da chamada HTTP. Contrato com o lado do aparelho: se a macro reenviar
   * após queda de rede com um `recebidoEm` novo, a `chave` (que inclui este
   * campo) mudaria e o dedupe falharia justamente no caso em que ele existe
   * para proteger.
   */
  recebidoEm: string;
  /** Hash estável da notificação original — dedupe usa isto, não `recebidoEm` sozinho. */
  chave: string;
}

export type MotivoDescarte = "canal_grupo" | "sem_lead" | "chave_repetida";

export interface ResultadoMensagemRecebida {
  processada: boolean;
  motivo?: MotivoDescarte;
}

function respostasCollection(leadId: string): string {
  return `leads/${leadId}/respostas`;
}

/** Doc ID seguro para `chave` — Firestore não aceita "/" (nem alguns outros) no id do documento. */
function idResposta(chave: string): string {
  return encodeURIComponent(chave);
}

async function respostaJaRegistrada(db: AppDb, leadId: string, chave: string): Promise<boolean> {
  const snap = await db.collection(respostasCollection(leadId)).doc(idResposta(chave)).get();
  return snap.exists;
}

async function gravarResposta(
  db: AppDb,
  leadId: string,
  corpo: CorpoMensagemRecebida,
  now: Date,
): Promise<void> {
  await db
    .collection(respostasCollection(leadId))
    .doc(idResposta(corpo.chave))
    .set({
      leadId,
      texto: corpo.texto,
      canal: corpo.canal,
      recebidoEm: corpo.recebidoEm,
      criadoEm: now.toISOString(),
    });
}

/**
 * Casa o remetente (dígitos puros com DDI) com o telefone do lead — MESMA
 * precedência de `montarMensagemParaLead` (`detalhes.telefoneIntl`,
 * enriquecido, vence o `telefoneIntl` da busca), reaproveitando
 * `digitosTelefone` em vez de normalizar de novo. Varredura completa de
 * `/leads`, mesmo espírito de `listLeads`/`construirPool`: dezenas ou
 * centenas de docs, não milhões.
 */
async function encontrarLeadPorTelefone(
  db: AppDb,
  remetenteDigitos: string,
): Promise<Lead | undefined> {
  const snapshot = await db.collection(LEADS_COLLECTION).get();
  for (const doc of snapshot.docs) {
    const lead = doc.data() as unknown as Lead;
    const telefoneCru = lead.detalhes?.telefoneIntl ?? lead.telefoneIntl;
    if (telefoneCru && digitosTelefone(telefoneCru) === remetenteDigitos) {
      return lead;
    }
  }
  return undefined;
}

/**
 * Transição de status: SOMENTE de "contactado" para "respondeu" — reusa
 * `VALID_TRANSITIONS` em vez de checar `lead.status === "contactado"` à mão
 * (só "contactado" tem "respondeu" na própria lista de destinos válidos, e é
 * essa checagem que já impede rebaixar "fechado" ou regravar "respondeu").
 * Fora desse caso (novo, respondeu, fechado), a mensagem é registrada sem
 * mexer no status.
 */
async function avancarParaRespondeuSeAplicavel(db: AppDb, lead: Lead, now: Date): Promise<void> {
  if (!VALID_TRANSITIONS[lead.status].includes("respondeu")) return;
  const atualizado = aplicarTransicao(lead, "respondeu", now);
  await db.collection(LEADS_COLLECTION).doc(lead.placeId).set(leadToDoc(atualizado));
}

/**
 * Processa UMA notificação: canal → lead → dedupe → registro (log
 * permanente em `leads/{leadId}/respostas/{chave}`, transição de status, e
 * entrada no grupo de agrupamento — ver `respostasPendentes.ts`).
 *
 * `chave` como o próprio ID do doc de log é o que dá o dedupe de graça:
 * chave repetida encontra o doc já existente e devolve `chave_repetida` sem
 * tocar em mais nada (nem status, nem grupo pendente) — "sem reprocessar" é
 * literal.
 */
export async function processarMensagemRecebida(
  db: AppDb,
  corpo: CorpoMensagemRecebida,
  now: Date,
): Promise<ResultadoMensagemRecebida> {
  if (corpo.canal !== CANAL_INDIVIDUAL) {
    return { processada: false, motivo: "canal_grupo" };
  }

  const remetenteDigitos = digitosTelefone(corpo.remetente);
  const lead = await encontrarLeadPorTelefone(db, remetenteDigitos);
  if (!lead) {
    return { processada: false, motivo: "sem_lead" };
  }

  if (await respostaJaRegistrada(db, lead.placeId, corpo.chave)) {
    return { processada: false, motivo: "chave_repetida" };
  }

  await gravarResposta(db, lead.placeId, corpo, now);
  await avancarParaRespondeuSeAplicavel(db, lead, now);
  await adicionarMensagemAoGrupo(
    db,
    lead.placeId,
    { texto: corpo.texto, recebidoEm: corpo.recebidoEm },
    now,
  );

  return { processada: true };
}
