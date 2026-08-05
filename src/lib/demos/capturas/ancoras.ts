import { BARBEARIA_SECOES } from "@/components/demos/barbearia/secoes";
import { BARBEARIA2_SECOES } from "@/components/demos/barbearia2/secoes";
import { IMOBILIARIA_SECOES } from "@/components/demos/imobiliaria/secoes";
import { LANCHERIA_SECOES } from "@/components/demos/lancheria/secoes";
import { MULTIMARCAS_SECOES } from "@/components/demos/multimarcas/secoes";
import { PETSHOP_SECOES } from "@/components/demos/petshop/secoes";
import { TATUAGEM_SECOES } from "@/components/demos/tatuagem/secoes";
import { TATUAGEM2_SECOES } from "@/components/demos/tatuagem2/secoes";
import type { SkinSecaoDef } from "@/lib/demos/types";

/**
 * ÂNCORAS DE CAPTURA: quais seções de cada skin viram print de prospecção.
 *
 * A âncora aponta para uma SEÇÃO do contrato da skin (`SkinDefinition.secoes`),
 * nunca para posição em pixel — o enquadramento sai da caixa do elemento
 * `[data-d-secao="<id>"]` que toda skin já emite no DOM (ver
 * `lib/demos/animacao/SecaoMarcada.tsx`). Trocar a marcação não recalibra
 * nada: a seção continua se anunciando sozinha, do início ao fim.
 *
 * Este módulo é a metade PURA do assunto (dados + validação), de propósito:
 * ele é importado por `lib/config`, que por sua vez é importado por quase
 * toda rota. Importar `lib/demos/registry` aqui arrastaria os componentes
 * React das 8 skins para o bundle de servidor de rotas que não têm nada a
 * ver com demo. Os `secoes.ts` são dado puro (só tipos, que somem na
 * compilação), então o custo é zero — e a duplicação da lista de skins
 * contra o registro é coberta por teste de contrato (ver __tests__).
 */

/** Teto de âncoras por skin. Três prints é o que cabe numa conversa. */
export const CAPTURAS_MAX_ANCORAS = 3;

/**
 * skinId (SkinDefinition.id, NÃO o nome da pasta) → contrato de seções.
 * Mesma lista que `SkinDefinition.secoes`; o teste de contrato garante que
 * as duas não divergem quando uma skin nova entrar no registro.
 */
export const SECOES_POR_SKIN: Record<string, SkinSecaoDef[]> = {
  "barbearia-editorial": BARBEARIA_SECOES,
  "barbearia2-sul": BARBEARIA2_SECOES,
  "imobiliaria-curada": IMOBILIARIA_SECOES,
  "lancheria-chapa-burger": LANCHERIA_SECOES,
  "multimarcas-vortice": MULTIMARCAS_SECOES,
  "petshop-focinho-feliz": PETSHOP_SECOES,
  "tatuagem-editorial": TATUAGEM_SECOES,
  "tatuagem-pigmento-vivo": TATUAGEM2_SECOES,
};

/**
 * Padrão inicial por skin, aprovado antes de virar código. O critério é
 * sempre o mesmo trio, na ordem em que uma conversa de prospecção anda:
 *
 *   1. IDENTIDADE  — o hero, a primeira impressão da marca (toda skin tem).
 *   2. OFERTA      — a seção que mostra o que o negócio vende.
 *   3. PROVA/FECHO — depoimento, galeria ou o passo que fecha a venda.
 *
 * Ficaram DE FORA as seções puramente decorativas (`faixa` do petshop,
 * `marquee` da tatuagem) e as que só fazem sentido em movimento: um print
 * parado delas não diz nada a quem recebe.
 *
 * Isto é só o DEFAULT. O doc `/config/app` sobrescreve por skin, editável
 * em /interno/capturas sem deploy.
 */
