import { NextResponse } from "next/server";

import { NotFoundError, ValidationError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError, readJsonBody } from "@/lib/http";
import { changeStatus, getLead } from "@/lib/leads/repo";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/leads/types";

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

/** Transição de status (novo → contactado → respondeu → fechado). */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await readJsonBody(req);
    const status = body.status;
    if (
      typeof status !== "string" ||
      !(LEAD_STATUSES as readonly string[]).includes(status)
    ) {
      throw new ValidationError([
        `status deve ser um de: ${LEAD_STATUSES.join(", ")}`,
      ]);
    }
    const lead = await changeStatus(getDb(), id, status as LeadStatus);
    return NextResponse.json({ lead });
  } catch (error) {
    return handleRouteError(error);
  }
}
