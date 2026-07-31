import { reserveQuota, type UsageCounts } from "@/lib/costs";
import { fontesPorPapel } from "@/lib/demos/fontes";
import { idiomaEfetivoDemo } from "@/lib/demos/idioma";
import { HEX_RE } from "@/lib/demos/tema";
import { ANIMACOES, type Animacao, type SkinDefinition } from "@/lib/demos/types";
import type { UsageDb } from "@/lib/firestore-like";
import { IDIOMA_PADRAO, idiomaLabel } from "@/lib/idioma";
import type { Lead } from "@/lib/leads/types";
import { AiError, gerarJson } from "./gemini";
import { NIVEL_IA_PADRAO, type NivelIA } from "./nivel";

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
const ROTULO_MAX = 40;
const CTA_MAX = 60;

/** Textos de UMA seção não-fixa no nível "completo" (ver textosSecoes). */
export interface SugestaoSecaoTexto {
  rotulo?: string;
  titulo?: string;
  texto?: string;
  cta?: string;
  ctaSecundaria?: string;
}

/** Nome/descrição de UM serviço no nível "completo" (ver `servicos`). Preço NUNCA entra — é dado, não conteúdo. */
export interface SugestaoServico {
  nome: string;
  descricao?: string;
}

/** Autor/texto de UM depoimento no nível "completo" (ver `depoimentos`). */
export interface SugestaoDepoimento {
  autor: string;
  texto: string;
}

export interface SugestaoDemo {
  /** Preset de tema da skin (paleta/base dentro dos tokens do Theme). */
  themeId: string;
  /** Cor primária #rrggbb por cima do preset (TemaPatch.destaque). */
  destaque: string;
  /** Id da lista curada de fontes, papel "display" (TemaPatch.fonteDisplay). */
  fonteDisplay: string;
  /** Nível de animação do tema. */
  animacao: Animacao;
  /** Frase de efeito curta (DemoData.slogan), pt-BR — ausente em "toque-leve". */
  slogan?: string;
  /** Descrição curta do negócio (texto do hero) — ausente em "toque-leve". */
  descricao?: string;
  /**
   * Título por seção do contrato da skin (DemoData.secoes[id].titulo) — só
   * no nível "equilibrado"; no "completo" o mesmo papel é coberto (com mais
   * campos) por `textosSecoes`.
   */
  titulosSecoes?: Record<string, string>;
  /**
   * Nível "completo": rótulo/título/texto/CTAs de cada seção NÃO-fixa,
   * reescritos no tom do nicho e no idioma da região — superset de
   * `titulosSecoes` (nunca os dois juntos na mesma sugestão).
   */
  textosSecoes?: Record<string, SugestaoSecaoTexto>;
  /**
   * Nível "completo": nome/descrição de CADA serviço do contrato da skin
   * (`skin.demoDataExemplo.servicos`, na mesma ordem/quantidade — preço
   * nunca entra, é dado do lead). Ausente quando a skin não tem serviços
   * (nunca acontece hoje — o registro exige ao menos um).
   */
  servicos?: SugestaoServico[];
  /**
   * Nível "completo": autor/texto de CADA depoimento do contrato da skin
   * (`skin.demoDataExemplo.depoimentos`, mesma ordem/quantidade). Ausente
   * quando a skin não tem depoimentos de exemplo (ex.: lancheria,
   * barbearia2 — ver `schemaListaDepoimentos`).
   */
  depoimentos?: SugestaoDepoimento[];
}

/** Chaves de topo aceitas na resposta do Gemini, de acordo com o nível e a SKIN ATIVA (não a união de todas). */
const CHAVES_BASE = ["themeId", "destaque", "fonteDisplay", "animacao"] as const;

function chavesParaNivel(skin: SkinDefinition, nivel: NivelIA): string[] {
  if (nivel === "toque-leve") return [...CHAVES_BASE];
  const chaves: string[] = [...CHAVES_BASE, "slogan", "descricao", "idioma"];
  if (nivel === "equilibrado") {
    chaves.push("titulosSecoes");
    return chaves;
  }
  chaves.push("textosSecoes");
  if (skin.demoDataExemplo.servicos.length > 0) chaves.push("servicos");
  if (skin.demoDataExemplo.depoimentos.length > 0) chaves.push("depoimentos");
  return chaves;
}

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

