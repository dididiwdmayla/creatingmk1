import { NextResponse } from "next/server";

import { loadFilaConfig } from "@/lib/fila/config";
import { retencaoMsDeHoras } from "@/lib/fila/envios";
import { listarRetidos } from "@/lib/fila/retidos";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError } from "@/lib/http";
import { requireAdmin } from "@/lib/usuarios";

/**
 * `GET /api/config/fila/retidos` — os leads que a RETENÇÃO POR CLAIM NÃO
 * CONFIRMADA está segurando (ver `lib/fila/retidos.ts`), com a contagem que
 * o funil do painel mostra.
 *
 * Devolve `{ total, linhas }` da MESMA varredura: a contagem do funil e a
 * lista não podem discordar, e duas fontes para o mesmo número divergiriam
 * em silêncio — na tela que existe justamente para nada ficar em silêncio.
 *
 * Mora sob `/api/config/`, e NÃO sob `/api/fila/`, pelo mesmo motivo da
 * lista de pendência ao lado: o proxy deixa todo o prefixo `/api/fila/`
 * passar sem sessão de usuário (é o celular com Bearer RADAR_DEVICE_KEY —
 * ver src/proxy.ts), e pendurar ali uma tela de admin a tiraria da sessão
 * junto.
 *
 * Restrita ao ADMIN, como todo o painel "Fila de envio": a fila é global e é
 * drenada por UM aparelho físico, então ver e mexer no estado dela é comando
 * sobre o celular de outra pessoa, não consulta. 401 sem sessão, 403 para
 * membro.
 */
export async function GET(req: Request) {
  try {
    const db = getDb();
    await requireAdmin(db, req);

    const config = await loadFilaConfig(db);
    const retidos = await listarRetidos(
      db,
      new Date(),
      retencaoMsDeHoras(config.retencaoEnvioHoras),
    );
    // `retencaoEnvioHoras` viaja junto porque a tela precisa dizer a REGRA ao
    // lado do número — "0 retidos" com a retenção desligada e "0 retidos"
    // com ela ligada são fatos diferentes, e o painel não pode confundi-los.
    return NextResponse.json({ ...retidos, retencaoHoras: config.retencaoEnvioHoras });
  } catch (error) {
    return handleRouteError(error);
  }
}
