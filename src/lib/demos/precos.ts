import { IDIOMA_PADRAO } from "@/lib/idioma";
import { MOEDA_PADRAO } from "@/lib/moeda";
import type { DemoServico } from "./types";

/**
 * Separação de preço em duas partes independentes (ver "Preços" no pedido
 * original):
 *
 *   - `precoPrefixo` — texto tipo "A partir de" / "Sob consulta". É
 *     CONTEÚDO: entra no schema de validação (`validate.ts`) como
 *     qualquer texto de `DemoData`, editável no editor, elegível a
 *     tradução (o mesmo caminho que já traduz o resto do conteúdo).
 *   - `precoValor` — o número em si. NUNCA é texto, NUNCA entra em schema
 *     de tradução/IA — é dado do lead/serviço, formatado na hora pelo
 *     locale/moeda da demo via `Intl.NumberFormat`, determinístico e sem
 *     IA em nenhuma parte.
 *
 * `preco` (string livre) continua existindo por compatibilidade: demos
 * salvas antes desta separação (ou serviços cujo preço é texto puro que
 * não vale a pena estruturar, ex. "Grátis") continuam funcionando —
 * `formatarPrecoServico` só usa `preco` quando nem prefixo nem valor
 * numérico estão presentes.
 */

/** Extrai o primeiro número de um texto de preço (aceita milhar "." e decimal ","). */
const NUMERO_PRECO = /\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+(?:,\d+)?/;

/**
 * Migra um `DemoServico` legado (só `preco` livre, ex. "R$ 1.800", "A
 * partir de R$ 1.800", "Sob consulta") para `precoPrefixo`/`precoValor` —
 * mesmo padrão de self-heal na leitura do resto da Forja (ver
 * `garantirEnvioToken`/`semDefaultsHistoricos`). Servico que já tem
 * `precoPrefixo` OU `precoValor` definido nunca é tocado — a migração só
 * preenche o que ainda não existe. Puro, sem IA: regex determinística.
 */
export function migrarPrecoServico(servico: DemoServico): DemoServico {
  if (servico.precoPrefixo !== undefined || servico.precoValor !== undefined) {
    return servico;
  }
  const texto = servico.preco?.trim();
  if (!texto) return servico;

  const match = texto.match(NUMERO_PRECO);
  if (!match || match.index === undefined) {
    // Nenhum número no texto (ex.: "Sob consulta") — vira só prefixo.
    return { ...servico, precoPrefixo: texto };
  }

  const valor = Number(match[0].replace(/\./g, "").replace(",", "."));
  const antes = texto
    .slice(0, match.index)
    .replace(/R\$\s*$/i, "")
    .trim();
  const depois = texto.slice(match.index + match[0].length).trim();
  const prefixo = [antes, depois].filter(Boolean).join(" ").trim();

  return {
    ...servico,
    precoValor: Number.isFinite(valor) ? valor : undefined,
    precoPrefixo: prefixo || undefined,
  };
}

/** Migra todos os serviços de uma lista (ver `montarDemoData`). */
export function migrarPrecos(servicos: readonly DemoServico[]): DemoServico[] {
  return servicos.map(migrarPrecoServico);
}

/**
 * Preço pronto para exibir: `precoPrefixo` + valor formatado por
 * `Intl.NumberFormat(idioma, { style: "currency", currency: moeda })` —
 * moeda e separadores decimais/milhar saem do locale/moeda da demo, nunca
 * de um símbolo cravado no texto. Sem `precoValor` (ex.: "Sob consulta"),
 * mostra só o prefixo. Sem nenhum dos dois, cai no `preco` legado.
 */
export function formatarPrecoServico(
  servico: Pick<DemoServico, "preco" | "precoPrefixo" | "precoValor">,
  idioma: string | undefined,
  moeda: string | undefined,
): string {
  const prefixo = servico.precoPrefixo?.trim();
  if (servico.precoValor !== undefined) {
    const valorFormatado = formatarValorMoeda(servico.precoValor, idioma, moeda);
    return prefixo ? `${prefixo} ${valorFormatado}` : valorFormatado;
  }
  if (prefixo) return prefixo;
  return servico.preco;
}

/** `Intl.NumberFormat` de moeda pelo locale/moeda da demo — sem IA, 100% determinístico. */
export function formatarValorMoeda(
  valor: number,
  idioma: string | undefined,
  moeda: string | undefined,
): string {
  return new Intl.NumberFormat(idioma ?? IDIOMA_PADRAO, {
    style: "currency",
    currency: moeda ?? MOEDA_PADRAO,
  }).format(valor);
}

/**
 * Só o símbolo/código da moeda ("R$", "CHF", "€"…) pelo locale/moeda da
 * demo — usado onde o layout separa o símbolo do número (ex.: preço
 * animado da multimarcas, ver `CarCard.tsx`).
 */
export function simboloMoeda(idioma: string | undefined, moeda: string | undefined): string {
  const partes = new Intl.NumberFormat(idioma ?? IDIOMA_PADRAO, {
    style: "currency",
    currency: moeda ?? MOEDA_PADRAO,
    currencyDisplay: "narrowSymbol",
  }).formatToParts(0);
  return partes.find((parte) => parte.type === "currency")?.value ?? moeda ?? MOEDA_PADRAO;
}
