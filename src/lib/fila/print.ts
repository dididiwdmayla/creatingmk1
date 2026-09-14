import { versaoDaImagem, type LeadCapturas } from "@/lib/demos/capturas/estado";

/**
 * O PRINT QUE VAI NA MENSAGEM — uma imagem só, escolhida por regra fixa, não
 * pelo operador: a fila é um executor burro e o celular não escolhe nada.
 *
 * Duas decisões, nesta ordem:
 *
 * 1. **A seção principal, no celular.** "Principal" é a âncora de MENOR
 *    `ordem` — a primeira da marcação da skin, que em todos os padrões é o
 *    hero (ver `capturas/padrao.mjs`): a primeira impressão da marca é o que
 *    abre uma conversa de prospecção. Celular porque quem recebe está no
 *    WhatsApp, no telefone.
 * 2. **Com moldura, caindo para a crua.** A composta é a que "se lê como um
 *    site num aparelho" numa conversa; a crua é a que se recorta e manda em
 *    carrossel (ver `CapturaImagem.composta`). Numa mensagem com UMA imagem,
 *    a composta é a peça que vende — mas a composição pode ter falhado, e aí
 *    mandar a crua é melhor que não mandar print nenhum.
 *
 * `undefined` = esta rodada não tem imagem de celular nenhuma. O lead então
 * NÃO é elegível: `capturas.estado === "pronto"` não garante que a tela de
 * celular saiu, e tarefa sem print é mensagem sem a peça que vende.
 */
export function printUrlDoLead(capturas: LeadCapturas | undefined): string | undefined {
  const doCelular = (capturas?.imagens ?? []).filter((imagem) => imagem.tela === "celular");
  if (doCelular.length === 0) return undefined;
  const principal = doCelular.reduce((menor, atual) => (atual.ordem < menor.ordem ? atual : menor));
  return (versaoDaImagem(principal, "moldura") ?? versaoDaImagem(principal, "crua"))?.url;
}