export const ANCORAS_PADRAO: Record<string, string[]> = {
  "barbearia-editorial": ["hero", "servicos", "depoimentos"],
  "barbearia2-sul": ["hero", "servicos", "galeria"],
  "imobiliaria-curada": ["hero", "imoveis", "depoimento"],
  "lancheria-chapa-burger": ["hero", "cardapio", "contato"],
  "multimarcas-vortice": ["hero", "estoque", "simulador"],
  "petshop-focinho-feliz": ["hero", "servicos", "depoimentos"],
  "tatuagem-editorial": ["hero", "portfolio", "investimento"],
  "tatuagem-pigmento-vivo": ["hero", "portfolio", "estilos"],
};

/** A seção existe no contrato desta skin? */
export function secaoExiste(skinId: string, secaoId: string): boolean {
  return (SECOES_POR_SKIN[skinId] ?? []).some((secao) => secao.id === secaoId);
}

/**
 * Valida o pedaço `capturas.ancoras` de um patch de config, acumulando
 * problemas no mesmo array do resto da validação (ver lib/config).
 *
 * Estrito de propósito, no mesmo espírito das outras chaves: skin que não
 * existe e seção que não existe são ERRO, não silêncio. Uma âncora com
 * typo que simplesmente não captura nada seria invisível até a hora de
 * mandar o print pro lead — tarde demais.
 */
export function validarAncoras(valor: unknown, caminho: string, problemas: string[]): void {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) {
    problemas.push(`${caminho} deve ser um objeto skin → lista de seções`);
    return;
  }

  for (const [skinId, ancoras] of Object.entries(valor as Record<string, unknown>)) {
    if (SECOES_POR_SKIN[skinId] === undefined) {
      problemas.push(`${caminho}.${skinId} não é uma skin conhecida`);
      continue;
    }
    if (!Array.isArray(ancoras)) {
      problemas.push(`${caminho}.${skinId} deve ser uma lista de ids de seção`);
      continue;
    }
    // Lista vazia é válida: é como se desliga a captura de uma skin.
    if (ancoras.length > CAPTURAS_MAX_ANCORAS) {
      problemas.push(
        `${caminho}.${skinId} aceita no máximo ${CAPTURAS_MAX_ANCORAS} âncoras (recebeu ${ancoras.length})`,
      );
    }
    const vistas = new Set<string>();
    ancoras.forEach((secaoId, i) => {
      if (typeof secaoId !== "string" || secaoId === "") {
        problemas.push(`${caminho}.${skinId}[${i}] deve ser um id de seção`);
        return;
      }
      if (!secaoExiste(skinId, secaoId)) {
        problemas.push(`${caminho}.${skinId}[${i}]: "${secaoId}" não é uma seção de ${skinId}`);
        return;
      }
      // Duas capturas idênticas na mesma skin é sempre engano de marcação.
      if (vistas.has(secaoId)) {
        problemas.push(`${caminho}.${skinId}[${i}]: "${secaoId}" está repetida`);
      }
      vistas.add(secaoId);
    });
  }
}

/**
 * Âncoras EFETIVAS de uma skin, já recortadas ao teto e sem ids que a skin
 * não tem mais. Um doc salvo antes de uma seção ser removida do contrato
 * não pode fazer o motor procurar por um `[data-d-secao]` inexistente e
 * derrubar a rodada inteira — o mesmo cuidado que `ordemEfetiva` toma com
 * `ordemSecoes` (ver lib/demos/estrutura.ts).
 */
export function ancorasEfetivas(
  ancorasConfig: Record<string, string[]> | undefined,
  skinId: string,
): string[] {
  const marcadas = ancorasConfig?.[skinId] ?? ANCORAS_PADRAO[skinId] ?? [];
  const vistas = new Set<string>();
  return marcadas
    .filter((secaoId) => {
      if (vistas.has(secaoId) || !secaoExiste(skinId, secaoId)) return false;
      vistas.add(secaoId);
      return true;
    })
    .slice(0, CAPTURAS_MAX_ANCORAS);
}
