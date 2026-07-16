import { ValidationError } from "@/lib/errors";

/**
 * Imagens de demo no Firebase Storage: limites, caminhos e operações,
 * sobre uma interface estrutural mínima (DemoStorage) — o adaptador real
 * vive em src/lib/firebase/storage.ts e os testes usam um fake em memória,
 * no mesmo padrão de firestore-like.ts.
 *
 * Convenção de caminhos: demos/{leadId}/{slot}-{timestamp}.{ext}. O upload
 * apaga antes tudo do prefixo demos/{leadId}/{slot}- (a troca nunca deixa
 * arquivo velho pra trás) e o timestamp no nome funciona como cache-bust —
 * cada versão tem URL própria e pode ser servida com cache imutável.
 */

/** Teto de upload (~2MB). O editor comprime client-side antes de enviar. */
export const IMAGEM_MAX_BYTES = 2 * 1024 * 1024;

/** Formatos aceitos (MIME → extensão do arquivo no Storage). */
export const IMAGEM_FORMATOS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Slot de imagem: chave definida pela skin (letras/números/hífen). */
const SLOT_RE = /^[a-z0-9][a-z0-9-]*$/i;

export interface DemoStorage {
  /** Grava o arquivo público no caminho dado. */
  save(path: string, data: Uint8Array, contentType: string): Promise<void>;
  /** Apaga todos os arquivos com o prefixo (não falha se não houver nenhum). */
  deleteByPrefix(prefix: string): Promise<void>;
  /** URL pública e estável do caminho. */
  publicUrl(path: string): string;
}

export function prefixoDoLead(leadId: string): string {
  return `demos/${leadId}/`;
}

function prefixoDoSlot(leadId: string, slot: string): string {
  return `${prefixoDoLead(leadId)}${slot}-`;
}

export function validarSlot(slot: unknown, slotsValidos: string[]): string {
  if (typeof slot !== "string" || !SLOT_RE.test(slot)) {
    throw new ValidationError(["slot deve ser um identificador de slot de imagem"]);
  }
  if (!slotsValidos.includes(slot)) {
    throw new ValidationError([
      `slot desconhecido: "${slot}" (slots da skin: ${slotsValidos.join(", ")})`,
    ]);
  }
  return slot;
}

export function validarImagem(contentType: string, tamanho: number): string {
  const problemas: string[] = [];
  const ext = IMAGEM_FORMATOS[contentType];
  if (!ext) {
    problemas.push(
      `formato "${contentType}" não aceito (use ${Object.keys(IMAGEM_FORMATOS).join(", ")})`,
    );
  }
  if (tamanho <= 0) {
    problemas.push("arquivo vazio");
  } else if (tamanho > IMAGEM_MAX_BYTES) {
    problemas.push(
      `arquivo com ${(tamanho / 1024 / 1024).toFixed(1)}MB — o máximo é ${IMAGEM_MAX_BYTES / 1024 / 1024}MB`,
    );
  }
  if (problemas.length > 0) throw new ValidationError(problemas);
  return ext;
}

/**
 * Sobe a imagem do slot (apagando as versões anteriores do mesmo slot) e
 * devolve a URL pública que o editor grava em dados.imagens[slot].
 */
export async function salvarImagemDemo(
  storage: DemoStorage,
  leadId: string,
  slot: string,
  data: Uint8Array,
  contentType: string,
  now: Date = new Date(),
): Promise<string> {
  const ext = validarImagem(contentType, data.byteLength);
  const path = `${prefixoDoSlot(leadId, slot)}${now.getTime()}.${ext}`;
  await storage.deleteByPrefix(prefixoDoSlot(leadId, slot));
  await storage.save(path, data, contentType);
  return storage.publicUrl(path);
}

/** Remove os arquivos do slot (voltar ao placeholder do template). */
export async function removerImagemDemo(
  storage: DemoStorage,
  leadId: string,
  slot: string,
): Promise<void> {
  await storage.deleteByPrefix(prefixoDoSlot(leadId, slot));
}

/** Remove TODAS as imagens do lead (usado pelo "Excluir demo"). */
export async function removerImagensDoLead(
  storage: DemoStorage,
  leadId: string,
): Promise<void> {
  await storage.deleteByPrefix(prefixoDoLead(leadId));
}
