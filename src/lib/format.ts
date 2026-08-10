export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatUSD(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

export function formatInt(n: number): string {
  return n.toLocaleString("pt-BR");
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

/** "27/07" — sem ano/hora, usado no modal de confirmação do selo de contato. */
export function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/**
 * "27/07" no fuso de **America/Sao_Paulo**, não no do navegador.
 *
 * Existe por um motivo específico: o cabeçalho de grupo (`CabecalhoBusca`)
 * aparece ao lado do agrupamento por mês de `/buscas`, que resolve o mês em
 * São Paulo (uma busca das 22h do dia 31 é de julho pra quem a rodou, ver
 * `agruparBuscas`). Formatar a data do cabeçalho no relógio do navegador
 * faz a mesma tela dizer "01/08" dentro do grupo "Julho de 2026" — os dois
 * precisam sair do MESMO fuso, e o fuso certo é o de quem opera.
 */
const DATA_CURTA_SP = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
});

export function formatDateShortSP(iso: string): string {
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? "—" : DATA_CURTA_SP.format(data);
}

/** "45s" / "2min" / "2min 30s" — duração de uma visita à demo. */
export function formatDuracao(segundos: number): string {
  if (segundos < 60) return `${segundos}s`;
  const minutos = Math.floor(segundos / 60);
  const resto = segundos % 60;
  return resto > 0 ? `${minutos}min ${resto}s` : `${minutos}min`;
}

const MINUTO_MS = 60 * 1000;
const HORA_MS = 60 * MINUTO_MS;
const DIA_MS = 24 * HORA_MS;

/**
 * "agora mesmo" / "há Xmin" / "há Xh" / "há X dia(s)" — tempo relativo a
 * `agora` (instante fixo pego no carregamento, nunca Date.now() direto no
 * render — ver nota do React Compiler em ARCHITECTURE.md). Usado no selo
 * "aberta há X" de /demos.
 */
export function formatTempoRelativo(iso: string, agora: number): string {
  const diffMs = Math.max(0, agora - new Date(iso).getTime());
  if (diffMs < MINUTO_MS) return "agora mesmo";
  if (diffMs < HORA_MS) return `há ${Math.floor(diffMs / MINUTO_MS)}min`;
  if (diffMs < DIA_MS) return `há ${Math.floor(diffMs / HORA_MS)}h`;
  const dias = Math.floor(diffMs / DIA_MS);
  return `há ${dias} dia${dias === 1 ? "" : "s"}`;
}
