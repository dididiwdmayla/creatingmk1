import { NextResponse } from "next/server";

import { loadFilaConfig, saveFilaConfig } from "@/lib/fila/config";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError, readJsonBody } from "@/lib/http";
import { requireAdmin } from "@/lib/usuarios";

/**
 * `/config/fila` — o painel "Fila de envio" da /config, INTEIRO restrito ao
 * admin: leitura e escrita. Doc PRÓPRIO (ver `lib/fila/config.ts`), não é o
 * mesmo documento de `/api/config`.
 *
 * **Por que o GET também é do admin** (e não "aberto a qualquer sessão",
 * como era e como é o `GET /api/config`): a fila é GLOBAL — um
 * `/config/fila`, um pool, um contador — e é drenada por UM aparelho
 * físico. Não é sigilo de dado, é comando sobre hardware alheio: quem lê
 * esta config está olhando o estado do celular de outra pessoa, e a tela
 * que a consome tem ação (pausa, tetos, tirar lead da fila) ao lado do
 * número. A página /config já é admin-only no proxy; sem esta checagem, a
 * API por trás dela continuava respondendo a membro logado.
 */
export async function GET(req: Request) {
  try {
    const db = getDb();
    await requireAdmin(db, req);
    const fila = await loadFilaConfig(db);
    return NextResponse.json({ fila });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(req: Request) {
  try {
    const db = getDb();
    const usuario = await requireAdmin(db, req);
    const patch = await readJsonBody(req);
    const fila = await saveFilaConfig(db, patch, usuario.id);
    return NextResponse.json({ fila });
  } catch (error) {
    return handleRouteError(error);
  }
}
