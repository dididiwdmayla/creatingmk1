import type { Busca } from "@/lib/buscas/types";

import { normalizaNichoExato, skinsDoNicho } from "./nicho";

/**
 * Um nicho de busca sem skin nenhuma no registro (agrupado pela
 * normalização exata — ver `normalizaNichoExato`), com o quanto ele pesa:
 * é a lista que diz ao operador qual template fazer em seguida (o de maior
 * `leads`) e, quando o nicho já tem uma skin prima de fato (ex.: "salão de
 * beleza" perto de "barbearia"), qual sinônimo falta no registro.
 */
export interface NichoSemSkin {
  /** Rótulo legível — o texto de nicho mais frequente entre as buscas do grupo. */
  nicho: string;
  /** Chave normalizada do grupo (ver normalizaNichoExato). */
  normalizado: string;
  /** Quantas buscas caem neste nicho. */
  buscas: number;
  /** Soma de leads (totalCriados + totalExistentes) das buscas do grupo. */
  leads: number;
}

/** O rótulo mais frequente de um grupo; empate resolvido pelo primeiro visto. */
function rotuloMaisFrequente(rotulos: Map<string, number>): string {
  let melhor = "";
  let maior = -1;
  for (const [rotulo, contagem] of rotulos) {
    if (contagem > maior) {
      maior = contagem;
      melhor = rotulo;
    }
  }
  return melhor;
}

/**
 * Nichos das buscas existentes que não casam com skin nenhuma do registro
 * (nem pelo `nicho` nem por sinônimo — ver `skinsDoNicho`), agrupados pela
 * normalização exata. Pura: recebe as buscas já carregadas, nunca lê
 * Firestore. Ordenada por `leads` desc (o nicho que mais pesa primeiro),
 * depois `buscas` desc, depois alfabética — desempate determinístico.
 */
export function nichosSemSkin(buscas: readonly Busca[]): NichoSemSkin[] {
  const grupos = new Map<string, { rotulos: Map<string, number>; buscas: number; leads: number }>();

  for (const busca of buscas) {
    if (!busca.nicho.trim()) continue;
    if (skinsDoNicho(busca.nicho).length > 0) continue;

    const normalizado = normalizaNichoExato(busca.nicho);
    const grupo = grupos.get(normalizado) ?? { rotulos: new Map(), buscas: 0, leads: 0 };
    grupo.buscas += 1;
    grupo.leads += busca.totalCriados + busca.totalExistentes;
    grupo.rotulos.set(busca.nicho, (grupo.rotulos.get(busca.nicho) ?? 0) + 1);
    grupos.set(normalizado, grupo);
  }

  return Array.from(grupos.entries())
    .map(([normalizado, grupo]) => ({
      nicho: rotuloMaisFrequente(grupo.rotulos),
      normalizado,
      buscas: grupo.buscas,
      leads: grupo.leads,
    }))
    .sort((a, b) => b.leads - a.leads || b.buscas - a.buscas || a.nicho.localeCompare(b.nicho));
}
