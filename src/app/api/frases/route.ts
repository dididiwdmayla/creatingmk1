import { NextResponse } from "next/server";

import { getDb } from "@/lib/firebase/admin";
import { montarConjuntos, salvarConjunto, validarConjuntoPatch } from "@/lib/frases";
import { handleRouteError, readJsonBody } from "@/lib/http";
import { requireAdmin } from "@/lib/usuarios";

/**
 * GET aberto a qualquer sessão: a ficha do lead e a fila do dia precisam ler
 * a frase da vez para montar o link do WhatsApp. Devolve UMA entrada por
 * skin do registro (mesmo sem frases preenchidas), já com nome e nicho da
 * skin resolvidos — o cliente não importa o registro (ver `montarConjuntos`).
 */
export async function GET() {
  try {
    const { conjuntos } = await montarConjuntos(getDb());
    return NextResponse.json({ conjuntos });
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * PUT restrito ao admin, um conjunto por vez — mesma divisão de /api/config:
 * o texto que sai em nome do time é decisão de quem responde por ele.
 * Salvar textos não mexe no contador da rotação, e `skinId` fora do registro
 * é 400 (a coleção nunca mais aceita chave vinda de texto digitado).
 */
export async function PUT(req: Request) {
  try {
    const db = getDb();
    await requireAdmin(db, req);
    const corpo = await readJsonBody(req);
    validarConjuntoPatch(corpo);
    const conjunto = await salvarConjunto(db, corpo.skinId, corpo.frases);
    return NextResponse.json({ conjunto });
  } catch (error) {
    return handleRouteError(error);
  }
}
