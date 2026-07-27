/**
 * Chaves de data em America/Sao_Paulo para as janelas de cota POR USUÁRIO
 * (dia/semana/mês) — nunca UTC. São limites de trabalho do time, não o
 * teto de fatura (esse continua em UTC, ver period.ts): resetar às 21h de
 * Brasília (meia-noite UTC) seria inaceitável para quem opera das 9 às 18h.
 *
 * Reset por composição de chave com a data, sem cron: a "semana" e o "mês"
 * são somas dos docs diários dentro da janela — quando a data vira, a
 * janela automaticamente passa a somar dias diferentes, nada precisa ser
 * zerado por um job.
 *
 * Usamos Intl com timeZone explícito em vez de um offset -3h fixo: o
 * Brasil não observa horário de verão desde 2019, mas depender da IANA tz
 * database em vez de hardcode é mais correto e não custa nada.
 */

const SP_TIME_ZONE = "America/Sao_Paulo";

const DATE_KEY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: SP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "YYYY-MM-DD" do dia corrente em America/Sao_Paulo. */
export function saoPauloDateKey(now: Date): string {
  return DATE_KEY_FORMATTER.format(now);
}

// A chave de calendário (já resolvida no fuso certo) vira uma âncora UTC só
// para aritmética de dias — somar/subtrair dias não deve reconsultar fuso,
// a string já É o dia local.
function anchor(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00Z`);
}

function keyFromAnchor(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(dateKey: string, days: number): string {
  const date = anchor(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return keyFromAnchor(date);
}

/** 0=domingo…6=sábado da chave de calendário (independe de fuso — é só a data). */
function weekday(dateKey: string): number {
  return anchor(dateKey).getUTCDay();
}

/** Segunda-feira da semana que contém a chave (semana começa segunda). */
export function saoPauloWeekStartKey(dateKey: string): string {
  const diasDesdeSegunda = (weekday(dateKey) + 6) % 7;
  return addDays(dateKey, -diasDesdeSegunda);
}

/** Dia 01 do mês da chave. */
export function saoPauloMonthStartKey(dateKey: string): string {
  return `${dateKey.slice(0, 7)}-01`;
}

/**
 * Todas as chaves entre "de" e "ate" (inclusive), em ordem crescente.
 * Guard de 400 iterações: nunca esperamos mais que ~31 dias (mês) aqui —
 * protege contra datas invertidas por dado corrompido.
 */
export function dateKeyRange(de: string, ate: string): string[] {
  const chaves: string[] = [];
  let atual = de;
  let guard = 0;
  while (atual <= ate && guard < 400) {
    chaves.push(atual);
    if (atual === ate) break;
    atual = addDays(atual, 1);
    guard += 1;
  }
  return chaves;
}

/** Deslocamento (minutos) do fuso em relação a UTC no instante dado. */
function tzOffsetMinutes(instant: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const partes = Object.fromEntries(
    formatter.formatToParts(instant).map((parte) => [parte.type, parte.value]),
  );
  const comoUtc = Date.UTC(
    Number(partes.year),
    Number(partes.month) - 1,
    Number(partes.day),
    Number(partes.hour),
    Number(partes.minute),
    Number(partes.second),
  );
  return (comoUtc - instant.getTime()) / 60_000;
}

/** Instante UTC real da meia-noite LOCAL (SP) de uma chave de calendário. */
function meiaNoiteSaoPauloComoInstante(dateKey: string, now: Date): Date {
  const offsetMin = tzOffsetMinutes(now, SP_TIME_ZONE);
  const comoUtcLiteral = anchor(dateKey).getTime();
  return new Date(comoUtcLiteral - offsetMin * 60_000);
}

/** ISO do próximo reset da janela DIÁRIA (meia-noite de amanhã em SP). */
export function resetaDiaEm(now: Date): string {
  const amanha = addDays(saoPauloDateKey(now), 1);
  return meiaNoiteSaoPauloComoInstante(amanha, now).toISOString();
}

/** ISO do próximo reset da janela SEMANAL (próxima segunda-feira, 00h em SP). */
export function resetaSemanaEm(now: Date): string {
  const hojeKey = saoPauloDateKey(now);
  const inicioSemana = saoPauloWeekStartKey(hojeKey);
  const proximaSegunda = addDays(inicioSemana, 7);
  return meiaNoiteSaoPauloComoInstante(proximaSegunda, now).toISOString();
}

/** ISO do próximo reset da janela MENSAL (dia 01 do mês seguinte, 00h em SP). */
export function resetaMesEm(now: Date): string {
  const hojeKey = saoPauloDateKey(now);
  const [ano, mes] = hojeKey.split("-").map(Number);
  const proximoMesKey =
    mes === 12 ? `${ano + 1}-01-01` : `${ano}-${String(mes + 1).padStart(2, "0")}-01`;
  return meiaNoiteSaoPauloComoInstante(proximoMesKey, now).toISOString();
}
