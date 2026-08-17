import { nomeDaAvulsa } from "@/lib/demos/avulsas/identidade";
import { getDemoAvulsa } from "@/lib/demos/avulsas/repo";
import { servirArquivoCaptura } from "@/lib/demos/capturas/servir";
import { NotFoundError, UnauthorizedError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError } from "@/lib/http";
import { usuarioDaRequest } from "@/lib/usuarios";

/**
 * GET /api/demos-avulsas/[id]/capturas/arquivo — gêmea da rota de arquivo
 * da demo de lead. Mesma lógica (`lib/demos/capturas/servir.ts`), só
 * lendo o `capturas` do doc da avulsa e usando o nome digitado no
 * `Content-Disposition`.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDb();
    const usuario = await usuarioDaRequest(db, req);
    if (!usuario) throw new UnauthorizedError();

    const avulsa = await getDemoAvulsa(db, id);
    if (!avulsa) throw new NotFoundError("Demo avulsa não encontrada.");

    return await servirArquivoCaptura(req, avulsa.capturas, nomeDaAvulsa(avulsa));
  } catch (error) {
    return handleRouteError(error);
  }
}
