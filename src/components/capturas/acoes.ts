"use client";

/**
 * AS DUAS AÇÕES da galeria — compartilhar e baixar — e a diferença entre
 * elas, que a interface precisa deixar explícita:
 *
 *   - **Compartilhar** abre a folha nativa do aparelho com as imagens
 *     anexadas. NÃO salva nada no aparelho: o arquivo vai direto para o
 *     app escolhido e some. Quem espera achar a imagem na galeria depois
 *     não acha.
 *   - **Baixar** salva os arquivos, um por imagem, sem compactar.
 *
 * As duas passam pela rota `/api/leads/[id]/capturas/arquivo`, e não pelo
 * endereço do Storage, por causa de CORS: o objeto é público mas o bucket
 * não manda cabeçalho de CORS, então `fetch` de outra origem é bloqueado —
 * e sem `fetch` não há `File`, e sem `File` não há folha nativa.
 */

export interface ImagemParaAcao {
  /** Rota do arquivo na origem do Radar. */
  url: string;
  /** Nome legível, o que aparece na pasta de downloads. */
  nome: string;
}

/**
 * O aparelho sabe compartilhar ARQUIVO? (não basta saber compartilhar
 * texto — desktop e navegadores antigos têm `share` sem suporte a `files`)
 *
 * Onde não souber, a ação de compartilhar é ESCONDIDA. Oferecer um botão
 * que não funciona, ou trocá-lo por um empacotado que ninguém pediu, é
 * pior que não ter o botão.
 *
 * Só pode ser chamada no cliente, depois da montagem: no servidor não há
 * `navigator`, e decidir isso no render inicial dá divergência de
 * hidratação.
 */
export function podeCompartilharArquivos(): boolean {
  if (typeof navigator === "undefined") return false;
  if (typeof navigator.share !== "function" || typeof navigator.canShare !== "function") {
    return false;
  }
  try {
    // A sonda precisa ser um arquivo DE VERDADE: `canShare({files: []})`
    // responde `true` em navegador que não anexa arquivo nenhum.
    const sonda = new File([new Uint8Array([0])], "sonda.png", { type: "image/png" });
    return navigator.canShare({ files: [sonda] });
  } catch {
    return false;
  }
}

/** Erro de compartilhamento que a interface precisa distinguir. */
export type FalhaCompartilhar = "cancelado" | "gesto-expirado" | "falhou";

export function classificarFalha(erro: unknown): FalhaCompartilhar {
  const nome = erro instanceof Error ? erro.name : "";
  // O operador fechou a folha. Não é erro: não merece mensagem nenhuma.
  if (nome === "AbortError") return "cancelado";
  // Safari exige que `share` seja chamado ainda dentro do toque. Buscar as
  // imagens antes consome esse crédito, e a chamada é recusada. Com os
  // arquivos já em mãos, o segundo toque compartilha na hora — por isso a
  // interface pede pra tocar de novo em vez de dizer que falhou.
  if (nome === "NotAllowedError") return "gesto-expirado";
  return "falhou";
}

/** Busca as imagens pela origem do Radar e devolve `File`s prontos. */
export async function buscarArquivos(imagens: ImagemParaAcao[]): Promise<File[]> {
  const arquivos: File[] = [];
  for (const imagem of imagens) {
    const resposta = await fetch(imagem.url);
    if (!resposta.ok) throw new Error(`não deu pra buscar ${imagem.nome}`);
    const blob = await resposta.blob();
    arquivos.push(new File([blob], imagem.nome, { type: blob.type || "image/png" }));
  }
  return arquivos;
}

/**
 * Salva os arquivos UM A UM, sem compactar.
 *
 * A pausa entre eles não é enfeite: disparar vários downloads no mesmo
 * instante faz o navegador descartar todos menos o primeiro. Com o
 * intervalo, os seis chegam.
 */
export async function baixarUmAUm(
  imagens: ImagemParaAcao[],
  { pausaMs = 350, doc = typeof document === "undefined" ? undefined : document } = {},
): Promise<number> {
  if (!doc) return 0;
  let salvos = 0;
  for (const [i, imagem] of imagens.entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, pausaMs));
    const link = doc.createElement("a");
    link.href = imagem.url;
    link.download = imagem.nome;
    link.rel = "noopener";
    doc.body.appendChild(link);
    link.click();
    link.remove();
    salvos += 1;
  }
  return salvos;
}
