import type { DemoData, DemoSecao, SkinDefinition, SkinSecaoDef, SkinVariante } from "./types";

/**
 * VARIANTE DE SKIN — resolução (ver `SkinVariante` em ./types.ts e
 * "Variante de skin" em ARCHITECTURE.md).
 *
 * Uma variante é um mundo visual completo (paleta, tipografia, textura,
 * composição, conteúdo de exemplo) sobre o MESMO contrato de seções e de
 * slots da skin. Ela ocupa o lugar que era do preset de tema: o id da
 * variante É o id do `Theme` dela, que é o que `LeadDemo.themeId` persiste.
 *
 * Módulo PURO e sem dependência do registro — mesmo espírito de
 * ./estrutura.ts, que ele reaproveita conceitualmente: a skin usa no
 * render, o editor no painel, os testes no contrato.
 */

/** Alias restrito à skin; leitura tolerante, escrita retorna o ID canônico. */
export function idThemeAtual(skin: SkinDefinition, id: string | undefined): string | undefined {
  return id === undefined ? undefined : skin.themeAliases?.[id] ?? id;
}

/** A variante de id pedido, ou `undefined` se a skin não tem essa (ou nenhuma). */
export function getVariante(
  skin: SkinDefinition,
  id: string | undefined,
): SkinVariante | undefined {
  return skin.variantes?.find((variante) => variante.id === idThemeAtual(skin, id));
}

/**
 * Variante EFETIVA: a pedida, ou a primeira quando o id é desconhecido/ausente
 * — mesma tolerância de `getTheme`, pelo mesmo motivo (demo salva com uma
 * variante que saiu do registro continua abrindo, na variante default, em vez
 * de derrubar a rota pública).
 */
export function varianteEfetiva(
  skin: SkinDefinition,
  id: string | undefined,
): SkinVariante | undefined {
  if (!skin.variantes?.length) return undefined;
  return getVariante(skin, id) ?? skin.variantes[0];
}

/**
 * A CAMADA DE EXEMPLO da demo: o exemplo da variante escolhida, ou o
 * `demoDataExemplo` da skin quando ela não tem variantes.
 *
 * É o único ponto em que a variante entra na montagem. `montarDemoData`
 * continua sendo o ponto único e não muda nem ganha argumento: a variante
 * só decide QUAL exemplo é a camada 1 — abaixo de `dadosDoLead` e abaixo do
 * patch do editor, que continuam vencendo campo a campo como em qualquer
 * outra skin. Em particular, o arranjo de seções da variante é um default
 * que o operador sobrescreve na aba Estrutura, não uma trava.
 */
export function exemploDaSkin(skin: SkinDefinition, themeId: string | undefined): DemoData {
  return varianteEfetiva(skin, themeId)?.exemplo ?? skin.demoDataExemplo;
}

/**
 * Os `ordemSecoes` que um arranjo representa: os ids NÃO-fixos na ordem
 * pedida. É exatamente a forma que o editor persiste (`ordemEfetiva` em
 * ./estrutura.ts só reordena as não-fixas; as fixas ficam na posição
 * default), então a variante e o operador falam a mesma língua.
 */
export function ordemSecoesDoArranjo(
  secoes: readonly SkinSecaoDef[],
  ordem: readonly string[],
): string[] {
  const reordenaveis = new Set(secoes.filter((s) => !s.fixa).map((s) => s.id));
  return ordem.filter((id) => reordenaveis.has(id));
}

/**
 * Monta a variante a partir da declaração da skin: pega o exemplo BASE
 * (comum a todas as variantes — é o mesmo contrato de slots) e grava nele o
 * arranjo da variante, mais os campos de exemplo próprios dela.
 *
 * O arranjo vira dado normal de `DemoData` (`ordemSecoes` + `secoes[].oculta`)
 * de propósito: assim não existe um segundo caminho de estrutura só para
 * variantes — a skin renderiza pela mesma `secoesVisiveis` de sempre, e o
 * editor edita por cima do mesmo jeito.
 */
export function criarVariante(
  entrada: Omit<SkinVariante, "exemplo"> & { exemplo: DemoData },
  secoes: readonly SkinSecaoDef[],
): SkinVariante {
  const { exemplo, arranjo } = entrada;
  const ocultas = new Set(arranjo.ocultas ?? []);
  const comOcultas: Record<string, DemoSecao> = {};
  for (const [id, secao] of Object.entries(exemplo.secoes)) {
    comOcultas[id] = ocultas.has(id) ? { ...secao, oculta: true } : secao;
  }
  return {
    ...entrada,
    exemplo: {
      ...exemplo,
      secoes: comOcultas,
      ordemSecoes: ordemSecoesDoArranjo(secoes, arranjo.ordem),
    },
  };
}

/**
 * A tipografia, o raio, a densidade e a animação desta skin vêm CALIBRADOS
 * do pacote dela, em vez de saírem dos tokens da Forja?
 *
 * É o mesmo fato que `aplicarTema` já usa para IGNORAR esses campos do
 * `TemaPatch` (ver o ramo `preset.lancheria` em ./tema.ts) e que o PUT usa
 * para recusá-los. Existe como função para o editor não precisar repetir a
 * condição, e para haver UM lugar a generalizar quando a segunda skin
 * empacotada chegar.
 *
 * O que continua editável numa skin calibrada é tudo que é camada de cima:
 * os papéis de cor, o efeito de fundo, o LED e a cor da barra.
 */
export function temaCalibrado(skin: SkinDefinition): boolean {
  return skin.themeDefault.lancheria !== undefined;
}
