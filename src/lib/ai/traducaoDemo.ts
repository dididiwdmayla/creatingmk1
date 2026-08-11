import { reserveQuota, type UsageCounts } from "@/lib/costs";
import type { DemoData, DemoItem, SkinDefinition } from "@/lib/demos/types";
import type { UsageDb } from "@/lib/firestore-like";
import { idiomaLabelRegional } from "@/lib/idioma";
import { type CtxIA, reserveQuotaOptsIA } from "./ctx";
import { AiError, gerarJson } from "./gemini";

/**
 * 4ª ação do botão de IA do editor de demo: TRADUZIR, não gerar. Ao
 * contrário de `./sugestao.ts` (que inventa um ponto de partida), esta
 * ação nunca reescreve, melhora ou muda o tom — verte para o idioma-alvo
 * EXATAMENTE o texto que já está no editor naquele momento (a edição do
 * usuário, não os slots de exemplo da skin). Ver "Idioma da IA na demo" em
 * ARCHITECTURE.md.
 *
 * Escopo estritamente CONTEÚDO — nenhum campo de identidade do lead entra
 * (nome, endereço, cidade, telefone, whatsapp, horários, instagram, título
 * do hero) nem o valor numérico de preço (`precoValor`/`preco` livre); o
 * PREFIXO de preço (`precoPrefixo`, ex. "A partir de") é conteúdo e entra,
 * mesmo critério de `lib/demos/precos.ts`. O nome do autor de um
 * depoimento também fica de fora — é um dado da pessoa, não texto pra
 * traduzir, só o depoimento em si.
 */

const SLOGAN_MAX = 120;
const DESCRICAO_MAX = 400;
const TITULO_MAX = 80;
const ROTULO_MAX = 40;
const CTA_MAX = 60;

const MAX_POR_CAMPO: Record<string, number> = {
  slogan: SLOGAN_MAX,
  rotulo: ROTULO_MAX,
  titulo: TITULO_MAX,
  texto: DESCRICAO_MAX,
  cta: CTA_MAX,
  ctaSecundaria: CTA_MAX,
  subtitulo: TITULO_MAX,
  detalhe: ROTULO_MAX,
  nome: TITULO_MAX,
  descricao: DESCRICAO_MAX,
  precoPrefixo: ROTULO_MAX,
};

/** Título/subtítulo/detalhe/texto de UM item de `DemoSecao.itens` — só os campos preenchidos. */
export interface TraducaoItem {
  titulo?: string;
  subtitulo?: string;
  detalhe?: string;
  texto?: string;
}

/** Textos de UMA seção — só os campos que tinham conteúdo no editor. */
export interface TraducaoSecaoTexto {
  rotulo?: string;
  /** Ausente na seção fixa (hero) — o título dela é o nome do negócio, identidade. */
  titulo?: string;
  texto?: string;
  cta?: string;
  ctaSecundaria?: string;
  /** Mesmo comprimento de `dados.secoes[id].itens` — item sem nenhum campo preenchido vira `{}`. */
  itens?: TraducaoItem[];
}

/** Nome/descrição/prefixo de preço de UM serviço — preço NUMÉRICO nunca entra. */
export interface TraducaoServico {
  nome?: string;
  descricao?: string;
  precoPrefixo?: string;
}

/** Só o texto do depoimento — o autor é um dado da pessoa, não é traduzido. */
export interface TraducaoDepoimento {
  texto?: string;
}

