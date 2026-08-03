import type { EfeitoIntensidade } from "../types";

/**
 * Perfil radial dos blobs da aura — puro, testável sem DOM (ver
 * __tests__/estilo.test.ts), mesma convenção do resto do registro.
 *
 * ## Por que existe (a queda do blur, parte 2)
 *
 * Cada blob era um cone radial simples (`cor 0%, transparent 70%`) com
 * `filter: blur(60–100px)` por cima. O contrato dos efeitos só proibia
 * ANIMAR `filter`, e aqui ele de fato nunca era animado — mas o blob tem
 * dezenas de vmax de lado e recebe um `transform` NOVO A CADA QUADRO,
 * escrito pelo rAF do componente. Um elemento com `filter` não composita a
 * transformação: o navegador re-rasteriza E re-borra a superfície inteira
 * toda vez que ela se move. Medido no preview do editor (1400×900,
 * Chromium headless, mediana de 3 cargas): **12,7 fps na intensidade 3**
 * e 16,7 na 1 — o mesmo defeito que derrubava o `gradiente` a 10 fps (ver
 * ../gradiente/estilo.ts), e pela mesma causa.
 *
 * ## A rampa é MEDIDA, não estimada — e o blob precisou CRESCER
 *
 * Duas tentativas erradas antes desta, as duas reprovadas pela captura (a
 * medição de pixel sozinha dizia "quase igual"; o que denunciou foi o
 * olho, e depois o número confirmou):
 *
 * 1. modelar o blur como convolução gaussiana 1-D do cone — errou a cauda
 *    e deixou uma ARESTA CIRCULAR nítida em volta do blob;
 * 2. medir o perfil do gradiente borrado SEM o recorte do `rounded-full` —
 *    a ordem do CSS é `border-radius` recorta o background e o `filter`
 *    borra o resultado JÁ recortado (e sangra pra fora da caixa). Medir na
 *    ordem errada dá um perfil que ainda tem 7% de cor onde o recorte
 *    corta, ou seja, a mesma aresta de novo.
 *
 * A tabela abaixo é o perfil certo, lido do Chromium (`gen-perfil.mjs` do
 * laço de verificação): o gradiente recortado num círculo e SÓ ENTÃO
 * borrado, amostrado ao longo do raio. Ela mostra as duas coisas que a
 * intensidade controlava por trás do `blur = 40 + intensidade × 20`: o
 * ápice que o desfoque derrubava (0,78 / 0,71 / 0,64 — mais desfoque, pico
 * mais baixo) e a cauda que ele esticava, que vai **até 108% do antigo
 * raio** na intensidade 3, ou seja, PRA FORA da caixa que a desenhava.
 *
 * É por isso que a caixa do blob cresceu `ESCALA_CAIXA` vezes: sem
 * `filter` não existe sangramento pra fora do elemento, então a cauda tem
 * que caber dentro dele. Com a caixa 1,6× e o gradiente em `closest-side`,
 * o raio do gradiente passa a ser 0,8 do lado ANTIGO — o suficiente pra
 * cauda inteira — e o blob mantém o tamanho aparente de antes, desde que a
 * posição seja corrigida pra manter o mesmo CENTRO (ver Aura.tsx).
 *
 * Uma diferença assumida: o blur era medido em PX sobre um blob medido em
 * `vmax`, então a difusão relativa mudava com o tamanho da janela (num
 * celular o mesmo blur cobria proporcionalmente mais blob). A rampa é
 * relativa ao raio do gradiente e portanto igual em qualquer viewport — a
 * tabela foi lida na janela de referência do laço de captura (1100px, onde
 * 60vmax = 660px).
 */

/**
 * Quanto a caixa do blob cresceu para caber a cauda que o blur pintava
 * fora dela. 1,6 dá folga sobre os 108% de cauda da intensidade 3
 * (108% × 0,7071 = 0,764 do lado antigo, contra 0,8 de raio disponível).
 */
