import { NextResponse } from "next/server";

import { listBuscasRecorrentes, updateBusca } from "@/lib/buscas/repo";
import { BUSCA_CORES } from "@/lib/buscas/types";
import { loadConfig } from "@/lib/config";
import { ValidationError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError, readJsonBody } from "@/lib/http";

export const MENSAGEM_MAX = 1000;

type Params = { params: Promise<{ id: string }> };

/**
 * Edita a busca: cor (restrita à paleta BUSCA_CORES), mensagem padrão do
 * grupo (string vazia limpa — volta ao fallback global da config) e/ou o
 * toggle recorrente (ligar respeita o teto config.maxBuscasRecorrentes).
 */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await readJsonBody(req);
    const problemas: string[] = [];

    const { cor, mensagemPadrao, recorrente } = body;
    if (cor === undefined && mensagemPadrao === undefined && recorrente === undefined) {
      problemas.push("informe ao menos um de: cor, mensagemPadrao, recorrente");
    }
    if (recorrente !== undefined && typeof recorrente !== "boolean") {
      problemas.push("recorrente deve ser booleano");
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

    const db = getDb();
    if (recorrente === true) {
      // Teto de recorrentes SIMULTÂNEAS: ligar mais uma só se couber.
      const config = await loadConfig(db);
      const ativas = (await listBuscasRecorrentes(db)).filter((b) => b.id !== id);
      if (ativas.length >= config.maxBuscasRecorrentes) {
        throw new ValidationError([
          `teto de ${config.maxBuscasRecorrentes} busca(s) recorrente(s) simultânea(s) atingido — ` +
            "desligue outra ou aumente o teto em /config",
        ]);
      }
    }

    const busca = await updateBusca(db, id, {
      cor: cor as string | undefined,
      mensagemPadrao: mensagemPadrao as string | undefined,
      recorrente: recorrente as boolean | undefined,
    });
    return NextResponse.json({ busca });
  } catch (error) {
    return handleRouteError(error);
  }
}
