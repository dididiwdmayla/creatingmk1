import type { AppDb } from "@/lib/firestore-like";

import type { MensagemGrupo } from "./estado";

/**
 * `/filaRespostasPendentes/{leadId}` — o GRUPO EM ABERTO de mensagens de um
 * lead, acumulando enquanto a janela de silêncio (`respostaAgrupamentoSegundos`
 * em `config/fila`) não vence. Coleção PRÓPRIA e pequena por natureza (só
 * conversas com mensagem recente ainda não rascunhada) — ler a coleção
 * INTEIRA a cada flush (ver `flushRespostas.ts`) é barato, mesmo espírito de
 * `/filaEnvios`.
 *
 * Existe separado de `leads/{leadId}/respostas` (o log individual de cada
 * mensagem, gravado por `mensagemRecebida.ts`) porque os dois têm ciclos de
 * vida diferentes: o log é permanente (auditoria), o grupo pendente morre
 * assim que o rascunho é gerado. Também é o que permite achar, a partir de
 * QUALQUER rota (`/proximo` ou `/mensagem-recebida`), quais leads têm grupo
 * maduro sem varrer `/leads` inteira.
 */
export const FILA_RESPOSTAS_PENDENTES_COLLECTION = "filaRespostasPendentes";

/**
 * Reexportado de `estado.ts`, e não declarado aqui, pelo mesmo motivo de
 * `PendenciaEnvio`: quem DESENHA a lista de respostas pendentes (/config) é
 * componente client, e este módulo lê o Firestore. O tipo mora no módulo
 * sem servidor; ninguém precisa saber da divisão.
 */
export type { MensagemGrupo } from "./estado";

export interface GrupoPendenteDoc {
  leadId: string;
  /** Vazio = grupo já reivindicado (ver `reivindicarGrupoMaduro`) e ainda sem mensagem nova. */
  mensagens: MensagemGrupo[];
  primeiraMensagemEm: string;
  ultimaMensagemEm: string;
  tentativas: number;
  ultimoErro: string | null;
}

function docRef(db: AppDb, leadId: string) {
  return db.collection(FILA_RESPOSTAS_PENDENTES_COLLECTION).doc(leadId);
}

function asDoc(data: Record<string, unknown> | undefined): GrupoPendenteDoc | undefined {
  return data as GrupoPendenteDoc | undefined;
}

function toDoc(doc: GrupoPendenteDoc): Record<string, unknown> {
  return { ...doc };
}

/**
 * Adiciona uma mensagem ao grupo em aberto do lead — cria o grupo se não
 * existir, ou anexa e REABRE a janela (`ultimaMensagemEm` avança) se já
 * existir. Transacional: a leitura-modificação-escrita precisa ser atômica
 * porque um flush concorrente pode estar reivindicando o MESMO doc (ver
 * `reivindicarGrupoMaduro`) — sem transação, um `set` sem `merge` perderia
 * a mensagem que está sendo adicionada agora.
 */
export async function adicionarMensagemAoGrupo(
  db: AppDb,
  leadId: string,
  mensagem: MensagemGrupo,
  now: Date,
): Promise<void> {
  await db.runTransaction(async (tx) => {
    const atual = asDoc((await tx.get(docRef(db, leadId))).data());
    const doc: GrupoPendenteDoc = atual
      ? {
          ...atual,
          mensagens: [...atual.mensagens, mensagem],
          ultimaMensagemEm: now.toISOString(),
        }
      : {
          leadId,
          mensagens: [mensagem],
          primeiraMensagemEm: now.toISOString(),
          ultimaMensagemEm: now.toISOString(),
          tentativas: 0,
          ultimoErro: null,
        };
    tx.set(docRef(db, leadId), toDoc(doc));
  });
}

/**
 * Todos os grupos pendentes agora — leitura da coleção INTEIRA (ver o
 * comentário do topo do arquivo sobre por que isso é barato aqui). Usada
 * pelo flush para achar quem venceu sem precisar saber os leadIds de
 * antemão.
 */
export async function listarGruposPendentes(db: AppDb): Promise<GrupoPendenteDoc[]> {
  const snapshot = await db.collection(FILA_RESPOSTAS_PENDENTES_COLLECTION).get();
  return snapshot.docs.map((doc) => asDoc(doc.data()) as GrupoPendenteDoc);
}

/** O grupo já passou da janela de silêncio (e tem ao menos uma mensagem à espera)? */
export function grupoMaduro(doc: GrupoPendenteDoc, now: Date, janelaSegundos: number): boolean {
  if (doc.mensagens.length === 0) return false;
  return now.getTime() - new Date(doc.ultimaMensagemEm).getTime() >= janelaSegundos * 1000;
}

/**
 * Reivindica um grupo maduro: devolve as mensagens acumuladas e ESVAZIA o
 * doc (nunca deleta — a `UsageTransaction` deste app só tem `get`/`set`,
 * nenhum `delete` transacional, mesmo motivo de `liberarClaim` marcar
 * `expiraEm` no passado em vez de apagar a claim). O doc esvaziado continua
 * existindo como âncora: uma mensagem nova que chegue ENQUANTO o rascunho
 * está sendo gerado (`adicionarMensagemAoGrupo`) começa um grupo novo em
 * cima dele, sem se perder e sem se misturar com o que acabou de ser
 * reivindicado.
 *
 * Devolve `null` quando não há grupo, ele já foi esvaziado por outro flush,
 * ou ainda não venceu a janela — os três casos são "nada a fazer aqui".
 */
export async function reivindicarGrupoMaduro(
  db: AppDb,
  leadId: string,
  now: Date,
  janelaSegundos: number,
): Promise<GrupoPendenteDoc | null> {
  return db.runTransaction(async (tx) => {
    const atual = asDoc((await tx.get(docRef(db, leadId))).data());
    if (!atual || !grupoMaduro(atual, now, janelaSegundos)) return null;

    tx.set(docRef(db, leadId), toDoc({ ...atual, mensagens: [] }));
    return atual;
  });
}

/**
 * Devolve ao grupo pendente as mensagens de uma reivindicação que falhou na
 * geração do rascunho (IA fora do ar, cota estourada, timeout) — é o que faz
 * o grupo "ficar marcado com o erro e ser retentável, não perdido". Mescla
 * com o que já estiver no doc AGORA (mensagem nova pode ter chegado enquanto
 * a geração rodava — ver `reivindicarGrupoMaduro`): a mais antiga das duas
 * `primeiraMensagemEm` e a mais recente das duas `ultimaMensagemEm`
 * prevalecem, para a janela de silêncio continuar medindo certo.
 */
export async function restaurarGrupoComErro(
  db: AppDb,
  falhou: GrupoPendenteDoc,
  erro: string,
): Promise<void> {
  await db.runTransaction(async (tx) => {
    const ref = docRef(db, falhou.leadId);
    const atual = asDoc((await tx.get(ref)).data());
    const mesclado: GrupoPendenteDoc = {
      leadId: falhou.leadId,
      mensagens: [...falhou.mensagens, ...(atual?.mensagens ?? [])],
      primeiraMensagemEm:
        atual && atual.primeiraMensagemEm < falhou.primeiraMensagemEm
          ? atual.primeiraMensagemEm
          : falhou.primeiraMensagemEm,
      ultimaMensagemEm:
        atual && atual.ultimaMensagemEm > falhou.ultimaMensagemEm
          ? atual.ultimaMensagemEm
          : falhou.ultimaMensagemEm,
      tentativas: falhou.tentativas + 1,
      ultimoErro: erro,
    };
    tx.set(ref, toDoc(mesclado));
  });
}
