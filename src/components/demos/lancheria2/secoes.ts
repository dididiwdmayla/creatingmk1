import type { SkinSecaoDef } from "@/lib/demos/types";

/**
 * Contrato de seções da skin `lancheria-2` — o MESMO para as quatro
 * variantes. É a trava do eixo de variante: uma variante move, redimensiona
 * e retexturiza; não renomeia, não remove e não inventa seção (ver
 * `__tests__/variantes.test.tsx`).
 *
 * Cada id corresponde a um `[data-d-secao]` que o componente emite no HTML
 * DO SERVIDOR — `#conteudo` tem exatamente estes oito filhos diretos, um
 * por seção, o que faz a ordenação e a ocultação caberem numa regra de CSS
 * por seletor (ver Skin.tsx).
 *
 * Sem `alignOptions` nem `entradaOptions`: o alinhamento e as animações de
 * entrada por seção são recursos das skins nativas da Forja
 * (`SectionReveal`), e este componente vem do pacote calibrado — declarar
 * opção que ele não implementa poria um seletor morto no editor.
 */
export const LANCHERIA2_SECOES: SkinSecaoDef[] = [
  // Abertura = marca + faixa hero + horário compacto. Fixa como em toda
  // skin, e é a âncora de identidade da captura de prospecção: o print
  // precisa sair com o NOME do negócio, não só com o slogan.
  { id: "hero", nome: "Abertura", fixa: true },
  // O cardápio é o produto desta skin (é dele que sai o raio-x). Fixa.
  { id: "cardapio", nome: "Cardápio", fixa: true },
  { id: "sugestoes", nome: "Na prensa" },
  { id: "bebidas", nome: "Pra beber" },
  { id: "acompanhamentos", nome: "Pra dividir" },
  { id: "historia", nome: "A chapa" },
  { id: "horarios", nome: "Horários" },
  { id: "contato", nome: "Rodapé", fixa: true },
];
