import type { AppConfig } from "@/lib/config";
import { loadContextoComercial } from "@/lib/contextoComercial";
import { reserveQuota } from "@/lib/costs";
import { idiomaEfetivoDemo } from "@/lib/demos/idioma";
import type { AppDb } from "@/lib/firestore-like";
import { AiError, gerarJson } from "@/lib/ai/gemini";
import { regiaoCacheKey } from "@/lib/geo/geocode";
import { idiomaLabel } from "@/lib/idioma";
import type { Lead } from "@/lib/leads/types";
import {
  calcularIndiceEfetivo,
  calcularPrecoSugerido,
  multiplicadorParaNicho,
} from "@/lib/precificacao/calc";
import { getRegiaoIndice } from "@/lib/regioes";

import { montarMensagemParaLead } from "./mensagem";
import type { MensagemGrupo } from "./respostasPendentes";

/**
 * O RASCUNHO de resposta — uma chamada de IA por grupo maduro (ver
 * `flushRespostas.ts`), passando pela MESMA reserva de cota de
 * `src/lib/costs` (SKU `aiGeneration`) que a Forja de Demos usa, reservada
 * ANTES do request ao Gemini como todo o resto do app faz.
 *
 * Diferente de `gerarSugestaoDemo` (Forja de Demos), aqui NÃO há retry de
 * schema: "uma chamada de IA por grupo" é literal — resposta fora do
 * formato vira falha do grupo (marcado com erro, retentável no PRÓXIMO
 * flush — ver `respostasPendentes.ts#restaurarGrupoComErro`), não uma
 * segunda chamada imediata.
 */

const RASCUNHO_MAX = 700;

const SCHEMA_RASCUNHO: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["rascunho"],
  properties: {
    rascunho: { type: "string", maxLength: RASCUNHO_MAX },
  },
};

/**
 * Resumo curto do que a demo já mostra ao lead (slogan, texto do hero,
 * nomes dos serviços) — é o que separa um rascunho que fala do negócio de
 * um genérico de agência. Ausência de demo, ou demo sem esses campos
 * preenchidos, devolve `undefined`: o prompt simplesmente omite a linha,
 * nunca inventa conteúdo.
 */
function resumoDemoParaPrompt(lead: Lead): string | undefined {
  const dados = lead.demo?.dados;
  if (!dados) return undefined;

  const partes: string[] = [];
  if (dados.slogan) partes.push(`slogan "${dados.slogan}"`);
  const heroTexto = dados.secoes?.hero?.texto;
  if (heroTexto) partes.push(`descrição "${heroTexto}"`);
  const servicos = (dados.servicos ?? []).map((s) => s.nome).filter(Boolean);
  if (servicos.length > 0) partes.push(`serviços: ${servicos.join(", ")}`);

  return partes.length > 0 ? partes.join("; ") : undefined;
}

/**
 * Preço de referência do negócio: índice de mercado da REGIÃO (cache
 * somente-leitura de `/regioes` — nunca gera/regenera aqui, isso é ação
 * explícita do admin) × multiplicador do nicho, com o piso configurado.
 * Sem nicho, não dá para calcular nada específico → `undefined`. Sem região
 * cacheada, cai no índice NEUTRO (1.0) — ainda dá um número direcional, só
 * sem a faixa de mercado local (que só existe quando a região já foi
 * calculada ao menos uma vez).
 *
 * `precoBase` usa o segundo atalho configurado ("Presença" por default,
 * R$2000) — o MESMO ponto de partida que o slider do card "Precificação" já
 * assume antes de o operador mexer nele (ver `PrecificacaoCard`); sem
 * atalho nenhum configurado, cai no mesmo valor hardcoded.
 */
async function posicionamentoPrecoParaPrompt(
  db: AppDb,
  lead: Lead,
  config: AppConfig,
): Promise<string | undefined> {
  const nicho = lead.busca?.nicho?.trim();
  if (!nicho) return undefined;

  const regiaoTexto = lead.busca?.regiao;
  const regiao = regiaoTexto
    ? await getRegiaoIndice(db, regiaoCacheKey(regiaoTexto))
    : undefined;

  const indiceEfetivo = calcularIndiceEfetivo(
    regiao?.indice ?? 1,
    regiao?.indiceAjustado,
    config.precificacao.fatorMinimoIndice,
  );
  const multiplicador = multiplicadorParaNicho(nicho, config.precificacao.multiplicadoresNicho);
  const precoBase = config.precificacao.presets[1]?.valorBRL ?? 2000;
  const precoSugerido = calcularPrecoSugerido(
    precoBase,
    indiceEfetivo,
    multiplicador,
    config.precificacao.pisoPrecificacao,
  );

  const faixa = regiao?.faixaMercadoLocal;
  return (
    `Posicionamento de preço: nosso preço de referência para este negócio gira em torno de ` +
    `R$${Math.round(precoSugerido)}` +
    (faixa ? ` (faixa de mercado local para um site simples: ${faixa})` : "") +
    ". Não prometa valor fechado — se o lead perguntar preço, use isto como referência, não como tabela fixa."
  );
}

