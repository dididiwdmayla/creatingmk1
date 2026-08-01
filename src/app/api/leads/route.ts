import { NextResponse } from "next/server";

import { getDb } from "@/lib/firebase/admin";
import { handleRouteError } from "@/lib/http";
import { envioTokenIncompleto, garantirEnvioToken, listLeads } from "@/lib/leads/repo";

export async function GET(req: Request) {
  try {
    const db = getDb();
    const params = new URL(req.url).searchParams;
    let leads = await listLeads(db, {
      status: params.get("status") ?? undefined,
      temSite: params.get("temSite") ?? undefined,
      temTelefone: params.get("temTelefone") ?? undefined,
      buscaId: params.get("buscaId") ?? undefined,
      favorito: params.get("favorito") ?? undefined,
    });

    // Self-heal do token de envio: /demos monta "Copiar link" com o token
    // vigente do canal "link" direto do que este GET devolve, sem fetch no
    // clique.
    const semToken = leads.filter((lead) => envioTokenIncompleto(lead));
    if (semToken.length > 0) {
      const atualizados = new Map(
        await Promise.all(
          semToken.map(
            async (lead) => [lead.placeId, await garantirEnvioToken(db, lead.placeId)] as const,
          ),
        ),
      );
      leads = leads.map((lead) => atualizados.get(lead.placeId) ?? lead);
    }

    return NextResponse.json({ leads });
  } catch (error) {
    return handleRouteError(error);
  }
}
