import { NextResponse } from "next/server";

import { AiIndisponivelError, aiDisponivel } from "@/lib/ai";
import { loadConfig } from "@/lib/config";
import { ValidationError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { geocodeRegion, regiaoCacheKey } from "@/lib/geo/geocode";
import { handleRouteError } from "@/lib/http";
import { gerarIndiceRegiao, getRegiaoIndice, parseCidadePais, salvarRegiaoIndice } from "@/lib/regioes";
import { usuarioDaRequest } from "@/lib/usuarios";

/**
 * Índice de mercado da região (calculadora de precificação). O slug é a
 * MESMA chave normalizada do cache de geocoding (`regiaoCacheKey`) — a
 * região é geocodificada (cache em /geocache, como em /api/geocode) e,
 * se ainda não tiver índice gerado, UMA chamada ao Gemini gera e cacheia
 * PERMANENTEMENTE em /regioes/{slug}. Chamadas seguintes vêm do cache,
 * qualquer que seja o usuário — regenerar é ação explícita do admin
 * (POST /api/regioes/regenerar).
 */
export async function GET(req: Request) {
  try {
    const db = getDb();
    const param = new URL(req.url).searchParams.get("regiao");
    const usuario = await usuarioDaRequest(db, req);
    const config = await loadConfig(db);
    const regiao = (param ?? config.regiao).trim();
    if (!regiao) {
      throw new ValidationError([
        "informe ?regiao= ou preencha a região default na config",
      ]);
    }

    const isAdmin = usuario?.papel === "admin";
    const geo = await geocodeRegion(db, regiao, config.caps, { userId: usuario?.id, isAdmin });
    const slug = regiaoCacheKey(geo.regiao);

    const existente = await getRegiaoIndice(db, slug);
    if (existente) {
      return NextResponse.json({ regiao: existente, cached: true });
    }

    if (!aiDisponivel()) throw new AiIndisponivelError();

    const { cidade, pais } = parseCidadePais(geo.endereco);
    const gerado = await gerarIndiceRegiao(
      db,
      { cidade, pais, regiaoTexto: geo.regiao },
      config.caps,
      { userId: usuario?.id, isAdmin },
    );
    const salva = await salvarRegiaoIndice(
      db,
      slug,
      { regiaoTexto: geo.regiao, cidade, pais },
      gerado,
    );
    return NextResponse.json({ regiao: salva, cached: false });
  } catch (error) {
    return handleRouteError(error);
  }
}
