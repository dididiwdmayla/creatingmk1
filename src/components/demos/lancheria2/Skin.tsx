import { Lancheria } from "@radar/lancheria-rx/client";

import { dadosDaLancheria, temaDaLancheria } from "@/lib/demos/lancheria/adapter";
import type { SkinProps } from "@/lib/demos/types";

/**
 * Skin `lancheria-2` — quatro variantes sobre o motor calibrado
 * `@radar/lancheria-rx` (ver ./variantes.ts). A mesma entrada serve SSR
 * público e preview; não lê URL nem resolve identidade.
 *
 * O componente do pacote é o mesmo nas quatro: a animação do lanche e o
 * raio-x do hambúrguer são a essência da skin. O que a variante troca é o
 * `Tema` (paleta, tipografia, layout do cardápio, assinatura) e o arranjo
 * das seções, que chega em `data` como `ordemSecoes`/`secoes[].oculta`
 * normais.
 */
export function Lancheria2({ data, theme }: SkinProps) {
  return <Lancheria tema={temaDaLancheria(theme)} dados={dadosDaLancheria(data)} />;
}
