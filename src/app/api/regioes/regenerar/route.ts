import { NextResponse } from "next/server";

import { AiIndisponivelError, aiDisponivel } from "@/lib/ai";
import { loadConfig } from "@/lib/config";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { regiaoCacheKey } from "@/lib/geo/geocode";
import { handleRouteError, readJsonBody } from "@/lib/http";
import { gerarIndiceRegiao, getRegiaoIndice, salvarRegiaoIndice } from "@/lib/regioes";
import { requireAdmin } from "@/lib/usuarios";

/**
 * Regeneração explícita do índice de mercado (clique do admin na UI da
 * região). Reaproveita cidade/país/regiaoTexto já salvos — não geocodifica
 * de novo. `indiceAjustado` (edição manual do admin) é PRESERVADO pelo
 * repo: regenerar só atualiza a base sugerida pela IA.
 */
export async function POST(req: Request) {
  try {
    const db = getDb();
    const usuario = await requireAdmin(db, req);

    const body = await readJsonBody(req);
    if (typeof body.regiao !== "string" || !body.regiao.trim()) {
      throw new ValidationError(["regiao deve ser string não vazia"]);
    }
    const slug = regiaoCacheKey(body.regiao.trim());

    const atual = await getRegiaoIndice(db, slug);
    if (!atual) {
      throw new NotFoundError(
        `Região "${body.regiao}" ainda não tem índice gerado — abra a calculadora primeiro.`,
      );
    }

    if (!aiDisponivel()) throw new AiIndisponivelError();

    const config = await loadConfig(db);
    const gerado = await gerarIndiceRegiao(
      db,
      { cidade: atual.cidade, pais: atual.pais, regiaoTexto: atual.regiaoTexto },
      config.caps,
      { userId: usuario.id, isAdmin: true },
    );
    const salva = await salvarRegiaoIndice(
      db,
      slug,
      { regiaoTexto: atual.regiaoTexto, cidade: atual.cidade, pais: atual.pais },
      gerado,
    );
    return NextResponse.json({ regiao: salva });
  } catch (error) {
    return handleRouteError(error);
  }
}
