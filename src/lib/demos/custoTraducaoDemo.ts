import { custoIncrementalUSD, type SkuPricing } from "@/lib/costs";

/**
 * Projeção do que a tradução do editor custa, para a confirmação poder
 * dizer o preço ANTES do clique — nunca "traduzir e ver depois". Ao
 * contrário de `lib/frases/custoTraducao.ts` (1 chamada normal, até 2 com
 * retry), esta ação é SEMPRE 1 chamada — `traduzirConteudoDemo` não tenta
 * de novo sozinha (ver ARCHITECTURE.md).
 */
export interface ProjecaoTraducaoDemo {
  usado: number;
  teto: number;
  /** Custo em BRL desta 1 chamada (0 dentro da cota grátis). */
  custoBRL: number;
  /** Esta chamada já passa do teto do mês? Aviso — o bloqueio real é do servidor. */
  podeEstourar: boolean;
}

export function projecaoTraducaoDemo(
  usado: number,
  teto: number,
  preco: SkuPricing,
  usdBrl: number,
): ProjecaoTraducaoDemo {
  return {
    usado,
    teto,
    custoBRL: custoIncrementalUSD(usado, 1, preco) * usdBrl,
    podeEstourar: usado + 1 > teto,
  };
}
