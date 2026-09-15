import { InvalidTransitionError, NotFoundError } from "@/lib/errors";
import type { AppDb } from "@/lib/firestore-like";
import { getLead } from "@/lib/leads/repo";

import type { RespostaPendente } from "./estado";
import { FILA_RESPOSTAS_COLLECTION, type FilaRespostaDoc, type RascunhoEstado } from "./flushRespostas";
import { carregarFontesDaMensagem, montarMensagemParaLead } from "./mensagem";

/**
 * RESPOSTAS PENDENTES — o lead respondeu, a IA rascunhou, e agora alguém
 * precisa decidir. Este módulo é quem monta a lista do painel na /config e
 * quem fecha cada linha.
 *
 * Fecha nos DOIS sentidos, e os dois tiram a linha da lista: **usada** (o
 * operador mandou o texto, editado ou não) e **descartada** (ele prefere
 * responder do próprio jeito). Sem o segundo, a lista só cresceria — e uma
 * lista que ninguém consegue esvaziar é a mesma que ninguém olha, o mesmo
 * motivo de `detalheEnvioResolvido` existir na pendência de print.
 *
 * **O custo de leitura, explícito.** O `AppDb` não tem query (ver
 * firestore-like.ts), então listar é VARREDURA de `/filaRespostas`. Está
 * tudo bem AQUI pelo mesmo motivo da lista de print: /config é página de
 * admin aberta esporadicamente por uma pessoa, não `/api/fila/proximo`.
 * Com uma diferença que vale dizer: `filaEnvios` tem um doc por LEAD e
 * `filaRespostas` acumula um por GRUPO de mensagens, para sempre (resolver
 * marca o estado, nunca apaga — o registro é o que sobra da conversa).
 * A varredura cresce com o total de conversas já respondidas, não com o
 * número de pendências. Para uma operação de um aparelho só isso são
 * dezenas a centenas de docs; se um dia não for, o conserto é uma coleção
 * de índice, não um cache — mas hoje seria complexidade sem problema.
 *
 * O que a varredura NÃO faz é ler `/leads` inteira atrás dos nomes: filtra
 * primeiro e só então lê, POR ID, os poucos docs que sobraram — mesma
 * regra de `pendencias.ts`, e há teste que espiona as chamadas.
 */

export type { RespostaPendente } from "./estado";

function docRef(db: AppDb, id: string) {
  return db.collection(FILA_RESPOSTAS_COLLECTION).doc(id);
}

/**
 * As pendentes, da mais RECENTE para a mais antiga — uma conversa que
 * acabou de chegar ainda está quente, e é ali que responder custa menos.
 * Desempate por id, porque a ordem não pode depender de em que ordem o
 * Firestore devolveu os docs (mesma regra da seleção da fila).
 */
export async function listarRespostasPendentes(db: AppDb): Promise<RespostaPendente[]> {
  const snap = await db.collection(FILA_RESPOSTAS_COLLECTION).get();

  const pendentes = snap.docs
    .map((d) => d.data() as unknown as FilaRespostaDoc)
    .filter((doc) => doc.estado === "pendente")
    .sort((a, b) => b.geradoEm.localeCompare(a.geradoEm) || a.id.localeCompare(b.id));

  if (pendentes.length === 0) return [];

  // As três fontes da precedência da mensagem (skin → grupo → global) UMA
  // vez para a lista inteira: `listBuscas`/`listConjuntos` são varreduras, e
  // `montarMensagemParaLead` as carregaria de novo a cada linha.
  const fontes = await carregarFontesDaMensagem(db);

  return Promise.all(
    pendentes.map(async (doc) => {
      const lead = await getLead(db, doc.leadId);
      // A mensagem que o Radar mandou é RECONSTRUÍDA (o app não guarda o
      // literal que saiu — ver `rascunhoResposta.ts`, que reconstrói pelo
      // mesmo caminho para montar o prompt). Falhar nisso não pode derrubar
      // a linha inteira: o rascunho e as mensagens do lead continuam sendo
      // o que o operador precisa ver, e o bloco some em vez da pendência.
      let mensagemEnviada = "";
      let telefone = "";
      if (lead) {
        try {
          const montada = await montarMensagemParaLead(db, lead, fontes);
          mensagemEnviada = montada.texto;
          telefone = montada.telefone ?? "";
        } catch {
          // Sem logar nada: o `texto` de uma mensagem privada nunca entra em
          // log neste caminho (ver PRIVACIDADE em ARCHITECTURE.md), e a
          // regra vale para qualquer corpo que passe por aqui.
        }
      }

      return {
        id: doc.id,
        leadId: doc.leadId,
        // Lead excluído não apaga a resposta — some o nome, fica o id. Uma
        // pendência que desaparece sozinha é um estado que mente.
        nome: lead?.nome ?? "",
        nicho: lead?.busca?.nicho ?? "",
        telefone,
        mensagens: doc.mensagens ?? [],
        mensagemEnviada,
        rascunho: doc.rascunho ?? "",
        geradoEm: doc.geradoEm ?? "",
      };
    }),
  );
}

/**
 * Fecha uma pendência: "usada" ou "descartada". `textoUsado` é o texto que
 * o operador de fato mandou — o EDITADO, não o rascunho original —, e só
 * faz sentido no caminho "usada".
 *
 * Guardar o texto usado é o que impede "usada" de virar buraco negro: sem
 * ele, a única coisa que sobra da resposta é o rascunho que a IA propôs,
 * que pode não ter nada a ver com o que a pessoa recebeu.
 *
 * Escrita com `merge` e sem transação, mesma leitura de `pendencias.ts`: o
 * doc não participa de claim nenhuma (o ciclo de vida dele acaba aqui), e o
 * merge garante que fechar a pendência não encoste nas mensagens nem no
 * rascunho.
 *
 * - Doc ausente → 404 e NENHUMA escrita. `set` com merge CRIA o documento
 *   que falta, e um id errado não pode plantar lixo em `filaRespostas`.
 * - Já fechada no MESMO estado → sucesso sem escrever nada (idempotente por
 *   VALOR, como `POST /api/fila/pausar`): o operador clicou duas vezes, ou
 *   tem duas abas abertas, e o resultado que ele queria já aconteceu.
 * - Já fechada em estado DIFERENTE → 409, sem escrever. Deixar um
 *   "descartada" apagar o `textoUsado` de uma resposta que de fato saiu
 *   seria perder a única cópia dela. Reusa `InvalidTransitionError` (já
 *   mapeado a 409 com `de`/`para` em http.ts) em vez de uma classe nova: é
 *   literalmente uma máquina de estados recusando uma transição, e a única
 *   diferença é qual máquina.
 */
export async function resolverResposta(
  db: AppDb,
  id: string,
  estado: Exclude<RascunhoEstado, "pendente">,
  textoUsado: string | undefined,
  now: Date,
): Promise<RespostaPendente["id"]> {
  const ref = docRef(db, id);
  const snap = await ref.get();
  const doc = snap.exists ? (snap.data() as unknown as FilaRespostaDoc) : undefined;
  if (!doc) {
    throw new NotFoundError(`Resposta "${id}" não encontrada.`);
  }
  if (doc.estado !== "pendente") {
    if (doc.estado === estado) return id;
    throw new InvalidTransitionError(doc.estado, estado);
  }

  await ref.set(
    {
      estado,
      resolvidoEm: now.toISOString(),
      ...(estado === "usada" && { textoUsado: textoUsado ?? doc.rascunho ?? "" }),
    },
    { merge: true },
  );

  return id;
}
