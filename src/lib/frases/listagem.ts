import { SKINS } from "@/lib/demos/registry";
import type { AppDb } from "@/lib/firestore-like";
import { conjuntoVazio, listConjuntos } from "./repo";
import type { ConjuntoSkin } from "./types";

/**
 * A lista que a tela de administração mostra: UMA linha por skin do
 * REGISTRO, na ordem do registro. Skin nova aparece sozinha na próxima
 * carga, só por ter sido registrada — não existe cadastro manual e nenhuma
 * linha nasce de texto digitado numa busca.
 *
 * Doc legado (chaveado pelo texto do nicho, antes da migração) simplesmente
 * não casa com nenhum id de skin e não vira linha — é assim que as entradas
 * duplicadas/com erro de digitação somem da tela. O texto delas não é
 * apagado aqui: quem cuida disso é a migração (ver ./migracao.ts).
 *
 * Skin ainda sem frases vem como conjunto VAZIO, e não omitida: a tela
 * precisa dos três campos em branco pra você preencher, e um conjunto vazio
 * é exatamente o que faz a skin não participar da precedência.
 */
export async function montarConjuntos(db: AppDb): Promise<{ conjuntos: ConjuntoSkin[] }> {
  const salvos = new Map((await listConjuntos(db)).map((conjunto) => [conjunto.skinId, conjunto]));

  const conjuntos = SKINS.map((skin) => ({
    ...(salvos.get(skin.id) ?? conjuntoVazio(skin.id)),
    skinNome: skin.nome,
    nicho: skin.nicho,
  }));
  return { conjuntos };
}
