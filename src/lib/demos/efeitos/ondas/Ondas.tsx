"use client";

import { useEffect, useRef } from "react";

import { corParaRgb, rgba, type Rgb } from "../corComputada";
import { devicePixelRatioClamped } from "../dpr";
import type { EfeitoProps } from "../types";
import { useEfeitoAtivo } from "../useEfeitoAtivo";
import {
  PONTOS_DO_ANEL,
  TEMPO_ESTATICO,
  alfaRelativo,
  aneisOndas,
  camadasParaAlfa,
  espessuraRelativa,
  fatorEspessura,
  fatorRaio,
  opacidadeOndas,
  progressoAnel,
} from "./estilo";

/**
 * ONDAS — anéis concêntricos nascendo do centro e se expandindo até a
 * borda, em **canvas** (nunca SVG; ver "Regra de superfície" em
 * ARCHITECTURE.md). Substitui o `geometrico-pulsante`, que formava figuras
 * legíveis e animava um `<svg>` do tamanho da viewport.
 *
 * Por que canvas, e não SVG: aqui a superfície é um bitmap que ESTE código
 * repinta — o navegador não mantém árvore vetorial nenhuma, não recalcula
 * estilo por nó e, principalmente, o modo de cor animado (arco-íris) não
 * invalida uma árvore de viewport inteira a cada quadro. A cor animada é
 * LIDA (uma property computada, amostrada a cada 3 desenhos), não aplicada
 * a centenas de `stop-color`.
 *
 * Como cada anel é desenhado (o resto da geometria está em ./estilo.ts):
 *
 * - **banda preenchida, não `stroke`**: um `stroke` tem espessura
 *   constante ao longo de todo o caminho; a banda é construída com o
 *   contorno externo e o interno próprios, então a espessura pode variar
 *   com o ÂNGULO (`fatorEspessura`) e o anel nunca lê como traço uniforme;
 * - **seção em camadas** (`camadasParaAlfa`): a mesma banda é preenchida
 *   3 a 6 vezes, da mais larga e quase transparente à mais estreita e mais
 *   cheia. O somatório é um sino — nenhuma borda dura em nenhum dos dois
 *   lados, que é o que uma banda de alfa constante deixaria;
 * - **brilho atravessando o anel**: a camada de DENTRO é preenchida com um
 *   gradiente linear numa direção própria por anel, então o mesmo anel é
 *   mais aceso de um lado; as de fora saem chapadas, clareando em direção
 *   ao núcleo (gradiente é caro por pixel, ver o comentário no laço).
 *   Junto com a ondulação do raio, é o que garante que nada se leia como
 *   circunferência perfeita na intensidade 3.
 *
 * Contrato dos efeitos, ponto a ponto: `intensidade` 0 não monta nada;
 * `cores` é a paleta do tema (lida via `color` computado, o que faz os 5
 * modos de cor funcionarem sem o efeito saber que existem); pausa fora da
 * viewport / aba oculta / `pausado` CONGELA o relógio (o anel retoma de
 * onde parou, não reinicia); `prefers-reduced-motion` desenha UM quadro e
 * nunca chama `requestAnimationFrame`; a rasterização fica ABAIXO do teto
 * de `devicePixelRatioClamped(2)`; nenhum `filter`, em lugar nenhum.
 */

/** Seno/cosseno dos ângulos do anel — tabela fixa, calculada uma vez. */
const COS: number[] = [];
const SEN: number[] = [];
for (let k = 0; k <= PONTOS_DO_ANEL; k++) {
  const a = (k / PONTOS_DO_ANEL) * Math.PI * 2;
  COS.push(Math.cos(a));
  SEN.push(Math.sin(a));
}

/** Abaixo disto o anel não soma nada visível — pular economiza o quadro. */
const ALFA_MINIMO = 0.02;

/**
 * Um pixel de rasterização a cada 2,5 px CSS. Não é economia de esperto: o
 * efeito não tem NENHUM detalhe fino — o anel mais grosso tem 20px de
 * travessia e o perfil dele sobe ~1% de opacidade por pixel —, e a
 * ampliação é INTERPOLADA pelo navegador, o que só deixa a mancha mais
 * suave. Rasterizar no dpr 2 do celular custaria 25× mais pixel pelo MESMO
 * desenho: medido, é a diferença entre **7,3 fps** e passar folgado na
 * condição de celular com CPU 4× (ver a tabela em ARCHITECTURE.md). O
 * contrato de efeitos manda limitar a rasterização a
 * `devicePixelRatioClamped(2)` — esta escala fica sempre ABAIXO desse
 * teto, nunca acima.
 */
