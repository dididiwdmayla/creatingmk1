"use client";

import { useEffect, useState } from "react";

import { SkeletonRows } from "@/components/Skeleton";
import { usePainelAberto } from "@/components/config/PainelColapsavel";
import { mensagemErroFila } from "@/components/config/comum";
import { ApiError, api } from "@/lib/api-client";
import {
  complementoDeFuso,
  diaDoOperador,
  horaDoOperador,
  textoDoBarrado,
  textoDoFora,
  textoDoMotivo,
  textoDoVencido,
} from "@/lib/fila/agendaTexto";
import type { AgendaFila, LinhaAgenda } from "@/lib/fila/estado";

/** As linhas agrupadas pelo dia do OPERADOR, na ordem da agenda. */
function porDia(agenda: AgendaFila): Array<{ dia: string; linhas: LinhaAgenda[] }> {
  const grupos: Array<{ dia: string; linhas: LinhaAgenda[] }> = [];
  for (const linha of agenda.linhas) {
    const dia = diaDoOperador(linha.em, agenda.geradoEm);
    const ultimo = grupos.at(-1);
    if (ultimo?.dia === dia) ultimo.linhas.push(linha);
    else grupos.push({ dia, linhas: [linha] });
  }
  return grupos;
}

/** O nome do lead, sempre link para a ficha. */
function NomeLead({ leadId, nome }: { leadId: string; nome: string }) {
  return (
    <a
      href={`/leads/${leadId}`}
      className="break-words text-xs text-foreground underline decoration-line underline-offset-2"
    >
      {nome || leadId}
    </a>
  );
}

/**
 * A AGENDA da fila — topo do painel "Fila de envio": os próximos leads na
 * ordem em que vão sair, a partir de quando, e por quê; abaixo, quem vai
 * ser barrado, quem perde a demo antes da vez e o que não coube. Ver
 * `lib/fila/agenda.ts`: é uma simulação com as MESMAS funções de
 * `/api/fila/proximo`, e nada aqui dispara envio.
 *
 * **Recalcula ao abrir** — cada vez que o painel abre — e no "↻ Atualizar".
 * Sem polling. Busca só com o painel aberto (a exceção de "Cotas"/"Metas",
 * `usePainelAberto`): a simulação lê `/buscas` e as frases, e com o pool
 * vencido varre `/leads` — custo de quem quer ver, não de quem só abriu a
 * /config. `versao` sobe a cada config salva no painel: meta, teto,
 * intervalo e janela mudam a agenda inteira.
 */
