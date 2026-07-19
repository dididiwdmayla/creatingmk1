import { EscolherSkinClient } from "./EscolherSkinClient";

/**
 * Passo de escolha da skin base, antes de criar a demo — cards com
 * miniatura/nome do nicho de TODAS as skins do registro, em vez de
 * assumir a primeira (DEFAULT_SKIN) como o editor fazia antes. Mesmo
 * padrão de wrapper fino da página do editor: extrai params.id e
 * remonta o client component por lead (key={id}).
 */
export default async function EscolherSkinPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EscolherSkinClient key={id} id={id} />;
}
