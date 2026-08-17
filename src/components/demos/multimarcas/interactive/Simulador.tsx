"use client";

import { useMemo, useState } from "react";

import { waHref } from "./logic";

/** Opções fixas do mecanismo do simulador — parte da MECÂNICA do widget, não conteúdo do lead. */
const VALOR_MIN = 60_000;
const VALOR_MAX = 400_000;
const VALOR_STEP = 5_000;
const ENTRADA_STEP = 1_000;
const ENTRADA_RATIO_MAX = 0.8;
const TAXA_JUROS_MENSAL = 1.49; // % a.m., taxa de referência exibida junto ao resultado
const PARCELAS_OPCOES = [24, 36, 48, 60];

function fmt(n: number): string {
  return Math.round(n).toLocaleString("pt-BR");
}

const DIGITOS = "0123456789".split("");

/** Uma coluna de dígito que desliza pro valor atual — fiel ao odômetro do material bruto. */
function DigitoOdometro({ digito }: { digito: string }) {
  const y = -(Number.parseInt(digito, 10) * 1.1);
  return (
    <span className="inline-block h-[1.1em] overflow-hidden align-top">
      <span
        className="block leading-[1.1em] transition-transform duration-[600ms] ease-[cubic-bezier(.2,.9,.25,1)]"
        style={{ transform: `translateY(${y}em)` }}
      >
        {DIGITOS.map((d) => (
          <span key={d} className="block h-[1.1em]">
            {d}
          </span>
        ))}
      </span>
    </span>
  );
}