/** Schema de UMA seção não-fixa no nível "completo" (ver SugestaoSecaoTexto). */
function schemaSecaoTexto(): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      rotulo: { type: "string", maxLength: ROTULO_MAX },
      titulo: { type: "string", maxLength: TITULO_MAX },
      texto: { type: "string", maxLength: DESCRICAO_MAX },
      cta: { type: "string", maxLength: CTA_MAX },
      ctaSecundaria: { type: "string", maxLength: CTA_MAX },
    },
  };
}

/**
 * Schema de `servicos`: array de comprimento FIXO (== quantidade de
 * serviços da skin ativa, `skin.demoDataExemplo.servicos` — nunca a união
 * de todas as skins), nome+descrição por item. `undefined` só quando a
 * skin não tem nenhum serviço de exemplo (não acontece hoje).
 */
function schemaListaServicos(skin: SkinDefinition): Record<string, unknown> | undefined {
  const quantidade = skin.demoDataExemplo.servicos.length;
  if (quantidade === 0) return undefined;
  return {
    type: "array",
    minItems: quantidade,
    maxItems: quantidade,
    items: {
      type: "object",
      additionalProperties: false,
      required: ["nome"],
      properties: {
        nome: { type: "string", maxLength: TITULO_MAX },
        descricao: { type: "string", maxLength: DESCRICAO_MAX },
      },
    },
  };
}

/**
 * Schema de `depoimentos`: array de comprimento FIXO (== quantidade de
 * depoimentos de exemplo da skin ativa). `undefined` quando a skin não
 * tem depoimentos de exemplo (ex.: lancheria, barbearia2).
 */
function schemaListaDepoimentos(skin: SkinDefinition): Record<string, unknown> | undefined {
  const quantidade = skin.demoDataExemplo.depoimentos.length;
  if (quantidade === 0) return undefined;
  return {
    type: "array",
    minItems: quantidade,
    maxItems: quantidade,
    items: {
      type: "object",
      additionalProperties: false,
      required: ["autor", "texto"],
      properties: {
        autor: { type: "string", maxLength: TITULO_MAX },
        texto: { type: "string", maxLength: DESCRICAO_MAX },
      },
    },
  };
}

/**
 * JSON Schema (padrão) enviado ao Gemini em responseJsonSchema — guia o
 * modelo pro formato certo; a validação estrita local continua mandando.
 * Os campos oferecidos dependem do NÍVEL escolhido pelo usuário: o Gemini
 * só recebe/devolve o que aquele nível permite (ver ./nivel.ts). `idioma`,
 * quando presente, é fixado num único valor permitido (enum de 1 item):
 * reforça no schema o idioma-alvo já instruído no prompt.
 */
export function schemaSugestao(
  skin: SkinDefinition,
  nivel: NivelIA = NIVEL_IA_PADRAO,
  idioma: string = IDIOMA_PADRAO,
): Record<string, unknown> {
  const properties: Record<string, unknown> = {
    themeId: { type: "string", enum: skin.themePresets.map((preset) => preset.id) },
    destaque: {
      type: "string",
      pattern: "^#[0-9a-fA-F]{6}$",
      description: "Cor primária em hex #rrggbb, harmônica com o preset escolhido.",
    },
    fonteDisplay: { type: "string", enum: idsFontesDisplay(skin) },
    animacao: { type: "string", enum: [...ANIMACOES] },
  };

  if (nivel !== "toque-leve") {
    properties.slogan = { type: "string", maxLength: SLOGAN_MAX };
    properties.descricao = { type: "string", maxLength: DESCRICAO_MAX };
    properties.idioma = {
      type: "string",
      enum: [idioma],
      description: "Idioma-alvo dos textos — repita este valor.",
    };
  }

  if (nivel === "equilibrado") {
    properties.titulosSecoes = {
      type: "object",
      additionalProperties: false,
      properties: Object.fromEntries(
        secoesTitulaveis(skin).map((secao) => [
          secao.id,
          { type: "string", maxLength: TITULO_MAX },
        ]),
      ),
    };
  }

  if (nivel === "completo") {
    properties.textosSecoes = {
      type: "object",
      additionalProperties: false,
      properties: Object.fromEntries(
        secoesTitulaveis(skin).map((secao) => [secao.id, schemaSecaoTexto()]),
      ),
    };
    const servicos = schemaListaServicos(skin);
    if (servicos) properties.servicos = servicos;
    const depoimentos = schemaListaDepoimentos(skin);
    if (depoimentos) properties.depoimentos = depoimentos;
  }

  return {
    type: "object",
    additionalProperties: false,
    required: chavesParaNivel(skin, nivel),
    properties,
  };
}

