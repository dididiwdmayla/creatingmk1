import type { Busca } from "@/lib/buscas/types";
import { reserveQuota, type UsageCounts } from "@/lib/costs";
import type { UsageDb } from "@/lib/firestore-like";
import { presenca } from "@/lib/leads/repo";
import { calculaScore } from "@/lib/leads/score";
import type { Lead } from "@/lib/leads/types";
import { AiError, gerarJson } from "./gemini";

/**
 * Análise de um grupo de busca inteiro numa ÚNICA chamada ao Gemini (SKU
 * aiGeneration, mesma cota das demais chamadas de IA — ver ./sugestao).
 * Ao contrário da sugestão de demo, NÃO há retry em resposta inválida:
 * o pedido é "uma chamada só" — falhar de novo é AiError direto.
 */

const ANALISE_MAX = 1500;

function presencaTexto(presente: boolean | undefined, quando: string, senao: string): string {
  if (presente === undefined) return "desconhecido";
  return presente ? quando : senao;
}

function linhaLead(lead: Lead): string {
  const score = calculaScore(lead);
  const site = presenca(lead, "site");
  const telefone = presenca(lead, "telefone");
  const rating = lead.detalhes?.rating;
  const avaliacoes = lead.detalhes?.totalAvaliacoes;
  const partes = [
    `score ${score}`,
    `site: ${presencaTexto(site, "tem site próprio", "sem site próprio")}`,
    `telefone: ${presencaTexto(telefone, "tem", "não tem")}`,
    ...(typeof rating === "number"
      ? [`avaliação ${rating}${avaliacoes ? ` (${avaliacoes} avaliações)` : ""}`]
      : []),
  ];
  return `- ${lead.nome} — ${partes.join(", ")}`;
}

export function montarPromptAnaliseBusca(busca: Busca, leads: Lead[]): string {
  const nicho = [busca.nicho, busca.subNicho].filter(Boolean).join(" / ");
  return [
    "Você é um consultor de vendas ajudando um time comercial brasileiro a priorizar contatos.",
    `Grupo de busca: "${busca.nome}" (nicho: ${nicho}, região: ${busca.regiao}).`,
    "Leads do grupo, com score de priorização calculado (quanto maior, mais prioritário) e dados públicos já coletados:",
    "",
    ...leads.map(linhaLead),
    "",
    "Escreva UM parágrafo corrido em português do Brasil (sem listas, sem markdown, sem emojis) recomendando os 3 primeiros contatos a fazer nesse grupo e o porquê — cite os nomes dos negócios. Responda apenas o JSON pedido.",
  ].join("\n");
}

export function schemaAnaliseBusca(): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    required: ["analise"],
    properties: {
      analise: {
        type: "string",
        maxLength: ANALISE_MAX,
        description:
          "Parágrafo em português do Brasil recomendando os 3 primeiros contatos do grupo.",
      },
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validarAnaliseBusca(
  bruto: unknown,
): { analise: string; problemas: [] } | { analise?: undefined; problemas: string[] } {
  if (!isRecord(bruto)) {
    return { problemas: ["resposta deve ser um objeto JSON"] };
  }
  const analise = bruto.analise;
  if (typeof analise !== "string" || !analise.trim()) {
    return { problemas: ["analise deve ser string não vazia"] };
  }
  return { analise: analise.trim().slice(0, ANALISE_MAX), problemas: [] };
}

/**
 * Gera a análise: UMA reserva de cota + UMA chamada ao Gemini, sem retry
 * (diferente de gerarSugestaoDemo) — resposta fora do schema já é AiError.
 */
export async function gerarAnaliseBusca(
  db: UsageDb,
  busca: Busca,
  leads: Lead[],
  caps: UsageCounts,
  userId?: string,
): Promise<string> {
  const prompt = montarPromptAnaliseBusca(busca, leads);
  await reserveQuota(db, "aiGeneration", caps, undefined, userId);
  const resultado = validarAnaliseBusca(await gerarJson(prompt, schemaAnaliseBusca()));
  if (resultado.analise) return resultado.analise;
  throw new AiError(`resposta fora do schema: ${resultado.problemas.join("; ")}`);
}