export const ESCALA_CAIXA = 1.6;

/**
 * Paradas da tabela medida, em % do raio ANTIGO do gradiente
 * (`farthest-corner` da caixa antiga = 0,7071 × lado antigo).
 */
const PARADAS_MEDIDAS = [0, 7, 14, 21, 28, 35, 42, 49, 56, 63, 70, 77, 84, 91, 98, 105, 112] as const;

/** Quanto da cor sobra em cada parada, em %, por intensidade (medido). */
const PERFIL_MEDIDO: Record<1 | 2 | 3, readonly number[]> = {
  1: [78, 76.1, 71.4, 64.3, 55.7, 46.7, 37.3, 27.8, 19.2, 11.8, 6.3, 2.7, 0.8, 0, 0, 0, 0],
  2: [70.6, 69.4, 65.9, 60, 52.5, 44.3, 35.7, 27.1, 19.6, 12.9, 7.8, 4.3, 2, 0.8, 0.4, 0, 0],
  3: [63.5, 62.4, 59.2, 54.5, 48.2, 41.2, 33.7, 26.7, 20, 14.1, 9.4, 5.9, 3.1, 1.6, 0.8, 0.4, 0],
};

/**
 * Conversão da tabela (fração do raio ANTIGO, `farthest-corner` da caixa
 * antiga) para a nova referência (`closest-side` da caixa ampliada, isto é
 * metade dela): `0,7071 × lado / (ESCALA_CAIXA × lado / 2)`. O tamanho
 * APARENTE do blob não muda — só a caixa que o carrega.
 */
const FATOR_RAIO = Math.SQRT1_2 / (ESCALA_CAIXA / 2);

/** Opacidade do blob — inalterada (1→0.38, 2→0.48, 3→0.58). */
export function opacidadeAura(intensidade: Exclude<EfeitoIntensidade, 0>): number {
  return 0.28 + intensidade * 0.1;
}

export interface ParadaMancha {
  /** Posição da parada, em % do raio do gradiente (`closest-side`). */
  parada: number;
  /** Quanto da cor sobra ali, em % (0 = `transparent`). */
  cor: number;
}

/**
 * A rampa de stops equivalente ao cone + blur daquela intensidade, sempre
 * fechada com uma parada transparente em 100% do raio: a cauda medida
 * termina antes disso, então o fecho não cria degrau nenhum — e nada da
 * mancha encosta na borda da caixa com cor.
 */
export function perfilMancha(intensidade: Exclude<EfeitoIntensidade, 0>): ParadaMancha[] {
  const valores = PERFIL_MEDIDO[intensidade];
  const paradas: ParadaMancha[] = [];
  for (const [i, medida] of PARADAS_MEDIDAS.entries()) {
    const parada = Math.round(medida * FATOR_RAIO * 10) / 10;
    paradas.push({ parada, cor: valores[i] });
    // A primeira parada já zerada fecha a rampa: as seguintes seriam
    // `transparent` repetido, sem efeito nenhum no gradiente.
    if (valores[i] === 0) break;
  }
  if (paradas[paradas.length - 1].cor > 0) paradas.push({ parada: 100, cor: 0 });
  return paradas;
}

/** O `background` do blob: a rampa acima já escrita como radial-gradient. */
export function fundoMancha(cor: string, intensidade: Exclude<EfeitoIntensidade, 0>): string {
  const stops = perfilMancha(intensidade).map(({ parada, cor: pct }) => {
    if (pct <= 0) return `transparent ${parada}%`;
    if (pct >= 100) return `${cor} ${parada}%`;
    return `color-mix(in srgb, ${cor} ${pct}%, transparent) ${parada}%`;
  });
  // `closest-side`: o raio do gradiente é METADE da caixa, então a rampa
  // acima (que termina em 100%) morre exatamente onde o `rounded-full`
  // recortaria — nunca é o recorte que termina a mancha.
  return `radial-gradient(circle closest-side, ${stops.join(", ")})`;
}
