"use client";

import { useEffect, useState } from "react";

import { SkeletonRows } from "@/components/Skeleton";
import { PainelColapsavel } from "@/components/config/PainelColapsavel";
import { mensagemErroFila } from "@/components/config/comum";
import { api } from "@/lib/api-client";
import type { PainelEventos } from "@/lib/fila/eventos";
import { formatDateTime, formatInt } from "@/lib/format";

/** Chave da persistência deste bloco — ver `PainelColapsavel`. */
export const PAINEL_EVENTOS_FILA = "fila-eventos";

/** O que cada código costuma querer dizer, em linguagem de operador. */
const MOTIVO_LABEL: Record<string, string> = {
  claim_invalida: "a tarefa já não era desse aparelho (claim que não bate)",
  confirmado_fora_da_claim:
    "a mensagem de uma tarefa já liberada SAIU — o lead foi marcado como contactado e o envio contado agora",
  corpo_invalido: "a macro mandou um corpo malformado",
  config_error: "falta configuração no servidor",
  internal_error: "erro inesperado no servidor",
  validation_error: "a macro mandou um valor inválido",
};

/**
 * "Erros do aparelho", subordinado ao painel "Fila de envio" (ver
 * `lib/fila/eventos.ts`): toda resposta não-200 de `/api/fila/proximo` e
 * `/api/fila/confirmar` — e o confirmar TARDIO, que responde 200 mas é o
 * aviso de que uma tarefa liberada tinha saído (ver `confirmarEnvio`). Fica logo abaixo da saúde da fila porque responde a
 * mesma pergunta pelo outro lado — a saúde diz o que FALTA, isto diz o que
 * de fato DEU ERRADO.
 *
 * O número do cabeçalho é o total do DIA (do servidor, não contado da lista
 * — a lista tem teto). Leitura pura: nada aqui reenvia nem corrige — é o
 * rastro que faltou quando todo confirmar respondia 503 e ninguém via.
 */
export function EventosFilaBloco() {
  const [dados, setDados] = useState<PainelEventos | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    api
      .getFilaEventos()
      .then((resposta) => {
        if (!ignore) setDados(resposta);
      })
      .catch((error) => {
        if (!ignore) setErro(mensagemErroFila(error, "Falha ao carregar os erros do aparelho"));
      });
    return () => {
      ignore = true;
    };
  }, []);

  const total = dados?.totalHoje ?? 0;

  return (
    <PainelColapsavel
      id={PAINEL_EVENTOS_FILA}
      titulo="Erros do aparelho"
      nivel={3}
      resumo={dados === null ? (erro ? "—" : undefined) : total === 0 ? "nenhum hoje" : `${formatInt(total)} hoje`}
    >
      <p className="mt-1 text-xs text-ink-muted">
        Respostas de erro que o celular recebeu ao pedir tarefa ou confirmar envio, e envios confirmados
        depois de a tarefa ter sido liberada. Sem a chave do aparelho nada é gravado aqui.
      </p>

      {dados === null && !erro && <SkeletonRows count={1} className="mt-2 h-14 rounded border border-line" />}

      {dados && dados.eventos.length === 0 && (
        <p className="mt-2 text-xs text-ink-muted">Nenhum erro hoje nem ontem.</p>
      )}

      {dados && dados.eventos.length > 0 && (
        <>
          <p className="mt-2 text-[10px] text-ink-muted">
            {formatInt(total)} hoje · os últimos {formatInt(dados.eventos.length)} de hoje e ontem, mais recente
            primeiro
          </p>
          <ul data-lista="eventos" className="mt-1 flex flex-col gap-1.5">
            {dados.eventos.map((evento, i) => (
              <li
                key={`${evento.em}-${i}`}
                className="flex flex-col gap-0.5 rounded border border-line p-2 text-xs"
              >
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span
                    className={`rounded px-1 font-mono text-[11px] ${
                      evento.status >= 500 ? "bg-critical/15 text-critical" : "bg-warning/15 text-warning"
                    }`}
                  >
                    {evento.status}
                  </span>
                  <span className="text-ink-secondary">{evento.rota === "confirmar" ? "confirmar" : "próximo"}</span>
                  <span className="text-[10px] text-ink-muted">{formatDateTime(evento.em)}</span>
                  {evento.leadId && (
                    <a
                      href={`/leads/${evento.leadId}`}
                      className="min-w-0 truncate text-foreground underline decoration-line underline-offset-2"
                    >
                      {evento.nomeLead || "lead excluído ou desconhecido"}
                    </a>
                  )}
                </div>
                <p className="break-words text-[11px] text-ink-muted">
                  <span className="font-mono text-ink-secondary">{evento.motivo}</span>
                  {MOTIVO_LABEL[evento.motivo] && ` — ${MOTIVO_LABEL[evento.motivo]}`}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}

      {erro && <p className="mt-2 text-xs text-critical">{erro}</p>}
    </PainelColapsavel>
  );
}
