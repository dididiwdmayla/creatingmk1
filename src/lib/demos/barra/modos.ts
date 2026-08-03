import { ehHex } from "../cores/hsl";
import {
  BARRA_COR_MODOS,
  type BarraCorModo,
  type BarraCorValor,
  type Theme,
  type ThemePaleta,
} from "../types";

/** O que a resolução da barra precisa da paleta — nada além disto. */
type PaletaBarra = Pick<ThemePaleta, "fundo" | "fundoAlt" | "destaque">;

/**
 * MODO DA COR DA BARRA — a resolução, pura, compartilhada pelos três
 * lugares que precisam da resposta e nunca podem divergir: o
 * `generateViewport` da rota pública (que emite a cor no HTML do
 * servidor), a amostra do painel do editor e o harness de QA.
 *
 * Testada em __tests__/modos.test.ts.
 */

export function barraModoValido(valor: unknown): valor is BarraCorModo {
  return typeof valor === "string" && (BARRA_COR_MODOS as readonly string[]).includes(valor);
}

/**
 * Só passa adiante o que tem modo conhecido — qualquer coisa fora do
 * contrato vira `undefined` (= `automatico`), a mesma tolerância dos
 * outros campos do `TemaPatch`. `personalizada` sem hex válido também
 * cai: um modo que depende de uma cor que não existe não é um modo.
 */
export function barraCorValida(valor: BarraCorValor | undefined): BarraCorValor | undefined {
  if (!valor || !barraModoValido(valor.modo)) return undefined;
  if (valor.modo === "automatico") return undefined;
  if (valor.modo === "personalizada") return ehHex(valor.cor) ? valor : undefined;
  return { modo: valor.modo };
}

/** O modo que de fato vale (o pedido, ou `automatico` quando ele não vale). */
export function barraModoEfetivo(theme: Theme): BarraCorModo {
  return barraCorValida(theme.barraCor)?.modo ?? "automatico";
}

/**
 * A cor que a barra assume — em `automatico`, a cor de PARTIDA (topo da
 * página), que é o plano do tema.
 *
 * É esta função que o `generateViewport` usa, e é por isso que o modo
 * `automatico` também tem uma resposta aqui: a cor certa precisa sair
 * pronta no HTML do servidor, antes de qualquer JavaScript. Navegador que
 * ignore a atualização dinâmica (ou o JS inteiro) fica exatamente com
 * esta cor — o mesmo comportamento que a demo tinha antes desta feature.
 *
 * Recebe a PALETA e não o `Theme` inteiro porque o painel do editor
 * precisa da resposta antes de existir um tema montado: lá a cor de
 * destaque pode estar sendo trocada no seletor ao lado, e a amostra tem
 * que acompanhar a tecla, não o último save.
 */
export function corDaBarraPaleta(
  paleta: PaletaBarra,
  barraCor: BarraCorValor | undefined,
): string {
  const valor = barraCorValida(barraCor);
  if (!valor) return paleta.fundo;
  if (valor.modo === "destaque") return paleta.destaque;
  if (valor.modo === "personalizada" && ehHex(valor.cor)) return valor.cor;
  return paleta.fundo;
}

export function corDaBarra(theme: Theme): string {
  return corDaBarraPaleta(theme.paleta, theme.barraCor);
}

/**
 * Amostra para o PAINEL do editor. O preview roda num IFRAME e a barra do
 * navegador obedece ao documento de CIMA, então a cor da barra é a única
 * decisão da aba Tema que não dá pra conferir olhando o preview — sem
 * esta amostra, o único jeito de saber se a escolha ficou boa seria
 * salvar, abrir a demo no celular e voltar.
 *
 * Em `automatico` a resposta não é UMA cor, e a amostra não pode fingir
 * que é: devolve as cores pelas quais a barra vai passar — o plano da
 * página e o fundo alternativo. Uma só quando a paleta usa a mesma cor
 * nos dois papéis, caso em que o automático é de fato indistinguível do
 * fixo, e a amostra mostra isso em vez de esconder.
 */
export function amostraDaBarra(
  paleta: PaletaBarra,
  barraCor: BarraCorValor | undefined,
): { cores: string[]; acompanha: boolean } {
  const valor = barraCorValida(barraCor);
  if (valor) return { cores: [corDaBarraPaleta(paleta, valor)], acompanha: false };
  return { cores: [...new Set([paleta.fundo, paleta.fundoAlt])], acompanha: true };
}
