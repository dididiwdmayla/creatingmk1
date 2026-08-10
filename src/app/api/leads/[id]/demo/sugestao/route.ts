import { NextResponse } from "next/server";

import { AiIndisponivelError, aiDisponivel, gerarSugestaoDemo } from "@/lib/ai";
import { NIVEIS_IA, NIVEL_IA_PADRAO, nivelIaValido } from "@/lib/ai/nivel";
import { loadConfig } from "@/lib/config";
import { getSkin } from "@/lib/demos/registry";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError, readJsonBody } from "@/lib/http";
import { IDIOMAS_SUPORTADOS } from "@/lib/idioma";
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
    if (body.nivel !== undefined && !nivelIaValido(body.nivel)) {
      throw new ValidationError([`nivel deve ser um de: ${NIVEIS_IA.join(", ")}`]);
    }
    const nivel = nivelIaValido(body.nivel) ? body.nivel : NIVEL_IA_PADRAO;

    if (body.idioma !== undefined && !IDIOMAS_SUPORTADOS.includes(body.idioma as string)) {
      throw new ValidationError([`idioma deve ser um de: ${IDIOMAS_SUPORTADOS.join(", ")}`]);
    }
    // Idioma escolhido AGORA no seletor do editor (pode ainda não ter sido
    // salvo) — ver gerarSugestaoDemo. Ausente/inválido cai no default
    // persistido/derivado do endereço do lead.
    const idioma = typeof body.idioma === "string" ? body.idioma : undefined;

    const lead = await getLead(db, id);
    if (!lead) {
      throw new NotFoundError(`Lead "${id}" não encontrado.`);
    }

    const usuario = await usuarioDaRequest(db, req);
    const config = await loadConfig(db);
    const sugestao = await gerarSugestaoDemo(
      db,
      lead,
      skin,
      config.caps,
      nivel,
      {
        userId: usuario?.id,
        isAdmin: usuario?.papel === "admin",
        limites: usuario?.limites,
      },
      idioma,
    );
    return NextResponse.json({ sugestao });
  } catch (error) {
    return handleRouteError(error);
  }
}
