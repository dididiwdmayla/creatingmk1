import { baseImagemSlot } from "./imagens-modo";
import type {
  DemoData,
  DemoDataPatch,
  DemoSecao,
  ImagensModo,
  SkinDefinition,
} from "./types";

/**
 * Diff do editor: o painel edita o DemoData EFETIVO (exemplo ← dados do
 * lead ← edições) e, na hora de salvar, só o que difere da base
 * (exemplo ← lead) vira patch. Função pura, testada em
 * __tests__/patch.test.ts.
 *
 * A regra de esvaziar difere por tipo de campo:
 *
 *   - **Conteúdo** (`CAMPOS_CONTEUDO`) — campo esvaziado sai do patch e
 *     volta a seguir a base (exemplo ← lead), o mesmo princípio da ficha
 *     antiga.
 *   - **Identidade** (`CAMPOS_IDENTIDADE`) — dados que identificam ESTE
 *     negócio (telefone, whatsapp, instagram, cidade, horários). Esvaziar
 *     entra no patch como string vazia explícita: o usuário está dizendo
 *     "não mostre isso", não "volte pro texto de exemplo" — sem essa
 *     distinção, limpar um instagram errado do lead faria a demo voltar a
 *     mostrar o instagram REAL (vindo do lead), que é exatamente o que o
 *     usuário queria esconder. `aplicarPatch`/`montarDemoData` tratam string
 *     vazia como valor definido (o elemento correspondente da skin já é
 *     condicional e some sem quebrar o layout — ver Skin.tsx de cada skin).
 */

const CAMPOS_CONTEUDO = ["nome", "slogan", "endereco"] as const;

const CAMPOS_IDENTIDADE = ["telefone", "whatsapp", "instagram", "cidade", "horarios"] as const;

export const CAMPOS_IDENTIDADE_DEMO: readonly string[] = CAMPOS_IDENTIDADE;

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

  // Só o `false` (animação DESLIGADA) precisa ser persistido: ausente já
  // significa ligada, o padrão de toda demo publicada antes do controle.
  if (atual.animacao === false) secao.animacao = false;

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

  for (const campo of CAMPOS_CONTEUDO) {
    const valor = atual[campo]?.trim() ?? "";
    if (valor && valor !== (base[campo] ?? "")) patch[campo] = valor;
  }

  for (const campo of CAMPOS_IDENTIDADE) {
    const valor = atual[campo]?.trim() ?? "";
    const baseValor = base[campo] ?? "";
    // Ao contrário de CAMPOS_CONTEUDO: valor vazio TAMBÉM entra no patch
    // quando difere da base — representa "esconder", não "seguir o padrão".
    if (valor !== baseValor) patch[campo] = valor;
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

  // Base de comparação por slot segue o modo ATUAL (não o `base` fixo, que
  // é sempre "foto" — ver montarDemoData): sem isso, trocar de modo sem
  // subir foto nenhuma faria todo slot "diferir" do `base` e entrar no
  // patch como se fosse upload. `skin.demoDataExemplo.imagens[slot]` é o
  // SVG cru, imune ao modo, a mesma fonte que baseImagemSlot espera.
  const modoAtual: ImagensModo = atual.imagensModo ?? "foto";
  const imagens: Record<string, string> = {};
  for (const [slot, src] of Object.entries(atual.imagens)) {
    const svgPadrao = skin.demoDataExemplo.imagens[slot];
    const baseSlot = svgPadrao ? baseImagemSlot(skin.id, slot, svgPadrao, modoAtual) : undefined;
    if (src && src !== baseSlot) imagens[slot] = src;
  }
  if (Object.keys(imagens).length > 0) patch.imagens = imagens;

  // "foto" é o default — só entra no patch quando o usuário escolheu "grafico".
  if (modoAtual !== "foto") patch.imagensModo = modoAtual;

  const videos: Record<string, string> = {};
  for (const [slot, src] of Object.entries(atual.videos ?? {})) {
    if (src && src !== base.videos?.[slot]) videos[slot] = src;
  }
  if (Object.keys(videos).length > 0) patch.videos = videos;

  const ordemDefault = skin.secoes.filter((s) => !s.fixa).map((s) => s.id);
  if (atual.ordemSecoes && !igualJson(atual.ordemSecoes, ordemDefault)) {
    patch.ordemSecoes = atual.ordemSecoes;
  }

  return patch;
}
