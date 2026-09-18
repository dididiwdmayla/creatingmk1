import { NextResponse } from "next/server";

import { ValidationError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { getDemoStorage } from "@/lib/firebase/storage";
import { handleRouteError, readJsonBody } from "@/lib/http";
import { excluirLeadsDefinitivo } from "@/lib/leads/exclusao";
import {
  CORTE_PADRAO,
  corteValido,
  listarSemVestigio,
  validarLeadIds,
} from "@/lib/leads/semVestigio";
import { requireAdmin } from "@/lib/usuarios";

/**
 * `POST /api/config/leads-sem-vestigio/excluir` — EXCLUIR EM DEFINITIVO os
 * leads marcados. Única rota do app que destrói doc de `/leads`.
 *
 * O que ela destrói está escrito, item por item, no cabeçalho de
 * `lib/leads/exclusao.ts` — e o diálogo de confirmação da tela cita a
 * MESMA lista, de propósito: a promessa que o operador lê antes de apertar
 * e o que o código faz têm que ser a mesma frase.
 *
 * **Não valida o recorte de novo aqui.** A tela só oferece a ação sobre
 * linhas que a listagem devolveu, e re-filtrar no servidor daria a falsa
 * impressão de uma trava que não existe (entre listar e apertar, o lead
 * pode ter mudado). O que protege é o outro lado: a lista é conservadora
 * (qualquer vestígio, inclusive doc em `filaEnvios`, tira o lead de lá) e a
 * ação é explicitamente confirmada por quem a pediu.
 *
 * `POST`, e não `DELETE`: o corpo é uma lista de ids, e `DELETE` com corpo é
 * terreno em que proxy e cliente se comportam de formas diferentes demais
 * para uma ação que não tem desfazer. O `DELETE` continua sendo a forma das
 * exclusões de UM recurso identificado pela URL (ver
 * `/api/config/fila/retidos/{leadId}`).
 *
 * Devolve o que de fato aconteceu (`excluidos`, `filaEnviosRemovidos`,
 * `storageFalhou`) e a lista nova — nada é deduzido pela tela.
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

    const resultado = await excluirLeadsDefinitivo(db, getDemoStorage(), leadIds);
    return NextResponse.json({ ...resultado, ...(await listarSemVestigio(db, corte)) });
  } catch (error) {
    return handleRouteError(error);
  }
}
