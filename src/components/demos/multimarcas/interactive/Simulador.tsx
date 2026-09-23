"use client";

import { useEffect, useMemo, useState } from "react";

import { simboloMoeda } from "@/lib/demos/precos";
import { IDIOMA_PADRAO } from "@/lib/idioma";
import type { DemoServico } from "@/lib/demos/types";
import { EVENTO_SIMULAR, faixaDoSimulador, formatarInteiro, parcelaMensal, waHref } from "./logic";

/**
 * Opções fixas do mecanismo do simulador — parte da MECÂNICA do widget, não
 * conteúdo do lead. A FAIXA do valor não está aqui: ela vem do estoque
 * (`faixaDoSimulador`), senão o carro mais barato ficava fora do slider.
 */
const ENTRADA_RATIO_MAX = 0.8;
const ENTRADA_RATIO_INICIAL = 0.2;
const TAXA_JUROS_MENSAL = 1.49; // % a.m., taxa de referência exibida junto ao resultado
const PARCELAS_OPCOES = [24, 36, 48, 60];

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
  telefone,
  ctaLabel,
  servicos,
  idioma,
  moeda,
}: {
  whatsapp?: string;
  /** Sem WhatsApp, o CTA liga para cá (`tel:`); sem os dois, não há botão (§7). */
  telefone?: string;
  ctaLabel?: string;
  /** O estoque: dele sai a faixa do slider e o valor de partida. */
  servicos: readonly DemoServico[];
  idioma?: string;
  moeda?: string;
}) {
  const faixa = faixaDoSimulador(servicos);
  const passoEntrada = Math.max(1, faixa.passo / 5);
  const entradaDe = (v: number) => Math.round((v * ENTRADA_RATIO_INICIAL) / passoEntrada) * passoEntrada;
  const [valor, setValor] = useState(faixa.inicial);
  const [entrada, setEntrada] = useState(() => entradaDe(faixa.inicial));
  const [parcelas, setParcelas] = useState(48);

  const fmt = (n: number) => formatarInteiro(n, idioma);
  const simbolo = simboloMoeda(idioma, moeda);
  const entradaMax = Math.round(valor * ENTRADA_RATIO_MAX);

  // "Simular este carro" (card do estoque): o valor do carro chega por
  // evento, porque o estoque e o simulador são seções independentes.
  useEffect(() => {
    const simular = (e: Event) => {
      const alvo = Number((e as CustomEvent<number>).detail);
      if (!Number.isFinite(alvo)) return;
      // O preço EXATO do carro, não o passo mais próximo: "simular este
      // carro" que mostra 40.000 para um carro de 39.900 é outra conta. O
      // slider só se alinha ao passo quando a pessoa o arrasta.
      const v = Math.min(faixa.max, Math.max(faixa.min, alvo));
      setValor(v);
      setEntrada(entradaDe(v));
    };
    window.addEventListener(EVENTO_SIMULAR, simular);
    return () => window.removeEventListener(EVENTO_SIMULAR, simular);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faixa.min, faixa.max, faixa.passo]);

  const { pmtStr, financiadoFmt } = useMemo(() => {
    const financiado = Math.max(valor - entrada, 0);
    const pmt = parcelaMensal(financiado, TAXA_JUROS_MENSAL, parcelas);
    return { pmtStr: formatarInteiro(pmt, idioma), financiadoFmt: formatarInteiro(financiado, idioma) };
  }, [valor, entrada, parcelas, idioma]);

  const telDigitos = telefone?.replace(/[^\d+]/g, "");
  const linkProposta =
    waHref(
      whatsapp,
      `Olá! Simulei no site: veículo ${simbolo} ${fmt(valor)}, entrada ${simbolo} ${fmt(entrada)}, ${parcelas}x de ${simbolo} ${pmtStr}. Quero uma proposta.`,
    ) ?? (telDigitos ? `tel:${telDigitos}` : undefined);
  const externo = linkProposta?.startsWith("https:");

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
              {simbolo} {fmt(valor)}
            </span>
          </div>
          <input
            type="range"
            min={faixa.min}
            max={faixa.max}
            step={faixa.passo}
            value={valor}
            onChange={(e) => {
              const v = Number(e.target.value);
              setValor(v);
              setEntrada((atual) => Math.min(atual, Math.round(v * ENTRADA_RATIO_MAX)));
            }}
            className="d-range w-full"
            style={
              {
                "--fill": `${(((valor - faixa.min) / (faixa.max - faixa.min)) * 100).toFixed(1)}%`,
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
              {simbolo} {fmt(entrada)}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={entradaMax}
            step={passoEntrada}
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
          <span className="font-[family-name:var(--d-mono)] text-xl font-semibold text-[var(--d-accent)]">{simbolo}</span>
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
          Financiado: {simbolo} {financiadoFmt} em {parcelas}× · taxa ref.{" "}
          {TAXA_JUROS_MENSAL.toLocaleString(idioma ?? IDIOMA_PADRAO, { minimumFractionDigits: 2 })}
          % a.m.
        </p>
        {linkProposta && (
        <a
          href={linkProposta}
          {...(externo && { target: "_blank", rel: "noopener noreferrer" })}
          data-demo-slot="secoes.simulador.cta"
          className="d-press mt-1.5 block rounded-lg py-[17px] text-center font-[family-name:var(--d-corpo)] text-sm font-bold tracking-[1.5px]"
          style={{
            background: "var(--d-accent)",
            color: "var(--d-accent-ink)",
            boxShadow: "0 10px 26px color-mix(in srgb, var(--d-accent) 28%, transparent)",
          }}
        >
          {(ctaLabel?.trim() || "Solicitar proposta").toUpperCase()}
        </a>
        )}
        <p className="font-[family-name:var(--d-corpo)] text-[11px] text-[var(--d-muted)]">
          Valores simulados, sujeitos a análise de crédito.
        </p>
      </div>
    </div>
  );
}
