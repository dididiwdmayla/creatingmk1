import { NextResponse } from "next/server";

import { ValidationError } from "@/lib/errors";
import { resolverResposta } from "@/lib/fila/respostasPainel";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError, readJsonBody } from "@/lib/http";
import { requireAdmin } from "@/lib/usuarios";

/**
 * `PATCH /api/config/fila/respostas/{id}` — corpo `{ estado, texto? }`: o
 * operador USOU o rascunho (mandou o texto pelo WhatsApp Business) ou o
 * DESCARTOU (prefere responder do próprio jeito). Nos dois casos a
 * pendência sai da lista; só o "usada" guarda o texto.
 *
 * `texto` é o que o operador de fato mandou — a caixa da tela é EDITÁVEL, e
 * é a edição dela que vai para o WhatsApp, não o rascunho original. Guardar
 * o rascunho no lugar do editado registraria uma resposta que ninguém
 * recebeu. Ausente, cai no rascunho (o caminho de quem não editou nada).
 *
 * Restrito ao admin, mesma divisão do `PATCH .../pendencias/{leadId}`.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb();
    await requireAdmin(db, req);
    const { id } = await params;
    const { estado, texto } = await readJsonBody(req);

    if (estado !== "usada" && estado !== "descartada") {
      throw new ValidationError(['estado deve ser "usada" ou "descartada"']);
    }
    if (texto !== undefined && typeof texto !== "string") {
      throw new ValidationError(["texto deve ser string"]);
    }

    await resolverResposta(db, id, estado, texto, new Date());
    return NextResponse.json({ id, estado });
  } catch (error) {
    return handleRouteError(error);
  }
}
