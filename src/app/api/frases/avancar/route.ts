import { NextResponse } from "next/server";

import { getDb } from "@/lib/firebase/admin";
import { avancarRotacao, validarAlvoRotacao } from "@/lib/frases";
import { handleRouteError, readJsonBody } from "@/lib/http";

/**
 * Avança a rotação de UM nicho (`nicho: null` = o conjunto genérico). É o
 * único caminho que mexe no contador, e quem o chama é o clique de enviar
 * pro WhatsApp — abrir a ficha, copiar o link ou editar a frase não passam
 * por aqui.
 *
 * Não é restrito ao admin: quem prospecta é o time inteiro, e o contador é
 * compartilhado justamente para que a rotação ande com os envios de todos.
 * Nicho sem conjunto salvo devolve 0 sem gravar nada.
 */
export async function POST(req: Request) {
  try {
    const corpo = await readJsonBody(req);
    validarAlvoRotacao(corpo);
    const indice = await avancarRotacao(getDb(), corpo.nicho);
    return NextResponse.json({ indice });
  } catch (error) {
    return handleRouteError(error);
  }
}
