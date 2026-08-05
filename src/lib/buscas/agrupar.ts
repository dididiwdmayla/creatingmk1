import type { Busca } from "./types";

/**
 * Um grupo por busca (nome/cor do grupo) + "Sem busca" para o resto —
 * mesmo padrão de agrupamento usado em `/leads` (lista de leads) e `/demos`
 * (lista de demos): dot de cor, nome, contagem, colapsável. Extraído pra
 * módulo próprio pra não duplicar a lógica entre as duas páginas.
 */
export interface GrupoBusca<T> {
  chave: string;
  titulo: string;
  cor?: string;
  itens: T[];
}

const SEM_BUSCA_CHAVE = "__sem_busca__";

/**
 * Agrupa itens que carregam `buscaId` (leads inteiros, ou qualquer outra
 * coisa derivada deles) pelas buscas às quais pertencem. Um item que
 * aparece em mais de uma busca (`buscaId` é array) entra em cada grupo
 * correspondente — mesmo espírito de `agruparPorBusca` original. A ordem
 * dos grupos segue `buscas` (desc por criação, como a listagem já devolve).
 */
export function agruparPorBusca<T>(
  itens: T[],
  buscas: Busca[],
  buscaIdDoItem: (item: T) => string[] | undefined,
): GrupoBusca<T>[] {
  const grupos: GrupoBusca<T>[] = [];
  const agrupados = new Set<T>();
  for (const busca of buscas) {
    const doGrupo = itens.filter((item) => (buscaIdDoItem(item) ?? []).includes(busca.id));
    if (doGrupo.length === 0) continue;
    doGrupo.forEach((item) => agrupados.add(item));
    grupos.push({ chave: busca.id, titulo: busca.nome, cor: busca.cor, itens: doGrupo });
  }
  const semBusca = itens.filter((item) => !agrupados.has(item));
  if (semBusca.length > 0) {
    grupos.push({ chave: SEM_BUSCA_CHAVE, titulo: "Sem busca", itens: semBusca });
  }
  return grupos;
}