export function Simulador({
  whatsapp,
  ctaLabel,
}: {
  whatsapp?: string;
  ctaLabel?: string;
}) {
  const [valor, setValor] = useState(120_000);
  const [entrada, setEntrada] = useState(24_000);
  const [parcelas, setParcelas] = useState(48);

  const entradaMax = Math.round(valor * ENTRADA_RATIO_MAX);

  const { pmtStr, financiadoFmt } = useMemo(() => {
    const taxa = TAXA_JUROS_MENSAL / 100;
    const financiado = Math.max(valor - entrada, 0);
    const pmt = financiado > 0 ? (financiado * taxa) / (1 - Math.pow(1 + taxa, -parcelas)) : 0;
    return { pmtStr: fmt(pmt), financiadoFmt: fmt(financiado) };
  }, [valor, entrada, parcelas]);

  const linkProposta = waHref(
    whatsapp,
    `Olá! Simulei no site: veículo R$ ${fmt(valor)}, entrada R$ ${fmt(entrada)}, ${parcelas}x de R$ ${pmtStr}. Quero uma proposta.`,
  );

  return (
    <div className="grid items-start gap-[22px] [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
      <div
        className="flex flex-col gap-[30px] border p-[clamp(24px,4vw,36px)]"
        style={{ background: "var(--d-bg-elev)", borderColor: "var(--d-border)", borderRadius: "var(--d-radius)" }}
      >
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="font-[family-name:var(--d-corpo)] text-[11px] font-semibold tracking-[2px] text-[var(--d-muted)]">
              VALOR DO VEÍCULO
            </span>
            <span className="font-[family-name:var(--d-mono)] text-2xl font-semibold tabular-nums text-[var(--d-text)]">
              R$ {fmt(valor)}
            </span>
          </div>
          <input
            type="range"
            min={VALOR_MIN}
            max={VALOR_MAX}
            step={VALOR_STEP}
            value={valor}
            onChange={(e) => {
              const v = Number(e.target.value);
              setValor(v);
              setEntrada((atual) => Math.min(atual, Math.round(v * ENTRADA_RATIO_MAX)));
            }}
            className="d-range w-full"
            style={
              {
                "--fill": `${(((valor - VALOR_MIN) / (VALOR_MAX - VALOR_MIN)) * 100).toFixed(1)}%`,
              } as React.CSSProperties
            }
          />
        </div>
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="font-[family-name:var(--d-corpo)] text-[11px] font-semibold tracking-[2px] text-[var(--d-muted)]">
              ENTRADA · {Math.round((entrada / valor) * 100)}%
            </span>
            <span className="font-[family-name:var(--d-mono)] text-2xl font-semibold tabular-nums text-[var(--d-text)]">
              R$ {fmt(entrada)}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={entradaMax}
            step={ENTRADA_STEP}
            value={entrada}
            onChange={(e) => setEntrada(Number(e.target.value))}
            className="d-range w-full"
            style={{ "--fill": `${((entrada / entradaMax) * 100).toFixed(1)}%` } as React.CSSProperties}
          />
        </div>
        <div>
          <p className="mb-3 font-[family-name:var(--d-corpo)] text-[11px] font-semibold tracking-[2px] text-[var(--d-muted)]">
            PARCELAS
          </p>
          <div className="flex gap-2">
            {PARCELAS_OPCOES.map((n) => {
              const ativo = n === parcelas;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setParcelas(n)}
                  className="d-press flex-1 rounded-lg border py-[13px] font-[family-name:var(--d-mono)] text-[15px] font-semibold tabular-nums transition-colors duration-300"
                  style={{
                    background: ativo ? "color-mix(in srgb, var(--d-accent) 8%, transparent)" : "transparent",
                    borderColor: ativo
                      ? "color-mix(in srgb, var(--d-accent) 55%, transparent)"
                      : "var(--d-border)",
                    color: ativo ? "var(--d-accent)" : "var(--d-muted)",
                  }}
                >
                  {n}×
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div
        className="flex flex-col gap-[18px] border p-[clamp(24px,4vw,36px)]"
        style={{
          background: "linear-gradient(160deg, var(--d-bg-alt), var(--d-bg-elev) 60%)",
          borderColor: "color-mix(in srgb, var(--d-accent) 30%, transparent)",
          borderRadius: "var(--d-radius)",
        }}
      >
        <p className="font-[family-name:var(--d-corpo)] text-[11px] font-semibold tracking-[2px] text-[var(--d-muted)]">
          PARCELA ESTIMADA
        </p>
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-[family-name:var(--d-mono)] text-xl font-semibold text-[var(--d-accent)]">R$</span>
          <span className="flex font-[family-name:var(--d-mono)] text-[clamp(48px,6.5vw,66px)] font-semibold leading-[1.1] tabular-nums tracking-[1px] text-[var(--d-text)]">
            {[...pmtStr].map((ch, i) =>
              /\d/.test(ch) ? (
                <DigitoOdometro key={i} digito={ch} />
              ) : (
                <span key={i} className="inline-block">
                  {ch}
                </span>
              ),
            )}
          </span>
          <span className="font-[family-name:var(--d-corpo)] text-base font-semibold text-[var(--d-muted)]">
            /mês
          </span>
        </div>
        <p className="font-[family-name:var(--d-corpo)] text-[13px] font-medium tabular-nums text-[var(--d-muted)]">
          Financiado: R$ {financiadoFmt} em {parcelas}× · taxa ref. {TAXA_JUROS_MENSAL.toFixed(2).replace(".", ",")}
          % a.m.
        </p>
        {linkProposta && (
        <a
          href={linkProposta}
          target="_blank"
          rel="noopener noreferrer"
          data-demo-slot="secoes.simulador.cta"
          className="d-press mt-1.5 block rounded-lg py-[17px] text-center font-[family-name:var(--d-corpo)] text-sm font-bold tracking-[1.5px]"
          style={{
            background: "var(--d-accent)",
            color: "var(--d-accent-ink)",
            boxShadow: "0 10px 26px color-mix(in srgb, var(--d-accent) 28%, transparent)",
          }}
        >
          {(ctaLabel ?? "Solicitar proposta").toUpperCase()}
        </a>
        )}
        <p className="font-[family-name:var(--d-corpo)] text-[11px] text-[var(--d-muted)]">
          Valores simulados, sujeitos a análise de crédito.
        </p>
      </div>
    </div>
  );
}
