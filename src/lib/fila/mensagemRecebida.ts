import type { FilaConfig } from "@/lib/fila/config";
import type { AppDb } from "@/lib/firestore-like";
import { aplicarTransicao, toDoc as leadToDoc } from "@/lib/leads/repo";
import { LEADS_COLLECTION, VALID_TRANSITIONS, type Lead } from "@/lib/leads/types";
import { digitosTelefone } from "@/lib/wa";

import { adicionarMensagemAoGrupo } from "./respostasPendentes";

/**
 * O leadId RESERVADO sob o qual mensagens do NÚMERO DE EXCEÇÃO se agrupam
 * em `/filaRespostasPendentes` (ver "Número de exceção" em ARCHITECTURE.md)
 * — mesmo espírito de `LEAD_TESTE_ID` (`lib/fila/leadTeste.ts`): uma forma
 * que NUNCA colide com um placeId real do Google (`ChIJ…`) nem com o lead
 * fixo de teste, então o grupo de exceção nunca se mistura com o grupo
 * pendente de um lead de verdade.
 *
 * Precisa ser um id PRÓPRIO, e não `leadContextoExcecao` direto: o lead de
 * contexto pode estar, ao MESMO TEMPO, recebendo mensagens de verdade pelo
 * número dele — usar o mesmo doc de `/filaRespostasPendentes` misturaria as
 * duas conversas num grupo só.
 */
export const EXCECAO_GRUPO_ID = "radar-excecao-resposta";

/**
 * Log das mensagens vindas do NÚMERO DE EXCEÇÃO — coleção PRÓPRIA, nunca
 * `leads/{leadContextoExcecao}/respostas`: aquela subcoleção é o histórico
 * PERMANENTE de um lead real, e uma mensagem de ensaio ali sujaria a
 * conversa de um negócio que nunca escreveu nada. Existe só para o dedupe
 * por `chave` funcionar do mesmo jeito (id do doc = chave, de graça).
 */
export const FILA_EXCECAO_LOG_COLLECTION = "filaExcecaoLog";

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

async function respostaExcecaoJaRegistrada(db: AppDb, chave: string): Promise<boolean> {
  const snap = await db.collection(FILA_EXCECAO_LOG_COLLECTION).doc(idResposta(chave)).get();
  return snap.exists;
}

/** Mesmo formato do log real (`gravarResposta`), sem `leadId`: esta mensagem não é de lead nenhum. */
async function gravarRespostaExcecao(
  db: AppDb,
  corpo: CorpoMensagemRecebida,
  now: Date,
): Promise<void> {
  await db
    .collection(FILA_EXCECAO_LOG_COLLECTION)
    .doc(idResposta(corpo.chave))
    .set({
      texto: corpo.texto,
      canal: corpo.canal,
      recebidoEm: corpo.recebidoEm,
      criadoEm: now.toISOString(),
    });
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
 * Processa uma notificação vinda do NÚMERO DE EXCEÇÃO (`config/fila.
 * numeroExcecao`) — ver "Número de exceção" em ARCHITECTURE.md. Mesmo
 * dedupe por `chave` do caminho real, mas em tudo o mais é deliberadamente
 * MENOS: log em coleção PRÓPRIA (nunca `leads/{id}/respostas`, que é
 * histórico permanente de um lead de verdade), sem tocar status de lead
 * nenhum, e agrupada sob `EXCECAO_GRUPO_ID` — nunca sob o `leadContextoExcecao`
 * escolhido, que pode estar recebendo mensagem de verdade ao mesmo tempo.
 *
 * Quem decide o que gerar a partir daqui é o FLUSH (`flushRespostas.ts`):
 * este módulo só REGISTRA e AGRUPA, exatamente como faz para um lead real.
 */
async function processarMensagemExcecao(
  db: AppDb,
  corpo: CorpoMensagemRecebida,
  now: Date,
): Promise<ResultadoMensagemRecebida> {
  if (await respostaExcecaoJaRegistrada(db, corpo.chave)) {
    return { processada: false, motivo: "chave_repetida" };
  }

  await gravarRespostaExcecao(db, corpo, now);
  await adicionarMensagemAoGrupo(
    db,
    EXCECAO_GRUPO_ID,
    { texto: corpo.texto, recebidoEm: corpo.recebidoEm },
    now,
  );

  return { processada: true };
}

/**
 * Processa UMA notificação: canal → exceção OU lead → dedupe → registro (log
 * permanente em `leads/{leadId}/respostas/{chave}`, transição de status, e
 * entrada no grupo de agrupamento — ver `respostasPendentes.ts`).
 *
 * **O casamento com o número de exceção vem ANTES do casamento com lead**,
 * de propósito: é config explícita do admin, e deve vencer mesmo na
 * coincidência remota de `numeroExcecao` bater com o telefone de um lead
 * real. `filaConfig.numeroExcecao` vazio (o padrão) pula esta checagem
 * inteira — comportamento IDÊNTICO ao de antes deste bloco existir.
 *
 * `chave` como o próprio ID do doc de log é o que dá o dedupe de graça:
 * chave repetida encontra o doc já existente e devolve `chave_repetida` sem
 * tocar em mais nada (nem status, nem grupo pendente) — "sem reprocessar" é
 * literal, nos dois caminhos.
 */
export async function processarMensagemRecebida(
  db: AppDb,
  corpo: CorpoMensagemRecebida,
  now: Date,
  filaConfig: FilaConfig,
): Promise<ResultadoMensagemRecebida> {
  if (corpo.canal !== CANAL_INDIVIDUAL) {
    return { processada: false, motivo: "canal_grupo" };
  }

  const remetenteDigitos = digitosTelefone(corpo.remetente);

  if (filaConfig.numeroExcecao && remetenteDigitos === digitosTelefone(filaConfig.numeroExcecao)) {
    return processarMensagemExcecao(db, corpo, now);
  }

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
