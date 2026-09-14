import { Lancheria } from "@radar/lancheria-rx/client";

import { secoesVisiveis } from "@/lib/demos/estrutura";
import { dadosDaLancheria, temaDaLancheria } from "@/lib/demos/lancheria/adapter";
import type { SkinProps } from "@/lib/demos/types";

import { LedEdges } from "./interactive/LedEdges";
import { LANCHERIA2_SECOES } from "./secoes";

/**
 * Skin `lancheria-2` — quatro variantes sobre o motor calibrado
 * `@radar/lancheria-rx` (ver ./variantes.ts). A mesma entrada serve SSR
 * público e preview; não lê URL nem resolve identidade.
 *
 * O componente do pacote é o mesmo nas quatro: a animação do lanche e o
 * raio-x do hambúrguer são a essência da skin. O que a variante troca é o
 * `Tema` (paleta, tipografia, layout do cardápio, assinatura) e o arranjo
 * das seções.
 *
 * ## Estrutura (ordem e ocultação)
 *
 * As outras oito skins montam as seções em JS, no `visiveis.map` do próprio
 * `Skin.tsx`. Esta não pode: o componente vem pronto do pacote e monta a
 * ordem por dentro. A estrutura sai então em CSS, gerado AQUI a partir da
 * mesma `secoesVisiveis`/`ordemEfetiva` que todas as skins usam — o dado é
 * o mesmo, só o mecanismo muda.
 *
 * Funciona porque `#conteudo` tem exatamente OITO filhos diretos, um por
 * seção do contrato, cada um marcado com `data-d-secao` (ver secoes.ts).
 * Uma regra de `order` por seção reordena; `display: none` oculta.
 *
 * É renderizado no SERVIDOR, junto com o HTML: ordem e ocultação mexem em
 * layout, e fazer isso depois da hidratação seria deslocamento de layout
 * puro — o portão de CLS (`scripts/qa-cls.mjs`) existe exatamente pra isso.
 *
 * `#conteudo` vira coluna flex (é o que dá sentido a `order`). O ritmo
 * vertical da folha do pacote é todo por `padding`, e o único `margin-top`
 * (`.a-chapa`) não tem par para colapsar — então virar flex não muda o
 * desenho. Isso não é suposição: `scripts/qa-lancheria.mjs` compara a caixa
 * de cada cartão do cardápio contra as medidas aprovadas.
 */
export function Lancheria2({ data, theme }: SkinProps) {
  const visiveis = secoesVisiveis(LANCHERIA2_SECOES, data);
  const ocultas = LANCHERIA2_SECOES.map((s) => s.id).filter((id) => !visiveis.includes(id));

  // Escopo no `[data-lancheria-app]` do pacote: a folha dele já é isolada
  // assim, e a demo pública nunca tem duas skins na mesma página.
  const raiz = "[data-lancheria-app] #conteudo";
  const estrutura = [
    `${raiz}{display:flex;flex-direction:column}`,
    ...visiveis.map((id, i) => `${raiz}>[data-d-secao="${id}"]{order:${i}}`),
    ...ocultas.map((id) => `${raiz}>[data-d-secao="${id}"]{display:none}`),
  ].join("");

  return (
    <>
      <style>{estrutura}</style>
      {/* Sibling da skin, como nas outras oito — o LED é da Forja, não do
          pacote, e vale sobre qualquer variante. O efeito de fundo já entra
          como sibling na própria rota (ver app/demo/comum.tsx). */}
      <LedEdges
        preset={theme.led}
        estilo={theme.ledEstilo}
        cores={theme.ledCores}
        corBase={theme.paleta.destaque}
      />
      <Lancheria tema={temaDaLancheria(theme)} dados={dadosDaLancheria(data)} />
    </>
  );
}
