import { NextResponse } from "next/server";

import { liberarRevisao, listarRevisao } from "@/lib/fila/revisao";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError, jsonError } from "@/lib/http";
import { requireAdmin } from "@/lib/usuarios";

/**
 * `DELETE /api/config/fila/revisao/{leadId}` — LIBERAR PARA A FILA: o
 * operador conferiu no WhatsApp que a mensagem NÃO saiu (ver
 * `liberarRevisao`).
 *
 * DELETE, e não PATCH: o que se apaga é a REVISÃO, não o lead nem a claim —
 * e a ação é de mão única. A revisão é estado DERIVADO da claim silenciosa,
 * e "conferi, não saiu" é informação que o servidor não tem como reproduzir
 * depois. Se o operador errar, o lead volta à fila e sai uma mensagem.
 *
 * **409 `claim_ativa`** com o `expiraEm`: claim não vencida quer dizer que o
 * aparelho pode estar com o WhatsApp aberto neste segundo. Recusa sem
 * explicação faria o operador clicar de novo. **404** para lead fora da
 * revisão, sem criar doc. Restrito ao admin: 401 sem sessão, 403 para membro.
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
    const resultado = await liberarRevisao(db, leadId, now);
    if (!resultado.ok) {
      return jsonError(
        409,
        resultado.motivo,
        "O aparelho está com esse lead reservado agora — pode estar enviando neste momento. " +
          "A reserva morre sozinha em minutos; tente depois.",
        { expiraEm: resultado.expiraEm },
      );
    }

    // Relê a lista inteira: quem decide quem continua em revisão é o
    // servidor, e devolver a lista nova evita que a tela adivinhe.
    return NextResponse.json(await listarRevisao(db, now));
  } catch (error) {
    return handleRouteError(error);
  }
}
