import {
  CAPTURA_TELAS,
  ehVersao,
  nomeDoPacote,
  nomeNoPacote,
  porTela,
  versaoDaImagem,
  type CapturaImagem,
  type CapturaTela,
  type CapturaVersao,
} from "@/lib/demos/capturas/estado";
import { NotFoundError, UnauthorizedError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError } from "@/lib/http";
import { getLead } from "@/lib/leads/repo";
import { usuarioDaRequest } from "@/lib/usuarios";
import { fluxoZip, type ArquivoZip } from "@/lib/zip";

/**
 * GET /api/leads/[id]/capturas/zip?tela=celular|desktop|tudo&versao=crua|moldura
 * — as capturas de um grupo (ou as seis) num pacote só.
 *
 * QUEM EMPACOTA É O SERVIDOR porque o caminho do cliente está fechado:
 * baixar os objetos por `fetch` no navegador e zipar lá exigiria
 * configurar CORS no bucket — eles são públicos, mas sem cabeçalho de
 * CORS o `fetch` de outra origem é bloqueado. É a mesma razão pela qual o
 * download de UMA imagem é feito por link com `Content-Disposition`.
 *
 * A resposta é TRANSMITIDA (ver lib/zip.ts): seis capturas de celular
 * passam com folga do que uma resposta não-transmitida comporta numa
 * função serverless, e transmitindo o tamanho do pacote deixa de ser um
 * teto. O primeiro byte também sai antes de a última imagem ter chegado.
 *
 * Restrita a usuário logado, qualquer papel — é o mesmo trabalho de
 * prospecção que gera as capturas. Nenhuma chamada paga: lê o Firestore e
 * busca objetos públicos do Storage.
 */

function telaPedida(url: string): CapturaTela | "tudo" {
  const valor = new URL(url).searchParams.get("tela");
  return CAPTURA_TELAS.includes(valor as CapturaTela) ? (valor as CapturaTela) : "tudo";
}

function versaoPedida(url: string): CapturaVersao {
  const valor = new URL(url).searchParams.get("versao");
  return ehVersao(valor) ? valor : "crua";
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDb();
    const usuario = await usuarioDaRequest(db, req);
    if (!usuario) throw new UnauthorizedError();

    const lead = await getLead(db, id);
    if (!lead) throw new NotFoundError("Lead não encontrado.");

    const tela = telaPedida(req.url);
    const versao = versaoPedida(req.url);
    const grupos = porTela(lead.capturas?.imagens ?? []);
    const escolhidas: CapturaImagem[] =
      tela === "tudo" ? [...grupos.celular, ...grupos.desktop] : grupos[tela];

    // Uma captura sem a versão pedida (moldura que não saiu) fica de fora
    // em vez de o pacote cair na outra versão sem avisar. O cabeçalho
    // abaixo diz quantas entraram, e a galeria já mostra o vão.
    const comUrl = escolhidas.flatMap((imagem) => {
      const alvo = versaoDaImagem(imagem, versao);
      return alvo ? [{ imagem, alvo }] : [];
    });

    if (comUrl.length === 0) {
      throw new NotFoundError(
        versao === "moldura"
          ? "Nenhuma captura deste grupo tem versão com moldura."
          : "Este lead não tem capturas geradas.",
      );
    }

    // Busca uma imagem de cada vez, no ritmo em que o zip as consome: o
    // pacote nunca fica inteiro na memória, só o arquivo corrente.
    const nomeLead = lead.nome;
    async function* arquivos(): AsyncGenerator<ArquivoZip> {
      for (const { imagem, alvo } of comUrl) {
        const resposta = await fetch(alvo.url);
        if (!resposta.ok) continue;
        yield {
          nome: nomeNoPacote(imagem, nomeLead, versao),
          dados: new Uint8Array(await resposta.arrayBuffer()),
        };
      }
    }

    const gerador = fluxoZip(arquivos());
    const fluxo = new ReadableStream<Uint8Array>({
      async pull(controller) {
        // `pull` é chamado de novo a cada pedaço entregue: mantém o gerador
        // como a única fonte de ritmo, em vez de despejar tudo de uma vez
        // num `start`.
        const { value, done } = await gerador.next();
        if (done) controller.close();
        else controller.enqueue(value);
      },
      cancel() {
        void gerador.return(undefined);
      },
    });

    return new Response(fluxo, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${nomeDoPacote(lead.nome, tela, versao)}"`,
        // Quantas entraram de fato — é o que permite a quem baixou saber
        // que faltou uma sem ter que contar os arquivos.
        "X-Capturas-Empacotadas": String(comUrl.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
