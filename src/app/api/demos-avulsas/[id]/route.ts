import { NextResponse } from "next/server";

import {
  deleteDemoAvulsa,
  garantirEnvioTokenAvulsa,
  salvarPaisAvulsa,
} from "@/lib/demos/avulsas/repo";
import { validarPaisAvulsa } from "@/lib/demos/avulsas/validate";
import { removerImagensDoLead } from "@/lib/demos/imagens";
import { UnauthorizedError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { getDemoStorage } from "@/lib/firebase/storage";
import { handleRouteError, readJsonBody } from "@/lib/http";
import { usuarioDaRequest } from "@/lib/usuarios";

type Params = { params: Promise<{ id: string }> };

/**
 * GET — a avulsa inteira (o editor carrega daqui, como carrega o lead pelo
 * `/api/leads/[id]`). O self-heal de token de envio acontece na leitura,
 * mesmo motivo da listagem.
 *
 * PATCH `{ pais }` — o país do negócio, de onde saem idioma e moeda. Vive
 * fora do PUT da demo porque não é `LeadDemo`: é identidade da avulsa, e o
 * PUT valida chave desconhecida como erro (e deve continuar validando).
 *
 * DELETE — apaga a avulsa INTEIRA (doc + imagens/vídeos no Storage). Ao
 * contrário do lead, onde "Excluir demo" tira só o campo `demo` e o
 * prospect fica, aqui a demo é o registro todo.
 */
export async function GET(req: Request, { params }: Params) {
  try {
    const db = getDb();
    if (!(await usuarioDaRequest(db, req))) throw new UnauthorizedError();

    const { id } = await params;
    return NextResponse.json({ avulsa: await garantirEnvioTokenAvulsa(db, id) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const db = getDb();
    if (!(await usuarioDaRequest(db, req))) throw new UnauthorizedError();

    const { id } = await params;
    const pais = validarPaisAvulsa(await readJsonBody(req));
    return NextResponse.json({ avulsa: await salvarPaisAvulsa(db, id, pais) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    const db = getDb();
    if (!(await usuarioDaRequest(db, req))) throw new UnauthorizedError();

    const { id } = await params;
    await deleteDemoAvulsa(db, id);
    // Mesma ordem do DELETE do lead: a limpeza do Storage vem DEPOIS e não
    // derruba a resposta — arquivo órfão custa centavos, demo meio-apagada
    // confunde. O prefixo é o mesmo (`demos/{id}/`); ids de avulsa são
    // UUID e não colidem com Place ID.
    try {
      await removerImagensDoLead(getDemoStorage(), id);
    } catch (error) {
      console.error("[radar] falha ao limpar imagens da demo avulsa:", error);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
