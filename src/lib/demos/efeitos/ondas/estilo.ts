import type { EfeitoIntensidade } from "../types";

/**
 * ONDAS — anéis concêntricos nascendo do centro e se expandindo até a
 * borda, pintados em `<canvas>` (ver ./Ondas.tsx). Este módulo é a parte
 * PURA: geometria, ritmo e as duas rampas do percurso (espessura e
 * opacidade). Sem DOM, determinístico e testável (./__tests__/estilo.test.ts).
 *
 * Três coisas que o desenho tem que garantir, e que moram aqui:
 *
 * 1. **Nenhum anel é uma circunferência.** O raio de cada anel é modulado
 *    por dois harmônicos angulares próprios (modo/amplitude/fase distintos
 *    por anel) que ainda giram devagar com o tempo — e a espessura tem uma
 *    modulação angular própria por cima disso. Em qualquer instante, um
 *    anel tem raio variando alguns por cento ao longo da volta e espessura
 *    variando quase pela metade: não fecha como círculo em intensidade
 *    nenhuma, muito menos na 3 (é o que reprovou `geometrico-pulsante`,
 *    cujos hexágonos dava pra contar os lados).
 * 2. **Espessura E opacidade decaem ao longo do percurso.** O anel nasce
 *    gordo e sem opacidade nenhuma (rampa de ataque curta — nascer "aceso"
 *    seria uma borda dura no tempo), fica mais fino e mais fraco conforme
 *    avança, e chega na borda praticamente inexistente. É o que faz o
 *    quadro ficar mais barato justamente quando o anel é maior.
 * 3. **Disparo escalonado e irregular.** Cada anel tem período próprio
 *    (7,0–12,4s) e fase inicial própria, ambos derivados de um ruído
 *    determinístico por índice. Períodos incomensuráveis entre si: dois
 *    anéis nunca voltam a disparar juntos, e o conjunto nunca lê como
 *    "pulso" sincronizado.
 *
 * A opacidade de 6% (teto da revisão de qualidade — ver ARCHITECTURE.md)
 * vive no ELEMENTO, não no traço: o canvas inteiro é desenhado com alfa
 * relativo (0–1) e a camada multiplica tudo por `opacidadeOndas`.
 */

/** Anéis simultâneos (slots) por intensidade. */
const ANEIS_POR_INTENSIDADE: Record<1 | 2 | 3, number> = { 1: 3, 2: 5, 3: 7 };

/**
 * Teto de 6% de opacidade para forma geométrica (a regra vale pra todo
 * efeito que não seja fonte de luz pontual — ver faiscas/estilo.ts para a
 * única exceção registrada).
 */
export const OPACIDADE_MAXIMA = 0.06;
const OPACIDADE_POR_INTENSIDADE: Record<1 | 2 | 3, number> = { 1: 0.022, 2: 0.04, 3: 0.06 };

/** Período base de um ciclo (centro → borda), em segundos. */
const PERIODO_BASE = 8.6;

/** Espessura no nascimento e no fim, como fração da MENOR dimensão da tela. */
const ESPESSURA_MAX_REL = 0.055;
const ESPESSURA_MIN_REL = 0.005;
const ESPESSURA_EXPOENTE = 1.35;

/**
 * Fração inicial do percurso em que a opacidade sobe de 0 até o pico. Sem
 * essa rampa o anel apareceria de uma vez no centro — uma borda dura no
 * tempo, tão visível quanto uma no espaço.
 */
export const ATAQUE = 0.1;
/** Expoente do decaimento de opacidade depois do ataque. */
const OPACIDADE_EXPOENTE = 1.7;

/** Amostras angulares de um anel (5° por passo). */
export const PONTOS_DO_ANEL = 72;

