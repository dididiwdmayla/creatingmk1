import { NextResponse } from "next/server";

import { listBuscas } from "@/lib/buscas/repo";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError } from "@/lib/http";

/** Buscas salvas, mais recentes primeiro. */
export async function GET() {
  try {
    const buscas = await listBuscas(getDb());
    return NextResponse.json({ buscas });
  } catch (error) {
    return handleRouteError(error);
  }
}
