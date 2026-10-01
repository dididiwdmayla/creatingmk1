"use client";

import { useEffect, useState } from "react";

import { SkeletonRows } from "@/components/Skeleton";
import { PainelColapsavel } from "@/components/config/PainelColapsavel";
import { mensagemErroFila } from "@/components/config/comum";
import { api } from "@/lib/api-client";
import type { FilaEnvioEstado, LinhaReconciliacao } from "@/lib/fila/estado";
import { formatDateTime, formatInt } from "@/lib/format";

/** Chave da persistência deste bloco — ver `PainelColapsavel`. */
export const PAINEL_RECONCILIACAO = "fila-reconciliacao";

const ROTULO_ESTADO: Record<FilaEnvioEstado, string> = {
  reservado: "reservado",
  enviado: "enviado",
  falhou: "falhou",
  invalido: "inválido",
};

interface Previa {
  linhas: LinhaReconciliacao[];
  total: number;
  leadsExcluidos: number;
  autorPresente: boolean;
  loteMax: number;
}

/**
 * RECONCILIAÇÃO, subordinada ao painel "Fila de envio" (ver
 * `lib/fila/reconciliacao.ts`): os leads que a fila reservou e que
 * continuam "novo" — o estrago de quando o confirmar respondia 503 e o
 * envio saía sem ser registrado.
 *
 * Duas etapas de propósito: a PRÉVIA está sempre na tela; o aplicar pede uma
 * confirmação explícita, dizendo o que vai acontecer, antes de mandar. Os
 * lotes vão em sequência e cada um que passou já está gravado — uma falha
 * no meio para ali e a prévia relida mostra o que sobrou.
 */
