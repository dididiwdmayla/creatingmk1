import { NextResponse } from "next/server";

import { removerImagensDoLead } from "@/lib/demos/imagens";
import { validateLeadDemoInput } from "@/lib/demos/validate";
import { getDb } from "@/lib/firebase/admin";
import { getDemoStorage } from "@/lib/firebase/storage";
import { handleRouteError, readJsonBody } from "@/lib/http";
import { ehLeadDeTeste } from "@/lib/fila/leadTeste";
import { ValidationError } from "@/lib/errors";
import { deleteDemo, getLead, saveDemo } from "@/lib/leads/repo";
import { usuarioDaRequest } from "@/lib/usuarios";

/**
 * PUT /api/leads/[id]/demo — salva a configuração da demo do lead (skin,
 * preset de tema, ajustes de tema e overrides de conteúdo) no campo `demo`
 * do doc. A rota pública /demo/{leadId} lê daqui. Nenhuma chamada ao Google.
 *
 * DELETE /api/leads/[id]/demo — apaga a configuração E as imagens do lead
 * no Storage (todas viram órfãs junto com o registro). /demo/{leadId}
 * volta a 404. Idempotente: lead sem demo responde 200 do mesmo jeito.
 *
 * **Exceção: o lead fixo de teste recusa.** A demo e a captura dele são
 * geradas UMA vez e persistem — ele existe justamente para estar pronto na
 * noite em que alguém precisar testar o aparelho, e um clique aqui o
 * deixaria "não pronto" sem ninguém perceber até lá (ver
 * `lib/fila/leadTeste.ts`). Não há job que invalide capturas; este caminho
 * manual era o único, e é o que fica fechado.
 */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await readJsonBody(req);
    const demo = validateLeadDemoInput(body);
    const db = getDb();
    // "Demo criada" registra o usuário do primeiro save (criadoPor).
    const usuario = await usuarioDaRequest(db, req);
    const lead = await saveDemo(db, id, demo, undefined, usuario?.id);
    return NextResponse.json({ lead });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDb();
    if (ehLeadDeTeste(await getLead(db, id))) {
      throw new ValidationError([
        "a demo do lead fixo de teste não é apagável — ela existe para o disparo de teste da fila estar sempre pronto",
      ]);
    }
    const lead = await deleteDemo(db, id);
    // A limpeza do Storage vem DEPOIS de apagar o registro e não derruba a
    // resposta: arquivo órfão custa centavos; demo meio-apagada confunde.
    try {
      await removerImagensDoLead(getDemoStorage(), id);
    } catch (error) {
      console.error("[radar] falha ao limpar imagens da demo:", error);
    }
    return NextResponse.json({ lead });
  } catch (error) {
    return handleRouteError(error);
  }
}
