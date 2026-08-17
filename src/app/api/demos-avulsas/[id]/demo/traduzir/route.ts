import { NextResponse } from "next/server";

import { AiIndisponivelError, aiDisponivel } from "@/lib/ai";
import {
  conteudoTraduzivelVazio,
  extrairConteudoTraduzivel,
  traduzirConteudoDemo,
} from "@/lib/ai/traducaoDemo";
import { loadConfig } from "@/lib/config";
import { getDemoAvulsa } from "@/lib/demos/avulsas/repo";
import { getSkin } from "@/lib/demos/registry";
import { coagirConteudoParaTraducao } from "@/lib/demos/traducaoInput";
import { NotFoundError, UnauthorizedError, ValidationError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError, readJsonBody } from "@/lib/http";
import { IDIOMA_PADRAO, IDIOMAS_SUPORTADOS } from "@/lib/idioma";
import { usuarioDaRequest } from "@/lib/usuarios";

type Params = { params: Promise<{ id: string }> };

/**
 * Traduzir o texto atual de uma demo avulsa — gêmea de
 * `/api/leads/[id]/demo/traduzir`, e a ÚNICA ação de IA que a avulsa
 * oferece.
 *
 * A sugestão de texto (`/demo/sugestao`) não tem correspondente aqui de
 * propósito: `gerarSugestaoDemo` monta o prompt a partir do LEAD (nicho da
 * busca, endereço, avaliações, site) — sem lead não há contexto pra
 * alimentar, e uma sugestão sobre o nada seria só o texto do template
 * reescrito. A tradução não tem esse problema: a entrada dela é o conteúdo
 * que já está na tela do editor.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const db = getDb();
    const usuario = await usuarioDaRequest(db, req);
    if (!usuario) throw new UnauthorizedError();

    if (!aiDisponivel()) throw new AiIndisponivelError();

    const { id } = await params;
    const body = await readJsonBody(req);
    const skin = typeof body.skinId === "string" ? getSkin(body.skinId) : undefined;
    if (!skin) {
      throw new ValidationError(["skinId deve ser uma skin do registro"]);
    }

    if (typeof body.idioma !== "string" || !IDIOMAS_SUPORTADOS.includes(body.idioma)) {
      throw new ValidationError([`idioma deve ser um de: ${IDIOMAS_SUPORTADOS.join(", ")}`]);
    }
    if (body.idioma === IDIOMA_PADRAO) {
      throw new ValidationError(["o idioma de destino é português do Brasil — nada para traduzir"]);
    }

    if (!(await getDemoAvulsa(db, id))) {
      throw new NotFoundError(`Demo avulsa "${id}" não encontrada.`);
    }

    const dados = coagirConteudoParaTraducao(body.dados);
    const conteudo = extrairConteudoTraduzivel(dados, skin);
    if (conteudoTraduzivelVazio(conteudo)) {
      throw new ValidationError(["o editor não tem nenhum campo de conteúdo preenchido para traduzir"]);
    }

    const config = await loadConfig(db);
    const traducao = await traduzirConteudoDemo(db, conteudo, body.idioma, config.caps, {
      userId: usuario.id,
      isAdmin: usuario.papel === "admin",
      limites: usuario.limites,
    });
    return NextResponse.json({ traducao, idioma: body.idioma });
  } catch (error) {
    return handleRouteError(error);
  }
}
