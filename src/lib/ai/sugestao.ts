import { reserveQuota, type UsageCounts } from "@/lib/costs";
import { fontesPorPapel } from "@/lib/demos/fontes";
import { HEX_RE } from "@/lib/demos/tema";
import { ANIMACOES, type Animacao, type SkinDefinition } from "@/lib/demos/types";
import type { UsageDb } from "@/lib/firestore-like";
import type { Lead } from "@/lib/leads/types";
import { AiError, gerarJson } from "./gemini";

/**
 * Sugestão de demo gerada pelo Gemini: um ponto de partida de tema + textos
 * para a Forja, calibrado pelo nicho e pelos dados públicos já salvos do
 * lead. O modelo NUNCA escreve direto na demo — a rota devolve a sugestão
 * validada e o editor mostra preview com aplicar/descartar; mesmo aplicada,
 * nada persiste sem o "Salvar" normal do editor.
 *
 * Tudo que a sugestão referencia fica DENTRO do que o sistema de demos já
 * valida: preset do tema entre os da skin (paleta dentro dos tokens do
 * Theme), `destaque` como o único token de cor patchável (TemaPatch),
 * fonte da lista curada (papel display), nível de animação de ANIMACOES e
 * títulos apenas para seções do contrato da skin.
 */

/** Limites dos textos curtos (clamp na validação — não motivo de retry). */
const SLOGAN_MAX = 120;
const DESCRICAO_MAX = 400;
const TITULO_MAX = 80;

export interface SugestaoDemo {
  /** Preset de tema da skin (paleta/base dentro dos tokens do Theme). */
  themeId: string;
  /** Cor primária #rrggbb por cima do preset (TemaPatch.destaque). */
  destaque: string;
  /** Id da lista curada de fontes, papel "display" (TemaPatch.fonteDisplay). */
  fonteDisplay: string;
  /** Nível de animação do tema. */
  animacao: Animacao;
  /** Frase de efeito curta (DemoData.slogan), pt-BR, tom do nicho. */
  slogan: string;
  /** Descrição curta do negócio (texto do hero), pt-BR. */
  descricao: string;
  /** Título por seção do contrato da skin (DemoData.secoes[id].titulo). */
  titulosSecoes: Record<string, string>;
}

const CHAVES_SUGESTAO = [
  "themeId",
  "destaque",
  "fonteDisplay",
  "animacao",
  "slogan",
  "descricao",
  "titulosSecoes",
] as const;

/**
 * Seções que a IA pode intitular: só as NÃO-fixas. O título da fixa (hero)
 * é o nome/wordmark do negócio nas skins atuais — a IA não mexe nele; a
 * `descricao` vai pro texto do hero, que é apresentação, não identidade.
 */
function secoesTitulaveis(skin: SkinDefinition) {
  return skin.secoes.filter((secao) => !secao.fixa);
}

function idsFontesDisplay(skin: SkinDefinition): string[] {
  const curadas = fontesPorPapel("display").map((fonte) => fonte.id);
  // Recomendadas da skin primeiro — vira dica de ordem no schema/prompt.
  const recomendadas = (skin.fontesRecomendadas ?? []).filter((id) => curadas.includes(id));
  return [...recomendadas, ...curadas.filter((id) => !recomendadas.includes(id))];
}

/**
 * JSON Schema (padrão) enviado ao Gemini em responseJsonSchema — guia o
 * modelo pro formato certo; a validação estrita local continua mandando.
 */
export function schemaSugestao(skin: SkinDefinition): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    required: [...CHAVES_SUGESTAO],
    properties: {
      themeId: { type: "string", enum: skin.themePresets.map((preset) => preset.id) },
      destaque: {
        type: "string",
        pattern: "^#[0-9a-fA-F]{6}$",
        description: "Cor primária em hex #rrggbb, harmônica com o preset escolhido.",
      },
      fonteDisplay: { type: "string", enum: idsFontesDisplay(skin) },
      animacao: { type: "string", enum: [...ANIMACOES] },
      slogan: { type: "string", maxLength: SLOGAN_MAX },
      descricao: { type: "string", maxLength: DESCRICAO_MAX },
      titulosSecoes: {
        type: "object",
        additionalProperties: false,
        properties: Object.fromEntries(
          secoesTitulaveis(skin).map((secao) => [
            secao.id,
            { type: "string", maxLength: TITULO_MAX },
          ]),
        ),
      },
    },
  };
}

