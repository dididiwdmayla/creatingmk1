import { NextResponse } from "next/server";

import { saudeDaFila } from "@/lib/fila/saude";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError } from "@/lib/http";
import { requireAdmin } from "@/lib/usuarios";

/**
 * `GET /api/config/fila/saude` — as variáveis de ambiente de que a fila
 * depende, cada uma PRESENTE ou AUSENTE (ver `lib/fila/saude.ts`). Só o
 * nome: o valor nunca sai do servidor.
 *
 * Sob `/api/config/` e restrita ao admin pelos mesmos motivos das outras
 * rotas do painel "Fila de envio" (o prefixo `/api/fila/` passa sem sessão
 * de usuário — ver src/proxy.ts).
 */
export async function GET(req: Request) {
  try {
    await requireAdmin(getDb(), req);
    return NextResponse.json(saudeDaFila());
  } catch (error) {
    return handleRouteError(error);
  }
}
