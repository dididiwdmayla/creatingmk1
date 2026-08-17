import { montarDemoData, quebrarTitulo } from "@/lib/demos/montar";
import type { DemoData, DemoDataPatch } from "@/lib/demos/types";

import type { DemoAvulsa, IdentidadeAvulsa } from "./types";

/**
 * A camada de identidade da demo avulsa — o lugar que na demo de lead é
 * ocupado por `dadosDoLead` (ver ./montar.ts).
 *
 * A diferença é que aqui ela ZERA em vez de preencher. Sem lead, o que o
 * exemplo da skin traz nesses campos é texto de template — e template não
 * pode se passar por identidade de negócio numa página pública. Os
 * `exemplo.ts` já não trazem telefone/whatsapp/instagram/cidade/horários
 * (viraram "ausente fica ausente"), mas TODOS trazem `endereco` ("Av.
 * Principal, 100 — Centro"): sem esta camada, uma avulsa sem endereço
 * publicaria o do template. Zerar a lista inteira também imuniza contra
 * uma skin nova que volte a encher qualquer um desses slots no exemplo.
 *
 * O que o operador digitou entra POR CIMA, na camada de sempre
 * (`LeadDemo.dados`). Campo não digitado fica vazio e some da página —
 * exatamente o que acontece hoje com um lead sem o dado.
 */
export const CAMPOS_IDENTIDADE_AVULSA = [
  "endereco",
  "cidade",
  "telefone",
  "whatsapp",
  "horarios",
  "instagram",
] as const;

export type CampoIdentidadeAvulsa = (typeof CAMPOS_IDENTIDADE_AVULSA)[number];

/** Patch que apaga todo slot de identidade herdado do exemplo da skin. */
export function identidadeEmBranco(): DemoDataPatch {
  return Object.fromEntries(CAMPOS_IDENTIDADE_AVULSA.map((campo) => [campo, ""]));
}

function limpo(valor: string | undefined): string {
  return valor?.trim() ?? "";
}

/**
 * Patch de criação a partir da identidade digitada. Campo vazio
 * simplesmente não entra — quem garante que ele não vira texto de template
 * é `identidadeEmBranco`, aplicada por baixo em toda leitura.
 *
 * O título hero acompanha o nome (`quebrarTitulo`, duas linhas no máximo)
 * pelo mesmo motivo que acompanha na demo de lead: é o nome do negócio em
 * exibição, não uma frase de campanha.
 */
export function patchIdentidadeAvulsa(identidade: IdentidadeAvulsa): DemoDataPatch {
  const nome = limpo(identidade.nome);
  const patch: DemoDataPatch = { nome, secoes: { hero: { titulo: quebrarTitulo(nome) } } };
  for (const campo of CAMPOS_IDENTIDADE_AVULSA) {
    const valor = limpo(identidade[campo]);
    if (valor) patch[campo] = valor;
  }
  return patch;
}

/**
 * DemoData efetivo de uma avulsa: exemplo do template ← identidade em
 * branco ← edições. Mesma `montarDemoData` da demo de lead, só sem a
 * camada `dadosDoLead`.
 */
export function montarDemoDataAvulsa(
  exemplo: DemoData,
  dados: DemoDataPatch | undefined,
  skinId?: string,
): DemoData {
  return montarDemoData(exemplo, undefined, { ...identidadeEmBranco(), ...dados }, skinId);
}

/**
 * A BASE contra a qual o editor calcula o diff mínimo de uma avulsa (o
 * papel que `exemplo ← dadosDoLead` cumpre na demo de lead). Precisa ser a
 * mesma montagem da leitura, com a identidade já zerada: contra o exemplo
 * cru, todo campo de identidade deixado vazio "diferiria" da base e o
 * editor gravaria patch pra dizer o que a base já diz.
 */
export function baseDemoDataAvulsa(exemplo: DemoData, skinId?: string): DemoData {
  return montarDemoDataAvulsa(exemplo, undefined, skinId);
}

/** Rótulo da avulsa nas telas internas — o nome digitado é a única fonte. */
export function nomeDaAvulsa(avulsa: Pick<DemoAvulsa, "demo">): string {
  return limpo(avulsa.demo.dados.nome) || "Demo sem nome";
}