const ESCALA_RASTER = 0.4;

function escalaDeRasterizacao(): number {
  return Math.min(ESCALA_RASTER, devicePixelRatioClamped(2));
}
/**
 * O efeito redesenha no máximo a ~30 Hz, não a cada quadro da página. O
 * anel mais rápido percorre a viewport em 7s: são ~1,8 px de crescimento
 * entre um desenho e o outro numa forma difusa de 6% de opacidade — não
 * existe olho que veja a diferença. E o que se ganha é o que importa: a
 * PÁGINA continua com quadro livre pra rolagem e para a skin, em vez de
 * dividir cada um dos 60 quadros com a decoração (ver a tabela de fps em
 * ARCHITECTURE.md).
 */
const MS_ENTRE_DESENHOS = 33;

/** A cor animada muda em ciclos de 20-42s: amostrar a 10 Hz sobra. */
const DESENHOS_POR_LEITURA_DE_COR = 3;

/** Mistura com branco — o núcleo do anel é mais claro que a borda dele. */
function clarear([r, g, b]: Rgb, quanto: number): Rgb {
  return [r + (255 - r) * quanto, g + (255 - g) * quanto, b + (255 - b) * quanto];
}

function misturar(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function Ondas({ intensidade, cores, pausado }: EfeitoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { ativo, reducedMotion } = useEfeitoAtivo(containerRef, pausado);
  /**
   * Relógio PRÓPRIO do efeito, em segundos, que só avança enquanto o
   * efeito está ativo (fora da viewport/aba oculta/`pausado` ele para de
   * contar). É o que faz o anel retomar de onde parou em vez de saltar
   * para onde estaria se o tempo tivesse corrido — o mesmo comportamento
   * que o `animation-play-state: paused` dá aos efeitos em CSS.
   */
  const relogioRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || intensidade === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const aneis = aneisOndas(intensidade);
    let cor: Rgb = [235, 235, 235];
    let corClara: Rgb = cor;
    let larguraCss = 0;
    let alturaCss = 0;

    const lerCor = () => {
      const lida = corParaRgb(getComputedStyle(canvas).color);
      if (!lida) return;
      cor = lida;
      corClara = clarear(lida, 0.45);
    };

    const dimensionar = () => {
      const escala = escalaDeRasterizacao();
      larguraCss = canvas.clientWidth || window.innerWidth;
      alturaCss = canvas.clientHeight || window.innerHeight;
      canvas.width = Math.max(1, Math.round(larguraCss * escala));
      canvas.height = Math.max(1, Math.round(alturaCss * escala));
      // Desenha sempre em px CSS; a escala vive só nesta matriz.
      ctx.setTransform(escala, 0, 0, escala, 0, 0);
    };

    const desenhar = (t: number) => {
      ctx.clearRect(0, 0, larguraCss, alturaCss);
      const cx = larguraCss / 2;
      const cy = alturaCss / 2;
      const menor = Math.min(larguraCss, alturaCss);
      // Metade da diagonal: o anel só termina o percurso quando passou até
      // pelos CANTOS, ou seja, cobriu a viewport inteira.
      const raioMax = Math.hypot(larguraCss, alturaCss) / 2;

      for (const anel of aneis) {
        const p = progressoAnel(anel, t);
        const alfa = alfaRelativo(p);
        if (alfa < ALFA_MINIMO) continue;
        const raio = p * raioMax;
        const espessura = espessuraRelativa(p) * menor;
        if (raio <= 0.5) continue;

        // Geometria do anel neste quadro: raio e meia-espessura por ângulo.
        const rs: number[] = new Array(PONTOS_DO_ANEL + 1);
        const meias: number[] = new Array(PONTOS_DO_ANEL + 1);
        for (let k = 0; k <= PONTOS_DO_ANEL; k++) {
          const ang = (k / PONTOS_DO_ANEL) * Math.PI * 2;
          rs[k] = raio * fatorRaio(anel, ang, t);
          meias[k] = (espessura * fatorEspessura(anel, ang)) / 2;
        }

        const tabela = camadasParaAlfa(alfa);
        const ultima = tabela.length - 1;
        for (let c = 0; c < tabela.length; c++) {
          const camada = tabela[c];
          if (c === ultima) {
            // BRILHO atravessando o anel, na direção própria dele — só na
            // camada de dentro. Preencher com gradiente custa caro (o
            // rasterizador avalia a rampa pixel a pixel: com TODAS as
            // camadas em gradiente, o efeito media 45 fps na condição de
            // celular contra 59 com preenchimento chapado). A camada de
            // dentro é ~6% da área pintada e é onde o brilho está — as de
            // fora, que são as largas, saem chapadas e ninguém vê a
            // diferença: elas nunca passam de 0,8% de opacidade na tela.
            const gx = Math.cos(anel.brilhoAnguloRad) * raio;
            const gy = Math.sin(anel.brilhoAnguloRad) * raio;
            const grad = ctx.createLinearGradient(cx - gx, cy - gy, cx + gx, cy + gy);
            grad.addColorStop(0, rgba(cor, 0.3));
            grad.addColorStop(0.45, rgba(corClara, 1));
            grad.addColorStop(1, rgba(cor, 0.55));
            ctx.fillStyle = grad;
          } else {
            // Halo: tinta chapada, mas clareando em direção ao núcleo — é o
            // mesmo "núcleo mais claro que a borda" que o gradiente dava na
            // travessia da fita, de graça.
            ctx.fillStyle = rgba(misturar(cor, corClara, ultima === 0 ? 0 : c / ultima), 1);
          }
          ctx.globalAlpha = alfa * camada.alfa;
          ctx.beginPath();
          // Contorno externo…
          for (let k = 0; k <= PONTOS_DO_ANEL; k++) {
            const r = rs[k] + meias[k] * camada.largura;
            const x = cx + r * COS[k];
            const y = cy + r * SEN[k];
            if (k === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          // …e o interno na volta: a banda é o miolo entre os dois, então a
          // espessura pode variar com o ângulo (um `stroke` não permitiria).
          for (let k = PONTOS_DO_ANEL; k >= 0; k--) {
            const r = Math.max(0, rs[k] - meias[k] * camada.largura);
            ctx.lineTo(cx + r * COS[k], cy + r * SEN[k]);
          }
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    };

    const aoRedimensionar = () => {
      dimensionar();
      desenhar(reducedMotion ? TEMPO_ESTATICO : relogioRef.current);
    };
    window.addEventListener("resize", aoRedimensionar);

    dimensionar();
    lerCor();

    // reduced-motion: UM quadro, nenhum rAF, nenhum relógio.
    if (reducedMotion) {
      desenhar(TEMPO_ESTATICO);
      return () => window.removeEventListener("resize", aoRedimensionar);
    }

    // Pausado: o último estado fica na tela e o relógio não anda.
    if (!ativo) {
      desenhar(relogioRef.current);
      return () => window.removeEventListener("resize", aoRedimensionar);
    }

    let raf = 0;
    let anterior = 0;
    let ultimoDesenho = 0;
    let desenhos = 0;
    const passo = (agora: number) => {
      // Clamp de 50ms: uma aba que volta do background não teleporta os
      // anéis por causa de um delta gigante.
      if (anterior) relogioRef.current += Math.min(0.05, (agora - anterior) / 1000);
      anterior = agora;
      raf = requestAnimationFrame(passo);
      if (agora - ultimoDesenho < MS_ENTRE_DESENHOS) return;
      ultimoDesenho = agora;
      if (desenhos++ % DESENHOS_POR_LEITURA_DE_COR === 0) lerCor();
      desenhar(relogioRef.current);
    };
    raf = requestAnimationFrame(passo);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", aoRedimensionar);
    };
  }, [intensidade, ativo, reducedMotion]);

  if (intensidade === 0) return null;

  return (
    <div
      ref={containerRef}
      // fixed + z-index positivo: mesma convenção dos demais efeitos (ver
      // "Cobertura de viewport" em ARCHITECTURE.md).
      className="pointer-events-none fixed inset-0 z-40"
      aria-hidden="true"
      style={{
        // O teto de opacidade mora AQUI: dentro do canvas tudo é desenhado
        // com alfa relativo (0–1), então 6% é 6% de verdade.
        opacity: `calc(${opacidadeOndas(intensidade)} * var(--d-efeito-fade, 1))`,
      }}
    >
      <canvas
        ref={canvasRef}
        className="h-full w-full"
        // A cor do tema (ou o `var(--d-efeito-cN)` animado pelo modo de
        // cor) entra como `color` e é LIDA computada a cada 5 quadros —
        // é assim que um efeito em canvas respeita os modos de cor sem
        // precisar conhecê-los.
        style={{ color: cores.destaque }}
      />
    </div>
  );
}
