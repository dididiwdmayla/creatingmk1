import {
  CAPTURA_TELAS,
  ehVersao,
  nomeDoArquivo,
  versaoDaImagem,
  type CapturaTela,
  type CapturaVersao,
  type LeadCapturas,
} from "./estado";
import { NotFoundError, ValidationError } from "@/lib/errors";

/**
 * UMA captura, servida pela ORIGEM do Radar em vez de direto do Storage —
 * a parte comum das duas rotas de arquivo (a da demo de lead e a da
 * avulsa), que só diferem em de onde leem o `capturas` e o nome.
 *
 * O desvio pela nossa origem existe por causa de UMA coisa: **CORS**. Os
 * objetos são públicos, mas o bucket não manda cabeçalho de CORS, e sem
 * ele o `fetch` do navegador para outra origem é bloqueado. A folha de
 * compartilhamento nativa (`navigator.share`) precisa de `File` em memória
 * — ou seja, do `fetch` — então sem esta rota o "Compartilhar" não existe.
 *
 * A mesma rota serve o "Baixar": mesma origem faz o atributo `download`
 * valer, e o `Content-Disposition` daqui carimba um nome legível
 * (`barbearia-norte-celular-01-hero.png`) no lugar do nome no Storage, que
 * começa com o id e não diz nada a quem abre a pasta depois.
 */
export async function servirArquivoCaptura(
  req: Request,
  capturas: LeadCapturas | undefined,
  nomeNegocio: string,
): Promise<Response> {
  const busca = new URL(req.url).searchParams;
  const tela = busca.get("tela");
  const ancora = busca.get("ancora");
  const versaoBruta = busca.get("versao");
  if (!CAPTURA_TELAS.includes(tela as CapturaTela) || !ancora) {
    throw new ValidationError(["informe tela=celular|desktop e ancora=<id da seção>"]);
  }
  const versao: CapturaVersao = ehVersao(versaoBruta) ? versaoBruta : "crua";

  const imagem = (capturas?.imagens ?? []).find((i) => i.tela === tela && i.ancora === ancora);
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
      "Content-Disposition": `attachment; filename="${nomeDoArquivo(imagem, nomeNegocio, versao)}"`,
      // O objeto no Storage é imutável e a URL dele carrega `?v=`, então
      // guardar por um dia é seguro — e economiza a segunda busca quando
      // o operador baixa e depois compartilha as mesmas imagens.
      "Cache-Control": "private, max-age=86400",
    },
  });
}
