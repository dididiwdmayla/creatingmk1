import { cidadeDoEndereco } from "@/lib/leads/cidade";
import type { Lead } from "@/lib/leads/types";
import { moedaDoPais, MOEDA_PADRAO } from "@/lib/moeda";

/**
 * Moeda (ISO 4217) da demo — mesmo princípio de `idiomaPadraoDoLead`
 * (`./idioma.ts`): deriva do PAÍS do endereço do PRÓPRIO lead, via o mesmo
 * `cidadeDoEndereco` usado ali. Determinístico, sem IA e sem seletor
 * manual no editor — ao contrário do idioma, a moeda de um preço não é
 * uma escolha de tom, é um fato do país do negócio. Sem endereço ou país
 * não reconhecido → `MOEDA_PADRAO` ("BRL").
 */
export function moedaDaDemo(lead: Pick<Lead, "endereco"> | undefined): string {
  if (!lead?.endereco) return MOEDA_PADRAO;
  const { pais } = cidadeDoEndereco(lead.endereco);
  return moedaDoPais(pais);
}