export function ReconciliacaoBloco() {
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [progresso, setProgresso] = useState<{ feitos: number; total: number } | null>(null);
  const [resultado, setResultado] = useState<{ marcados: number; pulados: number } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let ignore = false;
    api
      .getFilaReconciliacao()
      .then((resposta) => {
        if (!ignore) setPrevia(resposta);
      })
      .catch((error) => {
        if (ignore) return;
        setErro(mensagemErroFila(error, "Falha ao carregar a prévia"));
        // Falhar ao carregar não é "nada a reconciliar": o vazio abaixo só
        // aparece sem erro, e o botão some com a lista.
        setPrevia((atual) => atual ?? { linhas: [], total: 0, leadsExcluidos: 0, autorPresente: false, loteMax: 50 });
      });
    return () => {
      ignore = true;
    };
  }, [versao]);

  async function aplicar() {
    if (!previa) return;
    const ids = previa.linhas.map((l) => l.leadId);
    setConfirmando(false);
    setErro(null);
    setResultado(null);
    setProgresso({ feitos: 0, total: ids.length });
    let marcados = 0;
    let pulados = 0;
    try {
      for (let i = 0; i < ids.length; i += previa.loteMax) {
        const lote = ids.slice(i, i + previa.loteMax);
        const r = await api.aplicarFilaReconciliacao(lote);
        marcados += r.reconciliados.length;
        pulados += r.pulados.length;
        setProgresso({ feitos: Math.min(i + lote.length, ids.length), total: ids.length });
      }
      setResultado({ marcados, pulados });
    } catch (error) {
      setErro(mensagemErroFila(error, "Falha no meio da reconciliação — os lotes anteriores já foram gravados"));
    } finally {
      setProgresso(null);
      // Relê a prévia: é a resposta do servidor que diz o que sobrou.
      setVersao((n) => n + 1);
    }
  }

  const total = previa?.total ?? 0;
  const ocupado = progresso !== null;

  return (
    <PainelColapsavel
      id={PAINEL_RECONCILIACAO}
      titulo="Reconciliação"
      nivel={3}
      resumo={previa === null ? undefined : total === 0 ? "nada a reconciliar" : `${formatInt(total)} a marcar`}
    >
      <p className="mt-1 text-xs text-ink-muted">
        Leads que a fila reservou e que continuam “novo”. Enquanto o confirmar respondia 503, a mensagem saía e
        não era registrada — na dúvida, reservado conta como enviado. Marcar grava contactado com a data da
        reserva; não mexe na meta do dia nem na rotação.
      </p>

      {previa === null && <SkeletonRows count={1} className="mt-2 h-20 rounded border border-line" />}

      {previa && !previa.autorPresente && total > 0 && (
        <p
          data-reconciliacao="sem-autor"
          className="mt-2 rounded border border-warning/40 bg-warning/10 px-2 py-1 text-xs text-warning"
        >
          Bloqueado: cadastre <span className="font-mono">RADAR_DEVICE_USER_ID</span> na Vercel — é o autor que a
          reconciliação grava.
        </p>
      )}

      {previa && total === 0 && !erro && (
        <p className="mt-2 text-xs text-ink-muted">Nenhum lead reservado continua em “novo”.</p>
      )}

      {previa && total > 0 && (
        <ul
          data-lista="reconciliacao"
          className="mt-2 flex max-h-80 flex-col gap-1.5 overflow-y-auto overscroll-contain"
        >
          {previa.linhas.map((linha) => (
            <li
              key={linha.leadId}
              className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 rounded border border-line p-2"
            >
              <a
                href={`/leads/${linha.leadId}`}
                className="min-w-0 truncate text-xs text-foreground underline decoration-line underline-offset-2"
              >
                {linha.nome || linha.leadId}
              </a>
              <span className="flex shrink-0 items-baseline gap-2 text-[10px] text-ink-muted">
                <span>reservado {formatDateTime(linha.reservadoEm)}</span>
                <span className="rounded bg-surface-2 px-1 py-px text-ink-secondary">
                  {ROTULO_ESTADO[linha.estado] ?? linha.estado}
                  {linha.tentativas > 0 && ` · ${linha.tentativas} tent.`}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {previa && previa.leadsExcluidos > 0 && (
        <p className="mt-1 text-[11px] text-ink-muted">
          {formatInt(previa.leadsExcluidos)} {previa.leadsExcluidos === 1 ? "reserva é" : "reservas são"} de lead
          excluído — nada a marcar.
        </p>
      )}

      {previa && total > 0 && !confirmando && (
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          disabled={!previa.autorPresente || ocupado}
          className="mt-2 rounded border border-line bg-surface-2 px-2 py-1 text-xs text-foreground hover:border-accent/60 disabled:opacity-50"
        >
          {ocupado && progresso
            ? `Marcando… ${formatInt(progresso.feitos)} de ${formatInt(progresso.total)}`
            : `Marcar ${formatInt(total)} como contactados…`}
        </button>
      )}

      {confirmando && previa && (
        <div
          data-reconciliacao="confirmacao"
          role="alertdialog"
          aria-label="Confirmar reconciliação"
          className="mt-2 rounded border border-accent/40 bg-accent/10 p-2 text-xs text-foreground"
        >
          <p>
            Marcar <strong>{formatInt(total)}</strong> {total === 1 ? "lead" : "leads"} como contactado, com selo e
            registro de envio na data da reserva? Lead que já avançou é pulado, nunca rebaixado. Não há desfazer em
            lote.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={aplicar}
              className="rounded border border-accent bg-accent/20 px-2 py-1 text-xs font-semibold text-accent"
            >
              Confirmar
            </button>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="rounded border border-line bg-surface-2 px-2 py-1 text-xs text-ink-muted"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {resultado && (
        <p className="mt-2 text-xs text-good">
          {formatInt(resultado.marcados)} marcados como contactados
          {resultado.pulados > 0 && ` · ${formatInt(resultado.pulados)} pulados (já tinham avançado)`}.
        </p>
      )}

      {erro && <p className="mt-2 text-xs text-critical">{erro}</p>}
    </PainelColapsavel>
  );
}
