"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/Button";
import { ApiError, api } from "@/lib/api-client";
import { EFEITOS } from "@/lib/demos/efeitos/registry";
import { patchCriacaoLote, relatorioVazio, type RelatorioLote } from "@/lib/demos/lote";
import { SKINS, getSkin } from "@/lib/demos/registry";
import { IMAGENS_MODOS, type ImagensModo } from "@/lib/demos/types";
import type { Lead } from "@/lib/leads/types";

const SELECT_CLASS =
  "rounded border border-line bg-surface-2 px-2 py-1.5 text-xs text-foreground outline-none focus:border-accent";

const MODO_LABEL: Record<ImagensModo, string> = {
  foto: "Foto (fotos de produção do template)",
  grafico: "Gráfico (ilustração/SVG do template)",
};

/**
 * Diálogo "Gerar demos em lote" — a partir de um grupo de busca
 * (`/leads?buscaId=`), cria a demo de N leads de uma vez com skin/preset de
 * tema/efeito/modo de imagem escolhidos aqui (um valor para o lote
 * inteiro). Criar demo é só `PUT /api/leads/[id]/demo` — Firestore, sem
 * request pago — por isso o lote inteiro processa sem tocar cota nenhuma.
 *
 * Processamento RESILIENTE: loop serial no CLIENTE (mesmo padrão de
 * `autoEnrichSerial` em app/(app)/leads/page.tsx) — cada `PUT` é uma
 * escrita completa e independente por lead, então uma falha num lead não
 * trava o resto, e nenhuma chamada de servidor processa o lote inteiro de
 * uma vez (sem risco de estourar o timeout de uma função serverless).
 */
