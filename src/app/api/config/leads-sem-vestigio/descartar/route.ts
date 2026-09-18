import { NextResponse } from "next/server";

import { ValidationError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError, readJsonBody } from "@/lib/http";
import {
  CORTE_PADRAO,
  corteValido,
  descartarEmLote,
  listarSemVestigio,
  validarLeadIds,
} from "@/lib/leads/semVestigio";
import { requireAdmin } from "@/lib/usuarios";

/**
 * `POST /api/config/leads-sem-vestigio/descartar` — TIRAR DA FILA os leads
 * marcados na tela de revisão. É a ação PADRÃO, e a reversível.
 *
 * Usa o `descartado` que já existe: o lead continua na base inteiro (demo,
 * captura, telefone, tudo que a busca paga trouxe), vai para o fim da lista
 * de /leads com listra, sai do pool da fila automática — e volta com um
 * clique em "Restaurar lead" na ficha. Nada é destruído, então não há
 * confirmação a pedir.
 *
 * **Caminho SEPARADO do de excluir, e não um `modo` no mesmo corpo.** O
 * reversível e o irreversível não são variantes do mesmo verbo: um endpoint
 * único com `modo: "excluir"` é exatamente como um bug de cliente (ou um
 * corpo remontado por engano) transforma um descarte em destruição. Dois
 * caminhos, dois nomes, nenhuma chance de confundir um pelo outro.
 *
 * Devolve a LISTA NOVA, no mesmo corte: quem decide quem continua na
 * revisão é o servidor, não a tela (mesmo padrão de `liberarRetido`).
 *
 * Admin: 401 sem sessão, 403 para membro.
 */
export async function POST(req: Request) {
  try {
    const db = getDb();
    await requireAdmin(db, req);

    const body = await readJsonBody(req);
    const leadIds = validarLeadIds(body);
    const corte = typeof body.corte === "string" ? body.corte : CORTE_PADRAO;
    if (!corteValido(corte)) {
      throw new ValidationError([`corte deve ser uma data YYYY-MM-DD válida (recebi "${corte}")`]);
    }

    const descartados = await descartarEmLote(db, leadIds);
    return NextResponse.json({ descartados, ...(await listarSemVestigio(db, corte)) });
  } catch (error) {
    return handleRouteError(error);
  }
}
