import { NextResponse } from "next/server";

import { ValidationError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError, readJsonBody } from "@/lib/http";
import { decidirAprovacaoDemo } from "@/lib/leads/repo";
import { usuarioDaRequest } from "@/lib/usuarios";

/**
 * POST /api/leads/[id]/demo/aprovacao `{ aprovacao: "aprovada" | "reprovada" }`
 * — o operador decide a demo que a AUTOMAÇÃO fez. Aprovada, o lead entra na
 * fila de envio (o portão `aguardandoAprovacao` de `motivoEstrutural` sai
 * do caminho); reprovada, fica fora da fila E fora da automação para
 * sempre (ver `decidirAprovacaoDemo`). Demo manual → 400: não existe
 * aprovação para ela.
 *
 * Qualquer sessão, como o PUT da demo: revisar conteúdo é trabalho de
 * prospecção, não de administração.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await readJsonBody(req);
    if (body.aprovacao !== "aprovada" && body.aprovacao !== "reprovada") {
      throw new ValidationError(['aprovacao deve ser "aprovada" ou "reprovada"']);
    }
    const db = getDb();
    const usuario = await usuarioDaRequest(db, req);
    const lead = await decidirAprovacaoDemo(db, id, body.aprovacao, usuario?.id);
    return NextResponse.json({ lead });
  } catch (error) {
    return handleRouteError(error);
  }
}
