import { reserveQuota, type UsageCounts } from "@/lib/costs";
import type { UsageDb } from "@/lib/firestore-like";
import { montarTraducao, slotsATraduzir } from "@/lib/frases/traducao";
import type { FrasesProspeccao, TraducaoFrases } from "@/lib/frases/types";
import { IDIOMA_PADRAO, idiomaLabelRegional } from "@/lib/idioma";
import { MARCADORES } from "@/lib/wa";
import { type CtxIA, reserveQuotaOptsIA } from "./ctx";
import { AiError, gerarJson } from "./gemini";

/**
 * Tradução das frases de prospecção de uma skin para o idioma do lead
 * estrangeiro (SKU `aiTraducao`, contador próprio — ver src/lib/costs).
 *
 * As frases são SEMPRE escritas em português; isto aqui produz o texto
 * derivado, que é gravado e reusado. Nunca roda sozinho: quem dispara é um
 * clique confirmado na ficha, com o número de chamadas e o custo na tela
 * antes do OK (mesmo padrão da geração de textos em lote).
 *
 * **A variante regional é o ponto**: o alvo é "espanhol (Argentina)", não
 * "espanhol" — o prompt recebe o rótulo regional e pede explicitamente o
 * vocabulário e o tratamento daquele país.
 *
 * **Os marcadores são intocáveis**: `{nome}`, `{demo}` e `{penetracao}` são
 * substituídos depois, no envio. Um marcador que se perca na tradução
 * quebraria o link da demo (e o token de rastreio junto), então a validação
 * exige os MESMOS marcadores da frase original, na mesma quantidade — falha
 * vira retry e, persistindo, erro.
 */

/** Marcadores que precisam sobreviver íntegros à tradução. */
function marcadoresDe(texto: string): string[] {
  return MARCADORES.filter((marcador) => texto.includes(marcador)).sort();
}

function schemaTraducao(quantidade: number): Record<string, unknown> {
  return {
    type: "object",
    properties: {
      frases: {
        type: "array",
        minItems: quantidade,
        maxItems: quantidade,
        items: { type: "string" },
      },
    },
    required: ["frases"],
  };
}

export function montarPromptTraducao(frases: string[], idioma: string): string {
  const alvo = idiomaLabelRegional(idioma);
  return [
    `Traduza para ${alvo} (código ${idioma}) as mensagens de primeira abordagem comercial abaixo.`,
    "",
    "Regras:",
    `- use a VARIANTE REGIONAL de ${alvo}: vocabulário, tratamento (tu/vos/usted) e expressões correntes NAQUELE país, não o idioma genérico;`,
    "- mantenha o tom: mensagem curta de WhatsApp, cordial e direta, de quem oferece um site pronto para o negócio;",
    "- preserve EXATAMENTE os marcadores entre chaves ({nome}, {demo}, {penetracao}) — mesma grafia, mesma quantidade, sem traduzir o que está dentro das chaves;",
    "- não acrescente saudação, assinatura, emoji ou frase que não exista no original;",
    "- devolva as frases na MESMA ordem em que aparecem abaixo.",
    "",
    "Frases (português do Brasil):",
    ...frases.map((frase, i) => `${i + 1}. ${frase}`),
  ].join("\n");
}

/** Valida a resposta: quantidade certa, texto não-vazio e marcadores íntegros. */
export function validarTraducao(
  bruto: unknown,
  originais: string[],
): { frases?: string[]; problemas: string[] } {
  const problemas: string[] = [];
  const frases = (bruto as { frases?: unknown } | undefined)?.frases;
  if (!Array.isArray(frases) || frases.length !== originais.length) {
    return { problemas: [`frases deve ser uma lista de ${originais.length} textos`] };
  }

  const limpas: string[] = [];
  frases.forEach((frase, i) => {
    if (typeof frase !== "string" || !frase.trim()) {
      problemas.push(`frases[${i}] veio vazia`);
      limpas.push("");
      return;
    }
    const esperados = marcadoresDe(originais[i]);
    const obtidos = marcadoresDe(frase);
    if (esperados.join(",") !== obtidos.join(",")) {
      problemas.push(
        `frases[${i}] precisa manter os marcadores ${esperados.join(" ") || "(nenhum)"} exatamente como estão`,
      );
    }
    limpas.push(frase.trim());
  });

  return problemas.length > 0 ? { problemas } : { frases: limpas, problemas: [] };
}

/**
 * Traduz o conjunto inteiro em UMA chamada (as três frases juntas — dá
 * contexto ao modelo e custa um request em vez de três). Retry único de
 * resposta inválida, cada tentativa com a sua reserva de cota, igual a
 * `gerarSugestaoDemo`.
 */
export async function traduzirFrases(
  db: UsageDb,
  conjunto: Pick<FrasesProspeccao, "frases">,
  idioma: string,
  caps: UsageCounts,
  ctx: CtxIA = {},
  now: Date = new Date(),
): Promise<TraducaoFrases> {
  if (idioma === IDIOMA_PADRAO) {
    throw new AiError("as frases já são escritas em português — nada a traduzir");
  }
  const slots = slotsATraduzir(conjunto);
  if (slots.length === 0) {
    throw new AiError("conjunto sem frase preenchida para traduzir");
  }

  const originais = slots.map((slot) => conjunto.frases[slot].trim());
  const prompt = montarPromptTraducao(originais, idioma);
  const schema = schemaTraducao(originais.length);

  await reserveQuota(db, "aiTraducao", caps, undefined, reserveQuotaOptsIA(ctx));
  const primeira = validarTraducao(await gerarJson(prompt, schema), originais);
  const traduzidas =
    primeira.frases ?? (await retry(db, prompt, schema, originais, primeira.problemas, caps, ctx));

  // De volta aos SLOTS de origem: o slot 1 vazio não some da tradução, ele
  // continua vazio — assim `traducao.frases[slot]` casa com `frases[slot]`.
  const porSlot = Array.from({ length: conjunto.frases.length }, () => "");
  slots.forEach((slot, i) => {
    porSlot[slot] = traduzidas[i];
  });
  return montarTraducao(conjunto.frases, porSlot, now.toISOString());
}

async function retry(
  db: UsageDb,
  prompt: string,
  schema: Record<string, unknown>,
  originais: string[],
  problemas: string[],
  caps: UsageCounts,
  ctx: CtxIA,
): Promise<string[]> {
  const promptRetry = [
    prompt,
    "",
    "ATENÇÃO: sua resposta anterior foi rejeitada pelos problemas abaixo. Corrija TODOS e responda de novo apenas o JSON:",
    ...problemas.map((problema) => `- ${problema}`),
  ].join("\n");

  await reserveQuota(db, "aiTraducao", caps, undefined, reserveQuotaOptsIA(ctx));
  const segunda = validarTraducao(await gerarJson(promptRetry, schema), originais);
  if (segunda.frases) return segunda.frases;
  throw new AiError(`tradução inválida: ${segunda.problemas.join("; ")}`);
}