/**
 * Perfil da SEÇÃO do anel. Uma banda de alfa constante termina em aresta
 * dos dois lados, então o anel é pintado em camadas concêntricas, da mais
 * larga e quase transparente à mais estreita e mais cheia. Duas escolhas
 * aqui, as duas medidas no canvas (ver "ondas" em Verificação da UI):
 *
 * - **os alfas dão degraus IGUAIS** (`a_k = c / (1 − k·c)`, com
 *   c = 0,78/6): compondo source-over, cada camada acrescenta os mesmos
 *   13% de alfa. Uma tabela "bonita" tipo 0,1 / 0,2 / 0,3 / 0,8 concentra
 *   o degrau na camada de dentro — e um degrau de 42% num só pixel é
 *   exatamente a borda dura que a regra proíbe, só que no meio da fita;
 * - **as larguras seguem um sino** (`(1−u²)²` invertida, avaliada no meio
 *   de cada degrau) em vez de espaçamento linear: uma rampa de inclinação
 *   constante tem uma quina onde encontra o zero, e o olho lê essa quina
 *   como contorno (a mesma armadilha que reprovou a aura do gradiente de
 *   dois stops).
 *
 * Resultado medido no próprio canvas: maior passo entre pixels vizinhos
 * 33/255 de alfa, o que sobre o teto de 6% dá ~0,8% de opacidade — perto
 * de 1 nível de 255 na tela. A camada externa sozinha fica em 0,13 × 6% =
 * 0,78%: abaixo do que o olho lê como contorno.
 */
export interface CamadaSecao {
  /** Largura da banda, como fração da espessura do anel naquele ângulo. */
  largura: number;
  /** Alfa da camada (composição source-over sobre as anteriores). */
  alfa: number;
}

/** Alfa composto no núcleo do anel (o pico da seção, antes do teto de 6%). */
const PICO_COMPOSTO = 0.78;

/**
 * Gera a tabela de `n` camadas do parágrafo acima. Fica em função (e não
 * numa tabela escrita à mão) porque o efeito usa MAIS de uma: ver
 * `camadasParaAlfa`.
 */
export function camadas(n: number): CamadaSecao[] {
  const c = PICO_COMPOSTO / n;
  return Array.from({ length: n }, (_, k) => {
    // Larguras: o sino (1−u²)² avaliado no MEIO de cada degrau, normalizado
    // pra camada externa valer 1 (= a espessura cheia do anel).
    const g = (k + 0.5) / n;
    const u = Math.sqrt(1 - Math.sqrt(g));
    const u0 = Math.sqrt(1 - Math.sqrt(0.5 / n));
    return { largura: u / u0, alfa: c / (1 - k * c) };
  });
}

/** A tabela cheia — a que os anéis acesos usam. */
export const CAMADAS: readonly CamadaSecao[] = camadas(6);

/**
 * Quantas camadas um anel merece, pela opacidade dele. O degrau que uma
 * camada acrescenta aparece na tela multiplicado pelo alfa do anel E pelo
 * teto de 6%: num anel que já está fraco, três camadas dão um degrau menor
 * do que seis dariam no anel mais aceso. E são justamente os anéis fracos
 * que custam caro (são os maiores — perímetro grande), então esta é a
 * economia que não aparece: metade do preenchimento de um quadro sai daqui.
 * O PICO composto é o mesmo nas três tabelas, então o anel não pisca ao
 * trocar de tabela — só o perfil fica um pouco mais grosso.
 */
export function camadasParaAlfa(alfa: number): readonly CamadaSecao[] {
  if (alfa > 0.5) return CAMADAS;
  return alfa > 0.2 ? CAMADAS_4 : CAMADAS_3;
}

const CAMADAS_4: readonly CamadaSecao[] = camadas(4);
const CAMADAS_3: readonly CamadaSecao[] = camadas(3);

/** Instante desenhado quando `prefers-reduced-motion` está ligado. */
export const TEMPO_ESTATICO = 4.3;

export interface OndulacaoAnel {
  /** Quantos "lóbulos" na volta — 2 a 4 no harmônico lento, 5 a 8 no rápido. */
  modo: number;
  /** Amplitude como fração do raio. */
  amplitude: number;
  faseRad: number;
  /** Giro lento da ondulação (rad/s) — o anel muda de forma enquanto anda. */
  velocidade: number;
}

export interface AnelOnda {
  /** Ciclo completo (nascer no centro → morrer na borda), em segundos. */
  periodoSegundos: number;
  /** Fase inicial (0–1): é daqui que sai o disparo escalonado e irregular. */
  fase: number;
  ondulacoes: readonly [OndulacaoAnel, OndulacaoAnel];
  /** Modulação ANGULAR da espessura: modo e fase próprios por anel. */
  espessuraModo: number;
  espessuraFaseRad: number;
  /** Direção (rad) do gradiente de brilho que atravessa o anel. */
  brilhoAnguloRad: number;
}

/**
 * Ruído determinístico por (índice, canal) em [0,1). Nada de `Math.random`:
 * o efeito é montado no cliente, mas o mesmo índice tem que dar sempre o
 * mesmo anel — inclusive entre uma remontagem e outra, senão trocar de
 * intensidade embaralharia o campo inteiro.
 */
