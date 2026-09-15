import { NextResponse } from "next/server";

import { listarRespostasPendentes } from "@/lib/fila/respostasPainel";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError } from "@/lib/http";
import { requireAdmin } from "@/lib/usuarios";

/**
 * Painel "Respostas pendentes" (/config): os leads que RESPONDERAM e já têm
 * rascunho gerado pela IA (ver `flushRespostas.ts` → `/filaRespostas`),
 * esperando o operador usar ou descartar.
 *
 * Mora sob `/api/config/`, e NÃO sob `/api/fila/`, pelo mesmo motivo da
 * lista de print ao lado: o proxy deixa todo o prefixo `/api/fila/` passar
 * sem sessão de usuário (é o celular com Bearer RADAR_DEVICE_KEY — ver
 * src/proxy.ts). Esta rota é para uma PESSOA logada no painel; pendurá-la
 * lá embaixo a tiraria da sessão junto.
 *
 * Restrita ao ADMIN, leitura e escrita (no PATCH ao lado), como todo o
 * bloco "Fila de envio" — e aqui há uma razão a mais que em qualquer outro
 * painel: a resposta do lead é CONTEÚDO DE CONVERSA PRIVADA, captada do
 * celular pessoal do operador (ver PRIVACIDADE no ARCHITECTURE.md).
 * 401 sem sessão, 403 para membro.
 */
export async function GET(req: Request) {
  try {
    const db = getDb();
    await requireAdmin(db, req);
    const respostas = await listarRespostasPendentes(db);
    return NextResponse.json({ respostas });
  } catch (error) {
    return handleRouteError(error);
  }
}