export interface ConteudoTraduzivel {
  slogan?: string;
  secoes: Record<string, TraducaoSecaoTexto>;
  /** Mesmo comprimento/índice de `dados.servicos` — item sem conteúdo vira `{}`. */
  servicos: TraducaoServico[];
  /** Mesmo comprimento/índice de `dados.depoimentos` — item sem conteúdo vira `{}`. */
  depoimentos: TraducaoDepoimento[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textoOuUndefined(valor: string | undefined): string | undefined {
  const limpo = valor?.trim();
  return limpo ? limpo : undefined;
}

function extrairItem(item: DemoItem): TraducaoItem {
  const titulo = textoOuUndefined(item.titulo);
  const subtitulo = textoOuUndefined(item.subtitulo);
  const detalhe = textoOuUndefined(item.detalhe);
  const texto = textoOuUndefined(item.texto);
  return {
    ...(titulo !== undefined && { titulo }),
    ...(subtitulo !== undefined && { subtitulo }),
    ...(detalhe !== undefined && { detalhe }),
    ...(texto !== undefined && { texto }),
  };
}

function secaoTemConteudo(secao: TraducaoSecaoTexto): boolean {
  return (
    secao.rotulo !== undefined ||
    secao.titulo !== undefined ||
    secao.texto !== undefined ||
    secao.cta !== undefined ||
    secao.ctaSecundaria !== undefined ||
    (secao.itens?.some((item) => Object.keys(item).length > 0) ?? false)
  );
}

/**
 * Extrai do DemoData EFETIVO do editor (exemplo ← lead ← edições em
 * memória) só o que é elegível a tradução: nada de identidade, nada de
 * preço numérico, e só os campos que o usuário de fato preencheu — campo
 * vazio nunca é "traduzido" (não há o que traduzir, e não se pede ao
 * modelo que preencha algo que ele mesmo teria que inventar).
 */
export function extrairConteudoTraduzivel(
  dados: Pick<DemoData, "slogan" | "secoes" | "servicos" | "depoimentos">,
  skin: SkinDefinition,
): ConteudoTraduzivel {
  const secoes: Record<string, TraducaoSecaoTexto> = {};
  for (const def of skin.secoes) {
    const atual = dados.secoes[def.id];
    if (!atual) continue;
    const rotulo = textoOuUndefined(atual.rotulo);
    const titulo = def.fixa ? undefined : textoOuUndefined(atual.titulo);
    const texto = textoOuUndefined(atual.texto);
    const cta = textoOuUndefined(atual.cta);
    const ctaSecundaria = textoOuUndefined(atual.ctaSecundaria);
    const secao: TraducaoSecaoTexto = {
      ...(rotulo !== undefined && { rotulo }),
      ...(titulo !== undefined && { titulo }),
      ...(texto !== undefined && { texto }),
      ...(cta !== undefined && { cta }),
      ...(ctaSecundaria !== undefined && { ctaSecundaria }),
      ...(atual.itens && atual.itens.length > 0 && { itens: atual.itens.map(extrairItem) }),
    };
    if (secaoTemConteudo(secao)) secoes[def.id] = secao;
  }

  const servicos: TraducaoServico[] = dados.servicos.map((servico) => {
    const nome = textoOuUndefined(servico.nome);
    const descricao = textoOuUndefined(servico.descricao);
    const precoPrefixo = textoOuUndefined(servico.precoPrefixo);
    return {
      ...(nome !== undefined && { nome }),
      ...(descricao !== undefined && { descricao }),
      ...(precoPrefixo !== undefined && { precoPrefixo }),
    };
  });

  const depoimentos: TraducaoDepoimento[] = dados.depoimentos.map((depoimento) => {
    const texto = textoOuUndefined(depoimento.texto);
    return { ...(texto !== undefined && { texto }) };
  });

  const slogan = textoOuUndefined(dados.slogan);

  return {
    ...(slogan !== undefined && { slogan }),
    secoes,
    servicos,
    depoimentos,
  };
}

/** Nada pra traduzir (editor sem nenhum campo de conteúdo preenchido)? */
export function conteudoTraduzivelVazio(conteudo: ConteudoTraduzivel): boolean {
  return (
    conteudo.slogan === undefined &&
    Object.keys(conteudo.secoes).length === 0 &&
    conteudo.servicos.every((servico) => Object.keys(servico).length === 0) &&
    conteudo.depoimentos.every((depoimento) => Object.keys(depoimento).length === 0)
  );
}

function schemaCampo(chave: string): Record<string, unknown> {
  return { type: "string", minLength: 1, maxLength: MAX_POR_CAMPO[chave] ?? DESCRICAO_MAX };
}

function schemaItens(itens: TraducaoItem[]): Record<string, unknown> {
  return {
    type: "array",
    minItems: itens.length,
    maxItems: itens.length,
    items: {
      type: "object",
      additionalProperties: false,
      properties: {
        titulo: schemaCampo("titulo"),
        subtitulo: schemaCampo("subtitulo"),
        detalhe: schemaCampo("detalhe"),
        texto: schemaCampo("texto"),
      },
    },
  };
}

function schemaSecao(secao: TraducaoSecaoTexto): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  for (const chave of ["rotulo", "titulo", "texto", "cta", "ctaSecundaria"] as const) {
    if (secao[chave] !== undefined) properties[chave] = schemaCampo(chave);
  }
  if (secao.itens) properties.itens = schemaItens(secao.itens);
  return { type: "object", additionalProperties: false, properties };
}

function schemaServicos(servicos: TraducaoServico[]): Record<string, unknown> {
  return {
    type: "array",
    minItems: servicos.length,
    maxItems: servicos.length,
    items: {
      type: "object",
      additionalProperties: false,
      properties: {
        nome: schemaCampo("nome"),
        descricao: schemaCampo("descricao"),
        precoPrefixo: schemaCampo("precoPrefixo"),
      },
    },
  };
}

function schemaDepoimentos(depoimentos: TraducaoDepoimento[]): Record<string, unknown> {
  return {
    type: "array",
    minItems: depoimentos.length,
    maxItems: depoimentos.length,
    items: {
      type: "object",
      additionalProperties: false,
      properties: { texto: schemaCampo("texto") },
    },
  };
}

/**
 * Schema enviado ao Gemini: espelha SÓ os campos que `conteudo` realmente
 * tem (dinâmico por definição — não existe "nível" aqui, é o texto atual
 * do editor, seja lá o que for). Guia o modelo; a validação estrita de
 * verdade é `validarTraducaoDemo`.
 */
export function schemaTraducaoDemo(conteudo: ConteudoTraduzivel): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  if (conteudo.slogan !== undefined) properties.slogan = schemaCampo("slogan");
  if (Object.keys(conteudo.secoes).length > 0) {
    properties.secoes = {
      type: "object",
      additionalProperties: false,
      properties: Object.fromEntries(
        Object.entries(conteudo.secoes).map(([id, secao]) => [id, schemaSecao(secao)]),
      ),
    };
  }
  if (conteudo.servicos.some((servico) => Object.keys(servico).length > 0)) {
    properties.servicos = schemaServicos(conteudo.servicos);
  }
  if (conteudo.depoimentos.some((depoimento) => Object.keys(depoimento).length > 0)) {
    properties.depoimentos = schemaDepoimentos(conteudo.depoimentos);
  }
  return { type: "object", additionalProperties: false, properties };
}