/**
 * As DUAS REGRAS DURAS do prompt — SEMPRE presentes, com ou sem contexto
 * comercial preenchido. É a mesma regra que já vale para o índice regional
 * de preço ("LLM nunca é fonte de número absoluto", ver
 * `posicionamentoPrecoParaPrompt`), estendida para prazo/escopo/condição e
 * para a fonte nova: sem contexto comercial nenhum, ela é o único freio
 * contra o modelo preencher o vazio com um número plausível.
 *
 * A marcação (`[PREENCHER: ...]`) é o que faz "não invente" ser algo que o
 * operador PERCEBE, em vez de um rascunho educado que simplesmente omite a
 * resposta à pergunta do lead — omitir em silêncio pareceria bug de IA, não
 * cautela deliberada.
 */
const REGRAS_DURAS_PROMPT = [
  "REGRAS DURAS, sem exceção:",
  '- NUNCA invente um número absoluto (preço, desconto, prazo em dias/semanas). Se o valor exato não estiver escrito acima (no contexto comercial ou no posicionamento de preço), não chute: escreva a frase normalmente e troque o número que faltaria por uma marcação "[PREENCHER: o quê]" para o operador completar antes de mandar.',
  '- NUNCA prometa prazo, escopo (o que está incluso) ou condição (forma de pagamento, garantia, suporte) que não esteja escrito no contexto comercial acima. Sem essa informação, use a mesma marcação "[PREENCHER: ...]" em vez de inventar.',
].join("\n");

function montarPromptRascunho(
  lead: Lead,
  mensagens: MensagemGrupo[],
  mensagemEnviada: string,
  resumoDemo: string | undefined,
  posicionamentoPreco: string | undefined,
  contextoComercial: string | undefined,
  idioma: string,
): string {
  const nicho = lead.busca?.nicho?.trim() || "negócio local";
  const mensagensNumeradas = mensagens.map((m, i) => `${i + 1}. "${m.texto}"`).join("\n");

  return [
    "Você é um vendedor experiente respondendo, pelo WhatsApp, o dono de um negócio local que está sendo prospectado para ganhar um site/demo.",
    `Negócio: ${lead.nome} (${nicho}).`,
    "",
    `Mensagem que você (o Radar) mandou originalmente para este lead: "${mensagemEnviada}"`,
    ...(resumoDemo ? ["", `O que a demo já mostra para ele: ${resumoDemo}.`] : []),
    ...(posicionamentoPreco ? ["", posicionamentoPreco] : []),
    ...(contextoComercial
      ? [
          "",
          "Contexto comercial declarado pelo operador (o que ESTE negócio vende, como funciona, preços e prazos — use isto como fonte, nunca contrarie):",
          contextoComercial,
        ]
      : []),
    "",
    REGRAS_DURAS_PROMPT,
    "",
    "O lead respondeu com a(s) mensagem(ns) abaixo, na ordem em que chegaram (pode ser mais de uma, mandadas em sequência):",
    mensagensNumeradas,
    "",
    `Escreva um RASCUNHO de resposta em ${idiomaLabel(idioma)}, curto (poucas frases, tom de conversa de WhatsApp, nunca robótico ou genérico de agência). Responda diretamente ao que o lead disse e avance a conversa (agendar, mostrar mais, tirar dúvida, lidar com objeção de preço se for o caso), sem inventar dado que não está acima. Responda APENAS o JSON pedido.`,
  ].join("\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validarRascunho(bruto: unknown): string {
  if (!isRecord(bruto) || typeof bruto.rascunho !== "string" || !bruto.rascunho.trim()) {
    throw new AiError("resposta fora do schema: campo \"rascunho\" ausente ou vazio");
  }
  return bruto.rascunho.trim().slice(0, RASCUNHO_MAX);
}

/**
 * Geração completa: reserva de cota (SKU `aiGeneration`, ANTES do request) →
 * generateContent → validação. Uma chamada só — sem retry (ver o
 * comentário do topo do arquivo). Erro de qualquer etapa propaga para quem
 * chama (`flushRespostas.ts`), que isola a falha por grupo.
 */
export async function gerarRascunhoResposta(
  db: AppDb,
  lead: Lead,
  mensagens: MensagemGrupo[],
  config: AppConfig,
): Promise<string> {
  const idioma = idiomaEfetivoDemo(lead);
  const [mensagemEnviada, posicionamentoPreco, contexto] = await Promise.all([
    montarMensagemParaLead(db, lead),
    posicionamentoPrecoParaPrompt(db, lead, config),
    loadContextoComercial(db),
  ]);
  const resumoDemo = resumoDemoParaPrompt(lead);
  const contextoComercial = contexto.texto.trim() || undefined;

  const prompt = montarPromptRascunho(
    lead,
    mensagens,
    mensagemEnviada.texto,
    resumoDemo,
    posicionamentoPreco,
    contextoComercial,
    idioma,
  );

  await reserveQuota(db, "aiGeneration", config.caps);
  const bruto = await gerarJson(prompt, SCHEMA_RASCUNHO);
  return validarRascunho(bruto);
}
