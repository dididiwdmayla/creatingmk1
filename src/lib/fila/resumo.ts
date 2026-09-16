import { proximoMomentoAceito } from "@/lib/leads/barraDoDia";
import { MIN_DIA, minutoDaSemanaLocal } from "@/lib/leads/horarios";
import type { JanelasContatoConfig } from "@/lib/leads/janelaContato";

import { lerPool, type CandidatoFila } from "./candidatos";
import { loadFilaConfig, type FilaConfig } from "./config";
import { retencaoMsDeHoras } from "./envios";
import {
  lerContadorFilaCompleto,
  momentoFimIntervalo,
  momentoFimTetoHora,
  proximaViradaDiaOperacional,
  diaOperacionalKey,
  type FilaContadorCompleto,
} from "./contadores";
import {
  decidirFila,
  leadSinteticoDoCandidato,
  niveisAceitos,
  type CandidatoBloqueado,
  type MotivoSemTarefa,
} from "./selecao";
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
 * O próximo instante em que O CANDIDATO entra numa faixa aceita, como um
 * INSTANTE ABSOLUTO (não o par `{ offsetDias, inicioMin }` no calendário
 * LOCAL DO LEAD que `proximoMomentoAceito` devolve). A aritmética funciona
 * porque `offsetMinutos` é constante entre agora e o alvo (mesma simplificação
 * que o resto da fila já assume — o Brasil e a maioria dos fusos não mudam de
 * deslocamento de um dia para o outro): avançar N minutos no relógio de
 * parede local É avançar N minutos reais, então o delta calculado no fuso do
 * lead vale igual no relógio absoluto.
 */
function instanteAbsolutoDoMomento(
  momento: { offsetDias: number; inicioMin: number },
  offsetMinutos: number,
  now: Date,
): Date {
  const nowMin = minutoDaSemanaLocal(offsetMinutos, now);
  const minutoDoDiaAgora = nowMin % MIN_DIA;
  const deltaMin = momento.offsetDias * MIN_DIA + momento.inicioMin - minutoDoDiaAgora;
  return new Date(now.getTime() + deltaMin * 60_000);
}

/**
 * O próximo instante enviável entre os candidatos BLOQUEADOS POR JANELA —
 * o mínimo entre eles, convertido para um instante absoluto e então, por
 * quem chama, para o fuso do OPERADOR (nunca o do lead: são fusos
 * diferentes, e quem lê esta rota está em São Paulo).
 *
 * Usa `proximoMomentoAceito` com os NÍVEIS ACEITOS da config — nunca
 * `proximoBom` direto: com `exigirJanelaBoa === false` o próximo aceito é
 * "bom" OU "razoável", que vem antes do próximo bom, e mostrar o bom
 * daria uma hora plausível e ERRADA (mesma armadilha já documentada na
 * "próxima faixa aceita" do painel — ver `lib/leads/barraDoDia.ts`).
 */
function proximoInstanteDeJanela(
  pool: CandidatoFila[],
  bloqueados: CandidatoBloqueado[],
  janelas: JanelasContatoConfig,
  config: FilaConfig,
  now: Date,
): Date | undefined {
  const porId = new Map(pool.map((candidato) => [candidato.id, candidato]));
  const niveis = niveisAceitos(config);
  let melhor: Date | undefined;
  for (const bloqueado of bloqueados) {
    const candidato = porId.get(bloqueado.id);
    if (!candidato) continue;
    const momento = proximoMomentoAceito(janelas, leadSinteticoDoCandidato(candidato), niveis, now);
    if (!momento) continue;
    const instante = instanteAbsolutoDoMomento(momento, candidato.offset, now);
    if (!melhor || instante.getTime() < melhor.getTime()) melhor = instante;
  }
  return melhor;
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
    bloqueados: CandidatoBloqueado[];
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
      const instante = proximoInstanteDeJanela(
        contexto.pool,
        contexto.bloqueados,
        contexto.janelas,
        contexto.config,
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
  const [config, app] = await Promise.all([loadFilaConfig(db), loadConfig(db)]);
  const [contadorDoc, pool] = await Promise.all([
    lerContadorFilaCompleto(db, now, config.inicioDiaOperacionalHora),
    // A MESMA retenção que `/proximo` passa — o doc do pool é compartilhado,
    // e dois valores diferentes fariam quem reconstrói primeiro decidir pelo
    // outro. Ver `lerPool`.
    lerPool(db, now, { retencaoMs: retencaoMsDeHoras(config.retencaoEnvioHoras) }),
  ]);

  const { escolhido, diagnostico, motivo } = decidirFila(
    pool.candidatos,
    config,
    app.janelasContato,
    { totalDoDia: contadorDoc.enviados, ultimaHora: contadorDoc.ultimaHora, segundosDesdeUltimoEvento: contadorDoc.segundosDesdeUltimoEvento },
    now,
    { coletarBloqueados: true },
  );

  const proximaJanela = calcularProximaJanela(motivo, {
    contadorDoc,
    config,
    janelas: app.janelasContato,
    pool: pool.candidatos,
    bloqueados: diagnostico.bloqueados,
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
