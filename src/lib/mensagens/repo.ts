import { ValidationError } from "@/lib/errors";
import type { AppDb } from "@/lib/firestore-like";
import {
  MENSAGENS_COLLECTION,
  MENSAGEM_TEXTO_MAX,
  type ConversaResumo,
  type Mensagem,
} from "./types";

/**
 * Repositório de mensagens privadas entre usuários. Como no resto do app,
 * a coleção inteira é lida e filtrada em memória (escala de um punhado de
 * usuários trocando texto simples). TODA função de leitura recebe o userId
 * da SESSÃO e só devolve mensagens em que ele é remetente ou destinatário
 * — a privacidade é do repositório, não só da rota.
 */

function lerMensagem(id: string, data: Record<string, unknown>): Mensagem | undefined {
  const { deUserId, paraUserId, texto, criadaEm, lidaEm } = data;
  if (
    typeof deUserId !== "string" ||
    typeof paraUserId !== "string" ||
    typeof texto !== "string" ||
    typeof criadaEm !== "string"
  ) {
    return undefined; // doc malformado: ignorado, nunca quebra a listagem
  }
  return {
    id,
    deUserId,
    paraUserId,
    texto,
    criadaEm,
    ...(typeof lidaEm === "string" && { lidaEm }),
  };
}

/** Todas as mensagens em que o usuário da sessão participa. */
async function listDoUsuario(db: AppDb, userId: string): Promise<Mensagem[]> {
  const snapshot = await db.collection(MENSAGENS_COLLECTION).get();
  const mensagens: Mensagem[] = [];
  for (const doc of snapshot.docs) {
    const mensagem = lerMensagem(doc.id, doc.data());
    if (!mensagem) continue;
    if (mensagem.deUserId !== userId && mensagem.paraUserId !== userId) continue;
    mensagens.push(mensagem);
  }
  return mensagens.sort((a, b) => a.criadaEm.localeCompare(b.criadaEm));
}

/**
 * Envia texto simples de `deUserId` para `paraUserId`. Validação de
 * destinatário existente/diferente do remetente é da rota (que conhece
 * /usuarios); aqui só o texto é validado.
 */
export async function enviarMensagem(
  db: AppDb,
  deUserId: string,
  paraUserId: string,
  texto: string,
  now: Date = new Date(),
): Promise<Mensagem> {
  const limpo = texto.trim();
  if (!limpo) throw new ValidationError(["texto deve ser string não vazia"]);
  if (limpo.length > MENSAGEM_TEXTO_MAX) {
    throw new ValidationError([`texto deve ter no máximo ${MENSAGEM_TEXTO_MAX} caracteres`]);
  }

  const mensagem: Mensagem = {
    id: crypto.randomUUID(),
    deUserId,
    paraUserId,
    texto: limpo,
    criadaEm: now.toISOString(),
  };
  const { id, ...doc } = mensagem;
  await db.collection(MENSAGENS_COLLECTION).doc(id).set(doc);
  return mensagem;
}

/**
 * Conversa entre o usuário da sessão e `comUserId` (as duas direções, da
 * mais antiga pra mais nova). Com `marcarLidas`, carimba lidaEm nas
 * recebidas ainda não lidas — abrir/manter a conversa aberta (o polling
 * repete o GET) é o que conta como "ler".
 */
export async function listConversa(
  db: AppDb,
  euId: string,
  comUserId: string,
  { marcarLidas = false, now = new Date() }: { marcarLidas?: boolean; now?: Date } = {},
): Promise<Mensagem[]> {
  const minhas = await listDoUsuario(db, euId);
  const conversa = minhas.filter(
    (m) =>
      (m.deUserId === euId && m.paraUserId === comUserId) ||
      (m.deUserId === comUserId && m.paraUserId === euId),
  );

  if (marcarLidas) {
    const lidaEm = now.toISOString();
    for (const mensagem of conversa) {
      if (mensagem.paraUserId !== euId || mensagem.lidaEm) continue;
      mensagem.lidaEm = lidaEm;
      await db
        .collection(MENSAGENS_COLLECTION)
        .doc(mensagem.id)
        .set({ lidaEm }, { merge: true });
    }
  }
  return conversa;
}

/**
 * Resumo por interlocutor (última mensagem + não-lidas) para a lista de
 * conversas. `comUserIds` vem da rota (os outros usuários de /usuarios) —
 * interlocutores fora da lista (ex.: doc de usuário removido à mão) ainda
 * aparecem se houver mensagens, para nunca sumir conversa com histórico.
 */
export async function resumoConversas(
  db: AppDb,
  euId: string,
  comUserIds: string[],
): Promise<ConversaResumo[]> {
  const minhas = await listDoUsuario(db, euId);
  const porInterlocutor = new Map<string, ConversaResumo>(
    comUserIds.map((id) => [id, { comUserId: id, naoLidas: 0 }]),
  );

  for (const mensagem of minhas) {
    const comUserId = mensagem.deUserId === euId ? mensagem.paraUserId : mensagem.deUserId;
    const resumo = porInterlocutor.get(comUserId) ?? { comUserId, naoLidas: 0 };
    porInterlocutor.set(comUserId, resumo);
    resumo.ultimaMensagem = mensagem; // lista já vem ordenada da mais antiga
    if (mensagem.paraUserId === euId && !mensagem.lidaEm) resumo.naoLidas += 1;
  }

  // Conversas com mensagem mais recente primeiro; sem mensagem, no fim.
  return [...porInterlocutor.values()].sort((a, b) =>
    (b.ultimaMensagem?.criadaEm ?? "").localeCompare(a.ultimaMensagem?.criadaEm ?? ""),
  );
}

/** Total de mensagens recebidas sem lidaEm (badge de não-lidas do menu). */
export async function contarNaoLidas(db: AppDb, euId: string): Promise<number> {
  const minhas = await listDoUsuario(db, euId);
  return minhas.filter((m) => m.paraUserId === euId && !m.lidaEm).length;
}
