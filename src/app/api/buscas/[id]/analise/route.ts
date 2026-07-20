import { NextResponse } from "next/server";

import { AiIndisponivelError, aiDisponivel, gerarAnaliseBusca } from "@/lib/ai";
import { getBusca, salvarAnaliseIA } from "@/lib/buscas/repo";
import { loadConfig } from "@/lib/config";
import { ValidationError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError } from "@/lib/http";
import { listLeads } from "@/lib/leads/repo";
import { usuarioDaRequest } from "@/lib/usuarios";

type Params = { params: Promise<{ id: string }> };

/**
 * Análise de grupo via Gemini (SKU aiGeneration, mesma cota das demais
 * chamadas de IA — ver src/lib/ai): todos os leads do grupo entram numa
 * ÚNICA chamada; o resultado (um parágrafo pt-BR) fica cacheado no doc da
 * busca — só regenera quando este POST é chamado de novo.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();

    if (!aiDisponivel()) throw new AiIndisponivelError();

    const busca = await getBusca(db, id);
    const leads = await listLeads(db, { buscaId: id });
    if (leads.length === 0) {
      throw new ValidationError(["o grupo não tem leads para analisar"]);
    }

    const usuario = await usuarioDaRequest(db, req);
    const config = await loadConfig(db);
    const analise = await gerarAnaliseBusca(db, busca, leads, config.caps, usuario?.id);
    const atualizada = await salvarAnaliseIA(db, id, analise);
    return NextResponse.json({ busca: atualizada });
  } catch (error) {
    return handleRouteError(error);
  }
}
