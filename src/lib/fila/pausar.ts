import { FILA_CONFIG_COLLECTION, FILA_CONFIG_DOC, loadFilaConfig } from "./config";
import type { AppDb } from "@/lib/firestore-like";

/**
 * `POST /api/fila/pausar` — rota ESTREITA: liga/desliga a fila, nada mais.
 *
 * `RADAR_DEVICE_KEY` vive numa variável do MacroDroid, num celular que sai
 * de casa. Comprometida, ela só pode ligar e desligar a fila — nunca
 * reconfigurar cotas, janela ou o disparo de teste. Por isso esta função
 * NUNCA reusa `saveFilaConfig`: aquela grava o doc INTEIRO com `set` (lida a
 * config efetiva, mescla, regrava tudo) — se esta rota lesse a config e
 * regravasse por ali, uma edição do admin no PUT `/api/config/fila` entre a
 * leitura e a escrita seria estourada. Aqui a escrita é DIRIGIDA (`merge:
 * true`, só os três campos abaixo), então uma edição concorrente do admin em
 * `metaDiaria`/`tetoPorHora`/etc. sobrevive intacta.
 */

export interface ResultadoPausar {
  ativo: boolean;
  /** Houve escrita de fato — `false` quando o valor pedido já era o atual. */
  alterado: boolean;
}

/**
 * Aplica (ou não) o novo `ativo`, com merge dirigido ao campo. Idempotente
 * por VALOR, nunca por toggle: a macro pode reenviar o mesmo POST se a rede
 * cair depois de a escrita já ter acontecido, e mandar o valor que já está
 * vale como sucesso sem escrever nada — um toggle desligaria o que acabou
 * de ligar no reenvio.
 */
export async function aplicarPausar(
  db: AppDb,
  novoAtivo: boolean,
  alteradoPor: string,
  now: Date = new Date(),
): Promise<ResultadoPausar> {
  const atual = await loadFilaConfig(db);
  if (atual.ativo === novoAtivo) {
    return { ativo: atual.ativo, alterado: false };
  }

  await db
    .collection(FILA_CONFIG_COLLECTION)
    .doc(FILA_CONFIG_DOC)
    .set(
      {
        ativo: novoAtivo,
        ativoAlteradoPor: alteradoPor,
        ativoAlteradoEm: now.toISOString(),
      },
      { merge: true },
    );

  return { ativo: novoAtivo, alterado: true };
}
