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

export interface ParadaCanvas {
  /** Posição da parada em fração do raio (0–1), pronta pro addColorStop. */
  parada: number;
  /** Alfa FINAL da cor naquela parada (perfil × opacidade da intensidade). */
  alfa: number;
}

/**
 * A MESMA rampa medida, com a **transparência pré-calculada**: cada parada
 * já traz o alfa final, perfil × `opacidadeAura`, pronto pra virar um
 * `addColorStop` de canvas.
 *
 * ## Por que a rampa saiu do CSS (a queda do gradiente animado)
 *
 * Antes disto o blob era uma `<div>` com `background: radial-gradient(...)`
 * cujas paradas eram `color-mix(in srgb, var(--d-efeito-c1) X%,
 * transparent)`, mais `opacity` no elemento e `mix-blend-mode: screen`. As
 * três peças caíram juntas, cada uma por um motivo medido:
 *
 * 1. **o gradiente em CSS**: nos modos de cor ANIMADOS (`transicao`,
 *    `iridescente`, `arco-iris`) a custom property muda a 60 Hz, e cada
 *    mudança REGENERA a imagem de gradiente e repinta o elemento — que tem
 *    ~2× a viewport de lado. Medido no celular 390×844 com CPU 4×, rolando
 *    a página inteira: **10,5 Mpx/s repintados com a cor do tema contra
 *    83,6 Mpx/s no iridescente e 82,6 no arco-íris**, ~1,4 Mpx por quadro
 *    só de decoração. É o mesmo corolário da "regra de superfície" que
 *    reprovou a `filotaxia` (93 spans com gradiente na cor animada), aqui
 *    com 2 superfícies gigantes em vez de 93 pequenas. Num canvas a cor é
 *    LIDA e o bitmap é do tamanho que o efeito escolhe;
 * 2. **`mix-blend-mode: screen`**: nunca fez o que o comentário dizia. A
 *    raiz do efeito é `position: fixed; z-index: 40` — um stacking context,
 *    e stacking context ISOLA blending: os blobs só faziam screen entre si,
 *    nunca com a página (confirmado: no preset claro o efeito ABAIXA a
 *    luminância média da viewport, 0,806 → 0,650, o oposto de "soma luz");
 * 3. **`opacity` no elemento**: era só um multiplicador do alfa da rampa —
 *    aqui ele entra na conta uma vez, na tabela, e some do compositor.
 *
 * O tamanho aparente, a rampa e a opacidade final são os MESMOS de antes.
 */
export function paradasMancha(intensidade: Exclude<EfeitoIntensidade, 0>): ParadaCanvas[] {
  const opacidade = opacidadeAura(intensidade);
  return perfilMancha(intensidade).map(({ parada, cor }) => ({
    parada: Math.min(1, parada / 100),
    alfa: (cor / 100) * opacidade,
  }));
}
