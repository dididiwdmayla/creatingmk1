import { NextResponse } from "next/server";

import { validateLeadDemoInput } from "@/lib/demos/validate";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError, readJsonBody } from "@/lib/http";
import { saveDemo } from "@/lib/leads/repo";

/**
 * PUT /api/leads/[id]/demo — salva a configuração da demo do lead (skin,
 * preset de tema e overrides de conteúdo) no campo `demo` do doc. A rota
 * pública /demo/{leadId} lê daqui. Nenhuma chamada ao Google.
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
