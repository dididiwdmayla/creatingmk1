import { NextResponse } from "next/server";

import { IMAGENS_MODOS, type ImagensModo } from "@/lib/demos/types";
import { validateLeadDemoInput } from "@/lib/demos/validate";
import { LOTE_ORCAMENTO_MS_PADRAO, processarLoteComOrcamento } from "@/lib/demos/lote";
import { ValidationError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError, readJsonBody } from "@/lib/http";
import { saveDemo } from "@/lib/leads/repo";
import { usuarioDaRequest } from "@/lib/usuarios";

const LEAD_IDS_MAX = 300;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * POST /api/demos/lote — cria a demo de vários leads de uma vez (skin,
 * preset de tema, efeito e modo de imagem escolhidos no diálogo de lote).
 * Render de Firestore, igual ao PUT /api/leads/[id]/demo de um lead só —
 * NUNCA dispara request ao Google/Gemini, então o lote inteiro não
 * consome nenhuma cota.
 *
 * Paginada por ORÇAMENTO DE TEMPO (ver lib/demos/lote.ts): cada chamada
 * processa a partir de `cursor` até o orçamento estourar (nunca no meio
 * de um lead) e devolve `proximoCursor` — o cliente chama de novo até vir
 * `null`. Falha em um lead (ex.: id inexistente) não interrompe os
 * demais; o resultado por lead vai em `resultados`.
 */
export async function POST(req: Request) {
  try {
    const body = await readJsonBody(req);

    const leadIds = body.leadIds;
    if (!Array.isArray(leadIds) || leadIds.length === 0 || !leadIds.every((id) => typeof id === "string")) {
      throw new ValidationError(["leadIds deve ser uma lista não-vazia de ids"]);
    }
    if (leadIds.length > LEAD_IDS_MAX) {
      throw new ValidationError([`leadIds aceita no máximo ${LEAD_IDS_MAX} leads por lote`]);
    }

    // O diálogo de lote só oferece skin/preset/efeito/modo de imagem — mais
    // estreito que o PUT de um lead só (que aceita todo TemaPatch). Chaves
    // fora dessas quatro são rejeitadas AQUI, antes de reusar a validação
    // completa de validateLeadDemoInput pros valores em si.
    if (body.tema !== undefined) {
      if (!isRecord(body.tema)) {
        throw new ValidationError(["tema deve ser um objeto"]);
      }
      const chavesInvalidas = Object.keys(body.tema).filter((chave) => chave !== "fundoEfeito");
      if (chavesInvalidas.length > 0) {
        throw new ValidationError([
          `tema: o lote só aceita "fundoEfeito" (chave desconhecida: ${chavesInvalidas.join(", ")})`,
        ]);
      }
    }

    const imagensModo = body.imagensModo;
    if (
      imagensModo === undefined ||
      typeof imagensModo !== "string" ||
      !(IMAGENS_MODOS as readonly string[]).includes(imagensModo)
    ) {
      throw new ValidationError([`imagensModo deve ser um de: ${IMAGENS_MODOS.join(", ")}`]);
    }

    const cursor = body.cursor === undefined ? 0 : body.cursor;
    if (typeof cursor !== "number" || !Number.isInteger(cursor) || cursor < 0) {
      throw new ValidationError(["cursor deve ser um inteiro >= 0"]);
    }

    const demoInput = validateLeadDemoInput({
      skinId: body.skinId,
      themeId: body.themeId,
      dados: { imagensModo: imagensModo as ImagensModo },
      ...(body.tema !== undefined && { tema: body.tema }),
    });

    const db = getDb();
    const usuario = await usuarioDaRequest(db, req);
    const now = new Date();

    const { resultados, proximoCursor } = await processarLoteComOrcamento(
      leadIds,
      cursor,
      async (leadId) => {
        await saveDemo(db, leadId, demoInput, now, usuario?.id);
      },
      { orcamentoMs: LOTE_ORCAMENTO_MS_PADRAO },
    );

    return NextResponse.json({
      resultados: resultados.map(({ item, status, erro }) => ({
        leadId: item,
        status,
        ...(erro !== undefined && { erro }),
      })),
      proximoCursor,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
