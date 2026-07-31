import { IDIOMA_PADRAO, idiomaDoPais } from "@/lib/idioma";
import { cidadeDoEndereco } from "@/lib/leads/cidade";
import type { Lead } from "@/lib/leads/types";

/**
 * Idioma-alvo (BCP-47) da IA na Forja de Demos — ver "Idioma da IA na
 * demo" em ARCHITECTURE.md. Derivado do PAÍS do endereço do PRÓPRIO lead
 * (não da região geocodificada da busca que o trouxe — `lead.busca.idioma`
 * é uma aproximação de mercado, este é o dado específico do negócio):
 * `cidadeDoEndereco` extrai o país do `Lead.endereco`, mapeado pra idioma
 * em `@/lib/idioma`. Sem endereço ou país não reconhecido → IDIOMA_PADRAO.
 */
export function idiomaPadraoDoLead(lead: Pick<Lead, "endereco">): string {
  if (!lead.endereco) return IDIOMA_PADRAO;
  const { pais } = cidadeDoEndereco(lead.endereco);
  return idiomaDoPais(pais);
}

/**
 * Idioma EFETIVO da demo: sobrescrita manual salva em `LeadDemo.idioma`
 * (seletor do editor) vence o default derivado do endereço do lead.
 */
export function idiomaEfetivoDemo(lead: Lead): string {
  return lead.demo?.idioma ?? idiomaPadraoDoLead(lead);
}
