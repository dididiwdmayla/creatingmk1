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
  /**
   * Busca de origem do grupo — ausente só no grupo "Sem busca". O
   * cabeçalho do grupo fechado é a única coisa na tela e precisa mostrar a
   * procedência inteira (nicho, região, data, autor), então o grupo
   * carrega a busca em vez de só o nome e a cor dela.
   */
  busca?: Busca;
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
    grupos.push({ chave: busca.id, titulo: busca.nome, cor: busca.cor, busca, itens: doGrupo });
  }
  const semBusca = itens.filter((item) => !agrupados.has(item));
  if (semBusca.length > 0) {
    grupos.push({ chave: SEM_BUSCA_CHAVE, titulo: "Sem busca", itens: semBusca });
  }
  return grupos;
}

/* ── Agrupamento da própria lista de buscas (/buscas) ────────────────── */

/**
 * Como `/buscas` empilha as buscas: `nenhum` é a fila única de sempre;
 * `mes` e `nicho` são as duas dobras que o operador realmente procura
 * ("o que eu rodei em julho", "o que já rodei de dentista").
 */
export const MODOS_AGRUPAMENTO_BUSCAS = ["nenhum", "mes", "nicho"] as const;

export type ModoAgrupamentoBuscas = (typeof MODOS_AGRUPAMENTO_BUSCAS)[number];

export function modoAgrupamentoBuscasValido(valor: unknown): valor is ModoAgrupamentoBuscas {
  return (MODOS_AGRUPAMENTO_BUSCAS as readonly unknown[]).includes(valor);
}

/** Grupo sem busca de origem (o grupo é o mês ou o nicho, não uma busca). */
export interface GrupoBuscas {
  chave: string;
  titulo: string;
  itens: Busca[];
}

const SP_TIME_ZONE = "America/Sao_Paulo";

// Mês em America/Sao_Paulo, não UTC: uma busca rodada às 22h do dia 31 é de
// julho pra quem a rodou, e cairia em agosto se a chave saísse do ISO cru.
const MES_CHAVE = new Intl.DateTimeFormat("en-CA", {
  timeZone: SP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
});

const MES_TITULO = new Intl.DateTimeFormat("pt-BR", {
  timeZone: SP_TIME_ZONE,
  year: "numeric",
  month: "long",
});

function primeiraMaiuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * Agrupa a lista de buscas por mês ou por nicho, preservando a ordem em
 * que ela chegou (a rota já devolve as mais recentes primeiro) — daí os
 * meses saírem em ordem decrescente e os nichos na ordem do uso mais
 * recente, sem nenhuma reordenação extra.
 *
 * `nenhum` devolve um grupo único sem chave visível: quem renderiza decide
 * não desenhar cabeçalho nesse caso, e a lista fica idêntica à de antes.
 */
export function agruparBuscas(
  buscas: Busca[],
  modo: ModoAgrupamentoBuscas,
): GrupoBuscas[] {
  if (modo === "nenhum") {
    return buscas.length > 0 ? [{ chave: "todas", titulo: "Todas", itens: buscas }] : [];
  }

  const porChave = new Map<string, GrupoBuscas>();
  for (const busca of buscas) {
    const { chave, titulo } = modo === "mes" ? chaveMes(busca) : chaveNicho(busca);
    const grupo = porChave.get(chave);
    if (grupo) grupo.itens.push(busca);
    else porChave.set(chave, { chave, titulo, itens: [busca] });
  }
  return [...porChave.values()];
}

function chaveMes(busca: Busca): { chave: string; titulo: string } {
  const data = new Date(busca.criadaEm);
  if (Number.isNaN(data.getTime())) {
    // Data ilegível (doc sujo) não some da tela nem contamina outro mês.
    return { chave: "mes:sem-data", titulo: "Sem data" };
  }
  return {
    chave: `mes:${MES_CHAVE.format(data)}`,
    titulo: primeiraMaiuscula(MES_TITULO.format(data)),
  };
}

function chaveNicho(busca: Busca): { chave: string; titulo: string } {
  const nicho = busca.nicho?.trim();
  if (!nicho) return { chave: "nicho:sem-nicho", titulo: "Sem nicho" };
  return {
    chave: `nicho:${nicho.toLocaleLowerCase("pt-BR")}`,
    titulo: primeiraMaiuscula(nicho),
  };
}
