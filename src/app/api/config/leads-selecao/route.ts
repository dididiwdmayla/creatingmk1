import { NextResponse } from "next/server";

import { getDb } from "@/lib/firebase/admin";
import { handleRouteError } from "@/lib/http";
import { listarOpcoesDeLead } from "@/lib/leads/selecao";
import { requireAdmin } from "@/lib/usuarios";

/**
 * A LISTA DO SELETOR DE LEAD — nome, nicho, cidade e se tem demo, de cada
 * lead, e nada além disso (ver `lib/leads/selecao.ts`).
 *
 * Mora sob `/api/config/`, e NÃO sob `/api/fila/`, pelo motivo de sempre:
 * aquele prefixo inteiro passa SEM sessão de usuário (é o celular com
 * Bearer `RADAR_DEVICE_KEY` — ver `src/proxy.ts`), e é o oposto do que esta
 * rota precisa.
 *
 * **Admin, como os painéis que a usam.** Os três campos que o seletor
 * substitui vivem em "Fila de envio" e "Respostas pendentes", admin dos
 * dois lados — e esta resposta é o retrato da base de leads inteira num
 * único corpo, que não é consulta de membro.
 *
 * **O custo, explícito:** é VARREDURA de `/leads` (o `AppDb` não tem
 * query), então a tela a chama UMA vez, quando o seletor abre — nunca a
 * cada tecla digitada, que é o mesmo trabalho repetido por letra. Filtrar
 * por nome é do cliente, sobre a lista que já está em mãos.
 */
export async function GET(req: Request) {
  try {
    const db = getDb();
    await requireAdmin(db, req);
    const leads = await listarOpcoesDeLead(db);
    return NextResponse.json({ leads });
  } catch (error) {
    return handleRouteError(error);
  }
}
