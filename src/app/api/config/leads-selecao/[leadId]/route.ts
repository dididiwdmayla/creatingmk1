import { NextResponse } from "next/server";

import { getDb } from "@/lib/firebase/admin";
import { handleRouteError } from "@/lib/http";
import { getLead } from "@/lib/leads/repo";
import { opcaoDoLead } from "@/lib/leads/selecao";
import { requireAdmin } from "@/lib/usuarios";

/**
 * UM lead, pelo id — o que faz um `leadId` já GRAVADO aparecer pelo NOME
 * assim que o painel abre.
 *
 * Sem ela o seletor teria que varrer `/leads` só para descobrir o nome do
 * que já está escolhido, e essa varredura aconteceria no carregamento da
 * /config (os corpos dos painéis continuam MONTADOS mesmo fechados — ver
 * "O corpo fechado continua MONTADO"). Aqui é UMA leitura de documento,
 * por seletor com valor, e a varredura fica onde ela é inevitável: no
 * momento em que a lista abre.
 *
 * **Usa `getLead`, não `listLeads`** — e é de propósito: assim o LEAD FIXO
 * DE TESTE, que `listLeads` exclui na origem, continua resolvendo pelo
 * nome quando é ele que está gravado (é o padrão do disparo de teste e um
 * `leadContextoExcecao` legítimo). Quem lista é filtrado; quem busca por
 * id, não — a mesma distinção que já vale para a ficha `/leads/{id}`.
 *
 * **Id que não existe mais é 200 com `lead: null`, nunca 404.** A limpeza
 * de leads antigos pode excluir justamente o lead escolhido como contexto,
 * e isso é um ESTADO PREVISTO da tela ("lead não encontrado", escolha
 * outro), não um pedido malformado. Responder erro faria um painel inteiro
 * quebrar por causa de um campo com valor velho.
 */
export async function GET(req: Request, ctx: { params: Promise<{ leadId: string }> }) {
  try {
    const db = getDb();
    await requireAdmin(db, req);
    const { leadId } = await ctx.params;
    const lead = await getLead(db, leadId);
    return NextResponse.json({ lead: lead ? opcaoDoLead(lead) : null });
  } catch (error) {
    return handleRouteError(error);
  }
}
