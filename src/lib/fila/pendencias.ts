import { NotFoundError } from "@/lib/errors";
import type { AppDb } from "@/lib/firestore-like";
import { getLead } from "@/lib/leads/repo";

import { FILA_ENVIOS_COLLECTION, type FilaEnvioDoc } from "./envios";
import type { PendenciaEnvio } from "./estado";

/**
 * PENDÊNCIA DE PRINT — o lead que recebeu o texto mas não a peça que vende.
 *
 * Quando o anexo falha depois de o texto já ter saído, a macro reporta
 * "enviado" com o detalhe preenchido (ver `detalheEnvio` em estado.ts):
 * reportar falha devolveria o lead à fila e mandaria a mesma mensagem duas
 * vezes. O preço são leads contactados pela metade, e este módulo é o que
 * os torna encontráveis — é lista de trabalho MANUAL: o operador abre a
 * conversa e anexa o print à mão. Sem ação em massa, sem reenvio.
 *
 * **Sobre o custo de leitura:** o `AppDb` não tem query (ver
 * firestore-like.ts), então listar é VARREDURA da coleção inteira. Está
 * tudo bem AQUI, e só aqui: /config é página de admin aberta
 * esporadicamente por uma pessoa — não é `/api/fila/proximo`, que o celular
 * bate 1440× por dia e por isso ganhou o pool em `candidatos.ts`. Nada de
 * pool nem cache para esta lista. O que a varredura NÃO faz é ler `/leads`
 * inteira atrás de nomes: ela filtra primeiro e só então lê, POR ID, os
 * poucos docs de lead que sobraram.
 */

export type { PendenciaEnvio } from "./estado";

/** O doc da fila é uma pendência? (só o caminho "enviado" grava detalhe) */
function ehPendencia(doc: FilaEnvioDoc): boolean {
  return (doc.detalheEnvio ?? "").trim() !== "";
}

function envioRef(db: AppDb, leadId: string) {
  return db.collection(FILA_ENVIOS_COLLECTION).doc(leadId);
}

/**
 * Os leads com detalhe de envio pendente, do mais RECENTE para o mais
 * antigo — a mensagem acabou de sair, a conversa ainda está fresca no
 * WhatsApp, e é ali que anexar o print custa menos.
 *
 * `incluirResolvidos` traz também os já fechados: a lista mostra os não
 * resolvidos por padrão, mas um alternador marcado por engano precisa ter
 * como voltar (mesmo motivo de `telefoneInvalido` ser reversível na ficha).
 */
export async function listarPendencias(
  db: AppDb,
  opcoes: { incluirResolvidos?: boolean } = {},
): Promise<PendenciaEnvio[]> {
  const snap = await db.collection(FILA_ENVIOS_COLLECTION).get();

  const pendentes = snap.docs
    .map((d) => ({ leadId: d.id, doc: d.data() as unknown as FilaEnvioDoc }))
    .filter(({ doc }) => ehPendencia(doc))
    .filter(({ doc }) => opcoes.incluirResolvidos || doc.detalheEnvioResolvido !== true);

  // Só agora, e só destes: um por id, nunca uma varredura de /leads.
  return Promise.all(
    pendentes.map(async ({ leadId, doc }) => {
      const lead = await getLead(db, leadId);
      return {
        leadId,
        // Lead excluído não apaga a pendência — some o nome, fica o id. Uma
        // pendência que desaparece sozinha é um estado que mente.
        nome: lead?.nome ?? "",
        enviadoEm: doc.enviadoEm ?? "",
        detalhe: doc.detalheEnvio ?? "",
        resolvido: doc.detalheEnvioResolvido === true,
      };
    }),
  ).then((linhas) =>
    linhas.sort(
      // Desempate por leadId: a ordem não pode depender de em que ordem o
      // Firestore devolveu os docs (mesma regra da seleção da fila).
      (a, b) => b.enviadoEm.localeCompare(a.enviadoEm) || a.leadId.localeCompare(b.leadId),
    ),
  );
}

/**
 * Marca (ou desmarca) uma pendência como resolvida — o operador anexou o
 * print à mão. Escrita com `merge`, e sem transação de propósito: o doc já
 * está num estado TERMINAL ("enviado" nunca volta a ser reservado, ver
 * `leadDisponivel`), então não há claim concorrente com que competir; o
 * merge garante que fechar a pendência não encoste em nenhum outro campo.
 *
 * Doc que não é pendência é 404 e não vira doc novo: `set` com merge CRIA
 * o documento ausente, e um leadId errado não pode plantar lixo em
 * `filaEnvios`.
 */
export async function marcarPendenciaResolvida(
  db: AppDb,
  leadId: string,
  resolvido: boolean,
): Promise<PendenciaEnvio> {
  const ref = envioRef(db, leadId);
  const snap = await ref.get();
  const doc = snap.exists ? (snap.data() as unknown as FilaEnvioDoc) : undefined;
  if (!doc || !ehPendencia(doc)) {
    throw new NotFoundError(`Lead "${leadId}" não tem pendência de envio.`);
  }

  await ref.set({ detalheEnvioResolvido: resolvido }, { merge: true });

  const lead = await getLead(db, leadId);
  return {
    leadId,
    nome: lead?.nome ?? "",
    enviadoEm: doc.enviadoEm ?? "",
    detalhe: doc.detalheEnvio ?? "",
    resolvido,
  };
}