export function ruido(indice: number, canal: number): number {
  const x = Math.sin((indice + 1) * 127.1 + (canal + 1) * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Parte fracionária em [0,1). */
function fracao(x: number): number {
  return x - Math.floor(x);
}

/** Anéis (slots) de uma intensidade — determinístico, sem DOM. */
export function aneisOndas(intensidade: Exclude<EfeitoIntensidade, 0>): AnelOnda[] {
  return Array.from({ length: ANEIS_POR_INTENSIDADE[intensidade] }, (_, i) => ({
    // 0,81× a 1,44× o período base: irregular por anel e sem razão simples
    // entre os períodos (dois anéis não voltam a coincidir).
    periodoSegundos: PERIODO_BASE * (0.81 + 0.63 * ruido(i, 0)),
    // Fase = passo áureo (espalha: dois anéis nunca nascem quase juntos) +
    // um empurrãozinho de ruído (tira a cadência regular que o passo
    // áureo sozinho teria). O disparo fica escalonado E irregular.
    fase: fracao(i * 0.618033988749895 + (ruido(i, 1) - 0.5) * 0.05),
    ondulacoes: [
      {
        modo: 2 + Math.floor(ruido(i, 2) * 3),
        amplitude: 0.035 + 0.03 * ruido(i, 3),
        faseRad: ruido(i, 4) * Math.PI * 2,
        velocidade: (ruido(i, 5) - 0.5) * 0.24,
      },
      {
        modo: 5 + Math.floor(ruido(i, 6) * 4),
        amplitude: 0.012 + 0.014 * ruido(i, 7),
        faseRad: ruido(i, 8) * Math.PI * 2,
        velocidade: (ruido(i, 9) - 0.5) * 0.36,
      },
    ],
    espessuraModo: 2 + Math.floor(ruido(i, 10) * 4),
    espessuraFaseRad: ruido(i, 11) * Math.PI * 2,
    brilhoAnguloRad: ruido(i, 12) * Math.PI * 2,
  }));
}

export function opacidadeOndas(intensidade: Exclude<EfeitoIntensidade, 0>): number {
  return OPACIDADE_POR_INTENSIDADE[intensidade];
}

/** Posição no percurso (0 = centro, 1 = borda) do anel no instante `t`. */
export function progressoAnel(anel: AnelOnda, tSegundos: number): number {
  const bruto = (tSegundos / anel.periodoSegundos + anel.fase) % 1;
  return bruto < 0 ? bruto + 1 : bruto;
}

/**
 * Espessura no ponto `p` do percurso, como fração da MENOR dimensão da
 * tela. Decai monotonicamente: o anel afina enquanto cresce.
 */
export function espessuraRelativa(p: number): number {
  return ESPESSURA_MAX_REL * Math.pow(1 - p, ESPESSURA_EXPOENTE) + ESPESSURA_MIN_REL;
}

/**
 * Opacidade relativa (0–1) no ponto `p`: rampa suave de ataque até
 * `ATAQUE`, decaimento até zero na borda. O pico fica logo depois do
 * nascimento e nunca chega a 1 — é o que a camada multiplica pelo teto de
 * opacidade da intensidade.
 */
export function alfaRelativo(p: number): number {
  const ataque = p >= ATAQUE ? 1 : suavizar(p / ATAQUE);
  return ataque * Math.pow(1 - p, OPACIDADE_EXPOENTE);
}

/** smoothstep — derivada zero nas duas pontas (sem quina na rampa). */
function suavizar(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/**
 * Fator do raio num ângulo: 1 + os dois harmônicos do anel. É o que impede
 * qualquer anel de ler como circunferência perfeita (o ângulo entra em
 * radianos; `t` gira as ondulações devagar).
 */
export function fatorRaio(anel: AnelOnda, anguloRad: number, tSegundos: number): number {
  let f = 1;
  for (const o of anel.ondulacoes) {
    f += o.amplitude * Math.sin(o.modo * anguloRad + o.faseRad + o.velocidade * tSegundos);
  }
  return f;
}

/**
 * Fator da espessura num ângulo (0,45–1): a fita do anel é mais gorda de
 * um lado e mais fina do outro, e o lado muda de anel pra anel.
 */
export function fatorEspessura(anel: AnelOnda, anguloRad: number): number {
  return 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(anel.espessuraModo * anguloRad + anel.espessuraFaseRad));
}
