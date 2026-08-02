import { formatarPrecoServico } from "@/lib/demos/precos";
import type { DemoServico } from "@/lib/demos/types";

/**
 * Convenção de conteúdo do card de imóvel: `DemoServico` só tem
 * nome/preco/descricao (mesmo contrato genérico usado por toda a Forja —
 * ver lib/demos/types.ts), sem um campo dedicado para o selo de tipo do
 * imóvel ("Casa"/"Cobertura"/"Studio"…) que o material bruto mostra no
 * canto do card. Em vez de inventar um campo novo no contrato central
 * (que toda skin herdaria), a imobiliária usa uma convenção só dela:
 * `descricao` no formato "Selo • especificações", separadas pelo bullet
 * "•" (as especificações internas já usam "·" no material bruto, então o
 * bullet evita ambiguidade). Sem "•" na descrição, o card não mostra selo
 * — a fidelidade ao original não depende de o editor usar a convenção.
 */
export function parseImovel(descricao: string | undefined): {
  selo: string | undefined;
  especificacoes: string | undefined;
} {
  const texto = descricao?.trim();
  if (!texto) return { selo: undefined, especificacoes: undefined };

  const i = texto.indexOf("•");
  if (i === -1) return { selo: undefined, especificacoes: texto };

  const selo = texto.slice(0, i).trim();
  const especificacoes = texto.slice(i + 1).trim();
  return {
    selo: selo || undefined,
    especificacoes: especificacoes || undefined,
  };
}

/**
 * Preço do card: `precoValor`/`precoPrefixo` formatados por
 * `formatarPrecoServico` (moeda/locale da demo — ver lib/demos/precos.ts).
 * Campo vazio/ausente cai no `semPreco` (`microcopiaDemo(idioma).semPreco`
 * — ver lib/demos/microcopy.ts) — fiel ao toggle
 * `mostrarPrecos` do material bruto, só que por imóvel em vez de global (o
 * editor já dá esse controle de graça: basta esvaziar o preço de um
 * imóvel específico).
 */
export function formatarPreco(
  servico: Pick<DemoServico, "preco" | "precoPrefixo" | "precoValor">,
  idioma: string | undefined,
  moeda: string | undefined,
  semPreco: string,
): string {
  const formatado = formatarPrecoServico(servico, idioma, moeda);
  return formatado.trim() || semPreco;
}
