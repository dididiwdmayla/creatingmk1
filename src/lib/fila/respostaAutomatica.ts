import { horaSaoPaulo } from "./contadores";

/**
 * A RESPOSTA AUTOMÁTICA — o rascunho que deixa de esperar aprovação e vira
 * tarefa de envio na fila do aparelho (`config/fila.respostaAutomatica`,
 * padrão false).
 *
 * Este arquivo guarda o RITMO HUMANO da coisa: o atraso sorteado antes de a
 * resposta ficar disponível e a janela de horário do OPERADOR em que ela
 * pode sair. Os dois existem pela mesma razão, e ela não é técnica — uma
 * resposta que chega em dois segundos, ou às quatro da manhã, denuncia a
 * automação mais que qualquer texto que a IA escreva.
 */

/**
 * Sorteia o atraso, em segundos, de UMA resposta — o tempo entre o rascunho
 * ficar pronto e a tarefa ficar disponível para o aparelho puxar.
 *
 * SORTEADO por resposta, e não fixo: um intervalo sempre igual (12 minutos
 * cravados em toda conversa) é tão reconhecível quanto responder na hora.
 * Os dois extremos entram no sorteio (`min` e `max` inclusive).
 *
 * Faixa invertida usa o MAIOR dos dois como teto em vez de estourar: cada
 * campo do painel salva no próprio blur, então existe um instante em que o
 * mínimo já subiu e o máximo ainda não — e esse instante não pode derrubar
 * a fila. `aleatorio` é injetável só para o teste poder congelar o sorteio.
 */
export function sortearAtrasoSegundos(
  minSegundos: number,
  maxSegundos: number,
  aleatorio: () => number = Math.random,
): number {
  const min = Math.max(0, Math.trunc(minSegundos));
  const max = Math.max(min, Math.trunc(maxSegundos));
  return min + Math.floor(aleatorio() * (max - min + 1));
}

/**
 * Está dentro da JANELA DE RESPOSTA agora? Medida no relógio do OPERADOR
 * (America/Sao_Paulo, via `horaSaoPaulo`), nunca no do lead.
 *
 * É outra pergunta que a `janelaContato` da prospecção: aquela é "quando é
 * bom abordar ESTE negócio" (faixas da família × horário de funcionamento ×
 * fuso do lead); esta é "a que horas um humano responderia". Reusar a
 * primeira aqui responderia certo a pergunta errada.
 *
 * - `inicio === fim` → aberto o dia inteiro (a janela não restringe nada).
 * - `inicio < fim` → faixa normal, `inicio` inclusive e `fim` exclusivo
 *   (fim 22 = a última resposta sai 22h59, não 22h00 em ponto).
 * - `inicio > fim` → atravessa a meia-noite (22 → 6 é a madrugada inteira).
 */
export function dentroDaJanelaResposta(now: Date, inicio: number, fim: number): boolean {
  const de = horaNormalizada(inicio);
  const ate = horaNormalizada(fim);
  if (de === ate) return true;
  const hora = horaSaoPaulo(now);
  return de < ate ? hora >= de && hora < ate : hora >= de || hora < ate;
}

function horaNormalizada(hora: number): number {
  return Math.min(23, Math.max(0, Math.trunc(hora)));
}
