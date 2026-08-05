"use client";

import { useState } from "react";

import { ConfirmModal } from "@/components/ConfirmModal";
import { estadoVisivel, mensagemDisparoLote } from "@/lib/demos/capturas/estado";
import { api } from "@/lib/api-client";
import type { Lead } from "@/lib/leads/types";

import { useEstadoCapturas } from "./useEstadoCapturas";

/**
 * Ação "Gerar capturas do grupo" — o equivalente em lote do botão da
 * ficha, na barra de ações de um grupo de busca (/leads?buscaId=).
 *
 * Enfileira todo mundo num disparo só (um `next build` e um Chromium para
 * o grupo inteiro) e mostra o andamento AGREGADO: quantos ainda estão na
 * fila, quantos rodando, quantos prontos, quantos falharam. O detalhe
 * lead a lead continua na ficha de cada um.
 *
 * Ao terminar o disparo, a confirmação fica: quantos entraram na fila,
 * quantos foram pulados e quantos falharam — nunca só "voltou ao normal"
 * (mesmo defeito já corrigido na geração de demos em lote).
 */
export function CapturasLoteAcao({ leads }: { leads: Lead[] }) {
  // Só faz sentido para quem já tem demo — sem ela não há o que enquadrar.
  const comDemo = leads.filter((l) => l.demo?.skinId);
  const { mapa, agora, disponivel, carregado, recarregar } = useEstadoCapturas(
    comDemo.map((l) => l.placeId),
  );
  const [confirmando, setConfirmando] = useState(false);
  const [disparando, setDisparando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const contagem = { enfileirado: 0, rodando: 0, pronto: 0, falhou: 0 };
  for (const lead of comDemo) {
    const v = estadoVisivel(mapa[lead.placeId] ?? undefined, agora);
    if (v.estado !== "nunca") contagem[v.estado] += 1;
  }
  const emAndamento = contagem.enfileirado + contagem.rodando;

  function disparar() {
    setConfirmando(false);
    setDisparando(true);
    setErro(null);
    setMsg(null);
    api
      .gerarCapturasLote(comDemo.map((l) => l.placeId))
      .then((r) => {
        setMsg(
          mensagemDisparoLote(
            r.enfileirados.length,
            0,
            r.pulados.length + (leads.length - comDemo.length),
          ),
        );
        recarregar();
      })
      .catch((e: unknown) => setErro(e instanceof Error ? e.message : "falha ao disparar o lote"))
      .finally(() => setDisparando(false));
  }

  if (comDemo.length === 0) return null;

  return (
    <div className="border-t border-accent/20 pt-2">
      <button
        type="button"
        onClick={() => {
          setMsg(null);
          setErro(null);
          setConfirmando(true);
        }}
        disabled={disparando || !disponivel}
        className="text-xs font-medium text-accent hover:underline disabled:cursor-not-allowed disabled:text-ink-muted disabled:no-underline"
      >
        📸 Gerar capturas do grupo ({comDemo.length})
      </button>

      {/* Andamento agregado: o operador vê o grupo inteiro andar sem abrir
          ficha por ficha, e sem recarregar a página. */}
      {carregado && (contagem.pronto > 0 || emAndamento > 0 || contagem.falhou > 0) && (
        <p className="mt-1 flex flex-wrap gap-x-3 text-xs">
          {emAndamento > 0 && (
            <span className="text-accent">
              <span aria-hidden>↻</span> {emAndamento} gerando
            </span>
          )}
          {contagem.pronto > 0 && (
            <span className="text-good">
              <span aria-hidden>●</span> {contagem.pronto} pronto
              {contagem.pronto === 1 ? "" : "s"}
            </span>
          )}
          {contagem.falhou > 0 && (
            <span className="text-critical">
              <span aria-hidden>✗</span> {contagem.falhou} falh
              {contagem.falhou === 1 ? "ou" : "aram"}
            </span>
          )}
        </p>
      )}

      {msg && <p className="mt-1 text-xs text-good">{msg}</p>}
      {erro && <p className="mt-1 text-xs text-critical">{erro}</p>}
      {carregado && !disponivel && (
        <p className="mt-1 text-xs text-ink-muted">
          Geração indisponível: falta <code className="font-mono">GITHUB_CAPTURAS_TOKEN</code> no
          servidor.
        </p>
      )}

      <ConfirmModal
        aberto={confirmando}
        titulo="Gerar capturas do grupo"
        mensagem={
          `${comDemo.length} lead${comDemo.length === 1 ? "" : "s"} com demo ${
            comDemo.length === 1 ? "vai entrar" : "vão entrar"
          } na fila.` +
          (leads.length > comDemo.length
            ? ` ${leads.length - comDemo.length} sem demo ${leads.length - comDemo.length === 1 ? "fica" : "ficam"} de fora.`
            : "") +
          (emAndamento > 0
            ? ` ${emAndamento} já ${emAndamento === 1 ? "está" : "estão"} gerando e ${emAndamento === 1 ? "será pulado" : "serão pulados"}.`
            : "") +
          " A execução roda fora do Radar e leva alguns minutos; nenhuma chamada paga é feita."
        }
        confirmarLabel={`Gerar para ${comDemo.length} lead${comDemo.length === 1 ? "" : "s"}`}
        onConfirmar={disparar}
        onCancelar={() => setConfirmando(false)}
      />
    </div>
  );
}
