import { listBuscas } from "@/lib/buscas/repo";
import type { AppDb } from "@/lib/firestore-like";
import { chaveNicho } from "./chave";
import { conjuntoVazio, listConjuntos } from "./repo";
import { CHAVE_GENERICAS, type FrasesProspeccao } from "./types";

/**
 * A lista que a tela de administração mostra: TODO nicho que já apareceu em
 * alguma busca, mais os que já têm conjunto salvo (um nicho pode ter frases e
 * a busca dele ter sido apagada depois). Nicho novo entra sozinho na próxima
 * carga — não existe cadastro manual de nicho em lugar nenhum.
 *
 * Nicho ainda sem frases vem como conjunto VAZIO, e não omitido: a tela
 * precisa dos três campos em branco pra você preencher, e um conjunto vazio
 * é exatamente o que faz o nicho não participar da precedência.
 */
export async function montarConjuntos(
  db: AppDb,
): Promise<{ conjuntos: FrasesProspeccao[]; genericas: FrasesProspeccao }> {
  const [{ nichos, genericas }, buscas] = await Promise.all([listConjuntos(db), listBuscas(db)]);

  // Chave normalizada → conjunto. Os salvos entram primeiro e mandam na
  // grafia de exibição; a busca só acrescenta nicho que ainda não tem doc.
  const porChave = new Map<string, FrasesProspeccao>();
  for (const conjunto of nichos) {
    porChave.set(chaveNicho(conjunto.nicho), conjunto);
  }
  for (const busca of buscas) {
    const nicho = busca.nicho?.trim();
    if (!nicho) continue;
    const chave = chaveNicho(nicho);
    // Um nicho de busca chamado como o doc reservado não pode virar linha:
    // ele nunca teria conjunto próprio (ver validarConjuntoPatch).
    if (chave === CHAVE_GENERICAS || porChave.has(chave)) continue;
    porChave.set(chave, conjuntoVazio(nicho));
  }

  const conjuntos = [...porChave.values()].sort((a, b) =>
    a.nicho.localeCompare(b.nicho, "pt-BR"),
  );
  return { conjuntos, genericas: genericas ?? { nicho: "", frases: ["", "", ""], indice: 0 } };
}
