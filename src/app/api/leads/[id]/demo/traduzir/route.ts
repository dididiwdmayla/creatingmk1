import { NextResponse } from "next/server";

import { AiIndisponivelError, aiDisponivel } from "@/lib/ai";
import {
  conteudoTraduzivelVazio,
  extrairConteudoTraduzivel,
  traduzirConteudoDemo,
} from "@/lib/ai/traducaoDemo";
import { loadConfig } from "@/lib/config";
import { coagirConteudoParaTraducao } from "@/lib/demos/traducaoInput";
import { getSkin } from "@/lib/demos/registry";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError, readJsonBody } from "@/lib/http";
import { IDIOMA_PADRAO, IDIOMAS_SUPORTADOS } from "@/lib/idioma";
import { getLead } from "@/lib/leads/repo";
import { usuarioDaRequest } from "@/lib/usuarios";

type Params = { params: Promise<{ id: string }> };

/**
 * 4ª ação do botão de IA do editor de demo: TRADUZIR o texto atual (SKU
 * aiGeneration, mesma mecânica de reserveQuota das demais gerações — ver
 * lib/ai/traducaoDemo.ts). Só GERA e devolve a tradução validada: nada é
 * escrito na demo — aplicar/descartar é decisão do usuário no editor,
 * igual à sugestão, e a persistência continua sendo o PUT normal.
 *
 * `dados` no corpo é o DemoData EFETIVO do editor (exemplo ← lead ←
 * edições ainda não salvas), não os slots padrão da skin nem o que já está
 * persistido — a entrada é sempre o que o usuário está vendo na tela.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();

    if (!aiDisponivel()) throw new AiIndisponivelError();

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

    const lead = await getLead(db, id);
    if (!lead) {
      throw new NotFoundError(`Lead "${id}" não encontrado.`);
    }

    const dados = coagirConteudoParaTraducao(body.dados);
    const conteudo = extrairConteudoTraduzivel(dados, skin);
    if (conteudoTraduzivelVazio(conteudo)) {
      throw new ValidationError(["o editor não tem nenhum campo de conteúdo preenchido para traduzir"]);
    }

    const usuario = await usuarioDaRequest(db, req);
    const config = await loadConfig(db);
    const traducao = await traduzirConteudoDemo(db, conteudo, body.idioma, config.caps, {
      userId: usuario?.id,
      isAdmin: usuario?.papel === "admin",
      limites: usuario?.limites,
    });
    return NextResponse.json({ traducao, idioma: body.idioma });
  } catch (error) {
    return handleRouteError(error);
  }
}
