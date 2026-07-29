import { nomeUsuario, type NomesUsuarios } from "@/lib/contato-selo";
import { formatDateTime } from "@/lib/format";
import type { Lead } from "@/lib/leads/types";

/**
 * Selo "{nome} já contatou este lead" — visível em card/ficha/hoje pra
 * evitar contato duplicado entre colegas (ver useWhatsAppContato). Some
 * quando o lead ainda não tem `seloContato`.
 */
export function SeloContato({ lead, nomes }: { lead: Lead; nomes: NomesUsuarios }) {
  if (!lead.seloContato) return null;
  return (
    <p className="rounded border border-warning/40 bg-warning/10 px-2 py-1 text-xs font-medium text-warning">
      {nomeUsuario(nomes, lead.seloContato.userId)} já contatou este lead ·{" "}
      {formatDateTime(lead.seloContato.em)}
    </p>
  );
}
