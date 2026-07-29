"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { ApiError, api } from "@/lib/api-client";
import { DEFAULT_CONFIG, type AppConfig } from "@/lib/config";
import { formatBRL, formatDateTime } from "@/lib/format";
import {
  SLIDER_MAX_BRL,
  SLIDER_MIN_BRL,
  SLIDER_STEP_BRL,
  calcularIndiceEfetivo,
  calcularPrecoSugerido,
  converterMoedaLocal,
  multiplicadorParaNicho,
} from "@/lib/precificacao/calc";
import type { RegiaoIndice } from "@/lib/regioes";

const CONFIANCA_LABEL: Record<RegiaoIndice["confianca"], string> = {
  alta: "Confiança alta",
  media: "Confiança média",
  baixa: "Confiança baixa",
};

const CONFIANCA_CLASS: Record<RegiaoIndice["confianca"], string> = {
  alta: "text-good",
  media: "text-warning",
  baixa: "text-ink-muted",
};

function formatMoedaLocal(valor: number, moeda: string): string {
  return `${valor.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} ${moeda}`;
}

/** Debounce simples: persiste a posição do slider só depois de parar de arrastar. */
function useDebouncedCallback(fn: (valor: number) => void, delayMs: number) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return (valor: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(valor), delayMs);
  };
}

/**
 * Card "Precificação": slider de preço-base + cálculo ao vivo do preço
 * sugerido (índice da região × multiplicador do nicho, com piso), em BRL
 * e na moeda local da região. Usado na ficha do lead e no grupo de busca
 * — quem chama só precisa passar nicho + texto da região (o mesmo usado
 * na busca/geocoding).
 */
