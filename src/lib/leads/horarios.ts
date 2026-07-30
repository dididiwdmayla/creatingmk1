import type { Lead } from "./types";

/**
 * Estado atual e "melhor momento pra contatar", a partir de `lead.horarios`
 * (SKU detailsProHours). Funções puras: nada aqui lê o relógio nem toca
 * Firestore — `now` sempre vem de fora (chamador/teste).
 *
 * O Google devolve os períodos em hora LOCAL do lugar (0=domingo…6=sábado).
 * Para saber "agora" nesse fuso sem depender do fuso da máquina que roda o
 * código, deslocamos `now` por `utcOffsetMinutes` e lemos os campos UTC do
 * resultado — o mesmo truque que evita depender de Intl/tz do sistema.
 */

const MIN_DIA = 1_440;
const MIN_SEMANA = 7 * MIN_DIA;

const NOMES_DIA = [
  "domingo",
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
] as const;

export interface EstadoAtual {
  aberto: boolean;
  /** "Aberto agora · fecha 18h" | "Fechado · abre 9h" */
  texto: string;
}

export interface MelhorMomento {
  /** true = contatar agora (aberto); false = aguardar até `em`. */
  agora: boolean;
  /** "Contatar agora" | "amanhã ~10h" | "hoje ~14h" | "quarta ~10h" */
  texto: string;
  /** Instante sugerido (aberto agora → `now`; fechado → próxima abertura +1h). */
  em: Date;
}

type Horarios = NonNullable<Lead["horarios"]>;
type Faixa = Horarios["faixas"][number];

function formatHora(hora: number, minuto: number): string {
  return minuto === 0 ? `${hora}h` : `${hora}h${String(minuto).padStart(2, "0")}`;
}

/** Minuto-da-semana (0..10079) da hora LOCAL do lugar no instante `instante`. */
function minutoDaSemanaLocal(utcOffsetMinutes: number, instante: Date): number {
  const local = new Date(instante.getTime() + utcOffsetMinutes * 60_000);
  return local.getUTCDay() * MIN_DIA + local.getUTCHours() * 60 + local.getUTCMinutes();
}

function abreMinuto(faixa: Faixa): number {
  return faixa.diaAbre * MIN_DIA + faixa.horaAbre * 60 + faixa.minAbre;
}

/** Fechamento normalizado: se cair antes/igual à abertura, cruzou a semana. */
function fechaMinutoNormalizado(faixa: Faixa): number {
  const abre = abreMinuto(faixa);
  const fecha = faixa.diaFecha * MIN_DIA + faixa.horaFecha * 60 + faixa.minFecha;
  return fecha <= abre ? fecha + MIN_SEMANA : fecha;
}

function estaDentro(faixa: Faixa, nowMin: number): boolean {
  const abre = abreMinuto(faixa);
  const fecha = fechaMinutoNormalizado(faixa);
  return (
    (nowMin >= abre && nowMin < fecha) || (nowMin + MIN_SEMANA >= abre && nowMin + MIN_SEMANA < fecha)
  );
}

/** Minutos (≥0) até a faixa abrir a partir de `nowMin` (0 só se já aberta). */
function distanciaAteAbrir(faixa: Faixa, nowMin: number): number {
  const abre = abreMinuto(faixa);
  return ((abre - nowMin) % MIN_SEMANA + MIN_SEMANA) % MIN_SEMANA;
}

function proximaAbertura(faixas: Faixa[], nowMin: number): Faixa | undefined {
  return faixas.reduce<{ faixa: Faixa; distancia: number } | undefined>((melhor, faixa) => {
    const distancia = distanciaAteAbrir(faixa, nowMin);
    if (!melhor || distancia < melhor.distancia) return { faixa, distancia };
    return melhor;
  }, undefined)?.faixa;
}

