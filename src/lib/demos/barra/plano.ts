import { ehHex } from "../cores/hsl";

/**
 * O PLANO DA PÁGINA (`background-color` do `<body>`) pintado com a mesma
 * cor que vai na barra — a alternativa de plataforma para o WebKit
 * moderno, e uma correção que vale em todo navegador.
 *
 * **Por que existe.** A partir do Safari 26 (iOS e macOS) a meta
 * `theme-color` deixou de tintar a aba em navegação normal: o WebKit
 * passou a AMOSTRAR o `background-color` do `<body>` (com observador ao
 * vivo, então ele acompanha mudanças sem recarregar). Sem isto, a barra
 * do iOS 26 numa demo mostraria o `bg-background` que o `<body>` do
 * RADAR carrega — a cor do tema da plataforma, não a da skin do lead.
 * Isso já era verdade antes desta feature; a diferença é que agora dá pra
 * consertar no mesmo lugar em que a cor é decidida.
 *
 * **E vale além do Safari**: o plano do `<body>` é o que aparece no
 * rubber-band do overscroll em iOS/macOS e no espaço abaixo do conteúdo
 * numa página mais curta que a tela. Nos dois casos a cor certa é a da
 * página da demo, nunca a do app.
 *
 * **Por que `!important`.** O `<body>` é renderizado pelo layout RAIZ,
 * compartilhado por todo o app, e carrega a classe utilitária
 * `bg-background`. Uma rota aninhada não tem como reescrever esse
 * `className` no servidor, e um seletor de elemento (`body`, 0-0-1) perde
 * de uma classe (0-1-0) por especificidade — a regra simplesmente não
 * valeria. As alternativas eram piores: depender de o `<body>` ter
 * classe (`body[class]`) quebra silenciosamente no dia em que ela sair, e
 * pintar por script síncrono trocaria uma regra declarativa no HTML
 * servido por algo que não existe sem JavaScript. O par disto é
 * `pintarPlano`, que escreve inline COM prioridade — inline `!important`
 * vence folha `!important`, então a cor viva continua ganhando da inicial.
 */

/** Só cor hex entra no CSS — a paleta é dado, e dado não vira sintaxe. */
export function cssPlanoDaPagina(cor: string): string {
  return ehHex(cor) ? `body{background-color:${cor} !important}` : "";
}

/** Cor viva do plano (client) — ver o `!important` acima. */
export function pintarPlano(cor: string): void {
  document.body.style.setProperty("background-color", cor, "important");
}

/** Devolve o plano à regra servida pelo HTML. */
export function limparPlano(): void {
  document.body.style.removeProperty("background-color");
}
