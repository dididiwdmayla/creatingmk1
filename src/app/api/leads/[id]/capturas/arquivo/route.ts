import { servirArquivoCaptura } from "@/lib/demos/capturas/servir";
import { NotFoundError, UnauthorizedError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError } from "@/lib/http";
import { getLead } from "@/lib/leads/repo";
import { usuarioDaRequest } from "@/lib/usuarios";

/**
 * GET /api/leads/[id]/capturas/arquivo?tela=&ancora=&versao= — UMA captura
 * da demo deste lead, servida pela origem do Radar em vez de direto do
 * Storage (o porquê está em `lib/demos/capturas/servir.ts`, junto com a
 * lógica, dividida com a rota gêmea da demo avulsa).
 *
 * Restrita a usuário logado, qualquer papel — é o mesmo trabalho de
 * prospecção que gera as capturas. Nenhuma chamada paga: lê o Firestore e
 * busca um objeto público do Storage.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDb();
    const usuario = await usuarioDaRequest(db, req);
    if (!usuario) throw new UnauthorizedError();

    const lead = await getLead(db, id);
    if (!lead) throw new NotFoundError("Lead não encontrado.");

    return await servirArquivoCaptura(req, lead.capturas, lead.nome);
  } catch (error) {
    return handleRouteError(error);
  }
}
