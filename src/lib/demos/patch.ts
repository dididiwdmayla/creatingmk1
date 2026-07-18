import type {
  DemoData,
  DemoDataPatch,
  DemoSecao,
  SkinDefinition,
} from "./types";

/**
 * Diff do editor: o painel edita o DemoData EFETIVO (exemplo ← dados do
 * lead ← edições) e, na hora de salvar, só o que difere da base
 * (exemplo ← lead) vira patch — o mesmo princípio da ficha antiga: campo
 * esvaziado/igual ao padrão volta a seguir o template. Função pura,
 * testada em __tests__/patch.test.ts.
 */

const CAMPOS_TEXTO = [
  "nome",
  "slogan",
  "endereco",
  "telefone",
  "whatsapp",
  "instagram",
  "cidade",
  "horarios",
] as const;

const CAMPOS_SECAO = ["rotulo", "titulo", "texto", "cta", "ctaSecundaria"] as const;

function igualJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function diffSecao(
  base: DemoSecao | undefined,
  atual: DemoSecao | undefined,
  alinhamentoNatural: string | undefined,
): DemoSecao | undefined {
  if (!atual) return undefined;
  const secao: DemoSecao = {};

  for (const campo of CAMPOS_SECAO) {
    const valor = atual[campo]?.trim() ?? "";
    if (valor !== (base?.[campo] ?? "")) {
      // Texto igual ao da base sai do patch; diferente (inclusive vazio,
      // que NÃO dá pra representar — vazio volta ao padrão) entra.
      if (valor) secao[campo] = valor;
    }
  }

  if (atual.itens && !igualJson(atual.itens, base?.itens)) {
    secao.itens = atual.itens;
  }

  if (atual.oculta === true) secao.oculta = true;

  const naturalBase = base?.alinhamento ?? alinhamentoNatural;
  if (atual.alinhamento && atual.alinhamento !== naturalBase) {
    secao.alinhamento = atual.alinhamento;
  }

  // Sem "natural" da skin: o padrão é o próprio default do template
  // (animacaoEntrada ausente), então qualquer valor definido entra no patch.
  if (atual.animacaoEntrada && atual.animacaoEntrada !== base?.animacaoEntrada) {
    secao.animacaoEntrada = atual.animacaoEntrada;
  }

  return Object.keys(secao).length > 0 ? secao : undefined;
}

/** Patch mínimo que leva `base` até `atual` (contrato do PUT /demo). */
export function montarPatch(
  base: DemoData,
  atual: DemoData,
  skin: SkinDefinition,
): DemoDataPatch {
  const patch: DemoDataPatch = {};

  for (const campo of CAMPOS_TEXTO) {
    const valor = atual[campo]?.trim() ?? "";
    if (valor && valor !== (base[campo] ?? "")) patch[campo] = valor;
  }

  if (!igualJson(atual.servicos, base.servicos)) patch.servicos = atual.servicos;
  if (!igualJson(atual.depoimentos, base.depoimentos)) patch.depoimentos = atual.depoimentos;

  const secoes: Record<string, DemoSecao> = {};
  const ids = new Set([...Object.keys(base.secoes), ...Object.keys(atual.secoes)]);
  for (const id of ids) {
    const def = skin.secoes.find((s) => s.id === id);
    const diff = diffSecao(base.secoes[id], atual.secoes[id], def?.alignOptions?.[0]);
    if (diff) secoes[id] = diff;
  }
  if (Object.keys(secoes).length > 0) patch.secoes = secoes;

  const imagens: Record<string, string> = {};
  for (const [slot, src] of Object.entries(atual.imagens)) {
    if (src && src !== base.imagens[slot]) imagens[slot] = src;
  }
  if (Object.keys(imagens).length > 0) patch.imagens = imagens;

  const ordemDefault = skin.secoes.filter((s) => !s.fixa).map((s) => s.id);
  if (atual.ordemSecoes && !igualJson(atual.ordemSecoes, ordemDefault)) {
    patch.ordemSecoes = atual.ordemSecoes;
  }

  return patch;
}
