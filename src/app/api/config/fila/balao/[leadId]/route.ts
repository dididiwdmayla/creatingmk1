import { NextResponse } from "next/server";

import { montarBalaoFila, removerDaFila } from "@/lib/fila/balao";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError, jsonError } from "@/lib/http";
import { requireAdmin } from "@/lib/usuarios";

/**
 * `DELETE /api/config/fila/balao/{leadId}` — tirar um lead da fila pelo
 * balão. É a ÚNICA ação que ele tem.
 *
 * O que ela faz é o `descartado` que já existe (o mesmo do card, da ficha e
 * da visão da /config): nada de campo novo, e reversível pela ficha como
 * sempre foi. O que ela acrescenta é a GUARDA — **409 quando há claim ativa
 * no lead**, com a hora em que a reserva morre sozinha.
 *
 * A razão é a mesma da liberação manual de um retido, e usa a mesma função
 * (`claimAtiva`): remover um lead da fila NÃO cancela um envio em andamento.
 * O aparelho pode estar com o WhatsApp aberto neste segundo, e nada daqui
 * alcança a tela dele — então o servidor recusa e DIZ por quê, em vez de
 * fingir que interrompeu algo.
 *
 * Devolve o balão inteiro já relido: quem sai e quem entra na sequência é
 * decisão do servidor (cada linha é reconferida contra o doc fresco), e
 * deixar a tela adivinhar o resultado é justamente o que faria o lead
 * removido continuar listado como próximo. Mesmo motivo de
 * `DELETE .../retidos/{leadId}` devolver a lista nova.
 *
 * ADMIN ONLY, 401/403 como o GET ao lado.
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
  try {
    const db = getDb();
    await requireAdmin(db, req);
    const { leadId } = await params;

    const now = new Date();
    const resultado = await removerDaFila(db, leadId, now);
    if (!resultado.ok) {
      return jsonError(
        409,
        resultado.motivo,
        "O aparelho está com esse lead reservado agora — pode estar enviando neste momento. " +
          "Tirar da fila não cancela o envio em andamento. A reserva morre sozinha em minutos.",
        { expiraEm: resultado.expiraEm },
      );
    }

    return NextResponse.json({ ...(await montarBalaoFila(db, now)), lista: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
