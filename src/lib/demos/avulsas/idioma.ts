import { IDIOMA_PADRAO, idiomaDoPaisECidade } from "@/lib/idioma";
import { MOEDA_PADRAO, moedaDoPais } from "@/lib/moeda";

import type { DemoAvulsa } from "./types";

/**
 * Idioma e moeda da demo avulsa. Mesmíssima derivação da demo de lead
 * (`lib/demos/{idioma,moeda}.ts`) — só que o país vem do que o operador
 * DIGITOU (`DemoAvulsa.pais`) em vez de ser extraído do endereço que o
 * Google devolveu.
 *
 * A cidade continua entrando na conta porque Suíça, Bélgica e Canadá são
 * plurilíngues e o país sozinho não decide o idioma (ver
 * `idiomaDoPaisECidade`). Ela sai de `dados.cidade`, o mesmo campo que a
 * página exibe.
 */

function cidadeDaAvulsa(avulsa: Pick<DemoAvulsa, "demo">): string | undefined {
  return avulsa.demo.dados.cidade?.trim() || undefined;
}

/** Idioma derivado do país/cidade digitados. Sem país reconhecido → default. */
export function idiomaPadraoDaAvulsa(avulsa: Pick<DemoAvulsa, "pais" | "demo">): string {
  if (!avulsa.pais) return IDIOMA_PADRAO;
  return idiomaDoPaisECidade(avulsa.pais, cidadeDaAvulsa(avulsa));
}

/** Idioma EFETIVO: a sobrescrita manual do editor vence o derivado. */
export function idiomaEfetivoAvulsa(avulsa: Pick<DemoAvulsa, "pais" | "demo">): string {
  return avulsa.demo.idioma ?? idiomaPadraoDaAvulsa(avulsa);
}

/**
 * Moeda (ISO 4217) do país digitado. Como na demo de lead, não tem
 * sobrescrita manual: a moeda de um preço é fato do país do negócio, não
 * escolha de tom.
 */
export function moedaDaAvulsa(avulsa: Pick<DemoAvulsa, "pais"> | undefined): string {
  if (!avulsa?.pais) return MOEDA_PADRAO;
  return moedaDoPais(avulsa.pais);
}
