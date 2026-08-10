import { nomeUsuario, type NomesUsuarios } from "@/lib/contato-selo";
import { formatDateTime } from "@/lib/format";
import type { Lead } from "@/lib/leads/types";

/**
 * Selo "{nome} já contatou este lead" — visível em card/ficha/hoje pra
 * evitar contato duplicado entre colegas (ver useWhatsAppContato). Some
 * quando o lead ainda não tem `seloContato`.
 */
function textoSelo(lead: Lead, nomes: NomesUsuarios): string | null {
  if (!lead.seloContato) return null;
  return `${nomeUsuario(nomes, lead.seloContato.userId)} já contatou este lead · ${formatDateTime(
    lead.seloContato.em,
  )}`;
}

export function SeloContato({ lead, nomes }: { lead: Lead; nomes: NomesUsuarios }) {
  const texto = textoSelo(lead, nomes);
  if (!texto) return null;
  return (
    <p className="rounded border border-warning/40 bg-warning/10 px-2 py-1 text-xs font-medium text-warning">
      {texto}
    </p>
  );
}

/** Primeira letra de quem contatou, para a faixa estreita (`FaixaContato`). */
function inicialContato(nomes: NomesUsuarios, userId: string): string {
  const letra = nomeUsuario(nomes, userId).trim().charAt(0).toUpperCase();
  return letra || "?";
}

/**
 * A mesma informação reduzida a uma FAIXA estreita com a INICIAL de quem
 * contatou, para as densidades 2 a 4 da grade: a faixa inteira ("{nome} já
 * contatou este lead") ocupa uma linha de texto que, em duas colunas de
 * celular, é o que mais empurra o card para baixo — mas um ponto sem letra
 * nenhuma (a versão anterior) apaga o "quem" justamente na hora em que dois
 * colegas mais precisam distinguir um contato do outro. A inicial é o
 * meio-termo que ainda cabe nos ~85px da densidade 4 (celular, 4 colunas). O
 * texto completo continua por `title` e por leitor de tela.
 *
 * Caixa com altura/largura EXPLÍCITAS pelo mesmo motivo do `StatusBadge`
 * variante "ponto": <span> inline ignora as duas e vira caixa 0×0 fora de um
 * flex (ver [data-ponto-busca]).
 */
export function FaixaContato({ lead, nomes }: { lead: Lead; nomes: NomesUsuarios }) {
  const texto = textoSelo(lead, nomes);
  if (!texto || !lead.seloContato) return null;
  return (
    <span
      title={texto}
      className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] bg-warning text-[9px] font-bold leading-none text-black"
    >
      <span aria-hidden>{inicialContato(nomes, lead.seloContato.userId)}</span>
      <span className="sr-only">{texto}</span>
    </span>
  );
}
