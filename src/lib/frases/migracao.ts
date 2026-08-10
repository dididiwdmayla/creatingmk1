import { SKINS, getSkin } from "@/lib/demos/registry";
import type { AppDb } from "@/lib/firestore-like";
import { normalizaNicho } from "@/lib/precificacao/calc";
import { salvarConjunto } from "./repo";
import { frasesEfetivas, normalizarSlots } from "./rotacao";
import {
  FRASES_COLLECTION,
  type EntradaLegada,
  type FrasesProspeccao,
  type RelatorioMigracao,
} from "./types";

/**
 * Migração das frases chaveadas pelo TEXTO da busca para as chaveadas pela
 * SKIN registrada (ver "Frases de prospecção por skin").
 *
 * As entradas antigas já somem da tela sozinhas — não casam com id de skin
 * nenhum. O que esta migração faz é aproveitar o TEXTO já escrito antes de
 * ele virar lixo no banco, e dizer, item a item, o que não deu pra
 * associar. Nada é apagado sem antes ter sido copiado ou listado.
 *
 * Regra de associação, deliberadamente conservadora:
 *
 * - o nicho do doc antigo é comparado (normalizado) com o `nicho` das skins
 *   do REGISTRO. "barbearia" casa com as duas skins de barbearia; "barbearia
 *   old school" e "barbería" não casam com nada — texto livre não vira
 *   chave nem aqui;
 * - casando com mais de uma skin (nicho com skins irmãs), o texto é COPIADO
 *   para cada uma. Elas ficam independentes a partir daí: é uma cópia de
 *   partida para você editar, não um conjunto por família — nada em tempo de
 *   execução consulta "as skins do nicho X";
 * - skin que JÁ tem frase própria nunca é sobrescrita. Se todas as skins
 *   candidatas já têm texto, a entrada antiga vira pendência (o texto dela
 *   aparece no relatório para você decidir);
 * - o `indice` da rotação antiga não é herdado: o contador da skin é dela.
 */

/** Lê a coleção inteira e separa o que é doc legado (id que não é skin do registro). */
export async function listarLegados(db: AppDb): Promise<EntradaLegada[]> {
  const snapshot = await db.collection(FRASES_COLLECTION).get();
  const legados: EntradaLegada[] = [];
  for (const doc of snapshot.docs) {
    if (getSkin(doc.id)) continue;
    const data = doc.data() as { nicho?: unknown };
    legados.push({
      chave: doc.id,
      nicho: typeof data.nicho === "string" && data.nicho.trim() ? data.nicho : nichoDaChave(doc.id),
      frases: normalizarSlots((data as { frases?: unknown }).frases),
    });
  }
  return legados.sort((a, b) => a.chave.localeCompare(b.chave));
}

/**
 * A chave antiga era `encodeURIComponent(nicho normalizado)` — decodificar
 * devolve algo legível quando o doc não guardou a grafia de exibição. Chave
 * malformada volta como está, em vez de derrubar a leitura.
 */
function nichoDaChave(chave: string): string {
  try {
    return decodeURIComponent(chave);
  } catch {
    return chave;
  }
}

/**
 * O plano da migração — função PURA sobre o que já foi lido: nada aqui
 * escreve, para o GET poder mostrar exatamente o que o POST vai fazer.
 * `destinos` é a lista de escritas a executar (uma por skin de destino).
 */
export function planejarMigracao(
  legados: EntradaLegada[],
  salvos: FrasesProspeccao[],
): {
  destinos: Array<{ chave: string; skinId: string; frases: string[] }>;
  relatorio: RelatorioMigracao;
} {
  // Skins que já têm texto próprio — nunca sobrescritas. O Set cresce
  // durante o planejamento: duas entradas antigas do mesmo nicho não
  // disputam a mesma skin, a primeira (ordem alfabética de chave) leva.
  const ocupadas = new Set(
    salvos.filter((conjunto) => frasesEfetivas(conjunto).length > 0).map((c) => c.skinId),
  );

  const destinos: Array<{ chave: string; skinId: string; frases: string[] }> = [];
  const relatorio: RelatorioMigracao = { feitas: [], pendentes: [], vazias: 0 };

  for (const legado of legados) {
    if (frasesEfetivas(legado).length === 0) {
      relatorio.vazias += 1;
      continue;
    }

    const alvo = normalizaNicho(legado.nicho);
    const candidatas = SKINS.filter((skin) => normalizaNicho(skin.nicho) === alvo);
    if (candidatas.length === 0) {
      relatorio.pendentes.push({
        ...legado,
        motivo: "nenhuma skin do registro tem esse nicho — associe à mão",
      });
      continue;
    }

    const livres = candidatas.filter((skin) => !ocupadas.has(skin.id));
    if (livres.length === 0) {
      relatorio.pendentes.push({
        ...legado,
        motivo: `${candidatas.map((s) => s.nome).join(" e ")} já ${candidatas.length > 1 ? "têm" : "tem"} frases próprias — não sobrescrevi`,
      });
      continue;
    }

    for (const skin of livres) {
      ocupadas.add(skin.id);
      destinos.push({ chave: legado.chave, skinId: skin.id, frases: legado.frases });
      relatorio.feitas.push({
        chave: legado.chave,
        nicho: legado.nicho,
        skinId: skin.id,
        skinNome: skin.nome,
      });
    }
  }

  return { destinos, relatorio };
}

/**
 * Executa o plano: grava os conjuntos das skins de destino e apaga só os
 * docs legados que foram efetivamente aproveitados (mais os vazios, que não
 * tinham nada a preservar). Pendência NUNCA é apagada aqui — ela fica no
 * banco e no relatório até você resolver, e some da tela do mesmo jeito.
 */
export async function migrarLegados(
  db: AppDb,
  legados: EntradaLegada[],
  salvos: FrasesProspeccao[],
): Promise<RelatorioMigracao> {
  const { destinos, relatorio } = planejarMigracao(legados, salvos);

  for (const destino of destinos) {
    await salvarConjunto(db, destino.skinId, destino.frases);
  }

  const aproveitadas = new Set(destinos.map((destino) => destino.chave));
  const vazias = legados
    .filter((legado) => frasesEfetivas(legado).length === 0)
    .map((legado) => legado.chave);
  for (const chave of [...aproveitadas, ...vazias]) {
    await db.collection(FRASES_COLLECTION).doc(chave).delete();
  }

  return relatorio;
}

/** Apaga as entradas legadas que sobraram (o "já copiei, pode limpar"). */
export async function descartarLegados(db: AppDb): Promise<number> {
  const legados = await listarLegados(db);
  for (const legado of legados) {
    await db.collection(FRASES_COLLECTION).doc(legado.chave).delete();
  }
  return legados.length;
}
