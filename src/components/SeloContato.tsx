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

/**
 * A mesma informação reduzida a um PONTO, para a densidade 2 da grade: a
 * faixa inteira ocupa uma linha de texto que, em duas colunas de celular,
 * é o que mais empurra o card para baixo. O ponto continua dizendo tudo
 * por `title` e por leitor de tela — o que se perde é só a leitura de
 * relance, que nessa densidade já é o nome e o status.
 *
 * `block` + altura/largura explícitas porque <span> inline ignora as duas
 * e vira caixa 0×0 fora de um flex (ver [data-ponto-busca]).
 */
export function PontoContato({ lead, nomes }: { lead: Lead; nomes: NomesUsuarios }) {
  const texto = textoSelo(lead, nomes);
  if (!texto) return null;
  return (
    <span title={texto} className="flex shrink-0 items-center">
      <span aria-hidden className="block h-2.5 w-2.5 rounded-full bg-warning" />
      <span className="sr-only">{texto}</span>
    </span>
  );
}
