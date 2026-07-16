import { IMAGEM_FORMATOS, IMAGEM_MAX_BYTES } from "@/lib/demos/imagens";

/**
 * Compressão client-side simples antes do upload (canvas, sem lib):
 * redimensiona para no máximo 1600px no lado maior e re-encoda em WebP.
 * Arquivos já pequenos passam direto; se mesmo comprimido continuar acima
 * de 2MB, o upload é recusado aqui (o servidor revalida de qualquer jeito).
 */

const LADO_MAX = 1600;
/** Abaixo disso nem vale recomprimir — sobe o original. */
const LIMIAR_BYTES = 500 * 1024;

function carregarImagem(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não deu pra ler a imagem — o arquivo está íntegro?"));
    };
    img.src = url;
  });
}

function paraBlob(canvas: HTMLCanvasElement, tipo: string, qualidade: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, tipo, qualidade));
}

export async function prepararImagem(file: File): Promise<File> {
  if (!IMAGEM_FORMATOS[file.type]) {
    throw new Error("Formato não aceito — use JPG, PNG ou WebP.");
  }

  const img = await carregarImagem(file);
  const maiorLado = Math.max(img.naturalWidth, img.naturalHeight);
  if (file.size <= LIMIAR_BYTES && maiorLado <= LADO_MAX) {
    return file;
  }

  const escala = Math.min(1, LADO_MAX / maiorLado);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * escala));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * escala));
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // WebP preserva transparência do PNG e comprime melhor que JPEG.
  const blob = await paraBlob(canvas, "image/webp", 0.82);
  const comprimido =
    blob && blob.size < file.size
      ? new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp" })
      : file;

  if (comprimido.size > IMAGEM_MAX_BYTES) {
    throw new Error(
      `Mesmo comprimida a imagem ficou com ${(comprimido.size / 1024 / 1024).toFixed(1)}MB — o máximo é 2MB.`,
    );
  }
  return comprimido;
}
