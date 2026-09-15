import { barraDoDia } from "@/lib/leads/barraDoDia";
import type { JanelasContatoConfig } from "@/lib/leads/janelaContato";
import type { Lead } from "@/lib/leads/types";
import { normalizaNicho } from "@/lib/precificacao/calc";

import { motivoEstrutural } from "./candidatos";
import type { FilaConfig } from "./config";
import type { FilaContadorSnapshot } from "./contadores";
import { printUrlDoLead } from "./print";
import { motivoDeRitmo, nichoPermitido, niveisAceitos } from "./selecao";
import { ETAPAS_TESTE, type EtapaTeste } from "./teste";

/**
 * O PIPELINE DO DISPARO DE TESTE — rodar UM lead escolhido pelas quatro
 * etapas da seleção e dizer, nominalmente, qual delas barrou.
 *
 * **Por que um lead ESCOLHIDO, e não "o próximo elegível".** O próximo
 * elegível é justamente o que já passou por todos os filtros: testá-lo não
 * ensina nada. A funcionalidade dos interruptores existe para pegar um lead
 * ESPECÍFICO — o que você jurava que devia estar saindo e não sai — e ver
 * onde ele para.
 *
 * **A ordem é a REAL de avaliação** (ritmo → estrutural → nicho → janela), a
 * mesma de `/proximo` e a mesma do funil da visão. Um lead que falharia em
 * várias é reportado pela PRIMEIRA, como no diagnóstico: é a ordem que torna
 * a resposta acionável.
 *
 * **Duas etapas que não são interruptores** e por isso não são puláveis:
 *
 * - `numero` — `config/fila.numeroTeste` vazio. Sem destino não há disparo,
 *   e cair num número padrão seria exatamente o acidente que a sobrescrita
 *   existe para evitar. Vem primeiro porque não depende de lead nenhum.
 * - `conteudo` — sem demo, sem captura pronta ou sem printUrl. Os
 *   ESTRUTURAIS podem ser pulados para diagnóstico, mas entregar tarefa sem
 *   print quebraria o ciclo no aparelho sem ensinar nada: a mensagem chega
 *   sem a peça que vende e o teste não prova o caminho inteiro. Vem por
 *   ÚLTIMO, depois das quatro etapas, porque o produto principal é saber
 *   QUAL ETAPA barrou — e só quando nenhuma barrou é que a pergunta vira
 *   "tem o que enviar?".
 */

/** Onde o disparo de teste pode parar. As quatro do meio são as puláveis. */
export type BarreiraEtapa = EtapaTeste | "numero" | "conteudo";

export interface BarreiraTeste {
  etapa: BarreiraEtapa;
  /**
   * O motivo DENTRO da etapa, em código: `MotivoSemTarefa` no ritmo,
   * `MotivoEstrutural` nos estruturais, o nível da janela, e assim por
   * diante. A tela traduz; o código é o que não muda de sentido.
   */
  motivo: string;
}

export interface EntradaAvaliacaoTeste {
  lead: Lead;
  config: FilaConfig;
  contador: FilaContadorSnapshot;
  janelas: JanelasContatoConfig;
  now: Date;
  /** Etapas que o operador mandou pular — só as quatro de `ETAPAS_TESTE`. */
  pular: readonly EtapaTeste[];
}

/** Valida e normaliza a lista de etapas puláveis vinda do corpo da requisição. */
export function etapasValidas(valor: unknown): EtapaTeste[] | undefined {
  if (valor === undefined) return [];
  if (!Array.isArray(valor)) return undefined;
  const etapas = new Set<EtapaTeste>();
  for (const item of valor) {
    if (typeof item !== "string" || !(ETAPAS_TESTE as readonly string[]).includes(item)) {
      return undefined;
    }
    etapas.add(item as EtapaTeste);
  }
  return [...etapas];
}

/**
 * Onde este lead para AGORA, ou `undefined` quando nada o barra e a tarefa
 * pode ser injetada. Função pura: `now`, config, contador e janelas vêm de
 * fora, como em `ordenarCandidatos`.
 */
export function avaliarTeste(entrada: EntradaAvaliacaoTeste): BarreiraTeste | undefined {
  const { lead, config, contador, janelas, now } = entrada;
  const pular = new Set(entrada.pular);

  // Sem destino não há disparo — e não existe interruptor para isso.
  if (!config.numeroTeste) {
    return { etapa: "numero", motivo: "numero_teste_vazio" };
  }

  if (!pular.has("ritmo")) {
    const ritmo = motivoDeRitmo(config, contador);
    if (ritmo) return { etapa: "ritmo", motivo: ritmo };
  }

  if (!pular.has("estruturais")) {
    const estrutural = motivoEstrutural(lead);
    if (estrutural) return { etapa: "estruturais", motivo: estrutural };
  }

  if (!pular.has("nicho")) {
    const nicho = lead.busca?.nicho ? normalizaNicho(lead.busca.nicho) : "";
    if (!nichoPermitido(nicho, config.nichosPermitidos)) {
      return { etapa: "nicho", motivo: "fora_dos_nichos" };
    }
  }

  if (!pular.has("janela")) {
    const barra = barraDoDia(janelas, lead, now);
    // Sem fuso derivável (ou sem família com faixas) não há janela a
    // avaliar — e é diferente de "fechado agora": ali sabe-se a hora do
    // lead, aqui não se sabe.
    if (!barra) return { etapa: "janela", motivo: "sem_janela" };
    if (!barra.aberto || !barra.nivelAgora) return { etapa: "janela", motivo: "fechado" };
    if (!niveisAceitos(config).includes(barra.nivelAgora)) {
      return { etapa: "janela", motivo: barra.nivelAgora };
    }
  }

  // Passou nas quatro (ou foram puladas): resta ter o que enviar.
  if (!lead.demo) return { etapa: "conteudo", motivo: "sem_demo" };
  if (lead.capturas?.estado !== "pronto") {
    return { etapa: "conteudo", motivo: "captura_nao_pronta" };
  }
  if (!printUrlDoLead(lead.capturas)) return { etapa: "conteudo", motivo: "sem_print" };

  return undefined;
}