export function PrecificacaoCard({
  nicho,
  regiaoTexto,
}: {
  nicho: string;
  regiaoTexto: string | undefined;
}) {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [isAdmin, setIsAdmin] = useState(false);
  const [regiaoData, setRegiaoData] = useState<RegiaoIndice | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [regenerando, setRegenerando] = useState(false);

  const [precoBase, setPrecoBase] = useState(2000);
  const [editandoAjuste, setEditandoAjuste] = useState(false);
  const [valorAjuste, setValorAjuste] = useState("");
  const [ajusteErro, setAjusteErro] = useState<string | null>(null);
  const [salvandoAjuste, setSalvandoAjuste] = useState(false);

  const persistirSlider = useDebouncedCallback((valor) => {
    api.putPrecoBaseSlider(valor).catch(() => {
      // Cortesia de UI — se falhar, o slider continua funcionando localmente.
    });
  }, 500);

  useEffect(() => {
    let ignore = false;
    Promise.all([api.getConfig(), api.me(), api.getPrecoBaseSlider()])
      .then(([{ config: cfg }, { usuario }, { precoBase: salvo }]) => {
        if (ignore) return;
        setConfig(cfg);
        setIsAdmin(usuario.papel === "admin");
        if (salvo !== null) setPrecoBase(salvo);
      })
      .catch(() => {
        // Config/usuário/slider indisponíveis não bloqueiam o cálculo — os
        // defaults locais cobrem (multiplicador 1.0, piso R$900 etc.).
      });
    return () => {
      ignore = true;
    };
  }, []);

  // Reaproveita a instância entre trocas de região SEM remontar (o chamador
  // não é obrigado a passar `key={regiaoTexto}`) — por isso a busca de
  // novos dados também zera erro/dados antigos, tudo dentro do .then/.catch
  // (nunca setState síncrono no corpo do efeito).
  useEffect(() => {
    if (!regiaoTexto?.trim()) return;
    let ignore = false;
    api
      .getRegiaoIndice(regiaoTexto)
      .then(({ regiao }) => {
        if (ignore) return;
        setRegiaoData(regiao);
        setErro(null);
      })
      .catch((error) => {
        if (ignore) return;
        setRegiaoData(null);
        setErro(
          error instanceof ApiError
            ? `Não foi possível calcular o índice da região (${error.code}): ${error.message}`
            : "Não foi possível calcular o índice da região.",
        );
      })
      .finally(() => {
        if (!ignore) setCarregando(false);
      });
    return () => {
      ignore = true;
    };
  }, [regiaoTexto]);

  const calculo = useMemo(() => {
    if (!regiaoData) return null;
    const indiceEfetivo = calcularIndiceEfetivo(
      regiaoData.indice,
      regiaoData.indiceAjustado,
      config.precificacao.fatorMinimoIndice,
    );
    const multiplicador = multiplicadorParaNicho(nicho, config.precificacao.multiplicadoresNicho);
    const precoSugerido = calcularPrecoSugerido(
      precoBase,
      indiceEfetivo,
      multiplicador,
      config.precificacao.pisoPrecificacao,
    );
    const precoLocal = converterMoedaLocal(precoSugerido, regiaoData.cambioAproxBRL);
    return { indiceEfetivo, multiplicador, precoSugerido, precoLocal };
  }, [regiaoData, config, nicho, precoBase]);

  function mudarSlider(valor: number) {
    setPrecoBase(valor);
    persistirSlider(valor);
  }

  async function regenerar() {
    if (!regiaoTexto) return;
    setRegenerando(true);
    setErro(null);
    try {
      const { regiao } = await api.regenerarRegiaoIndice(regiaoTexto);
      setRegiaoData(regiao);
    } catch (error) {
      setErro(error instanceof ApiError ? error.message : "Falha ao regenerar o índice.");
    } finally {
      setRegenerando(false);
    }
  }

  function abrirEdicaoAjuste() {
    setValorAjuste(String(regiaoData?.indiceAjustado ?? regiaoData?.indice ?? ""));
    setAjusteErro(null);
    setEditandoAjuste(true);
  }

  async function salvarAjuste() {
    if (!regiaoTexto) return;
    const numero = Number(valorAjuste.replace(",", "."));
    if (!Number.isFinite(numero) || numero <= 0) {
      setAjusteErro("Informe um número maior que zero.");
      return;
    }
    setSalvandoAjuste(true);
    setAjusteErro(null);
    try {
      const { regiao } = await api.ajustarIndiceRegiao(regiaoTexto, numero);
      setRegiaoData(regiao);
      setEditandoAjuste(false);
    } catch (error) {
      setAjusteErro(error instanceof ApiError ? error.message : "Falha ao salvar o ajuste.");
    } finally {
      setSalvandoAjuste(false);
    }
  }

  async function limparAjuste() {
    if (!regiaoTexto) return;
    setSalvandoAjuste(true);
    setAjusteErro(null);
    try {
      const { regiao } = await api.ajustarIndiceRegiao(regiaoTexto, null);
      setRegiaoData(regiao);
      setEditandoAjuste(false);
    } catch (error) {
      setAjusteErro(error instanceof ApiError ? error.message : "Falha ao limpar o ajuste.");
    } finally {
      setSalvandoAjuste(false);
    }
  }

  if (!regiaoTexto?.trim()) return null;

  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        Precificação
      </h2>

      {carregando && (
        <p className="mt-1 text-xs text-ink-muted">Calculando índice de mercado da região…</p>
      )}
      {erro && <p className="mt-1 text-xs text-critical">{erro}</p>}

      {!carregando && regiaoData && calculo && (
        <div className="mt-2 flex flex-col gap-2">
          <p className="text-xs text-ink-muted">
            {regiaoData.cidade}, {regiaoData.pais} ·{" "}
            <span className={CONFIANCA_CLASS[regiaoData.confianca]}>
              {CONFIANCA_LABEL[regiaoData.confianca]}
            </span>
          </p>

          <div className="flex flex-wrap gap-1.5">
            {config.precificacao.presets.map((preset) => (
              <button
                key={preset.nome}
                type="button"
                onClick={() => mudarSlider(preset.valorBRL)}
                className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  precoBase === preset.valorBRL
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-line text-ink-secondary hover:border-accent/40"
                }`}
              >
                {preset.nome} · {formatBRL(preset.valorBRL)}
              </button>
            ))}
          </div>

          <label className="flex flex-col gap-1">
            <span className="flex items-center justify-between text-xs text-ink-secondary">
              <span>Preço-base</span>
              <span className="font-medium text-foreground">{formatBRL(precoBase)}</span>
            </span>
            <input
              type="range"
              min={SLIDER_MIN_BRL}
              max={SLIDER_MAX_BRL}
              step={SLIDER_STEP_BRL}
              value={precoBase}
              onChange={(event) => mudarSlider(Number(event.target.value))}
              className="w-full accent-[var(--accent)]"
            />
          </label>

          <div className="rounded border border-line bg-surface-2 p-2.5">
            <p className="text-xs text-ink-muted">Preço sugerido</p>
            <p className="text-lg font-semibold text-foreground">
              {formatBRL(calculo.precoSugerido)}
            </p>
            {calculo.precoLocal !== undefined && (
              <p className="text-xs text-ink-muted">
                ≈ {formatMoedaLocal(calculo.precoLocal, regiaoData.moedaLocal)}{" "}
                <span className="italic">(estimado)</span>
              </p>
            )}
          </div>

          <p className="text-xs text-ink-secondary">
            Faixa de mercado local: <strong className="text-foreground">{regiaoData.faixaMercadoLocal}</strong>
          </p>
          <p className="text-xs text-ink-muted">{regiaoData.justificativa}</p>

          {isAdmin && (
            <div className="flex flex-col gap-1.5 border-t border-line/60 pt-2">
              <p className="text-[10px] text-ink-muted">
                Índice gerado: {regiaoData.indice.toFixed(2)}
                {regiaoData.indiceAjustado !== undefined && (
                  <> · Índice ajustado: {regiaoData.indiceAjustado.toFixed(2)} (vale este)</>
                )}{" "}
                · Gerado em {formatDateTime(regiaoData.geradoEm)}
              </p>
              {editandoAjuste ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step="0.1"
                    value={valorAjuste}
                    onChange={(event) => setValorAjuste(event.target.value)}
                    className="w-20 rounded border border-line bg-surface-2 px-2 py-1 text-xs text-foreground outline-none focus:border-accent"
                  />
                  <button
                    type="button"
                    disabled={salvandoAjuste}
                    onClick={salvarAjuste}
                    className="text-xs font-medium text-accent hover:underline disabled:opacity-50"
                  >
                    Salvar
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditandoAjuste(false)}
                    className="text-xs text-ink-muted hover:underline"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={abrirEdicaoAjuste}
                    className="text-xs font-medium text-accent hover:underline"
                  >
                    Editar índice
                  </button>
                  {regiaoData.indiceAjustado !== undefined && (
                    <button
                      type="button"
                      disabled={salvandoAjuste}
                      onClick={limparAjuste}
                      className="text-xs text-ink-muted hover:underline disabled:opacity-50"
                    >
                      Limpar ajuste
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={regenerando}
                    onClick={regenerar}
                    className="text-xs text-ink-muted hover:underline disabled:opacity-50"
                  >
                    {regenerando ? "Regenerando…" : "Regenerar com IA"}
                  </button>
                </div>
              )}
              {ajusteErro && <p className="text-xs text-critical">{ajusteErro}</p>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
