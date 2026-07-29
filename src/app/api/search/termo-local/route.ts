import { NextResponse } from "next/server";

import { aiDisponivel } from "@/lib/ai";
import { loadConfig } from "@/lib/config";
import { ValidationError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { geocodeRegion, idiomaEhLusofono, idiomaLabel } from "@/lib/geo/geocode";
import { handleRouteError } from "@/lib/http";
import { parseCidadePais } from "@/lib/regioes";
import { gerarTermoLocal, getTraducaoNicho, salvarTraducaoNicho } from "@/lib/traducaoNicho";
import { usuarioDaRequest } from "@/lib/usuarios";

/**
 * Dica de "termo local" pro campo de nicho da busca (/leads): quando a
 * região resolvida é de país NÃO-lusófono, sugere a tradução do nicho pro
 * idioma local — termos em português rendem poucos resultados fora do
 * Brasil/Portugal. A tradução é UMA chamada ao Gemini (SKU aiGeneration)
 * cacheada PERMANENTEMENTE por par nicho+idioma (ver ./lib/traducaoNicho) —
 * chamadas seguintes do mesmo par, qualquer usuário, vêm do cache.
 *
 * `disponivel: false` (sem erro) cobre os três casos em que a dica não
 * aparece: sem GEMINI_API_KEY, região brasileira/lusófona, ou nicho vazio —
 * a UI só mostra a dica quando `disponivel` é true.
 */
export async function GET(req: Request) {
  try {
    const db = getDb();
    const url = new URL(req.url);
    const nicho = (url.searchParams.get("nicho") ?? "").trim();
    const regiaoParam = url.searchParams.get("regiao");

    const usuario = await usuarioDaRequest(db, req);
    const config = await loadConfig(db);
    const regiao = (regiaoParam ?? config.regiao).trim();
    if (!regiao) {
      throw new ValidationError([
        "informe ?regiao= ou preencha a região default na config",
      ]);
    }
    if (!nicho) {
      return NextResponse.json({ disponivel: false });
    }
    if (!aiDisponivel()) {
      return NextResponse.json({ disponivel: false });
    }

    const isAdmin = usuario?.papel === "admin";
    const geo = await geocodeRegion(db, regiao, config.caps, { userId: usuario?.id, isAdmin });
    if (idiomaEhLusofono(geo.idioma)) {
      return NextResponse.json({ disponivel: false });
    }

    const { pais } = parseCidadePais(geo.endereco);
    // "idioma" na resposta é o RÓTULO em português ("inglês", "espanhol"…),
    // pronto pra UI — a UI não precisa saber o código BCP-47 pra exibir.
    const idioma = idiomaLabel(geo.idioma);
    const existente = await getTraducaoNicho(db, nicho, geo.idioma);
    if (existente) {
      return NextResponse.json({ disponivel: true, pais, idioma, termo: existente.termo });
    }

    const termo = await gerarTermoLocal(db, nicho, geo.idioma, config.caps, {
      userId: usuario?.id,
      isAdmin,
    });
    await salvarTraducaoNicho(db, nicho, geo.idioma, termo);
    return NextResponse.json({ disponivel: true, pais, idioma, termo });
  } catch (error) {
    return handleRouteError(error);
  }
}