export function AgendaFilaBloco({ painelId, versao }: { painelId: string; versao: number }) {
  const aberto = usePainelAberto(painelId);
  const [agenda, setAgenda] = useState<AgendaFila | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);
  const [calculando, setCalculando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    let ignore = false;
    api
      .getFilaAgenda()
      .then((resposta) => {
        if (ignore) return;
        setAgenda(resposta);
        setErro(null);
      })
      .catch((error) => {
        if (ignore) return;
        setErro(
          error instanceof ApiError && error.status === 403
            ? "A agenda da fila é restrita ao admin."
            : mensagemErroFila(error, "Falha ao calcular a agenda"),
        );
      })
      .finally(() => {
        if (!ignore) setCalculando(false);
      });
    return () => {
      ignore = true;
    };
  }, [aberto, versao, recarga]);

  const fora = agenda ? textoDoFora(agenda) : undefined;

  return (
    <section data-bloco="agenda" className="mt-3 rounded border border-line p-2.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-ink-secondary">Agenda</h3>
        <button
          type="button"
          onClick={() => {
            setCalculando(true);
            setRecarga((n) => n + 1);
          }}
          disabled={calculando}
          className="shrink-0 rounded px-1.5 py-0.5 text-xs text-ink-muted hover:text-foreground disabled:opacity-60"
        >
          {calculando ? "calculando…" : "↻ Atualizar"}
        </button>
      </div>
      <p className="mt-0.5 text-[11px] text-ink-muted">
        Quem sai, na ordem, com as regras da fila — horário de São Paulo, até o fim de amanhã.
      </p>

      {agenda?.pausada && (
        <p
          data-agenda-aviso="pausada"
          className="mt-2 rounded border border-warning/40 bg-warning/10 px-2 py-1 text-xs text-warning"
        >
          A fila está pausada: nada sai enquanto ela estiver assim. A agenda é a de quando ela voltar.
        </p>
      )}
      {agenda?.bloqueada && (
        <p
          data-agenda-aviso="bloqueada"
          className="mt-2 rounded border border-critical/40 bg-critical/10 px-2 py-1 text-xs text-critical"
        >
          Entrega bloqueada por config ausente (ver “Saúde da fila”): nada sai até ela existir.
        </p>
      )}

      {agenda === null && !erro && <SkeletonRows count={1} className="mt-2 h-24 rounded" />}

      {agenda && agenda.linhas.length === 0 && (
        <p data-agenda-vazia className="mt-2 text-xs text-ink-muted">
          Nenhum lead sai até o fim de amanhã.
        </p>
      )}

      {agenda &&
        porDia(agenda).map((grupo) => (
          <div key={grupo.dia} data-dia-agenda={grupo.dia} className="mt-2.5">
            <p className="text-[10px] text-ink-muted">
              <span className="font-semibold uppercase tracking-wide">{grupo.dia}</span> · a partir de
            </p>
            <ol className="mt-1 flex flex-col gap-1">
              {grupo.linhas.map((linha) => {
                const dele = complementoDeFuso(linha);
                return (
                  <li
                    key={linha.leadId}
                    data-linha-agenda={linha.leadId}
                    className="flex items-start gap-2.5 rounded border border-line px-2 py-1.5"
                  >
                    <span
                      title={`a partir de ${horaDoOperador(linha.em)} (São Paulo)`}
                      className="w-11 shrink-0 pt-px font-mono text-sm tabular-nums text-foreground"
                    >
                      {horaDoOperador(linha.em)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <NomeLead leadId={linha.leadId} nome={linha.nome} />
                        {linha.manual && (
                          <span
                            title="Adicionado à fila à mão: fura o nicho permitido e a ordem natural, dentro da mesma janela."
                            className="rounded border border-accent/40 bg-accent/10 px-1 text-[10px] text-accent"
                          >
                            manual
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-ink-muted">
                        {textoDoMotivo(linha, agenda.ritmo)}
                        {dele && <span className="text-ink-secondary"> · {dele}</span>}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}

      {agenda && agenda.barrados.length > 0 && (
        <div data-agenda-barrados className="mt-3">
          <h4 className="text-[11px] font-semibold text-warning">
            Vão ser barrados ({agenda.barrados.length}) — não ocupam vaga
          </h4>
          <ul className="mt-1 flex flex-col gap-1">
            {agenda.barrados.map((barrado) => (
              <li key={barrado.leadId} data-barrado-agenda={barrado.leadId} className="text-[11px] text-ink-muted">
                <NomeLead leadId={barrado.leadId} nome={barrado.nome} /> — {textoDoBarrado(barrado)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {agenda && agenda.vencidos.length > 0 && (
        <div data-agenda-vencidos className="mt-3">
          <h4 className="text-[11px] font-semibold text-warning">
            Demo vence antes da vez ({agenda.vencidos.length}) — não saem
          </h4>
          <ul className="mt-1 flex flex-col gap-1">
            {agenda.vencidos.map((vencido) => (
              <li key={vencido.leadId} data-vencido-agenda={vencido.leadId} className="text-[11px] text-ink-muted">
                <NomeLead leadId={vencido.leadId} nome={vencido.nome} /> — {textoDoVencido(vencido, agenda.geradoEm)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {agenda && (fora || agenda.pool) && (
        <p data-agenda-rodape className="mt-2.5 text-[11px] text-ink-muted">
          {fora && (
            <>
              <span data-agenda-fora className="text-ink-secondary">
                {fora}
              </span>
              {" · "}
            </>
          )}
          {agenda.pool.reconstruido
            ? "candidatos lidos agora"
            : `candidatos do retrato das ${horaDoOperador(agenda.pool.geradoEm)}`}
        </p>
      )}

      {erro && <p className="mt-2 text-xs text-critical">{erro}</p>}
    </section>
  );
}
