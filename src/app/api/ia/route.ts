import { NextResponse } from "next/server";

import { GEMINI_MODEL, aiDisponivel } from "@/lib/ai";

/**
 * Disponibilidade da IA (GEMINI_API_KEY configurada?). A UI consulta isto
 * para ocultar/desabilitar as funcionalidades de IA com aviso — sem a
 * chave nada quebra, só some. Nunca expõe a chave, só o boolean.
 */
export async function GET() {
  return NextResponse.json({ disponivel: aiDisponivel(), modelo: GEMINI_MODEL });
}
