import { NextResponse } from "next/server";

import { enfileirarCapturas } from "@/lib/demos/capturas/enfileirar";
import { getDb } from "@/lib/firebase/admin";
import { garantirLeadDeTeste, LEAD_TESTE_ID } from "@/lib/fila/leadTeste";
import { handleRouteError, readJsonBody } from "@/lib/http";
import { requireAdmin } from "@/lib/usuarios";

/**
 * POST /api/fila/teste/capturas — gera (ou regenera) a captura do LEAD FIXO
 * DE TESTE, a partir do próprio painel "Disparo de teste".
 *
 * O painel que é DONO do lead de teste é o dono da manutenção dele: antes
 * desta rota, a única forma de gerar a captura dele era abrir a ficha
 * `/leads/radar-lead-teste` à parte — reachable (`getLead`, não `listLeads`,
 * que é só quem o exclui — ver `lib/fila/leadTeste.ts`), mas fora do painel
 * que precisa dela para o disparo de teste funcionar.
 *
 * **Reusa `enfileirarCapturas`** — o MESMO mecanismo de
 * `POST /api/leads/[id]/capturas` e `POST /api/capturas` (marca o estado,
 * dispara o `repository_dispatch` no GitHub). Nada de caminho novo de
 * captura, nada de workflow novo.
 *
 * **Admin, diferente das outras duas rotas de captura** (que aceitam
 * qualquer sessão — gerar print é trabalho de prospecção, não de
 * administração). Esta vive dentro do bloco "Fila de envio", que é
 * admin-only do início ao fim (ver `GET`/`POST /api/fila/teste`), então
 * segue a mesma checagem — 401 sem sessão, 403 para membro — em vez de
 * herdar a regra mais aberta da rota genérica.
 */
export async function POST(req: Request) {
  try {
    const db = getDb();
    const usuario = await requireAdmin(db, req);

    const body = (await readJsonBody(req).catch(() => ({}))) as { forcar?: unknown };

    // Idempotente e não-destrutiva: se o lead ainda não existe (painel nunca
    // aberto), nasce aqui — mesma garantia do GET.
    await garantirLeadDeTeste(db);

    const resultado = await enfileirarCapturas(db, [LEAD_TESTE_ID], {
      userId: usuario.id,
      forcar: body?.forcar === true,
    });

    return NextResponse.json(resultado);
  } catch (error) {
    return handleRouteError(error);
  }
}
