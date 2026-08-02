/**
 * Fita afilada: gerador de path SVG compartilhado pelos efeitos que
 * desenham TRAÇO (`veios`, `geometrico-pulsante`).
 *
 * Por que fita e não `stroke`: um `stroke` tem espessura constante e ponta
 * reta (ou uma bolinha, com `stroke-linecap: round`) — ou seja, começa e
 * termina em ARESTA, e é uniforme do começo ao fim. Os dois defeitos que a
 * revisão visual apontou. Uma fita é uma forma FECHADA construída em cima
 * da curva: sobe por um lado, desce pelo outro, com a meia-espessura
 * variando ponto a ponto. Espessura zero nas pontas = o traço nasce e
 * morre em nada, sem máscara extra; espessura variável no meio = brilho e
 * peso mudam ao longo do traço, nunca uniformes.
 *
 * Tudo aqui é puro e determinístico (nada de `Math.random`: o mesmo HTML
 * precisa sair no server e no client) e independente de DOM — testável
 * direto, ver ./__tests__/fita.test.ts.
 */

export interface Ponto {
  x: number;
  y: number;
}

/** Amostras suficientes pra fita ler como curva, não como polígono. */
const AMOSTRAS = 44;

/** Ponto de uma Bézier cúbica em `t` (0-1). */
export function pontoCubica(p0: Ponto, c1: Ponto, c2: Ponto, p3: Ponto, t: number): Ponto {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x: a * p0.x + b * c1.x + c * c2.x + d * p3.x,
    y: a * p0.y + b * c1.y + c * c2.y + d * p3.y,
  };
}

/**
 * Perfil de meia-espessura padrão: zero nas duas pontas, cheio no meio,
 * com uma ondulação de baixa frequência por cima pra que o traço não vire
 * uma lente perfeitamente simétrica (que lê tão "desenhada" quanto uma
 * espessura constante). `fase` e `ondas` variam por traço, então dois
 * traços nunca engrossam no mesmo lugar.
 */
export function perfilEspessura(
  t: number,
  maxima: number,
  ondas: number,
  fase: number,
): number {
  const envelope = Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, t))), 0.7);
  const ondulacao = 0.55 + 0.45 * Math.sin(t * Math.PI * ondas + fase);
  return maxima * envelope * ondulacao;
}

/**
 * Path FECHADO ("...Z") da fita construída sobre `centro`: para cada
 * amostra, desloca o ponto pela NORMAL da curva (perpendicular à tangente)
 * em ±`meiaEspessura(t)`. A ida usa o lado positivo da normal, a volta o
 * negativo — daí o contorno fechado.
 */
export function fitaAfilada(
  centro: (t: number) => Ponto,
  meiaEspessura: (t: number) => number,
  amostras: number = AMOSTRAS,
): string {
  const ladoA: Ponto[] = [];
  const ladoB: Ponto[] = [];
  for (let i = 0; i <= amostras; i++) {
    const t = i / amostras;
    const p = centro(t);
    // Tangente por diferença finita: dispensa derivada analítica e serve
    // para qualquer curva que o chamador passe (cúbica, arco, o que for).
    const passo = 1 / (amostras * 2);
    const antes = centro(Math.max(0, t - passo));
    const depois = centro(Math.min(1, t + passo));
    const dx = depois.x - antes.x;
    const dy = depois.y - antes.y;
    const norma = Math.hypot(dx, dy) || 1;
    const nx = -dy / norma;
    const ny = dx / norma;
    const e = meiaEspessura(t);
    ladoA.push({ x: p.x + nx * e, y: p.y + ny * e });
    ladoB.push({ x: p.x - nx * e, y: p.y - ny * e });
  }
  const partes = [`M ${fmt(ladoA[0].x)} ${fmt(ladoA[0].y)}`];
  for (let i = 1; i < ladoA.length; i++) partes.push(`L ${fmt(ladoA[i].x)} ${fmt(ladoA[i].y)}`);
  for (let i = ladoB.length - 1; i >= 0; i--) partes.push(`L ${fmt(ladoB[i].x)} ${fmt(ladoB[i].y)}`);
  partes.push("Z");
  return partes.join(" ");
}

function fmt(n: number): string {
  return Number(n.toFixed(2)).toString();
}
