import { IDIOMA_PADRAO } from "@/lib/idioma";
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

export const MIN_DIA = 1_440;
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

export function formatHora(hora: number, minuto: number): string {
  return minuto === 0 ? `${hora}h` : `${hora}h${String(minuto).padStart(2, "0")}`;
}

/** Minuto-da-semana (0..10079) da hora LOCAL do lugar no instante `instante`. */
export function minutoDaSemanaLocal(utcOffsetMinutes: number, instante: Date): number {
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

/**
 * Localização (determinística, sem IA) de `resumirHorarios`: rótulos de
 * dia (abreviação) e formato de hora por idioma-alvo (ver
 * "Idioma da IA na demo" — o mesmo idioma que a IA usa no resto da demo).
 * Chave por RAIZ do BCP-47 (ex.: "de" cobre de-CH/de-DE/de-AT); idioma sem
 * entrada cai no padrão pt-BR.
 */
interface LocaleHorario {
  dias: Record<number, string>;
  fechado: string;
  formatHora(hora: number, minuto: number): string;
}

const LOCALE_PT: LocaleHorario = {
  dias: ABREV_DIA,
  fechado: "fechado",
  formatHora,
};

function formatHora24h(hora: number, minuto: number): string {
  return `${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}`;
}

const LOCALES_HORARIO: Record<string, LocaleHorario> = {
  pt: LOCALE_PT,
  de: {
    dias: { 0: "SO", 1: "MO", 2: "DI", 3: "MI", 4: "DO", 5: "FR", 6: "SA" },
    fechado: "geschlossen",
    formatHora: formatHora24h,
  },
  en: {
    dias: { 0: "SUN", 1: "MON", 2: "TUE", 3: "WED", 4: "THU", 5: "FRI", 6: "SAT" },
    fechado: "closed",
    formatHora: formatHora24h,
  },
  es: {
    dias: { 0: "DOM", 1: "LUN", 2: "MAR", 3: "MIÉ", 4: "JUE", 5: "VIE", 6: "SÁB" },
    fechado: "cerrado",
    formatHora: formatHora24h,
  },
  fr: {
    dias: { 0: "DIM", 1: "LUN", 2: "MAR", 3: "MER", 4: "JEU", 5: "VEN", 6: "SAM" },
    fechado: "fermé",
    formatHora: formatHora24h,
  },
  it: {
    dias: { 0: "DOM", 1: "LUN", 2: "MAR", 3: "MER", 4: "GIO", 5: "VEN", 6: "SAB" },
    fechado: "chiuso",
    formatHora: formatHora24h,
  },
  nl: {
    dias: { 0: "ZO", 1: "MA", 2: "DI", 3: "WO", 4: "DO", 5: "VR", 6: "ZA" },
    fechado: "gesloten",
    formatHora: formatHora24h,
  },
};

function localeDoIdioma(idioma: string): LocaleHorario {
  const raiz = idioma.split("-")[0];
  return LOCALES_HORARIO[raiz] ?? LOCALE_PT;
}

/** "09:00-18:00" | "09:00-12:00/14:00-18:00" (faixas do mesmo dia) | locale.fechado. */
function textoFaixasDoDiaLocalizado(faixas: Faixa[], dia: number, locale: LocaleHorario): string {
  const doDia = faixas
    .filter((faixa) => faixa.diaAbre === dia)
    .sort((a, b) => abreMinuto(a) - abreMinuto(b));
  if (doDia.length === 0) return locale.fechado;
  return doDia
    .map(
      (faixa) =>
        `${locale.formatHora(faixa.horaAbre, faixa.minAbre)}-${locale.formatHora(faixa.horaFecha, faixa.minFecha)}`,
    )
    .join("/");
}

/**
 * Resumo legível de `lead.horarios.faixas`, agrupando dias consecutivos
 * (SEG→DOM) com a mesma faixa: "SEG-SEX 9h-20h · SÁB 9h-18h · DOM fechado"
 * (pt-BR) ou "MO-FR 09:00-20:00 · SA 09:00-18:00 · SO geschlossen" (de-CH).
 * `idioma` (BCP-47, default pt-BR) é o mesmo idioma-alvo da IA na demo —
 * puramente determinístico, sem chamada de IA (ver `@/lib/idioma`). Dias
 * sem nenhuma faixa entram como "fechado"/`locale.fechado` no agrupamento.
 * Sem faixas (nunca buscado, ou lugar sem horário conhecido) → undefined.
 */
export function resumirHorarios(faixas: Faixa[], idioma: string = IDIOMA_PADRAO): string | undefined {
  if (faixas.length === 0) return undefined;

  const locale = localeDoIdioma(idioma);
  const dias = DIAS_ORDEM.map((dia) => ({
    dia,
    texto: textoFaixasDoDiaLocalizado(faixas, dia, locale),
  }));

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
      const rotulo =
        inicio === fim ? locale.dias[inicio] : `${locale.dias[inicio]}-${locale.dias[fim]}`;
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
