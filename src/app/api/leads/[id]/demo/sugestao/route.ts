import { NextResponse } from "next/server";

import { AiIndisponivelError, aiDisponivel, gerarSugestaoDemo } from "@/lib/ai";
import { loadConfig } from "@/lib/config";
import { getSkin } from "@/lib/demos/registry";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError, readJsonBody } from "@/lib/http";
import { getLead } from "@/lib/leads/repo";
import { usuarioDaRequest } from "@/lib/usuarios";

type Params = { params: Promise<{ id: string }> };

/**
 * Sugestão de demo via Gemini (SKU aiGeneration, mesma mecânica de
 * reserveQuota das APIs pagas — retry de resposta inválida reserva de
 * novo). Só GERA e devolve a sugestão validada: nada é escrito na demo —
 * aplicar/descartar é decisão do usuário no editor, e a persistência
 * continua sendo o PUT normal.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();

    if (!aiDisponivel()) throw new AiIndisponivelError();

    const body = await readJsonBody(req);
    const skin = typeof body.skinId === "string" ? getSkin(body.skinId) : undefined;
    if (!skin) {
      throw new ValidationError(["skinId deve ser uma skin do registro"]);
    }

    const lead = await getLead(db, id);
    if (!lead) {
      throw new NotFoundError(`Lead "${id}" não encontrado.`);
    }

    const usuario = await usuarioDaRequest(db, req);
    const config = await loadConfig(db);
    const sugestao = await gerarSugestaoDemo(db, lead, skin, config.caps, usuario?.id);
    return NextResponse.json({ sugestao });
  } catch (error) {
    return handleRouteError(error);
  }
}