export function GerarDemosLoteDialog({
  leads,
  onFechar,
  onLeadAtualizado,
}: {
  /** Leads do grupo de busca atual (o diálogo filtra os que já têm demo). */
  leads: Lead[];
  onFechar: () => void;
  /** Chamado a cada lead criado com sucesso, para o caller mesclar na lista local. */
  onLeadAtualizado: (lead: Lead) => void;
}) {
  const semDemo = leads.filter((lead) => !lead.demo);

  const [selecionados, setSelecionados] = useState<Set<string>>(
    () => new Set(semDemo.map((lead) => lead.placeId)),
  );
  const [skinId, setSkinId] = useState(SKINS[0]?.id ?? "");
  const skin = getSkin(skinId);
  const [themeId, setThemeId] = useState(skin?.themeDefault.id ?? "");
  const [efeitoId, setEfeitoId] = useState("nenhum");
  const [imagensModo, setImagensModo] = useState<ImagensModo>("foto");

  const [processando, setProcessando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [relatorio, setRelatorio] = useState<RelatorioLote | null>(null);
  const canceladoRef = useRef(false);

  function trocarSkin(novoSkinId: string) {
    setSkinId(novoSkinId);
    const novaSkin = getSkin(novoSkinId);
    setThemeId(novaSkin?.themeDefault.id ?? "");
  }

  function alternarSelecao(placeId: string) {
    setSelecionados((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(placeId)) proximo.delete(placeId);
      else proximo.add(placeId);
      return proximo;
    });
  }

  const alvos = semDemo.filter((lead) => selecionados.has(lead.placeId));

  async function criarDemos() {
    if (!skin || alvos.length === 0 || processando) return;
    canceladoRef.current = false;
    setProcessando(true);
    setProgresso(0);
    const relatorioAtual = relatorioVazio();
    const { dados, tema } = patchCriacaoLote({ skinId, themeId, efeitoId, imagensModo });

    for (const lead of alvos) {
      if (canceladoRef.current) {
        relatorioAtual.cancelado = true;
        break;
      }
      try {
        const { lead: atualizado } = await api.putLeadDemo(lead.placeId, {
          skinId,
          themeId,
          dados,
          ...(tema && { tema }),
        });
        relatorioAtual.sucessos.push({ placeId: lead.placeId, nome: lead.nome, ok: true });
        onLeadAtualizado(atualizado);
      } catch (error) {
        relatorioAtual.falhas.push({
          placeId: lead.placeId,
          nome: lead.nome,
          ok: false,
          erro: error instanceof ApiError ? error.message : "falha desconhecida",
        });
      }
      setProgresso((n) => n + 1);
      setRelatorio({ ...relatorioAtual });
    }

    setRelatorio(relatorioAtual);
    setProcessando(false);
  }

  function cancelar() {
    canceladoRef.current = true;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={processando ? undefined : onFechar}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-y-auto rounded-lg border border-line bg-surface p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">Gerar demos em lote</h2>
          {!processando && (
            <button
              type="button"
              onClick={onFechar}
              className="text-xs text-ink-muted hover:text-foreground"
            >
              Fechar
            </button>
          )}
        </div>

        {semDemo.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">
            Todos os leads deste grupo já têm demo — edite individualmente pela ficha.
          </p>
        ) : (
          <>
            <p className="mt-1 text-xs text-ink-muted">
              Cria a demo de cada lead selecionado com a mesma skin/tema/efeito/modo de imagem —
              render do Firestore, gratuito, não consome cota.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <select
                value={skinId}
                onChange={(event) => trocarSkin(event.target.value)}
                className={SELECT_CLASS}
                disabled={processando}
              >
                {SKINS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </select>
              <select
                value={themeId}
                onChange={(event) => setThemeId(event.target.value)}
                className={SELECT_CLASS}
                disabled={processando}
              >
                {skin?.themePresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.nome}
                  </option>
                ))}
              </select>
              <select
                value={efeitoId}
                onChange={(event) => setEfeitoId(event.target.value)}
                className={SELECT_CLASS}
                disabled={processando}
              >
                <option value="nenhum">Sem efeito de fundo</option>
                {EFEITOS.map((efeito) => (
                  <option key={efeito.id} value={efeito.id}>
                    {efeito.nome}
                  </option>
                ))}
              </select>
              <select
                value={imagensModo}
                onChange={(event) => setImagensModo(event.target.value as ImagensModo)}
                className={SELECT_CLASS}
                disabled={processando}
              >
                {IMAGENS_MODOS.map((modo) => (
                  <option key={modo} value={modo}>
                    {MODO_LABEL[modo]}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-ink-muted">
              <span>
                {alvos.length} de {semDemo.length} lead{semDemo.length === 1 ? "" : "s"} sem demo
                selecionado{alvos.length === 1 ? "" : "s"}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={processando}
                  onClick={() => setSelecionados(new Set(semDemo.map((l) => l.placeId)))}
                  className="font-medium text-accent hover:underline disabled:opacity-50"
                >
                  Selecionar todos
                </button>
                <button
                  type="button"
                  disabled={processando}
                  onClick={() => setSelecionados(new Set())}
                  className="font-medium text-accent hover:underline disabled:opacity-50"
                >
                  Limpar
                </button>
              </div>
            </div>

            <ul className="mt-2 flex max-h-40 flex-col gap-1 overflow-y-auto rounded border border-line p-2">
              {semDemo.map((lead) => {
                const resultado =
                  relatorio?.sucessos.find((r) => r.placeId === lead.placeId) ??
                  relatorio?.falhas.find((r) => r.placeId === lead.placeId);
                return (
                  <li key={lead.placeId} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={selecionados.has(lead.placeId)}
                      onChange={() => alternarSelecao(lead.placeId)}
                      disabled={processando}
                    />
                    <span className="min-w-0 flex-1 truncate text-ink-secondary">{lead.nome}</span>
                    {resultado && (
                      <span className={resultado.ok ? "text-good" : "text-critical"}>
                        {resultado.ok ? "✓" : `✗ ${resultado.erro}`}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>

            {processando && (
              <p className="mt-2 text-xs text-ink-muted">
                Processando {progresso}/{alvos.length}…
              </p>
            )}

            {relatorio && !processando && (
              <p className="mt-2 text-sm">
                <span className="text-good">{relatorio.sucessos.length} criada(s)</span>
                {relatorio.falhas.length > 0 && (
                  <span className="text-critical"> · {relatorio.falhas.length} falhou(aram)</span>
                )}
                {relatorio.cancelado && <span className="text-ink-muted"> · cancelado</span>}
              </p>
            )}

            <div className="mt-3 flex justify-end gap-2">
              {processando ? (
                <Button variant="secondary" onClick={cancelar}>
                  Cancelar
                </Button>
              ) : (
                <Button onClick={criarDemos} disabled={!skin || alvos.length === 0}>
                  Criar {alvos.length} demo{alvos.length === 1 ? "" : "s"}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
