import { NextResponse } from "next/server";

import { getDb } from "@/lib/firebase/admin";
import { handleRouteError } from "@/lib/http";
import { listLeads } from "@/lib/leads/repo";

export async function GET(req: Request) {
  try {
    const params = new URL(req.url).searchParams;
    const leads = await listLeads(getDb(), {
      status: params.get("status") ?? undefined,
      temSite: params.get("temSite") ?? undefined,
      temTelefone: params.get("temTelefone") ?? undefined,
      buscaId: params.get("buscaId") ?? undefined,
      favorito: params.get("favorito") ?? undefined,
    });
    return NextResponse.json({ leads });
  } catch (error) {
    return handleRouteError(error);
  }
}
