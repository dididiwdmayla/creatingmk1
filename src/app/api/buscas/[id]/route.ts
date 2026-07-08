import { NextResponse } from "next/server";

import { updateBusca } from "@/lib/buscas/repo";
import { BUSCA_CORES } from "@/lib/buscas/types";
import { ValidationError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError, readJsonBody } from "@/lib/http";

export const MENSAGEM_MAX = 1000;

type Params = { params: Promise<{ id: string }> };

/**
 * Edita a busca: cor (restrita à paleta BUSCA_CORES) e/ou mensagem padrão
 * do grupo (string vazia limpa — volta ao fallback global da config).
 */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await readJsonBody(req);
    const problemas: string[] = [];

    const { cor, mensagemPadrao } = body;
    if (cor === undefined && mensagemPadrao === undefined) {
      problemas.push("informe ao menos um de: cor, mensagemPadrao");
    }
    if (
      cor !== undefined &&
      (typeof cor !== "string" || !(BUSCA_CORES as readonly string[]).includes(cor))
    ) {
      problemas.push(`cor deve ser uma da paleta: ${BUSCA_CORES.join(", ")}`);
    }
    if (mensagemPadrao !== undefined && typeof mensagemPadrao !== "string") {
      problemas.push("mensagemPadrao deve ser string");
    } else if (
      typeof mensagemPadrao === "string" &&
      mensagemPadrao.length > MENSAGEM_MAX
    ) {
      problemas.push(`mensagemPadrao deve ter no máximo ${MENSAGEM_MAX} caracteres`);
    }
    if (problemas.length > 0) {
      throw new ValidationError(problemas);
    }

    const busca = await updateBusca(getDb(), id, {
      cor: cor as string | undefined,
      mensagemPadrao: mensagemPadrao as string | undefined,
    });
    return NextResponse.json({ busca });
  } catch (error) {
    return handleRouteError(error);
  }
}
