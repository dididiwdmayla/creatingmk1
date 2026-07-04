import { NextResponse } from "next/server";

import { updateBuscaCor } from "@/lib/buscas/repo";
import { BUSCA_CORES } from "@/lib/buscas/types";
import { ValidationError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError, readJsonBody } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

/** Edita a cor da busca (restrita à paleta fixa BUSCA_CORES). */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await readJsonBody(req);
    const cor = body.cor;
    if (typeof cor !== "string" || !(BUSCA_CORES as readonly string[]).includes(cor)) {
      throw new ValidationError([
        `cor deve ser uma da paleta: ${BUSCA_CORES.join(", ")}`,
      ]);
    }
    const busca = await updateBuscaCor(getDb(), id, cor);
    return NextResponse.json({ busca });
  } catch (error) {
    return handleRouteError(error);
  }
}
