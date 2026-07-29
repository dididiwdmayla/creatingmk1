import { NextResponse } from "next/server";

import { ValidationError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { regiaoCacheKey } from "@/lib/geo/geocode";
import { handleRouteError, readJsonBody } from "@/lib/http";
import { setIndiceAjustado } from "@/lib/regioes";
import { requireAdmin } from "@/lib/usuarios";

/**
 * Edição manual do índice (admin, na UI da região): `indiceAjustado`
 * number seta (vence o índice gerado nos cálculos), `null` limpa (volta a
 * valer o gerado). Região sem índice gerado ainda → 404.
 */
export async function PATCH(req: Request) {
  try {
    const db = getDb();
    await requireAdmin(db, req);

    const body = await readJsonBody(req);
    if (typeof body.regiao !== "string" || !body.regiao.trim()) {
      throw new ValidationError(["regiao deve ser string não vazia"]);
    }
    const valor = body.indiceAjustado;
    if (valor !== null && (typeof valor !== "number" || !Number.isFinite(valor) || valor <= 0)) {
      throw new ValidationError(["indiceAjustado deve ser número > 0 ou null (limpa o ajuste)"]);
    }

    const slug = regiaoCacheKey(body.regiao.trim());
    const salva = await setIndiceAjustado(db, slug, valor);
    return NextResponse.json({ regiao: salva });
  } catch (error) {
    return handleRouteError(error);
  }
}