export function estadoAtual(
  horarios: Lead["horarios"] | undefined,
  now: Date = new Date(),
): EstadoAtual | null {
  if (!horarios || horarios.utcOffsetMinutes === undefined || horarios.faixas.length === 0) {
    return null;
  }
  const nowMin = minutoDaSemanaLocal(horarios.utcOffsetMinutes, now);
  const aberta = horarios.faixas.find((faixa) => estaDentro(faixa, nowMin));
  if (aberta) {
    return { aberto: true, texto: `Aberto agora · fecha ${formatHora(aberta.horaFecha, aberta.minFecha)}` };
  }
  const proxima = proximaAbertura(horarios.faixas, nowMin);
  if (!proxima) return null;
  return { aberto: false, texto: `Fechado · abre ${formatHora(proxima.horaAbre, proxima.minAbre)}` };
}

const DIAS_ORDEM = [1, 2, 3, 4, 5, 6, 0] as const;

const ABREV_DIA: Record<number, string> = {
  0: "DOM",
  1: "SEG",
  2: "TER",
  3: "QUA",
  4: "QUI",
  5: "SEX",
  6: "SÁB",
};

/** "9h-18h" | "9h-12h/14h-18h" (faixas do mesmo dia) | "fechado". */
function textoFaixasDoDia(faixas: Faixa[], dia: number): string {
  const doDia = faixas
    .filter((faixa) => faixa.diaAbre === dia)
    .sort((a, b) => abreMinuto(a) - abreMinuto(b));
  if (doDia.length === 0) return "fechado";
  return doDia
    .map((faixa) => `${formatHora(faixa.horaAbre, faixa.minAbre)}-${formatHora(faixa.horaFecha, faixa.minFecha)}`)
    .join("/");
}

/**
 * Resumo legível de `lead.horarios.faixas`, agrupando dias consecutivos
 * (SEG→DOM) com a mesma faixa: "SEG-SEX 9h-20h · SÁB 9h-18h · DOM fechado".
 * Dias sem nenhuma faixa entram como "fechado" no agrupamento. Sem faixas
 * (nunca buscado, ou lugar sem horário conhecido) → undefined.
 */
export function resumirHorarios(faixas: Faixa[]): string | undefined {
  if (faixas.length === 0) return undefined;

  const dias = DIAS_ORDEM.map((dia) => ({ dia, texto: textoFaixasDoDia(faixas, dia) }));

  const grupos: { inicio: number; fim: number; texto: string }[] = [];
  for (const { dia, texto } of dias) {
    const atual = grupos[grupos.length - 1];
    if (atual && atual.texto === texto) {
      atual.fim = dia;
    } else {
      grupos.push({ inicio: dia, fim: dia, texto });
    }
  }

  return grupos
    .map(({ inicio, fim, texto }) => {
      const rotulo = inicio === fim ? ABREV_DIA[inicio] : `${ABREV_DIA[inicio]}-${ABREV_DIA[fim]}`;
      return `${rotulo} ${texto}`;
    })
    .join(" · ");
}

export function melhorMomento(
  horarios: Lead["horarios"] | undefined,
  now: Date = new Date(),
): MelhorMomento | null {
  if (!horarios || horarios.utcOffsetMinutes === undefined || horarios.faixas.length === 0) {
    return null;
  }
  const offset = horarios.utcOffsetMinutes;
  const nowMin = minutoDaSemanaLocal(offset, now);

  if (horarios.faixas.some((faixa) => estaDentro(faixa, nowMin))) {
    return { agora: true, texto: "Contatar agora", em: now };
  }

  const proxima = proximaAbertura(horarios.faixas, nowMin);
  if (!proxima) return null;

  const distanciaMin = distanciaAteAbrir(proxima, nowMin);
  const contatoEm = new Date(now.getTime() + (distanciaMin + 60) * 60_000);
  const contatoMin = minutoDaSemanaLocal(offset, contatoEm);

  const diaAgora = Math.floor(nowMin / MIN_DIA);
  const diaContato = Math.floor(contatoMin / MIN_DIA);
  const diffDias = ((diaContato - diaAgora) % 7 + 7) % 7;

  const prefixo = diffDias === 0 ? "hoje" : diffDias === 1 ? "amanhã" : NOMES_DIA[diaContato % 7];
  const horaContato = Math.floor((contatoMin % MIN_DIA) / 60);
  const minContato = contatoMin % 60;

  return { agora: false, texto: `${prefixo} ~${formatHora(horaContato, minContato)}`, em: contatoEm };
}
