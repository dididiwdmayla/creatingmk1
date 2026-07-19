import type { Lead } from "@/lib/leads/types";
import type { DemoData, DemoDataPatch, DemoSecao } from "./types";

/**
 * Montagem do DemoData efetivo de um lead, em três camadas (a de cima vence):
 *
 *   1. exemplo do template (demoDataExemplo da skin) — a base completa;
 *   2. dados reais do lead (nome, endereço, telefone, whatsapp) — o que o
 *      Radar já sabe do negócio preenche os slots correspondentes;
 *   3. edições feitas na ficha (LeadDemo.dados) — palavra final do usuário.
 *
 * Funções puras: a rota /demo/[leadId] e a ficha usam a mesma montagem.
 */

/** Cópia sem chaves undefined — camada de cima só sobrescreve o que definiu. */
function definidos<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

/** Slots de DemoData que os dados já persistidos do lead preenchem. */
export function dadosDoLead(lead: Lead): Partial<DemoData> {
  return definidos({
    nome: lead.nome,
    endereco: lead.endereco,
    telefone: lead.detalhes?.telefone ?? lead.telefone,
    whatsapp: lead.detalhes?.telefoneIntl ?? lead.telefoneIntl,
  });
}

function mergeSecoes(
  base: Record<string, DemoSecao>,
  patch: Record<string, DemoSecao> | undefined,
): Record<string, DemoSecao> {
  if (!patch) return base;
  const merged: Record<string, DemoSecao> = { ...base };
  for (const [chave, secao] of Object.entries(patch)) {
    // Mescla por campo dentro da seção; `itens` substitui a lista inteira
    // (mesclar item a item criaria listas meio-velhas, meio-novas).
    merged[chave] = { ...base[chave], ...definidos(secao) };
  }
  return merged;
}

/** Aplica um patch parcial sobre uma base completa de DemoData. */
export function aplicarPatch(base: DemoData, patch: DemoDataPatch | undefined): DemoData {
  if (!patch) return base;
  const { secoes, imagens, videos, servicos, depoimentos, ...campos } = patch;
  const temVideos = { ...base.videos, ...(definidos(videos ?? {}) as Record<string, string>) };
  return {
    ...base,
    ...definidos(campos),
    servicos: servicos ?? base.servicos,
    depoimentos: depoimentos ?? base.depoimentos,
    secoes: mergeSecoes(base.secoes, secoes),
    // definidos() remove as chaves undefined; o cast devolve o índice string.
    imagens: { ...base.imagens, ...(definidos(imagens ?? {}) as Record<string, string>) },
    ...(Object.keys(temVideos).length > 0 && { videos: temVideos }),
  };
}

/**
 * DemoData efetivo do lead: exemplo do template ← dados do lead ← edições.
 * `lead` opcional (a ficha monta a prévia dos campos antes de salvar).
 */
export function montarDemoData(
  exemplo: DemoData,
  lead?: Lead,
  patch?: DemoDataPatch,
): DemoData {
  const comLead = lead ? aplicarPatch(exemplo, dadosDoLead(lead)) : exemplo;
  return aplicarPatch(comLead, patch);
}
