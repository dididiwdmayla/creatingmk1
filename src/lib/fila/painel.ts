import type { AppDb } from "@/lib/firestore-like";
import { horaDoMinuto, proximoMomentoAceito } from "@/lib/leads/barraDoDia";
import { MIN_DIA, minutoDaSemanaLocal } from "@/lib/leads/horarios";
import type { JanelasContatoConfig, NivelContato } from "@/lib/leads/janelaContato";
import { getLead } from "@/lib/leads/repo";

import { motivoEstrutural, type CandidatoFila } from "./candidatos";
import type { FilaConfig } from "./config";
import type { FilaContadorSnapshot } from "./contadores";
import { diaOperacionalKey, proximaViradaDiaOperacional } from "./contadores";
import type { ContadorPainel, LinhaFilaPainel } from "./estado";
import { leadSinteticoDoCandidato } from "./selecao";

/**
 * AS LINHAS DO PAINEL "Fila de envio" (/config) — os poucos leads que a tela
 * de fato mostra, com nome, e por isso o único lugar da fila que lê `/leads`
 * fora da varredura do pool.
 *
 * **Por que ler o doc do lead aqui é aceitável:** /config é página de admin,
 * aberta esporadicamente por uma pessoa — não é `/api/fila/proximo`, que o
 * celular bate 1440× por dia e por isso ganhou o pool (`candidatos.ts`).
 * Mesmo assim, nada aqui varre `/leads`: as entradas do pool são compactas
 * DE PROPÓSITO (`{ id, nicho, offset, faixas, criadoEm }`, teto de 1 MiB) e
 * continuam sem nome — o nome vem de uma leitura POR ID, só dos que a tela
 * mostra. Nada de cache nem de pool para esta tela.
 *
 * **A releitura também é honestidade, não só o nome.** O pool é CACHE, e a
 * regra da fila inteira é "pode OFERECER um lead que não serve mais, nunca
 * ENTREGAR" (ver `lerPool`). A tela segue a mesma regra: cada linha é
 * reconferida contra o doc fresco do lead (`motivoEstrutural`) e sai da
 * lista quando não passa mais. É isso que faz o lead desaparecer assim que
 * o operador clica em "tirar da fila", em vez de continuar listado como
 * próximo até o pool reconstruir.
 */

/** Quantas linhas cada lista mostra — e, portanto, quantos docs de lead são lidos. */
export const PAINEL_LINHAS = 5;

/** Hora local do lead AGORA, a partir do deslocamento que o pool guardou. */
function horaLocalDoCandidato(candidato: CandidatoFila, now: Date): string {
  const minutoSemana = minutoDaSemanaLocal(candidato.offset, now);
  return horaDoMinuto(minutoSemana - Math.floor(minutoSemana / MIN_DIA) * MIN_DIA);
}

/**
 * Monta as linhas de uma lista (próximos OU bloqueados) a partir dos ids que
 * a seleção já ordenou. `comProximaFaixa` só é ligado para os bloqueados: é
 * a resposta a "quando esse lead entra", e nos elegíveis a resposta é agora.
 *
 * Lead que sumiu da base, ou que não passa mais nos critérios estruturais,
 * é DESCARTADO da lista (não vira linha sem nome): o pool pode estar até
 * `POOL_TTL_MS` atrasado, e mostrar como "próximo a receber mensagem" quem
 * acabou de ser descartado à mão seria pior do que mostrar uma linha a
 * menos.
 */
export async function linhasDoPainel(
  db: AppDb,
  pool: CandidatoFila[],
  selecionados: Array<{ id: string; nivel?: NivelContato }>,
  opcoes: {
    janelas: JanelasContatoConfig;
    niveisAceitos: readonly NivelContato[];
    now: Date;
    comProximaFaixa: boolean;
  },
): Promise<LinhaFilaPainel[]> {
  const porId = new Map(pool.map((candidato) => [candidato.id, candidato]));

  const linhas = await Promise.all(
    selecionados.map(async ({ id, nivel }): Promise<LinhaFilaPainel | undefined> => {
      const candidato = porId.get(id);
      if (!candidato) return undefined;

      const lead = await getLead(db, id);
      // Pool velho pode OFERECER quem não serve mais; a tela não mostra.
      if (!lead || motivoEstrutural(lead) !== undefined) return undefined;

      const proxima =
        opcoes.comProximaFaixa
          ? proximoMomentoAceito(
              opcoes.janelas,
              leadSinteticoDoCandidato(candidato),
              opcoes.niveisAceitos,
              opcoes.now,
            )
          : undefined;

      return {
        leadId: id,
        nome: lead.nome,
        // O nicho CRU da busca, como a pessoa digitou; o do pool é o
        // normalizado da peneira, e serve de rede se a busca sumiu.
        nicho: lead.busca?.nicho ?? candidato.nicho,
        nivel: nivel ?? null,
        horaLocal: horaLocalDoCandidato(candidato, opcoes.now),
        proximaFaixa: proxima
          ? { rotuloDia: proxima.rotuloDia, hora: horaDoMinuto(proxima.inicioMin) }
          : null,
      };
    }),
  );

  return linhas.filter((linha): linha is LinhaFilaPainel => linha !== undefined);
}

/**
 * O contador do dia, pronto para a tela: quanto saiu, quanto falta e QUANDO
 * o dia operacional vira. Puro — `now` e o snapshot vêm de fora.
 *
 * `restante` nunca é negativo: a meta pode ser reduzida no painel depois de
 * o dia já ter passado dela, e "-3 restantes" não quer dizer nada para quem
 * lê. O portão que vale é `meta_atingida`, e ele já aparece no ritmo.
 */
export function contadorDoPainel(
  config: FilaConfig,
  contador: FilaContadorSnapshot,
  now: Date,
): ContadorPainel {
  return {
    diaOperacional: diaOperacionalKey(now, config.inicioDiaOperacionalHora),
    enviados: contador.totalDoDia,
    meta: config.metaDiaria,
    restante: Math.max(0, config.metaDiaria - contador.totalDoDia),
    viraEm: proximaViradaDiaOperacional(now, config.inicioDiaOperacionalHora).toISOString(),
    inicioHora: config.inicioDiaOperacionalHora,
    ultimaHora: contador.ultimaHora,
    tetoPorHora: config.tetoPorHora,
  };
}