/**
 * Prompt de TRADUÇÃO pura — o oposto de `montarPromptSugestao`: nada de
 * "sugira", "reescreva no tom do nicho" ou inventar dado. O texto já foi
 * escrito e aprovado pelo operador; a única tarefa é vertê-lo para a
 * variante regional certa, preservando significado e estrutura.
 */
export function montarPromptTraducaoDemo(conteudo: ConteudoTraduzivel, idioma: string): string {
  return [
    "Você é um TRADUTOR profissional — não um redator, revisor ou copywriter.",
    `Traduza CADA valor de texto do JSON abaixo para ${idiomaLabelRegional(idioma)}, respeitando o vocabulário, a ortografia e as expressões dessa variante regional específica (não é a mesma coisa que a língua genérica).`,
    "",
    "REGRAS ESTRITAS:",
    "- Traduza o SIGNIFICADO exato de cada texto. NUNCA reescreva, resuma, expanda, melhore, corrija ou troque o tom — sua única tarefa é verter para o idioma-alvo o que já está escrito.",
    "- Não invente conteúdo novo, não remova informação, não adicione frases.",
    "- Preserve emojis e pontuação enfática do texto original.",
    "- Responda APENAS o JSON pedido, na MESMA estrutura e as MESMAS chaves do JSON de entrada, com os valores traduzidos.",
    "",
    "Texto atual (JSON):",
    JSON.stringify(conteudo, null, 2),
  ].join("\n");
}

function validarCampo(bruto: unknown, max: number): string | undefined {
  if (typeof bruto !== "string") return undefined;
  const limpo = bruto.trim();
  return limpo ? limpo.slice(0, max) : undefined;
}

function validarItens(
  brutos: unknown,
  original: TraducaoItem[],
  path: string,
  problemas: string[],
): TraducaoItem[] {
  const lista = Array.isArray(brutos) ? brutos : [];
  return original.map((itemOriginal, i) => {
    if (Object.keys(itemOriginal).length === 0) return {};
    const bruto = lista[i];
    if (!isRecord(bruto)) {
      problemas.push(`${path}[${i}] deve ser um objeto`);
      return {};
    }
    const item: TraducaoItem = {};
    for (const chave of ["titulo", "subtitulo", "detalhe", "texto"] as const) {
      if (itemOriginal[chave] === undefined) continue;
      const valor = validarCampo(bruto[chave], MAX_POR_CAMPO[chave]);
      if (!valor) {
        problemas.push(`${path}[${i}].${chave} deve ser string não vazia`);
        continue;
      }
      item[chave] = valor;
    }
    return item;
  });
}

/**
 * Validação estrita da resposta do Gemini contra o QUE FOI PEDIDO
 * (`conteudo`, não um contrato de skin): todo campo presente no original
 * precisa voltar como string não vazia; campo ausente no original nunca é
 * cobrado (o modelo não recebeu nada pra traduzir ali). Comprimento não é
 * motivo de rejeição — é recortado (clamp) na leitura.
 */
