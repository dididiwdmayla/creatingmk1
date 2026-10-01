"use client";

import { useEffect, useState } from "react";

import { SkeletonRows } from "@/components/Skeleton";
import { mensagemErroFila } from "@/components/config/comum";
import { api } from "@/lib/api-client";
import type { SaudeFila } from "@/lib/fila/saude";

/**
 * "Saúde da fila" — as variáveis de ambiente de que o ciclo de envio
 * depende, cada uma presente ou ausente (só o NOME; o valor nunca sai do
 * servidor). Fica no TOPO do painel porque responde a pergunta que vem antes
 * de todas as outras: a fila consegue registrar o que manda?
 *
 * Com uma EXIGIDA ausente, `/proximo` responde `pausado` e não entrega lead
 * nenhum (ver `lib/fila/saude.ts`) — a faixa vermelha diz isso com o nome do
 * que falta e onde se resolve, para ninguém confundir com a pausa do botão.
 */
export function SaudeFilaBloco({ onBloqueada }: { onBloqueada?: (bloqueada: boolean) => void }) {
  const [saude, setSaude] = useState<SaudeFila | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    api
      .getFilaSaude()
      .then((resposta) => {
        if (ignore) return;
        setSaude(resposta);
        onBloqueada?.(!resposta.entregaLiberada);
      })
      .catch((error) => {
        if (!ignore) setErro(mensagemErroFila(error, "Falha ao carregar a saúde da fila"));
      });
    return () => {
      ignore = true;
    };
  }, [onBloqueada]);

  return (
    <section data-bloco="saude" className="mt-3 rounded border border-line p-2.5">
      <h3 className="text-xs font-semibold text-ink-secondary">Saúde da fila</h3>

      {saude === null && !erro && <SkeletonRows count={1} className="mt-2 h-16 rounded" />}

      {saude && !saude.entregaLiberada && (
        <p
          data-saude="bloqueada"
          className="mt-2 rounded border border-critical/40 bg-critical/10 px-2 py-1 text-xs text-critical"
        >
          Entrega bloqueada: o aparelho recebe “pausado” e nenhum lead sai até{" "}
          {saude.faltando.length === 1 ? "esta variável ser cadastrada" : "estas variáveis serem cadastradas"}{" "}
          na Vercel — <span className="font-mono">{saude.faltando.join(", ")}</span>. O teste do aparelho
          continua funcionando.
        </p>
      )}

      {saude && (
        <ul className="mt-2 flex flex-col gap-1.5">
          {saude.variaveis.map((variavel) => {
            const tom = variavel.presente
              ? "text-good"
              : variavel.exigida
                ? "text-critical"
                : "text-warning";
            return (
              <li key={variavel.nome} data-variavel={variavel.nome} className="flex items-start gap-2 text-xs">
                <span aria-hidden className={`mt-px shrink-0 font-semibold ${tom}`}>
                  {variavel.presente ? "✓" : "✕"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="break-all font-mono text-[11px] text-foreground">{variavel.nome}</span>
                    <span className={`text-[11px] ${tom}`}>
                      {variavel.presente ? "presente" : "ausente"}
                      {!variavel.exigida && " · recomendada"}
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-muted">{variavel.papel}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {erro && <p className="mt-2 text-xs text-critical">{erro}</p>}
    </section>
  );
}
