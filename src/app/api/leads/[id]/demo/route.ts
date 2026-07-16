import { NextResponse } from "next/server";

import { removerImagensDoLead } from "@/lib/demos/imagens";
import { validateLeadDemoInput } from "@/lib/demos/validate";
import { getDb } from "@/lib/firebase/admin";
import { getDemoStorage } from "@/lib/firebase/storage";
import { handleRouteError, readJsonBody } from "@/lib/http";
import { deleteDemo, saveDemo } from "@/lib/leads/repo";

/**
 * PUT /api/leads/[id]/demo — salva a configuração da demo do lead (skin,
 * preset de tema, ajustes de tema e overrides de conteúdo) no campo `demo`
 * do doc. A rota pública /demo/{leadId} lê daqui. Nenhuma chamada ao Google.
 *
 * DELETE /api/leads/[id]/demo — apaga a configuração E as imagens do lead
 * no Storage (todas viram órfãs junto com o registro). /demo/{leadId}
 * volta a 404. Idempotente: lead sem demo responde 200 do mesmo jeito.
 */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await readJsonBody(req);
    const demo = validateLeadDemoInput(body);
    const lead = await saveDemo(getDb(), id, demo);
    return NextResponse.json({ lead });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const lead = await deleteDemo(getDb(), id);
    // A limpeza do Storage vem DEPOIS de apagar o registro e não derruba a
    // resposta: arquivo órfão custa centavos; demo meio-apagada confunde.
    try {
      await removerImagensDoLead(getDemoStorage(), id);
    } catch (error) {
      console.error("[radar] falha ao limpar imagens da demo:", error);
    }
    return NextResponse.json({ lead });
  } catch (error) {
    return handleRouteError(error);
  }
}
