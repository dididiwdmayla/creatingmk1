"use client";

import { useEffect, useState } from "react";

import { SkeletonRows } from "@/components/Skeleton";
import { PainelColapsavel } from "@/components/config/PainelColapsavel";
import { mensagemErroFila } from "@/components/config/comum";
import { api } from "@/lib/api-client";
import type { PendenciaEnvio } from "@/lib/fila/estado";
import { formatDateTime } from "@/lib/format";

/** Chave da persistência deste bloco — ver `PainelColapsavel`. */
export const PAINEL_PRINT_PENDENTE = "fila-print-pendente";

/**
 * Lista de pendência de PRINT, subordinada ao painel "Fila de envio".
 *
 * Quando o texto da prospecção sai e o anexo falha, o celular reporta
 * "enviado" com o detalhe preenchido (ver `detalheEnvio` em
 * lib/fila/estado.ts) — reportar falha devolveria o lead à fila e mandaria
 * a mesma mensagem duas vezes. O preço são leads contactados sem a peça que
 * vende, e esta lista é o único lugar onde eles aparecem.
 *
 * É lista de trabalho MANUAL: o operador abre a conversa e anexa o print à
 * mão, depois marca "resolvido". Sem ação em massa e sem botão de reenvio —
 * reenviar produziria justamente a mensagem duplicada que a escolha de
 * reportar "enviado" existe para evitar.
 */
export function PrintPendenteLista() {
  const [linhas, setLinhas] = useState<PendenciaEnvio[] | null>(null);
  const [verResolvidas, setVerResolvidas] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    // Sem zerar a lista aqui: trocar de visão troca as linhas no lugar, sem
    // piscar esqueleto. `null` é só o primeiro carregamento.
    api
      .getFilaPendencias(verResolvidas)
      .then(({ pendencias }) => {
        if (!ignore) setLinhas(pendencias);
      })
      .catch((error) => {
        if (ignore) return;
        setLinhas([]);
        setErro(mensagemErroFila(error, "Falha ao carregar as pendências"));
      });
    return () => {
      ignore = true;
    };
  }, [verResolvidas]);

  async function alternar(leadId: string, resolvido: boolean) {
    setOcupado(leadId);
    setErro(null);
    try {
      await api.patchFilaPendencia(leadId, resolvido);
      // Relê em vez de remendar a lista local: marcar resolvido TIRA a linha
      // da visão padrão, e é a resposta do servidor que decide isso.
      const { pendencias } = await api.getFilaPendencias(verResolvidas);
      setLinhas(pendencias);
    } catch (error) {
      setErro(mensagemErroFila(error, "Falha ao salvar"));
    } finally {
      setOcupado(null);
    }
  }

  return (
    <PainelColapsavel
      id={PAINEL_PRINT_PENDENTE}
      titulo="Print pendente"
      nivel={3}
      resumo={
        linhas === null
          ? undefined
          : verResolvidas
            ? `${linhas.length} resolvidas`
            : String(linhas.length)
      }
      acoes={
        <button
          type="button"
          onClick={() => setVerResolvidas(!verResolvidas)}
          aria-pressed={verResolvidas}
          className="shrink-0 rounded px-1.5 py-0.5 text-xs text-ink-muted hover:text-foreground"
        >
          {verResolvidas ? "ver só as abertas" : "ver resolvidas"}
        </button>
      }
    >
      <p className="mt-1 text-xs text-ink-muted">
        O texto saiu, o print não foi anexado.
        {/* A instrução só aparece quando há o que fazer: com a lista vazia,
            mandar abrir a conversa é instrução para uma tarefa que não existe. */}
        {linhas !== null && linhas.length > 0 && " Abra a conversa e mande a imagem à mão."}
      </p>

      {linhas === null && <SkeletonRows count={1} className="mt-2 h-14 rounded border border-line" />}

      {linhas?.length === 0 && !erro && (
        // Estado vazio de UMA linha: nada de caixa vazia ocupando o painel.
        // `!erro` porque falhar ao carregar não é "não há pendência": dizer
        // isso quando a lista nem chegou esconderia justamente o que ela
        // existe para mostrar.
        <p className="mt-2 text-xs text-ink-muted">
          {verResolvidas ? "Nenhuma pendência resolvida." : "Nenhuma pendência."}
        </p>
      )}

      {linhas && linhas.length > 0 && (
        <ul data-lista="pendencias" className="mt-2 flex flex-col gap-1.5">
          {linhas.map((linha) => (
            <li
              key={linha.leadId}
              className="flex flex-wrap items-start justify-between gap-2 rounded border border-line p-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <a
                    href={`/leads/${linha.leadId}`}
                    className="text-xs text-foreground underline decoration-line underline-offset-2"
                  >
                    {linha.nome || linha.leadId}
                  </a>
                  {linha.enviadoEm && (
                    <span className="text-[10px] text-ink-muted">
                      {formatDateTime(linha.enviadoEm)}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 font-mono text-[10px] text-ink-muted">{linha.leadId}</p>
                <p className="mt-1 text-xs text-ink-secondary">{linha.detalhe}</p>
              </div>
              <button
                type="button"
                onClick={() => alternar(linha.leadId, !linha.resolvido)}
                disabled={ocupado === linha.leadId}
                aria-pressed={linha.resolvido}
                title={
                  linha.resolvido
                    ? "Reabrir — volta para a lista de pendências"
                    : "Marcar como resolvido — o print já foi anexado à mão"
                }
                className={`shrink-0 rounded border px-2 py-1 text-xs disabled:opacity-50 ${
                  linha.resolvido
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-line bg-surface-2 text-ink-muted"
                }`}
              >
                {linha.resolvido ? "✓ resolvido" : "resolvido"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {erro && <p className="mt-2 text-xs text-critical">{erro}</p>}
    </PainelColapsavel>
  );
}
