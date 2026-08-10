import { NextResponse } from "next/server";

import { getBusca } from "@/lib/buscas/repo";
import { removerImagensDoLead } from "@/lib/demos/imagens";
import { getDb } from "@/lib/firebase/admin";
import { getDemoStorage } from "@/lib/firebase/storage";
import { handleRouteError } from "@/lib/http";
import { deleteDemo, listLeads } from "@/lib/leads/repo";
import { requireAdmin } from "@/lib/usuarios";

type Params = { params: Promise<{ id: string }> };

/**
 * DELETE /api/buscas/[id]/demos — apaga a demo (config + imagens) de TODOS
 * os leads do grupo que têm demo salva de uma vez. Admin apenas: a rota
 * recusa (401/403) antes de tocar em qualquer lead, não é só a tela que
 * esconde o botão — ver "/demos" (botão "Apagar todas do grupo").
 *
 * Mesma semântica do DELETE individual (`/api/leads/[id]/demo`), lead a
 * lead: NUNCA apaga o lead, não mexe em `status`/`contato`, e o histórico
 * de visitas (`Lead.demoVisitas`, com o envio/canal anotado em cada
 * entrada) sobrevive — só o campo `demo` de cada lead some. Idempotente:
 * grupo sem nenhuma demo responde `200 { apagadas: 0 }`.
 */
export async function DELETE(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();
    await requireAdmin(db, req);

    const busca = await getBusca(db, id);
    const leads = await listLeads(db, { buscaId: id });
    const comDemo = leads.filter((lead) => lead.demo);

    const storage = getDemoStorage();
    await Promise.all(
      comDemo.map(async (lead) => {
        await deleteDemo(db, lead.placeId);
        // Mesma postura do DELETE individual: limpeza do Storage vem
        // DEPOIS de apagar o registro e não derruba a resposta — arquivo
        // órfão custa centavos, demo meio-apagada confunde.
        try {
          await removerImagensDoLead(storage, lead.placeId);
        } catch (error) {
          console.error("[radar] falha ao limpar imagens da demo (lote):", error);
        }
      }),
    );

    return NextResponse.json({ apagadas: comDemo.length, busca: busca.nome });
  } catch (error) {
    return handleRouteError(error);
  }
}
