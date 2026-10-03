import type { Lead } from "@/lib/leads/types";

import { candidatoEstavel } from "./candidatos";
import type { MensagemParaLeadResultado } from "./mensagem";
import { printUrlDoLead } from "./print";
import { marcadorSemResolver } from "./saude";

/**
 * O VEREDITO SOBRE O DOC FRESCO — a metade da entrega que vem DEPOIS da
 * ordem (`proximaSaida`, lib/fila/selecao.ts) e é por lead: o pool é cache,
 * então o lead escolhido é relido e reconferido antes de a tarefa sair.
 *
 * Puro, em duas etapas, na ordem em que `/api/fila/proximo` as aplica —
 * entre elas a rota monta a mensagem (três leituras), e montar para um lead
 * que já reprovou na primeira seria pagar à toa:
 *
 * 1. `printParaEntrega` — o lead ainda passa nos critérios estáveis (com o
 *    corte do legado em vigor) e tem o print de celular;
 * 2. `vereditoDaMensagem` — a mensagem montada tem telefone e nenhum
 *    `{marcador}` sobrando.
 *
 * Quem simula a fila (a agenda, `lib/fila/agenda.ts`) chama as MESMAS duas,
 * sem reservar nada: um lead que a fila devolveria é um lead que a agenda
 * não põe na sequência.
 */

/**
 * A URL do print que vai na mensagem, ou `undefined` quando o lead (relido)
 * não serve mais: sumiu, saiu dos critérios estáveis — status, telefone,
 * demo, captura, descarte, número inválido, corte do legado, aprovação — ou
 * não tem imagem de celular.
 *
 * `candidatoEstavel` com `undefined` no envio: o estado da fila é decidido
 * pela reserva (transacional, em `/proximo`; `leadDisponivel` na agenda).
 */
export function printParaEntrega(lead: Lead | undefined, corteLegado: string): string | undefined {
  return lead && candidatoEstavel(lead, undefined, { corteLegado }) ? printUrlDoLead(lead.capturas) : undefined;
}

/** O que barra a mensagem já montada. */
export type BarreiraMensagem =
  | { barreira: "sem_telefone" }
  /** Sobrou um `{marcador}` no texto — ver `marcadorSemResolver`. */
  | { barreira: "marcador"; marcador: string };

/**
 * A mensagem montada pode sair? Devolve o telefone quando pode, ou a
 * barreira. A REDE DE SEGURANÇA dos marcadores mora aqui: qualquer
 * `{marcador}` que sobrou no texto — dado faltando ou marcador digitado
 * errado na frase — sairia literal para um negócio real, e isso é pior do
 * que não mandar (ver `marcadorSemResolver` em lib/fila/saude.ts).
 */
export function vereditoDaMensagem(
  mensagem: Pick<MensagemParaLeadResultado, "texto" | "telefone">,
): { telefone: string } | BarreiraMensagem {
  if (!mensagem.telefone) return { barreira: "sem_telefone" };
  const marcador = marcadorSemResolver(mensagem.texto);
  if (marcador) return { barreira: "marcador", marcador };
  return { telefone: mensagem.telefone };
}
