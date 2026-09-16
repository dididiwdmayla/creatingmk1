import { NextResponse } from "next/server";

import { loadFilaConfig } from "@/lib/fila/config";
import { retencaoMsDeHoras } from "@/lib/fila/envios";
import { liberarRetido, listarRetidos } from "@/lib/fila/retidos";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError, jsonError } from "@/lib/http";
import { requireAdmin } from "@/lib/usuarios";

/**
 * `DELETE /api/config/fila/retidos/{leadId}` — o operador conferiu que a
 * mensagem realmente NÃO saiu e devolve o lead à fila antes de a janela de
 * retenção vencer.
 *
 * DELETE, e não PATCH: o que se apaga é a RETENÇÃO, não o lead nem a claim —
 * e a ação é de mão única. Diferente do alternador de `pendencias`, não há
 * "re-reter": a retenção é estado DERIVADO da claim silenciosa (ver
 * `lib/fila/estado.ts`), e o operador afirmando "não saiu" é informação que
 * o servidor não tem como reproduzir depois. Se ele errar, o lead volta à
 * fila e sai uma mensagem — o custo que a assimetria da retenção já assume
 * como recuperável.
 *
 * **409 quando há claim ATIVA no lead**, com o motivo e a hora visíveis: uma
 * claim não expirada quer dizer que o aparelho pode estar com o WhatsApp
 * aberto neste segundo, e liberar ali produziria a segunda reserva do mesmo
 * lead — exatamente a mensagem duplicada que a retenção existe para evitar.
 * Recusa silenciosa faria o operador clicar de novo.
 *
 * Restrito ao admin, mesma divisão do `PUT /api/config/fila` e do
 * `PATCH .../pendencias/{leadId}`: 401 sem sessão, 403 para membro.
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
    const config = await loadFilaConfig(db);
    const retencaoMs = retencaoMsDeHoras(config.retencaoEnvioHoras);

    const resultado = await liberarRetido(db, leadId, now, retencaoMs);
    if (!resultado.ok) {
      return jsonError(
        409,
        resultado.motivo,
        "O aparelho está com esse lead reservado agora — pode estar enviando neste momento. " +
          "A reserva morre sozinha em minutos; tente depois.",
        { expiraEm: resultado.expiraEm },
      );
    }

    // Relê a lista inteira: quem decide quem continua retido é o servidor, e
    // devolver a lista nova evita que a tela adivinhe o resultado (o mesmo
    // motivo de a visão da fila recarregar depois de "tirar da fila").
    const retidos = await listarRetidos(db, now, retencaoMs);
    return NextResponse.json({ ...retidos, retencaoHoras: config.retencaoEnvioHoras });
  } catch (error) {
    return handleRouteError(error);
  }
}
