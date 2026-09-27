"use client";

import { useEffect, useRef, useState } from "react";

import { SkeletonRows } from "@/components/Skeleton";
import { PainelColapsavel, usePainelAberto } from "@/components/config/PainelColapsavel";
import { mensagemErroFila } from "@/components/config/comum";
import { api } from "@/lib/api-client";
import type { OperadorAutomacao as DadosOperador } from "@/lib/automacao/painelTipos";
import { formatDateShortSP, formatInt } from "@/lib/format";

/** Chave da persistência deste bloco (subordinado a "Automação"). */
export const PAINEL_AUTOMACAO_OPERADOR = "automacao-operador";

/**
 * O QUE A AUTOMAÇÃO NÃO RESOLVE SOZINHA: nichos que ela pula por não ter
 * skin (qual template fazer em seguida, qual sinônimo falta) e pares
 * (nicho, região) que saíram do rodízio de busca por saturação.
 *
 * **Busca na primeira abertura** — a exceção de "Cotas"/"Metas"
 * (`usePainelAberto`): custa uma varredura de `/buscas` mais as execuções
 * de cada par da automação, e nada disto entra no resumo do cabeçalho do
 * painel. Aberto quer dizer o bloco E o painel "Automação" em volta dele:
 * o bloco aberto dentro de um painel fechado continua escondido.
 */
export function OperadorAutomacao({ painelId }: { painelId: string }) {
  const painelAberto = usePainelAberto(painelId);
  const blocoAberto = usePainelAberto(PAINEL_AUTOMACAO_OPERADOR);
  const aberto = painelAberto && blocoAberto;
  const [dados, setDados] = useState<DadosOperador | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const buscou = useRef(false);

  useEffect(() => {
    if (!aberto || buscou.current) return;
    buscou.current = true;
    let ignore = false;
    api
      .getAutomacaoOperador()
      .then((novo) => {
        if (!ignore) setDados(novo);
      })
      .catch((error) => {
        if (!ignore) setErro(mensagemErroFila(error, "Falha ao carregar"));
      });
    return () => {
      ignore = true;
    };
  }, [aberto]);

  const resumo =
    dados === null
      ? "não carregado"
      : `${dados.nichosSemSkin.length} nicho${dados.nichosSemSkin.length === 1 ? "" : "s"} sem skin · ${dados.paresSaturados.length} par${dados.paresSaturados.length === 1 ? "" : "es"} saturado${dados.paresSaturados.length === 1 ? "" : "s"}`;

  return (
    <PainelColapsavel id={PAINEL_AUTOMACAO_OPERADOR} titulo="O que falta" nivel={3} resumo={resumo}>
      {dados === null && !erro && <SkeletonRows count={2} className="mt-2 h-10 rounded border border-line" />}

      {dados && (
        <div className="mt-2 flex flex-col gap-4">
          <section data-bloco="nichos-sem-skin">
            <h4 className="text-xs font-medium text-ink-secondary">Nichos sem skin</h4>
            <p className="text-xs text-ink-muted">
              A automação pula lead e busca destes nichos. O de mais leads é o próximo template a
              fazer; se o nicho já tem uma skin prima, falta só o sinônimo no registro.
            </p>
            {dados.nichosSemSkin.length === 0 ? (
              <p className="mt-1 text-xs text-ink-muted">Todo nicho buscado tem skin.</p>
            ) : (
              <table className="mt-1 w-full text-xs">
                <thead>
                  <tr className="text-left text-ink-muted">
                    <th className="py-1 font-normal">nicho</th>
                    <th className="py-1 text-right font-normal">buscas</th>
                    <th className="py-1 text-right font-normal">leads</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.nichosSemSkin.map((n) => (
                    <tr key={n.nicho} className="border-t border-line">
                      <td className="py-1 pr-2 break-words text-ink-secondary">{n.nicho}</td>
                      <td className="py-1 text-right tabular-nums">{formatInt(n.buscas)}</td>
                      <td className="py-1 text-right tabular-nums">{formatInt(n.leads)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section data-bloco="pares-saturados">
            <h4 className="text-xs font-medium text-ink-secondary">Pares saturados</h4>
            <p className="text-xs text-ink-muted">
              Fora do rodízio de busca: as últimas {dados.saturacao.execucoes} execuções da
              automação trouxeram, somadas, menos de {dados.saturacao.minNovos} leads novos.
            </p>
            {dados.paresSaturados.length === 0 ? (
              <p className="mt-1 text-xs text-ink-muted">Nenhum par saturado.</p>
            ) : (
              <ul className="mt-1 flex flex-col gap-1">
                {dados.paresSaturados.map((p) => (
                  <li key={p.chave} className="flex flex-wrap items-baseline gap-x-2 border-t border-line pt-1 text-xs">
                    <span className="text-ink-secondary">
                      {p.nicho} — {p.regiao}
                    </span>
                    <span className="text-ink-muted">
                      novos por noite: {p.novos.join(", ")}
                      {p.ultimaEm ? ` · última ${formatDateShortSP(p.ultimaEm)}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {erro && <p className="mt-2 text-xs text-critical">{erro}</p>}
    </PainelColapsavel>
  );
}