/**
 * Prompt com o que a rota sabe do lead: nicho, nome, rating/dados públicos
 * já salvos (nunca busca nada novo no Google) e a skin escolhida.
 */
export function montarPromptSugestao(skin: SkinDefinition, lead: Lead): string {
  const nicho = lead.busca?.nicho?.trim() || skin.nicho;
  const rating = lead.detalhes?.rating;
  const avaliacoes = lead.detalhes?.totalAvaliacoes;
  const fontes = fontesPorPapel("display");

  const linhasLead = [
    `- Nome do negócio: ${lead.nome}`,
    `- Nicho: ${nicho}`,
    ...(lead.busca?.subNicho ? [`- Especialidade: ${lead.busca.subNicho}`] : []),
    ...(lead.endereco ? [`- Endereço: ${lead.endereco}`] : []),
    ...(typeof rating === "number"
      ? [`- Avaliação no Google: ${rating}${avaliacoes ? ` (${avaliacoes} avaliações)` : ""}`]
      : []),
  ];

  return [
    "Você é o diretor de arte de demos de sites para negócios locais brasileiros.",
    "Sugira tema e textos curtos para a demo do negócio abaixo. Responda APENAS o JSON pedido, em português do Brasil, com tom adequado ao nicho (nada genérico de agência).",
    "",
    "Negócio (dados públicos já coletados):",
    ...linhasLead,
    "",
    `Template escolhido: "${skin.nome}"${skin.descricao ? ` — ${skin.descricao}` : ""}`,
    "",
    "Escolhas permitidas (use exatamente estes valores):",
    `- themeId (preset de paleta do template): ${skin.themePresets
      .map((preset) => `"${preset.id}" (${preset.nome})`)
      .join(", ")}`,
    '- destaque: cor primária em hex "#rrggbb" que combine com o nicho e o preset.',
    `- fonteDisplay: ${idsFontesDisplay(skin)
      .map((id) => {
        const fonte = fontes.find((f) => f.id === id);
        return `"${id}"${fonte ? ` (${fonte.nome})` : ""}`;
      })
      .join(", ")}`,
    `- animacao: ${ANIMACOES.map((nivel) => `"${nivel}"`).join(", ")} (quanto o site se move).`,
    "",
    "Textos (curtos, diretos, sem emojis, sem inventar dados que não estão acima):",
    `- slogan: frase de efeito com até ${SLOGAN_MAX} caracteres.`,
    `- descricao: apresentação do negócio com até ${DESCRICAO_MAX} caracteres.`,
    `- titulosSecoes: um título (até ${TITULO_MAX} caracteres) para cada seção: ${secoesTitulaveis(
      skin,
    )
      .map((secao) => `"${secao.id}" (${secao.nome})`)
      .join(", ")}.`,
  ].join("\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textoCurto(value: unknown, max: number): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  return value.trim().slice(0, max);
}

/**
 * Validação estrita da resposta do Gemini contra o contrato da skin.
 * Qualquer desvio de forma (chave desconhecida, enum fora da lista, hex
 * inválido, seção que a skin não tem) vira lista de problemas — o chamador
 * tenta 1 retry com os problemas no prompt. Comprimento de texto não é
 * problema: é recortado (clamp) na leitura.
 */
export function validarSugestao(
  bruto: unknown,
  skin: SkinDefinition,
): { sugestao: SugestaoDemo; problemas: [] } | { sugestao?: undefined; problemas: string[] } {
  const problemas: string[] = [];
  if (!isRecord(bruto)) {
    return { problemas: ["resposta deve ser um objeto JSON"] };
  }

  for (const chave of Object.keys(bruto)) {
    if (!(CHAVES_SUGESTAO as readonly string[]).includes(chave)) {
      problemas.push(`chave desconhecida: ${chave}`);
    }
  }

  const themeId = bruto.themeId;
  if (
    typeof themeId !== "string" ||
    !skin.themePresets.some((preset) => preset.id === themeId)
  ) {
    problemas.push(
      `themeId deve ser um preset da skin: ${skin.themePresets.map((p) => p.id).join(", ")}`,
    );
  }

  const destaque = bruto.destaque;
  if (typeof destaque !== "string" || !HEX_RE.test(destaque)) {
    problemas.push("destaque deve ser cor hex no formato #rrggbb");
  }

  const fonteDisplay = bruto.fonteDisplay;
  const fontesValidas = idsFontesDisplay(skin);
  if (typeof fonteDisplay !== "string" || !fontesValidas.includes(fonteDisplay)) {
    problemas.push(`fonteDisplay deve ser uma da lista curada: ${fontesValidas.join(", ")}`);
  }

  const animacao = bruto.animacao;
  if (typeof animacao !== "string" || !(ANIMACOES as readonly string[]).includes(animacao)) {
    problemas.push(`animacao deve ser um de: ${ANIMACOES.join(", ")}`);
  }

  const slogan = textoCurto(bruto.slogan, SLOGAN_MAX);
  if (!slogan) problemas.push("slogan deve ser string não vazia");
  const descricao = textoCurto(bruto.descricao, DESCRICAO_MAX);
  if (!descricao) problemas.push("descricao deve ser string não vazia");

  const titulos: Record<string, string> = {};
  const idsSecoes = secoesTitulaveis(skin).map((secao) => secao.id);
  if (!isRecord(bruto.titulosSecoes)) {
    problemas.push("titulosSecoes deve ser um objeto seção → título");
  } else {
    for (const [id, titulo] of Object.entries(bruto.titulosSecoes)) {
      if (!idsSecoes.includes(id)) {
        problemas.push(`titulosSecoes.${id} não é seção da skin (${idsSecoes.join(", ")})`);
        continue;
      }
      const limpo = textoCurto(titulo, TITULO_MAX);
      if (!limpo) {
        problemas.push(`titulosSecoes.${id} deve ser string não vazia`);
        continue;
      }
      titulos[id] = limpo;
    }
  }

  if (problemas.length > 0) return { problemas };
  return {
    sugestao: {
      themeId: themeId as string,
      destaque: (destaque as string).toLowerCase(),
      fonteDisplay: fonteDisplay as string,
      animacao: animacao as Animacao,
      slogan: slogan as string,
      descricao: descricao as string,
      titulosSecoes: titulos,
    },
    problemas: [],
  };
}

/**
 * Geração completa: reserva de cota (SKU aiGeneration — cada chamada real
 * ao Gemini reserva 1, igual às páginas do Text Search) → generateContent
 * → validação estrita. Resposta inválida ganha UM retry com os problemas
 * anexados ao prompt; inválida de novo → AiError (502).
 */
export async function gerarSugestaoDemo(
  db: UsageDb,
  lead: Lead,
  skin: SkinDefinition,
  caps: UsageCounts,
  userId?: string,
): Promise<SugestaoDemo> {
  const prompt = montarPromptSugestao(skin, lead);
  const schema = schemaSugestao(skin);

  await reserveQuota(db, "aiGeneration", caps, undefined, { userId });
  const primeira = validarSugestao(await gerarJson(prompt, schema), skin);
  if (primeira.sugestao) return primeira.sugestao;

  const promptRetry = [
    prompt,
    "",
    "ATENÇÃO: sua resposta anterior foi rejeitada pelos problemas abaixo. Corrija TODOS e responda de novo apenas o JSON:",
    ...primeira.problemas.map((problema) => `- ${problema}`),
  ].join("\n");

  await reserveQuota(db, "aiGeneration", caps, undefined, { userId });
  const segunda = validarSugestao(await gerarJson(promptRetry, schema), skin);
  if (segunda.sugestao) return segunda.sugestao;

  throw new AiError(
    `resposta fora do schema mesmo após retry: ${segunda.problemas.join("; ")}`,
  );
}
