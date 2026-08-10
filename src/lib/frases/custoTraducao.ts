import { custoIncrementalUSD, type SkuPricing } from "@/lib/costs";

/**
 * Projeção do que UMA tradução custa, para a confirmação da ficha poder
 * dizer o preço antes do clique — nunca "traduzir e ver depois".
 *
 * São 1 chamada no caso normal (as três frases vão juntas no mesmo request)
 * e até 2 quando a resposta volta fora do formato e a rota tenta de novo —
 * a mesma faixa honesta que a geração de textos em lote mostra, em vez de
 * um número só que possa mentir pra baixo.
 */
export const CHAMADAS_TRADUCAO = { minimo: 1, maximo: 2 } as const;

export interface ProjecaoTraducao {
  chamadas: { minimo: number; maximo: number };
  usado: number;
  teto: number;
  /** Custo em BRL no melhor e no pior caso (dentro da cota grátis, 0). */
  custoBRL: { minimo: number; maximo: number };
  /** O pior caso já passa do teto do mês? Aviso — o bloqueio real é do servidor. */
  podeEstourar: boolean;
}

export function projecaoTraducao(
  usado: number,
  teto: number,
  preco: SkuPricing,
  usdBrl: number,
): ProjecaoTraducao {
  const { minimo, maximo } = CHAMADAS_TRADUCAO;
  return {
    chamadas: CHAMADAS_TRADUCAO,
    usado,
    teto,
    custoBRL: {
      minimo: custoIncrementalUSD(usado, minimo, preco) * usdBrl,
      maximo: custoIncrementalUSD(usado, maximo, preco) * usdBrl,
    },
    podeEstourar: usado + maximo > teto,
  };
}
