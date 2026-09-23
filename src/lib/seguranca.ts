import { timingSafeEqual } from "node:crypto";

/**
 * Comparação em tempo constante de duas strings — para comparar um segredo
 * RECEBIDO (header, query) contra o valor configurado no servidor, sem
 * vazar por timing quanto da string bateu. O algoritmo em si não é
 * segredo, só o VALOR comparado é — por isso é compartilhado entre todo
 * segredo comparado fora de um hash (`RADAR_DEVICE_KEY` em
 * `lib/fila/auth.ts`, `CAPTURA_SECRET` em `app/demo/comum.tsx`), cada
 * consumidor guardando o seu próprio valor.
 */
export function compararEmTempoConstante(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Gasta o tempo de uma comparação mesmo assim — não vaza o tamanho da
    // chave por timing.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}
