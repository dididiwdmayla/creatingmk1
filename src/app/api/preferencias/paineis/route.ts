import { NextResponse } from "next/server";

import { UnauthorizedError, ValidationError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError, readJsonBody } from "@/lib/http";
import {
  normalizaPaineisConfigAbertos,
  salvarPaineisConfigAbertos,
  usuarioDaRequest,
} from "@/lib/usuarios";

/**
 * Quais painéis da /config estão ABERTOS para este usuário — persistidos
 * por USUÁRIO (não por navegador), lidos uma vez ao abrir a página.
 * Self-service: qualquer sessão lê/grava só as PRÓPRIAS preferências, sem
 * privilégio de admin envolvido (mesmo padrão de /api/preferencias/listas,
 * /api/metas/proprio e /api/tema).
 *
 * NÃO é rota de configuração: não conhece `/config/app` nem `/config/fila`,
 * e nada que ela grave muda o que a plataforma faz — só o que a pessoa vê
 * aberto quando chega. A /config em si continua restrita ao admin pelo
 * proxy; esta rota não é o que decide isso.
 */
export async function GET(req: Request) {
  try {
    const db = getDb();
    const usuario = await usuarioDaRequest(db, req);
    if (!usuario) throw new UnauthorizedError();
    return NextResponse.json({
      paineis: normalizaPaineisConfigAbertos(usuario.paineisConfigAbertos),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * O corpo é a lista INTEIRA de abertos (não um patch): a página já tem o
 * estado em mãos ao alternar um painel, e a normalização corta id inválido,
 * duplicata e o excedente do teto. Mesma escolha da rota das listas — um
 * patch exigiria o servidor conhecer o registro de painéis da UI, que é
 * justamente o que ele não precisa saber.
 */
export async function PUT(req: Request) {
  try {
    const db = getDb();
    const usuario = await usuarioDaRequest(db, req);
    if (!usuario) throw new UnauthorizedError();

    const body = await readJsonBody(req);
    if (!Array.isArray(body.paineis)) {
      throw new ValidationError(["paineis deve ser um array de ids"]);
    }

    const paineis = normalizaPaineisConfigAbertos(body.paineis);
    await salvarPaineisConfigAbertos(db, usuario.id, paineis);
    return NextResponse.json({ paineis });
  } catch (error) {
    return handleRouteError(error);
  }
}