/**
 * Prompt com o que a rota sabe do lead: nicho, nome, rating/dados públicos
 * já salvos (nunca busca nada novo no Google) e a skin escolhida. `idioma`
 * (BCP-47, default pt-BR) vem da região geocodificada da busca que trouxe o
 * lead — ver "Idioma da IA na demo": os TEXTOS saem no idioma do lead, mas
 * a instrução em si continua em português (idioma do operador do app).
 */
export function montarPromptSugestao(
  skin: SkinDefinition,
  lead: Lead,
  nivel: NivelIA = NIVEL_IA_PADRAO,
  idioma: string = IDIOMA_PADRAO,
): string {
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

  const linhasTextos: string[] =
    nivel === "toque-leve"
      ? []
      : [
          "",
          "Textos (curtos, diretos, sem emojis, sem inventar dados que não estão acima):",
          `- slogan: frase de efeito com até ${SLOGAN_MAX} caracteres.`,
          `- descricao: apresentação do negócio com até ${DESCRICAO_MAX} caracteres.`,
          ...(nivel === "equilibrado"
            ? [
                `- titulosSecoes: um título (até ${TITULO_MAX} caracteres) para cada seção: ${secoesTitulaveis(
                  skin,
                )
                  .map((secao) => `"${secao.id}" (${secao.nome})`)
                  .join(", ")}.`,
              ]
            : [
                `- textosSecoes: para CADA seção abaixo, reescreva os textos que ela já usa (rótulo ≤${ROTULO_MAX} caracteres, título ≤${TITULO_MAX}, texto ≤${DESCRICAO_MAX}, cta/ctaSecundaria ≤${CTA_MAX} — preencha só os campos que fizerem sentido pra seção, mantendo a intenção original de cada uma): ${secoesTitulaveis(
                  skin,
                )
                  .map((secao) => `"${secao.id}" (${secao.nome})`)
                  .join(", ")}.`,
                ...(skin.demoDataExemplo.servicos.length > 0
                  ? [
                      `- servicos: reescreva nome (≤${TITULO_MAX} caracteres) e descrição (≤${DESCRICAO_MAX}, quando fizer sentido) de CADA um dos ${skin.demoDataExemplo.servicos.length} serviços abaixo, na MESMA ordem (não invente nem remova item; preço não entra, é dado do lead): ${skin.demoDataExemplo.servicos
                        .map((servico, i) => `${i + 1}. "${servico.nome}"${servico.descricao ? ` — ${servico.descricao}` : ""}`)
                        .join("; ")}.`,
                    ]
                  : []),
                ...(skin.demoDataExemplo.depoimentos.length > 0
                  ? [
                      `- depoimentos: reescreva autor e texto (≤${DESCRICAO_MAX}) de CADA um dos ${skin.demoDataExemplo.depoimentos.length} depoimentos abaixo, na MESMA ordem (mantenha nome plausível pro idioma-alvo, sem inventar dados do negócio): ${skin.demoDataExemplo.depoimentos
                        .map((dep, i) => `${i + 1}. ${dep.autor}: "${dep.texto}"`)
                        .join("; ")}.`,
                    ]
                  : []),
              ]),
        ];

  return [
    "Você é o diretor de arte de demos de sites para negócios locais brasileiros (o cliente da agência é brasileiro; o negócio abaixo pode estar em outro país).",
    nivel === "toque-leve"
      ? "Sugira só um ponto de partida de TEMA (paleta/fonte/animação) para a demo do negócio abaixo — nenhum texto. Responda APENAS o JSON pedido."
      : "Sugira tema e textos curtos para a demo do negócio abaixo. Responda APENAS o JSON pedido, com tom adequado ao nicho (nada genérico de agência).",
    ...(nivel !== "toque-leve"
      ? [
          `IMPORTANTE: escreva os TEXTOS em ${idiomaLabel(idioma)} — é o idioma do país/região do negócio, não necessariamente o seu. Preencha o campo "idioma" do JSON com exatamente "${idioma}".`,
        ]
      : []),
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
    `- animacao: ${ANIMACOES.map((valor) => `"${valor}"`).join(", ")} (quanto o site se move).`,
    ...linhasTextos,
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
  nivel: NivelIA = NIVEL_IA_PADRAO,
  idioma: string = IDIOMA_PADRAO,
): { sugestao: SugestaoDemo; problemas: [] } | { sugestao?: undefined; problemas: string[] } {
  const problemas: string[] = [];
  if (!isRecord(bruto)) {
    return { problemas: ["resposta deve ser um objeto JSON"] };
  }

  const chavesPermitidas = chavesParaNivel(skin, nivel);
  for (const chave of Object.keys(bruto)) {
    if (!chavesPermitidas.includes(chave)) {
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

  let slogan: string | undefined;
  let descricao: string | undefined;
  let titulos: Record<string, string> | undefined;
  let textos: Record<string, SugestaoSecaoTexto> | undefined;
  const idsSecoes = secoesTitulaveis(skin).map((secao) => secao.id);

  if (nivel !== "toque-leve") {
    slogan = textoCurto(bruto.slogan, SLOGAN_MAX);
    if (!slogan) problemas.push("slogan deve ser string não vazia");
    descricao = textoCurto(bruto.descricao, DESCRICAO_MAX);
    if (!descricao) problemas.push("descricao deve ser string não vazia");

    if (bruto.idioma !== idioma) {
      problemas.push(`idioma deve ser exatamente "${idioma}"`);
    }
  }

  if (nivel === "equilibrado") {
    titulos = {};
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
  }

  if (nivel === "completo") {
    textos = {};
    if (!isRecord(bruto.textosSecoes)) {
      problemas.push("textosSecoes deve ser um objeto seção → textos");
    } else {
      for (const [id, valor] of Object.entries(bruto.textosSecoes)) {
        if (!idsSecoes.includes(id)) {
          problemas.push(`textosSecoes.${id} não é seção da skin (${idsSecoes.join(", ")})`);
          continue;
        }
        if (!isRecord(valor)) {
          problemas.push(`textosSecoes.${id} deve ser um objeto de textos`);
          continue;
        }
        for (const chave of Object.keys(valor)) {
          if (!["rotulo", "titulo", "texto", "cta", "ctaSecundaria"].includes(chave)) {
            problemas.push(`textosSecoes.${id}.${chave} não é um campo de texto válido`);
          }
        }
        const secaoTexto: SugestaoSecaoTexto = {
          rotulo: textoCurto(valor.rotulo, ROTULO_MAX),
          titulo: textoCurto(valor.titulo, TITULO_MAX),
          texto: textoCurto(valor.texto, DESCRICAO_MAX),
          cta: textoCurto(valor.cta, CTA_MAX),
          ctaSecundaria: textoCurto(valor.ctaSecundaria, CTA_MAX),
        };
        const semTextoAlgum = Object.values(secaoTexto).every((v) => v === undefined);
        if (semTextoAlgum) {
          problemas.push(`textosSecoes.${id} deve ter ao menos um campo de texto não vazio`);
          continue;
        }
        textos[id] = secaoTexto;
      }
    }
  }

  let servicos: SugestaoServico[] | undefined;
  const quantidadeServicos = skin.demoDataExemplo.servicos.length;
  if (nivel === "completo" && quantidadeServicos > 0) {
    if (!Array.isArray(bruto.servicos) || bruto.servicos.length !== quantidadeServicos) {
      problemas.push(`servicos deve ser uma lista com ${quantidadeServicos} item(ns)`);
    } else {
      servicos = bruto.servicos.map((item, i) => {
        if (!isRecord(item)) {
          problemas.push(`servicos[${i}] deve ser um objeto`);
          return { nome: "" };
        }
        const nome = textoCurto(item.nome, TITULO_MAX);
        if (!nome) problemas.push(`servicos[${i}].nome deve ser string não vazia`);
        const desc = textoCurto(item.descricao, DESCRICAO_MAX);
        return { nome: nome ?? "", ...(desc !== undefined && { descricao: desc }) };
      });
    }
  }

  let depoimentos: SugestaoDepoimento[] | undefined;
  const quantidadeDepoimentos = skin.demoDataExemplo.depoimentos.length;
  if (nivel === "completo" && quantidadeDepoimentos > 0) {
    if (!Array.isArray(bruto.depoimentos) || bruto.depoimentos.length !== quantidadeDepoimentos) {
      problemas.push(`depoimentos deve ser uma lista com ${quantidadeDepoimentos} item(ns)`);
    } else {
      depoimentos = bruto.depoimentos.map((item, i) => {
        if (!isRecord(item)) {
          problemas.push(`depoimentos[${i}] deve ser um objeto`);
          return { autor: "", texto: "" };
        }
        const autor = textoCurto(item.autor, TITULO_MAX);
        if (!autor) problemas.push(`depoimentos[${i}].autor deve ser string não vazia`);
        const texto = textoCurto(item.texto, DESCRICAO_MAX);
        if (!texto) problemas.push(`depoimentos[${i}].texto deve ser string não vazia`);
        return { autor: autor ?? "", texto: texto ?? "" };
      });
    }
  }

  if (problemas.length > 0) return { problemas };
  return {
    sugestao: {
      themeId: themeId as string,
      destaque: (destaque as string).toLowerCase(),
      fonteDisplay: fonteDisplay as string,
      animacao: animacao as Animacao,
      ...(slogan !== undefined && { slogan }),
      ...(descricao !== undefined && { descricao }),
      ...(titulos !== undefined && { titulosSecoes: titulos }),
      ...(textos !== undefined && { textosSecoes: textos }),
      ...(servicos !== undefined && { servicos }),
      ...(depoimentos !== undefined && { depoimentos }),
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
  nivel: NivelIA = NIVEL_IA_PADRAO,
  ctx: { userId?: string; isAdmin?: boolean } = {},
  /**
   * Idioma escolhido AGORA no seletor do editor (pode ainda não ter sido
   * salvo) — vence o default. Ausente → `LeadDemo.idioma` já persistido ou,
   * na falta dele, o derivado do país do ENDEREÇO DO PRÓPRIO LEAD (mais
   * preciso que o idioma da região da busca, `lead.busca.idioma`, uma
   * aproximação de mercado). Nunca o idioma do usuário logado — ver
   * "Idioma da IA na demo". Default pt-BR.
   */
  idiomaEscolhido?: string,
): Promise<SugestaoDemo> {
  const idioma = idiomaEscolhido ?? idiomaEfetivoDemo(lead);
  const prompt = montarPromptSugestao(skin, lead, nivel, idioma);
  const schema = schemaSugestao(skin, nivel, idioma);

  await reserveQuota(db, "aiGeneration", caps, undefined, ctx);
  const primeira = validarSugestao(await gerarJson(prompt, schema), skin, nivel, idioma);
  if (primeira.sugestao) return primeira.sugestao;

  const promptRetry = [
    prompt,
    "",
    "ATENÇÃO: sua resposta anterior foi rejeitada pelos problemas abaixo. Corrija TODOS e responda de novo apenas o JSON:",
    ...primeira.problemas.map((problema) => `- ${problema}`),
  ].join("\n");

  await reserveQuota(db, "aiGeneration", caps, undefined, ctx);
  const segunda = validarSugestao(await gerarJson(promptRetry, schema), skin, nivel, idioma);
  if (segunda.sugestao) return segunda.sugestao;

  throw new AiError(
    `resposta fora do schema mesmo após retry: ${segunda.problemas.join("; ")}`,
  );
}
