import { ValidationError } from "@/lib/errors";
import type { DemoStorage } from "./imagens";

/**
 * Vídeos de demo no Firebase Storage (efeito vídeo-no-título — ver
 * SkinDefinition.videoSlots): mesmo padrão de src/lib/demos/imagens.ts,
 * sobre a mesma interface DemoStorage, com limites/formatos próprios e um
 * prefixo de caminho distinto (nunca colide com uma imagem do mesmo slot).
 *
 * Diferença chave: NÃO há placeholder de vídeo (a Forja não versiona
 * vídeo de terceiros — princípio de "sem assets binários" do
 * ARCHITECTURE.md). Slot sem vídeo simplesmente não usa o efeito; a skin
 * cai no fallback (imagem do slot correspondente, ou cor sólida).
 */

/** Teto de upload (~15MB) — vídeo pesa mais que imagem; o editor avisa disso. */
export const VIDEO_MAX_BYTES = 15 * 1024 * 1024;

/** Formatos aceitos (MIME → extensão do arquivo no Storage). */
export const VIDEO_FORMATOS: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
};

/** Slot de vídeo: chave definida pela skin (letras/números/hífen), igual a imagens. */
const SLOT_RE = /^[a-z0-9][a-z0-9-]*$/i;

function prefixoDoLead(leadId: string): string {
  return `demos/${leadId}/`;
}

/** Prefixo com "video-" na frente do slot: nunca colide com o path de uma imagem do mesmo nome. */
function prefixoDoSlot(leadId: string, slot: string): string {
  return `${prefixoDoLead(leadId)}video-${slot}-`;
}

export function validarSlotVideo(slot: unknown, slotsValidos: readonly string[]): string {
  if (typeof slot !== "string" || !SLOT_RE.test(slot)) {
    throw new ValidationError(["slot deve ser um identificador de slot de vídeo"]);
  }
  if (!slotsValidos.includes(slot)) {
    throw new ValidationError([
      slotsValidos.length > 0
        ? `slot de vídeo desconhecido: "${slot}" (slots da skin: ${slotsValidos.join(", ")})`
        : `a skin não oferece vídeo-no-título (slot "${slot}" pedido)`,
    ]);
  }
  return slot;
}

export function validarVideo(contentType: string, tamanho: number): string {
  const problemas: string[] = [];
  const ext = VIDEO_FORMATOS[contentType];
  if (!ext) {
    problemas.push(
      `formato "${contentType}" não aceito (use ${Object.keys(VIDEO_FORMATOS).join(", ")})`,
    );
  }
  if (tamanho <= 0) {
    problemas.push("arquivo vazio");
  } else if (tamanho > VIDEO_MAX_BYTES) {
    problemas.push(
      `arquivo com ${(tamanho / 1024 / 1024).toFixed(1)}MB — o máximo é ${VIDEO_MAX_BYTES / 1024 / 1024}MB`,
    );
  }
  if (problemas.length > 0) throw new ValidationError(problemas);
  return ext;
}

/**
 * Sobe o vídeo do slot (apagando as versões anteriores do mesmo slot) e
 * devolve a URL pública que o editor grava em dados.videos[slot].
 */
export async function salvarVideoDemo(
  storage: DemoStorage,
  leadId: string,
  slot: string,
  data: Uint8Array,
  contentType: string,
  now: Date = new Date(),
): Promise<string> {
  const ext = validarVideo(contentType, data.byteLength);
  const path = `${prefixoDoSlot(leadId, slot)}${now.getTime()}.${ext}`;
  await storage.deleteByPrefix(prefixoDoSlot(leadId, slot));
  await storage.save(path, data, contentType);
  return storage.publicUrl(path);
}

/** Remove os arquivos do slot (volta ao fallback: imagem ou cor sólida). */
export async function removerVideoDemo(
  storage: DemoStorage,
  leadId: string,
  slot: string,
): Promise<void> {
  await storage.deleteByPrefix(prefixoDoSlot(leadId, slot));
}

// removerImagensDoLead (imagens.ts) já apaga TODO o prefixo demos/{leadId}/
// no "Excluir demo" — como os vídeos vivem sob o mesmo prefixo do lead
// (só com "video-" na frente do slot), a exclusão total já os alcança sem
// precisar de uma função own aqui.
