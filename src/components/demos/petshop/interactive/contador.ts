/**
 * Parser puro do texto de um contador (DemoItem.titulo da seção "números",
 * ex.: "+3.000", "12", "4,9★") em prefixo/número-alvo/casas
 * decimais/sufixo — usado pelo Counter.tsx pra animar a contagem fiel ao
 * `data-count`/`data-prefix`/`data-suffix` do material bruto (fx.js), sem
 * precisar de campos novos no contrato de dados (o editor continua
 * editando um texto só). Extraído como função pura (sem DOM) pra poder
 * ser testado sem montar o componente client.
 */
export interface ContadorParseado {
  prefixo: string;
  alvo: number;
  casasDecimais: number;
  sufixo: string;
}

// Convenção pt-BR (mesma de src/lib/format.ts): "." separa milhar,
// "," separa decimal — "3.000" é três mil, "4,9" é quatro vírgula nove.
const NUMERO_RE = /-?\d[\d.,]*/;

/** undefined = texto sem número reconhecível (o componente cai no texto estático). */
export function parseContador(texto: string): ContadorParseado | undefined {
  const match = NUMERO_RE.exec(texto);
  if (!match) return undefined;

  const bruto = match[0];
  const prefixo = texto.slice(0, match.index);
  const sufixo = texto.slice(match.index + bruto.length);
  const [inteiro, decimal] = bruto.split(",");
  const casasDecimais = decimal?.length ?? 0;
  const semMilhar = inteiro.replace(/\./g, "");
  const alvo = Number(decimal ? `${semMilhar}.${decimal}` : semMilhar);

  if (!Number.isFinite(alvo)) return undefined;
  return { prefixo, alvo, casasDecimais, sufixo };
}

/** Formata o valor intermediário da animação de volta pro formato pt-BR do texto original. */
export function formatarContador(valor: number, parsed: ContadorParseado): string {
  const { prefixo, casasDecimais, sufixo } = parsed;
  const corpo = casasDecimais > 0
    ? valor.toFixed(casasDecimais).replace(".", ",")
    : Math.round(valor).toLocaleString("pt-BR");
  return prefixo + corpo + sufixo;
}
