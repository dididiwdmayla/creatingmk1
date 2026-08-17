import { NextResponse } from "next/server";

import { enfileirarCapturas, estadoDasCapturas } from "@/lib/demos/capturas/enfileirar";
import { UnauthorizedError, ValidationError } from "@/lib/errors";
import { capturasDisponiveis } from "@/lib/github/dispatch";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError, readJsonBody } from "@/lib/http";
import { usuarioDaRequest } from "@/lib/usuarios";

/**
 * GET /api/capturas?ids=a,b,c — estado da geração de cada ALVO pedido.
 * Um alvo é uma demo de lead (id cru) ou uma demo avulsa (`avulsa:<id>` —
 * ver lib/demos/capturas/alvo.mjs); as duas guardam o estado no mesmo
 * campo `capturas`, e a resposta usa o alvo COMO VEIO como chave.
 *
 * É o alvo do acompanhamento da ficha e do lote: a execução leva minutos e
 * o operador não pode ficar recarregando a página. Devolve SÓ o campo
 * `capturas`, que é o único que muda enquanto o workflow roda — recarregar
 * o lead inteiro a cada poucos segundos seria pagar caro por dado parado.
 * Também informa se a geração está configurada, pra UI não oferecer um
 * botão que só falharia.
 *
 * POST /api/capturas { placeIds: [...] } — enfileira o LOTE (ação a partir
 * de um grupo de busca, e o caminho de UM alvo só usado pela seção de
 * capturas). Mesma restrição de sessão do disparo individual. O nome do
 * campo continua `placeIds` porque é o que a UI já manda; o conteúdo é
 * lista de ALVOS.
 *
 * Teto de 60 alvos por chamada: o workflow roda um atrás do outro num
 * runner só, e um lote maior que isso passa do `timeout-minutes` do job —
 * melhor recusar na hora do que deixar metade morrer no silêncio.
 */

const MAX_LOTE = 60;

function idsDaQuery(url: string): string[] {
  const bruto = new URL(url).searchParams.get("ids") ?? "";
  return [...new Set(bruto.split(",").map((v) => v.trim()).filter(Boolean))];
}

export async function GET(req: Request) {
  try {
    const db = getDb();
    const usuario = await usuarioDaRequest(db, req);
    if (!usuario) throw new UnauthorizedError();

    const ids = idsDaQuery(req.url);
    if (ids.length > MAX_LOTE) {
      throw new ValidationError([`no máximo ${MAX_LOTE} ids por consulta`]);
    }

    return NextResponse.json({
      capturas: ids.length > 0 ? await estadoDasCapturas(db, ids) : {},
      disponivel: capturasDisponiveis(),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(req: Request) {
  try {
    const db = getDb();
    const usuario = await usuarioDaRequest(db, req);
    if (!usuario) throw new UnauthorizedError();

    const body = (await readJsonBody(req)) as { placeIds?: unknown; forcar?: unknown };
    const placeIds = Array.isArray(body?.placeIds)
      ? [...new Set(body.placeIds.filter((v): v is string => typeof v === "string" && v !== ""))]
      : [];

    if (placeIds.length === 0) {
      throw new ValidationError([
        "placeIds deve ser uma lista não vazia de alvos (id de lead, ou avulsa:<id>)",
      ]);
    }
    if (placeIds.length > MAX_LOTE) {
      throw new ValidationError([
        `no máximo ${MAX_LOTE} alvos por lote (recebeu ${placeIds.length}) — o workflow captura um de cada vez`,
      ]);
    }

    const resultado = await enfileirarCapturas(db, placeIds, {
      userId: usuario.id,
      forcar: body?.forcar === true,
    });
    return NextResponse.json(resultado);
  } catch (error) {
    return handleRouteError(error);
  }
}