export function validarTraducaoDemo(
  bruto: unknown,
  conteudo: ConteudoTraduzivel,
): { traducao: ConteudoTraduzivel; problemas: [] } | { traducao?: undefined; problemas: string[] } {
  const problemas: string[] = [];
  if (!isRecord(bruto)) return { problemas: ["resposta deve ser um objeto JSON"] };

  let slogan: string | undefined;
  if (conteudo.slogan !== undefined) {
    slogan = validarCampo(bruto.slogan, SLOGAN_MAX);
    if (!slogan) problemas.push("slogan deve ser string não vazia");
  }

  const secoes: Record<string, TraducaoSecaoTexto> = {};
  const brutoSecoes = isRecord(bruto.secoes) ? bruto.secoes : {};
  for (const [id, secaoOriginal] of Object.entries(conteudo.secoes)) {
    const brutoSecao = isRecord(brutoSecoes[id]) ? brutoSecoes[id] : {};
    const secao: TraducaoSecaoTexto = {};
    for (const chave of ["rotulo", "titulo", "texto", "cta", "ctaSecundaria"] as const) {
      if (secaoOriginal[chave] === undefined) continue;
      const valor = validarCampo(brutoSecao[chave], MAX_POR_CAMPO[chave]);
      if (!valor) {
        problemas.push(`secoes.${id}.${chave} deve ser string não vazia`);
        continue;
      }
      secao[chave] = valor;
    }
    if (secaoOriginal.itens) {
      secao.itens = validarItens(brutoSecao.itens, secaoOriginal.itens, `secoes.${id}.itens`, problemas);
    }
    secoes[id] = secao;
  }

  const brutoServicos = Array.isArray(bruto.servicos) ? bruto.servicos : [];
  const servicos: TraducaoServico[] = conteudo.servicos.map((servicoOriginal, i) => {
    if (Object.keys(servicoOriginal).length === 0) return {};
    const brutoServico = isRecord(brutoServicos[i]) ? brutoServicos[i] : {};
    const servico: TraducaoServico = {};
    for (const chave of ["nome", "descricao", "precoPrefixo"] as const) {
      if (servicoOriginal[chave] === undefined) continue;
      const valor = validarCampo(brutoServico[chave], MAX_POR_CAMPO[chave]);
      if (!valor) {
        problemas.push(`servicos[${i}].${chave} deve ser string não vazia`);
        continue;
      }
      servico[chave] = valor;
    }
    return servico;
  });

  const brutoDepoimentos = Array.isArray(bruto.depoimentos) ? bruto.depoimentos : [];
  const depoimentos: TraducaoDepoimento[] = conteudo.depoimentos.map((depOriginal, i) => {
    if (depOriginal.texto === undefined) return {};
    const brutoDep = isRecord(brutoDepoimentos[i]) ? brutoDepoimentos[i] : {};
    const texto = validarCampo(brutoDep.texto, DESCRICAO_MAX);
    if (!texto) {
      problemas.push(`depoimentos[${i}].texto deve ser string não vazia`);
      return {};
    }
    return { texto };
  });

  if (problemas.length > 0) return { problemas };
  return {
    traducao: {
      ...(slogan !== undefined && { slogan }),
      secoes,
      servicos,
      depoimentos,
    },
    problemas: [],
  };
}

/**
 * Tradução completa: 1 chamada ao Gemini (SKU `aiGeneration`, mesma
 * mecânica de `reserveQuota` das demais gerações — inclusive a cota
 * INDIVIDUAL `geracoesIA` via `ctx`). Sem retry: resposta fora do formato
 * já é `AiError` direto (mesma postura de `gerarIndiceRegiao` — ver
 * ARCHITECTURE.md, "Precificação regional por IA").
 */
export async function traduzirConteudoDemo(
  db: UsageDb,
  conteudo: ConteudoTraduzivel,
  idioma: string,
  caps: UsageCounts,
  ctx: CtxIA = {},
): Promise<ConteudoTraduzivel> {
  const prompt = montarPromptTraducaoDemo(conteudo, idioma);
  const schema = schemaTraducaoDemo(conteudo);

  await reserveQuota(db, "aiGeneration", caps, undefined, reserveQuotaOptsIA(ctx));
  const resultado = validarTraducaoDemo(await gerarJson(prompt, schema), conteudo);
  if (resultado.traducao) return resultado.traducao;

  throw new AiError(`tradução fora do schema: ${resultado.problemas.join("; ")}`);
}
