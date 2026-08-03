/**
 * COBERTURA ANIMADA: quanto da viewport, AGORA, é ocupado por seções com
 * animação ligada (`DemoSecao.animacao` — ver ../estrutura.ts). É o número
 * que a camada decorativa usa como opacidade: 1 = seção animada dominando
 * a tela, 0 = seção sem animação dominando a tela, e todo o meio do
 * caminho enquanto a fronteira entre as duas atravessa a viewport.
 *
 * A regra de projeto é que o efeito **nunca surja nem suma de uma vez**.
 * Duas decisões fazem isso sozinhas, sem estado por seção e sem timer:
 *
 * 1. **Peso por posição na viewport, não "está visível?".** Cada seção é
 *    integrada contra um núcleo (kernel) que vale ZERO nas pontas e é
 *    máximo no centro da tela: `w(t) = 1 - cos(2πt)` sobre a banda de
 *    foco (ver BANDA_FOCO). Uma seção que acabou de entrar na banda pesa
 *    ~0 e vai ganhando peso conforme sobe — a transição ocupa MEIA
 *    VIEWPORT de rolagem e a curva é suave nos dois extremos (a derivada
 *    do peso também vai a zero lá, então não existe "quina" no começo nem
 *    no fim do movimento).
 *
 *    A primitiva do núcleo é fechada — `W(t) = t - sin(2πt)/2π` — então a
 *    integral de cada seção é uma subtração, sem laço de amostragem.
 *
 * 2. **Normalização pelo que está MARCADO.** O resultado é
 *    animado/marcado, não animado/viewport. Cabeçalho, rodapé e qualquer
 *    região que a skin não marca como seção são NEUTROS: não puxam a
 *    opacidade pra baixo. Sem isso, o efeito apagaria sozinho ao chegar no
 *    rodapé de toda demo — inclusive nas que nunca desligaram animação
 *    nenhuma. Com a viewport inteira em região neutra (rodapé alto), o
 *    valor ANTERIOR é mantido: a camada segue como estava, em vez de
 *    piscar.
 *
 * Puro e sem DOM de propósito (testado em __tests__/cobertura.test.ts); a
 * leitura do DOM mora em ./medirCobertura.ts.
 */

/** Uma seção medida, em pixels relativos à viewport (topo 0 = topo da tela). */
export interface FaixaSecao {
  topo: number;
  base: number;
  animada: boolean;
}

/**
 * Fração CENTRAL da viewport onde o núcleo tem peso (o resto vale zero).
 * É o único número de calibração daqui, e ele arbitra dois desejos que
 * puxam pra lados opostos:
 *
 *   - distância de transição generosa → banda larga;
 *   - uma seção conseguir apagar a camada POR COMPLETO → banda mais
 *     estreita que a seção, senão as vizinhas (animadas) sempre pesam
 *     alguma coisa e a camada trava num meio-termo. Com a viewport
 *     INTEIRA como banda (a primeira versão desta função), uma seção de
 *     meia tela de altura não passava de 0.50 de apagamento — medido no
 *     laço, e era o que também impedia o motor de chegar ao estado
 *     pausado.
 *
 * Meia viewport: a transição leva meia tela de rolagem (350px no desktop
 * de teste, ~420px num celular) e qualquer seção com ao menos metade da
 * altura da tela zera a camada de verdade.
 */
const BANDA_FOCO = 0.5;

/** Primitiva do núcleo `1 - cos(2πt)` em [0,1] — W(0)=0, W(1)=1, monótona. */
function acumulado(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x - Math.sin(2 * Math.PI * x) / (2 * Math.PI);
}

/** Posição na viewport → posição na banda de foco (0 antes dela, 1 depois). */
function naBanda(t: number): number {
  return (t - (0.5 - BANDA_FOCO / 2)) / BANDA_FOCO;
}

/** Peso de uma faixa [topo, base] (px na viewport) sob o núcleo. */
function peso(topo: number, base: number, alturaViewport: number): number {
  if (alturaViewport <= 0 || base <= topo) return 0;
  return (
    acumulado(naBanda(base / alturaViewport)) - acumulado(naBanda(topo / alturaViewport))
  );
}

/**
 * Cobertura no instante atual, em [0,1]. `anterior` é o valor da medição
 * passada, devolvido quando não há nenhuma seção marcada na viewport
 * (região neutra) — 1 na primeira medição de uma página sem marcador
 * nenhum, que é o comportamento de antes deste controle existir.
 */
export function coberturaAnimada(
  faixas: readonly FaixaSecao[],
  alturaViewport: number,
  anterior = 1,
): number {
  let marcado = 0;
  let animado = 0;
  for (const faixa of faixas) {
    const p = peso(faixa.topo, faixa.base, alturaViewport);
    if (p <= 0) continue;
    marcado += p;
    if (faixa.animada) animado += p;
  }

  // Nada marcado pesando na viewport: região neutra (rodapé, cabeçalho,
  // uma skin que ainda não marque seções). Mantém o que estava.
  if (marcado < 1e-4) return anterior;

  const bruto = animado / marcado;
  // Encosta nos extremos: 0.998 de opacidade não é distinguível de 1, e
  // deixar o valor "quase 1" impediria a camada de chegar ao estado
  // PAUSADO (que só liga em 0) e de sair dele.
  if (bruto > 0.995) return 1;
  if (bruto < 0.005) return 0;
  return bruto;
}
