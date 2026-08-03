import { pesoNaBanda } from "../animacao/cobertura";
import { misturar, type Rgb } from "./srgb";

/**
 * A COR EM FOCO: dadas as faixas pintadas na viewport AGORA, qual cor a
 * barra do navegador deve estar mostrando. Pura e sem DOM (a leitura mora
 * em ./medir.ts); testada em __tests__/foco.test.ts.
 *
 * **A transição não é um efeito à parte — ela é o resultado da conta.**
 * O requisito é que a barra nunca troque de cor de uma vez, e o jeito
 * óbvio de conseguir isso seria escolher a faixa "em foco", detectar
 * quando ela muda e animar a cor por um tempo fixo. Isso teria dois
 * defeitos: a barra continuaria mudando depois que a pessoa parou de
 * rolar (a animação tem vida própria) e a velocidade da troca não teria
 * relação com a velocidade da rolagem.
 *
 * Aqui a cor é uma MÉDIA PONDERADA das faixas que estão na banda de foco
 * (as faixas vêm de ./fundo.ts), com o peso de cada uma vindo do mesmo
 * núcleo que a camada decorativa já usa
 * (`lib/demos/animacao/cobertura.ts` — peso zero nas pontas da tela,
 * máximo no centro). Enquanto a fronteira entre duas faixas atravessa a
 * banda, o peso escorre de uma pra outra e a cor caminha junto: a
 * interpolação sai de graça, dura exatamente meia viewport de rolagem, é
 * suave nos dois extremos (a derivada do peso também vai a zero lá) e é
 * uma função da POSIÇÃO, não do tempo — parou de rolar, parou a cor.
 * Rolar de volta desfaz pelo mesmo caminho.
 *
 * O peso que sobra (o núcleo integra 1 sobre a viewport inteira; as
 * faixas pintadas raramente ocupam tudo) vai para `corBase`, o plano da
 * página. É o que faz cabeçalho, rodapé e qualquer região sem fundo
 * próprio puxarem a barra de volta pro fundo do tema em vez de congelá-la
 * na cor da última faixa.
 */

/** Uma faixa pintada, em px relativos à viewport. */
export interface FaixaCor {
  topo: number;
  base: number;
  /** `undefined` = nada pinta ali; vale `corBase`. */
  cor?: Rgb;
}

export function corEmFoco(
  faixas: readonly FaixaCor[],
  alturaViewport: number,
  corBase: Rgb,
): Rgb {
  const partes: { cor: Rgb; peso: number }[] = [];
  let usado = 0;
  for (const faixa of faixas) {
    const p = pesoNaBanda(faixa.topo, faixa.base, alturaViewport);
    if (p <= 0) continue;
    usado += p;
    partes.push({ cor: faixa.cor ?? corBase, peso: p });
  }
  // O núcleo integra 1 sobre a viewport: o que as faixas não cobriram é
  // plano de página. Sem isto, uma faixa de 20% de peso decidiria a barra
  // sozinha e o rodapé nunca devolveria a cor do tema.
  const sobra = Math.max(0, 1 - usado);
  if (sobra > 0) partes.push({ cor: corBase, peso: sobra });
  return misturar(partes) ?? corBase;
}
