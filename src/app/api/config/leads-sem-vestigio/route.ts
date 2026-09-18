import { NextResponse } from "next/server";

import { ValidationError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError } from "@/lib/http";
import { CORTE_PADRAO, corteValido, listarSemVestigio } from "@/lib/leads/semVestigio";
import { requireAdmin } from "@/lib/usuarios";

/**
 * `GET /api/config/leads-sem-vestigio?corte=YYYY-MM-DD` — os leads antigos
 * que estão em "novo" e não têm vestígio NENHUM de contato: nem
 * `seloContato`, nem `registrosEnvio`, nem `contato.primeiroContatoEm`, nem
 * doc em `filaEnvios` (ver `lib/leads/semVestigio.ts` para o recorte
 * inteiro e para por que a claim da fila conta como vestígio).
 *
 * `corte` é a chave de calendário em **America/Sao_Paulo**, não UTC —
 * mesmo precedente do agrupamento de `/buscas` por mês. Ausente, vale
 * `CORTE_PADRAO` (o dia em que `registrosEnvio` passou a existir). Formato
 * inválido é **400, nunca um fallback silencioso**: cair no padrão sem
 * avisar mostraria uma lista que não é a que o operador pediu — e é sobre
 * essa lista que ele vai apertar "excluir em definitivo".
 *
 * Mora sob `/api/config/`, e NÃO sob `/api/fila/`, pelo mesmo motivo das
 * rotas do painel da fila ao lado: o proxy deixa todo o prefixo
 * `/api/fila/` passar sem sessão de usuário (é o celular com Bearer
 * RADAR_DEVICE_KEY — ver src/proxy.ts), e pendurar ali uma tela de admin a
 * tiraria da sessão junto.
 *
 * Restrita ao ADMIN nos três verbos desta família, GET incluído: a lista é
 * a matéria-prima de uma ação destrutiva, e quem não pode apagar também não
 * precisa da lista de candidatos. 401 sem sessão, 403 para membro.
 */
export async function GET(req: Request) {
  try {
    const db = getDb();
    await requireAdmin(db, req);

    const corte = new URL(req.url).searchParams.get("corte") ?? CORTE_PADRAO;
    if (!corteValido(corte)) {
      throw new ValidationError([`corte deve ser uma data YYYY-MM-DD válida (recebi "${corte}")`]);
    }

    return NextResponse.json(await listarSemVestigio(db, corte));
  } catch (error) {
    return handleRouteError(error);
  }
}
