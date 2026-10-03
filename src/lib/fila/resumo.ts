import type { JanelasContatoConfig } from "@/lib/leads/janelaContato";

import { corteLegadoAtual, lerPool, type CandidatoFila } from "./candidatos";
import { loadFilaConfig, type FilaConfig } from "./config";
import { motivoDeSaude } from "./saude";
import {
  lerContadorFilaCompleto,
  momentoFimIntervalo,
  momentoFimTetoHora,
  proximaViradaDiaOperacional,
  diaOperacionalKey,
  type FilaContadorCompleto,
} from "./contadores";
import { decidirFila, proximaAberturaDeJanela, type MotivoSemTarefa } from "./selecao";
import type { AppDb } from "@/lib/firestore-like";
import { loadConfig } from "@/lib/config";

/**
 * `GET /api/fila/resumo` — o retrato SOMENTE-LEITURA da fila, para a macro
 * pequena que dispara no desbloqueio do celular (dezenas de vezes por dia,
 * não 1440 — mas ainda assim custo importa, ver `montarResumoFila` abaixo).
 *
 * Resposta ACHATADA, mesma regra de `/proximo`: um nível só, TODAS as
 * chaves sempre presentes, e todo valor string exceto os booleanos e os
 * números — chave ausente faz o MacroDroid devolver o marcador literal em
 * vez de vazio (já custou um ciclo inteiro de depuração nesta fila).
 */
export interface ResumoFila {
  ativo: boolean;
  enviados: number;
  meta: number;
  restante: number;
  semPrint: number;
  falhas: number;
  invalidos: number;
  elegiveisAgora: number;
  /** "" quando há tarefa disponível agora — os mesmos seis valores de `MotivoSemTarefa` senão. */
  motivoAtual: MotivoSemTarefa | "";
  /** ISO do próximo instante enviável, ou "" — ver `calcularProximaJanela`. */
  proximaJanela: string;
  diaOperacional: string;
}

/**
 * O próximo instante enviável, coerente com O PORTÃO que está bloqueando —
 * NUNCA a abertura da próxima faixa quando quem bloqueia é RITMO. Mostrar a
 * faixa nesse caso daria uma hora plausível e errada (o mesmo erro já visto
 * na "próxima faixa aceita" do painel): meta batida e teto/intervalo liberam
 * antes ou depois da próxima faixa, sem relação nenhuma com ela.
 *
 * `""` para "pausado" (não há instante — depende do admin/dispositivo
 * reativar) e para "sem_leads_elegiveis" (não há hora que resolva; alguém
 * precisa gerar demo e capturas), pelo mesmo motivo: melhor não prometer
 * hora nenhuma do que uma inventada.
 */
function calcularProximaJanela(
  motivo: MotivoSemTarefa | "",
  contexto: {
    contadorDoc: FilaContadorCompleto;
    config: FilaConfig;
    janelas: JanelasContatoConfig;
    pool: CandidatoFila[];
    now: Date;
  },
): string {
  switch (motivo) {
    case "meta_atingida":
      return proximaViradaDiaOperacional(contexto.now, contexto.config.inicioDiaOperacionalHora).toISOString();
    case "teto_hora": {
      const instante = momentoFimTetoHora(contexto.contadorDoc, contexto.config.tetoPorHora, contexto.now);
      return instante ? instante.toISOString() : "";
    }
    case "intervalo": {
      const instante = momentoFimIntervalo(contexto.contadorDoc, contexto.config.intervaloMinimoSegundos);
      return instante ? instante.toISOString() : "";
    }
    case "fora_de_janela": {
      // A MESMA conta que a seleção usa para saber quando a fila volta a
      // andar (`proximaAberturaDeJanela`, lib/fila/selecao.ts): a menor das
      // próximas faixas ACEITAS entre quem o nicho não barra — com todo
      // mundo fora de janela, são exatamente os bloqueados por janela.
      const instante = proximaAberturaDeJanela(
        contexto.pool,
        contexto.config,
        contexto.janelas,
        contexto.now,
      );
      return instante ? instante.toISOString() : "";
    }
    case "pausado":
    case "sem_leads_elegiveis":
    case "":
      return "";
  }
}

/**
 * Monta `GET /api/fila/resumo` — LEITURA PURA, nunca reserva, nunca cria
 * claim, nunca toca `filaEnvios` nem incrementa contador. Reusa
 * `decidirFila` (lib/fila/selecao.ts) em vez de duplicar a cadeia de portões
 * de `/proximo`: chamar o handler de `/proximo` aqui queimaria uma claim e
 * prenderia um lead por 5 minutos à toa a cada desbloqueio do celular.
 *
 * Custo: sempre lê `config/fila`, `config/app`, `filaContadores/{dia}` e o
 * POOL — o pool é necessário mesmo com a fila pausada, porque
 * `elegiveisAgora` tem que contar quem passaria nos filtros de lead
 * independente do ritmo ("pausado com fila cheia" ≠ "pausado e vazio"). Isso
 * é aceitável aqui porque a rota é chamada dezenas de vezes por dia (o
 * desbloqueio do celular do operador), não 1440× como `/proximo` — mas o
 * pool em si é cache (`lerPool`, TTL de 10min): a maioria das chamadas paga
 * 1 leitura, não a varredura de `/leads`.
 */
export async function montarResumoFila(db: AppDb, now: Date = new Date()): Promise<ResumoFila> {
  const [config, app, corteLegado] = await Promise.all([
    loadFilaConfig(db),
    loadConfig(db),
    corteLegadoAtual(db),
  ]);
  const [contadorDoc, pool] = await Promise.all([
    lerContadorFilaCompleto(db, now, config.inicioDiaOperacionalHora),
    // O MESMO corte que `/proximo` passa — o doc do pool é compartilhado, e
    // dois valores diferentes fariam quem reconstrói primeiro decidir pelo
    // outro. Ver `lerPool`.
    lerPool(db, now, { corteLegado }),
  ]);

  const decisao = decidirFila(
    pool.candidatos,
    config,
    app.janelasContato,
    { totalDoDia: contadorDoc.enviados, ultimaHora: contadorDoc.ultimaHora, segundosDesdeUltimoEvento: contadorDoc.segundosDesdeUltimoEvento },
    now,
  );
  const { escolhido } = decisao;
  // A MESMA regra de `/proximo`: faltando config que o confirmar exige, a
  // fila não entrega — e o resumo não pode dizer que há tarefa disponível
  // quando a rota de entrega diria `pausado`. Ver lib/fila/saude.ts.
  const motivo = motivoDeSaude() ?? decisao.motivo;

  const proximaJanela = calcularProximaJanela(motivo, {
    contadorDoc,
    config,
    janelas: app.janelasContato,
    pool: pool.candidatos,
    now,
  });

  return {
    ativo: config.ativo,
    enviados: contadorDoc.enviados,
    meta: config.metaDiaria,
    restante: Math.max(0, config.metaDiaria - contadorDoc.enviados),
    semPrint: contadorDoc.semPrint,
    falhas: contadorDoc.falhas,
    invalidos: contadorDoc.invalidos,
    elegiveisAgora: escolhido.length,
    motivoAtual: motivo,
    proximaJanela,
    diaOperacional: diaOperacionalKey(now, config.inicioDiaOperacionalHora),
  };
}
