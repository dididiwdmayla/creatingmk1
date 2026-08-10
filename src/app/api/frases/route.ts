import { NextResponse } from "next/server";

import { getDb } from "@/lib/firebase/admin";
import { montarConjuntos, salvarConjunto, validarConjuntoPatch } from "@/lib/frases";
import { handleRouteError, readJsonBody } from "@/lib/http";
import { requireAdmin } from "@/lib/usuarios";

/**
 * GET aberto a qualquer sessão: a ficha do lead e a fila do dia precisam ler
 * a frase da vez para montar o link do WhatsApp. Devolve TODO nicho já visto
 * em alguma busca (mesmo sem frases preenchidas) mais o conjunto genérico.
 */
export async function GET() {
  try {
    const { conjuntos, genericas } = await montarConjuntos(getDb());
    return NextResponse.json({ conjuntos, genericas });
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * PUT restrito ao admin, um conjunto por vez (`nicho: null` = o genérico) —
 * mesma divisão de /api/config: o texto que sai em nome do time é decisão de
 * quem responde por ele. Salvar textos não mexe no contador da rotação.
 */
export async function PUT(req: Request) {
  try {
    const db = getDb();
    await requireAdmin(db, req);
    const corpo = await readJsonBody(req);
    validarConjuntoPatch(corpo);
    const conjunto = await salvarConjunto(db, corpo.nicho, corpo.frases);
    return NextResponse.json({ conjunto });
  } catch (error) {
    return handleRouteError(error);
  }
}
