import type { CronExecucao } from "./cron";

/**
 * Estado da última rodada do cron, como o painel o lê. Módulo PURO (só
 * tipos e funções sobre o doc /cron/ultima): o widget do dashboard é um
 * client component e não pode importar `cron.ts`, que fala com Firestore e
 * Google.
 */

/**
 * `rodando` é gravado ANTES de qualquer outra coisa, e substituído no fim
 * por `ok` ou `falhou`. Um `rodando` que envelhece além do teto da função
 * é uma rodada que MORREU sem passar pelo catch (estouro de tempo — a
 * Vercel mata o processo, não lança exceção). Ausente = doc de antes desta
 * feature, que só existia quando a rodada terminava bem: vale `ok`.
 */
export type CronEstado = "rodando" | "ok" | "falhou";

/** Onde a rodada estava quando falhou — gravado em `falha.etapa`. */
export type CronEtapa = "inicio" | "config" | "fila" | "buscas" | "penetracao" | "registro";

export interface CronFalha {
  etapa: CronEtapa;
  mensagem: string;
  /** Instante em que a falha foi capturada. */
  em: string;
}

export const ROTULO_ETAPA: Record<CronEtapa, string> = {
  inicio: "abertura da rodada",
  config: "leitura da configuração",
  fila: "leitura das buscas recorrentes",
  buscas: "execução das buscas",
  penetracao: "recálculo da penetração",
  registro: "gravação do resumo",
};

/**
 * Espelho do `maxDuration` de `src/app/api/cron/route.ts` (que precisa ser
 * literal lá — o Next lê a config de segmento estaticamente). Um teste
 * cobra que os dois batam.
 */
export const CRON_MAX_DURATION_S = 300;

/** Folga sobre o teto antes de declarar "não concluiu" (relógios, cold start). */
const FOLGA_S = 60;

export type SituacaoCron =
  | { tipo: "nunca" }
  | { tipo: "rodou"; execucao: CronExecucao }
  | { tipo: "rodando"; execucao: CronExecucao }
  | { tipo: "falhou"; execucao: CronExecucao; falha: CronFalha }
  /** Ficou `rodando` além do teto: a função foi encerrada sem registrar o fim. */
  | { tipo: "nao-concluiu"; execucao: CronExecucao };

export function situacaoCron(ultima: CronExecucao | null, now: Date): SituacaoCron {
  if (!ultima) return { tipo: "nunca" };
  if (ultima.estado === "falhou") {
    return {
      tipo: "falhou",
      execucao: ultima,
      falha: ultima.falha ?? { etapa: "inicio", mensagem: "falha sem detalhe", em: ultima.em },
    };
  }
  if (ultima.estado === "rodando") {
    const decorridoS = (now.getTime() - new Date(ultima.em).getTime()) / 1000;
    return decorridoS > CRON_MAX_DURATION_S + FOLGA_S
      ? { tipo: "nao-concluiu", execucao: ultima }
      : { tipo: "rodando", execucao: ultima };
  }
  return { tipo: "rodou", execucao: ultima };
}
