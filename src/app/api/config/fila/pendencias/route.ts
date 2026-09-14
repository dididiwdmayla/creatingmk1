import { NextResponse } from "next/server";

import { listarPendencias } from "@/lib/fila/pendencias";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError } from "@/lib/http";
import { requireAdmin } from "@/lib/usuarios";

/**
 * Lista de pendência do painel "Fila de envio" (/config): os leads que
 * receberam o TEXTO mas não o print, porque o anexo falhou depois de a
 * mensagem já ter saído (ver `detalheEnvio` em lib/fila/estado.ts).
 *
 * Mora sob `/api/config/`, e NÃO sob `/api/fila/`, de propósito: o proxy
 * deixa todo o prefixo `/api/fila/` passar sem sessão de usuário (é o
 * celular com Bearer RADAR_DEVICE_KEY — ver src/proxy.ts). Esta rota é
 * para uma PESSOA logada no painel; pendurá-la lá embaixo a tiraria da
 * sessão junto.
 *
 * Restrita ao ADMIN, leitura e escrita (no PATCH ao lado), como todo o
 * painel "Fila de envio": a fila é global — um `/config/fila`, um pool, um
 * contador — e é drenada por UM aparelho físico, então ver e mexer no
 * estado dela é comando sobre o celular de outra pessoa, não consulta.
 *
 * `?resolvidos=1` traz também as já fechadas — a lista mostra as abertas
 * por padrão, mas uma marcada por engano precisa ter como voltar.
 */
export async function GET(req: Request) {
  try {
    const db = getDb();
    await requireAdmin(db, req);
    const incluirResolvidos = new URL(req.url).searchParams.get("resolvidos") === "1";
    const pendencias = await listarPendencias(db, { incluirResolvidos });
    return NextResponse.json({ pendencias });
  } catch (error) {
    return handleRouteError(error);
  }
}
