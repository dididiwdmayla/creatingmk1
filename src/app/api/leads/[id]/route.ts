import { NextResponse } from "next/server";

import { NotFoundError, ValidationError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError, readJsonBody } from "@/lib/http";
import { changeStatus, getLead, updateLeadExtras } from "@/lib/leads/repo";
import { LEAD_STATUSES, type Lead, type LeadStatus } from "@/lib/leads/types";
import { usuarioDaRequest } from "@/lib/usuarios";

export const NOTAS_MAX = 500;

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const lead = await getLead(getDb(), id);
    if (!lead) {
      throw new NotFoundError(`Lead "${id}" não encontrado.`);
    }
    return NextResponse.json({ lead });
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * Atualização parcial do lead: transição de status (novo → contactado →
 * respondeu → fechado) e/ou notas/favorito/descartado editáveis direto no
 * card. Descartar é suave: não deleta, só marca (reversível).
 */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await readJsonBody(req);
    const problemas: string[] = [];

    const { status, notas, favorito, descartado } = body;
    if (
      status === undefined &&
      notas === undefined &&
      favorito === undefined &&
      descartado === undefined
    ) {
      problemas.push("informe ao menos um de: status, notas, favorito, descartado");
    }
    if (
      status !== undefined &&
      (typeof status !== "string" || !(LEAD_STATUSES as readonly string[]).includes(status))
    ) {
      problemas.push(`status deve ser um de: ${LEAD_STATUSES.join(", ")}`);
    }
    if (notas !== undefined && typeof notas !== "string") {
      problemas.push("notas deve ser string");
    } else if (typeof notas === "string" && notas.length > NOTAS_MAX) {
      problemas.push(`notas deve ter no máximo ${NOTAS_MAX} caracteres`);
    }
    if (favorito !== undefined && typeof favorito !== "boolean") {
      problemas.push("favorito deve ser booleano");
    }
    if (descartado !== undefined && typeof descartado !== "boolean") {
      problemas.push("descartado deve ser booleano");
    }
    if (problemas.length > 0) {
      throw new ValidationError(problemas);
    }

    const db = getDb();
    let lead: Lead | undefined;
    if (status !== undefined) {
      // "Lead contactado" registra quem contactou (métricas por usuário).
      const usuario = await usuarioDaRequest(db, req);
      lead = await changeStatus(db, id, status as LeadStatus, undefined, usuario?.id);
    }
    if (notas !== undefined || favorito !== undefined || descartado !== undefined) {
      lead = await updateLeadExtras(db, id, {
        notas: notas as string | undefined,
        favorito: favorito as boolean | undefined,
        descartado: descartado as boolean | undefined,
      });
    }
    return NextResponse.json({ lead });
  } catch (error) {
    return handleRouteError(error);
  }
}
