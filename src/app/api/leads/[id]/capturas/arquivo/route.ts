import {
  CAPTURA_TELAS,
  ehVersao,
  nomeDoArquivo,
  versaoDaImagem,
  type CapturaTela,
  type CapturaVersao,
} from "@/lib/demos/capturas/estado";
import { NotFoundError, UnauthorizedError, ValidationError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError } from "@/lib/http";
import { getLead } from "@/lib/leads/repo";
import { usuarioDaRequest } from "@/lib/usuarios";

/**
 * GET /api/leads/[id]/capturas/arquivo?tela=&ancora=&versao= — UMA captura,
 * servida pela origem do Radar em vez de direto do Storage.
 *
 * O desvio existe por causa de UMA coisa: **CORS**. Os objetos são
 * públicos, mas o bucket não manda cabeçalho de CORS, e sem ele o `fetch`
 * do navegador para outra origem é bloqueado. A folha de compartilhamento
 * nativa (`navigator.share`) precisa de `File` em memória — ou seja, do
 * `fetch` — então sem esta rota o "Compartilhar" simplesmente não existe.
 *
 * A mesma rota serve o "Baixar": mesma origem faz o atributo `download`
 * valer, e o `Content-Disposition` daqui carimba um nome legível
 * (`barbearia-norte-celular-01-hero.png`) no lugar do nome no Storage, que
 * começa com o `placeId` e não diz nada a quem abre a pasta depois.
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

    const busca = new URL(req.url).searchParams;
    const tela = busca.get("tela");
    const ancora = busca.get("ancora");
    const versaoBruta = busca.get("versao");
    if (!CAPTURA_TELAS.includes(tela as CapturaTela) || !ancora) {
      throw new ValidationError(["informe tela=celular|desktop e ancora=<id da seção>"]);
    }
    const versao: CapturaVersao = ehVersao(versaoBruta) ? versaoBruta : "crua";

    const lead = await getLead(db, id);
    if (!lead) throw new NotFoundError("Lead não encontrado.");

    const imagem = (lead.capturas?.imagens ?? []).find(
      (i) => i.tela === tela && i.ancora === ancora,
    );
    if (!imagem) throw new NotFoundError("Captura não encontrada nesta rodada.");

    const alvo = versaoDaImagem(imagem, versao);
    if (!alvo) throw new NotFoundError("Esta captura não tem versão com moldura.");

    const upstream = await fetch(alvo.url);
    if (!upstream.ok || !upstream.body) {
      throw new NotFoundError("A imagem não está mais no Storage.");
    }

    return new Response(upstream.body, {
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "image/png",
        "Content-Disposition": `attachment; filename="${nomeDoArquivo(imagem, lead.nome, versao)}"`,
        // O objeto no Storage é imutável e a URL dele carrega `?v=`, então
        // guardar por um dia é seguro — e economiza a segunda busca quando
        // o operador baixa e depois compartilha as mesmas imagens.
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
