import { NextResponse } from "next/server";

import {
  criarDemoAvulsa,
  garantirEnvioTokenAvulsa,
  listDemosAvulsas,
} from "@/lib/demos/avulsas/repo";
import { configDoCorpo, validarIdentidadeAvulsa } from "@/lib/demos/avulsas/validate";
import { validateLeadDemoInput } from "@/lib/demos/validate";
import { UnauthorizedError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError, readJsonBody } from "@/lib/http";
import { usuarioDaRequest } from "@/lib/usuarios";

/**
 * Demos avulsas — as que existem sem lead associado (ver
 * `lib/demos/avulsas/types.ts`).
 *
 * GET — lista todas, para a página /demos. Faz o mesmo self-heal de token
 * de envio que a listagem de leads: "Copiar link" precisa do token pronto
 * no carregamento, nunca de um fetch no clique.
 *
 * POST — cria uma. O corpo junta as duas metades do diálogo: a IDENTIDADE
 * digitada à mão (nome, país, cidade, telefone, whatsapp, horários,
 * instagram, endereço) e a CONFIGURAÇÃO da demo (skin, preset, `dados`,
 * `tema`) — esta última validada pelo mesmo `validateLeadDemoInput` do PUT
 * do editor. Firestore puro, nenhuma chamada paga, nenhum contador de
 * cota: uma avulsa não é prospecção.
 */
export async function GET(req: Request) {
  try {
    const db = getDb();
    if (!(await usuarioDaRequest(db, req))) throw new UnauthorizedError();

    const avulsas = await listDemosAvulsas(db);
    const comToken = await Promise.all(
      avulsas.map((avulsa) => garantirEnvioTokenAvulsa(db, avulsa.id)),
    );
    return NextResponse.json({ avulsas: comToken });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(req: Request) {
  try {
    const db = getDb();
    const usuario = await usuarioDaRequest(db, req);
    if (!usuario) throw new UnauthorizedError();

    const body = await readJsonBody(req);
    const identidade = validarIdentidadeAvulsa(body);
    const { skinId, themeId, dados, tema } = validateLeadDemoInput(configDoCorpo(body));

    const avulsa = await criarDemoAvulsa(
      db,
      identidade,
      { skinId, themeId, dados, tema },
      undefined,
      usuario.id,
    );
    return NextResponse.json({ avulsa }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
