import { listBuscas } from "@/lib/buscas/repo";
import { nichosSemSkin } from "@/lib/demos/nichosSemSkin";
import type { AppDb } from "@/lib/firestore-like";

import { loadAutomacaoConfig } from "./config";
import { execucoesDe, idBuscaAutomacao, paresDasBuscas, parSaturado } from "./pares";
import type { OperadorAutomacao, ParSaturadoPainel } from "./painelTipos";

/**
 * "O que o operador precisa saber" do painel "Automação" — o que a
 * automação NÃO resolve sozinha:
 *
 * - **nichos sem skin** (`nichosSemSkin`, a função do bloco de skins): a
 *   automação pula lead e par de nicho sem skin, então esta lista é o que
 *   fica parado — o template a fazer em seguida (o de mais leads) e, quando
 *   o nicho já tem uma skin prima, o sinônimo que falta no registro;
 * - **pares (nicho, região) saturados**: fora do rodízio de busca pela
 *   régua de `parSaturado` — a área esgotou para a automação, e só o
 *   operador decide se vale buscar outra região.
 *
 * Custo: uma varredura de `/buscas` (dezenas de docs) e a subcoleção
 * `execucoes` SÓ dos pares que têm doc da automação — só eles podem estar
 * saturados. Por isso o bloco busca na primeira abertura, não ao montar a
 * /config (nada disto entra no resumo do cabeçalho).
 */
export async function montarOperador(db: AppDb): Promise<OperadorAutomacao> {
  const [config, buscas] = await Promise.all([loadAutomacaoConfig(db), listBuscas(db)]);

  const paresSaturados: ParSaturadoPainel[] = [];
  for (const par of paresDasBuscas(buscas)) {
    const idAutomacao = idBuscaAutomacao(par.chave);
    if (!par.buscas.some((b) => b.id === idAutomacao)) continue;
    const execucoes = await execucoesDe(db, idAutomacao);
    if (!parSaturado(execucoes, config)) continue;
    paresSaturados.push({
      chave: par.chave,
      nicho: par.nicho,
      regiao: par.regiao,
      novos: execucoes.slice(0, config.saturacaoExecucoes).map((e) => e.novos ?? 0),
      ultimaEm: execucoes[0]?.em ?? "",
    });
  }

  return {
    nichosSemSkin: nichosSemSkin(buscas).map(({ nicho, buscas: n, leads }) => ({ nicho, buscas: n, leads })),
    paresSaturados,
    saturacao: { execucoes: config.saturacaoExecucoes, minNovos: config.saturacaoMinNovos },
  };
}
