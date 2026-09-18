"use client";

import { useState } from "react";

import { PainelColapsavel } from "@/components/config/PainelColapsavel";
import type { PainelFormProps } from "@/components/config/tipos";
import { Field, INPUT_CLS } from "@/components/config/comum";
import type { PresetPrecificacao } from "@/lib/config";
import { formatBRL } from "@/lib/format";
import { SLIDER_MAX_BRL, SLIDER_MIN_BRL, SLIDER_STEP_BRL } from "@/lib/precificacao/calc";

/** Chave da persistência deste painel — ver `PainelColapsavel`. */
export const PAINEL_PRECIFICACAO = "precificacao";

/** Os parâmetros da calculadora do card "Precificação" (ficha e grupo). */
export function PainelPrecificacao({ form, onChange }: PainelFormProps) {
  const nichos = Object.keys(form.precificacao.multiplicadoresNicho).length;

  return (
    <PainelColapsavel
      id={PAINEL_PRECIFICACAO}
      titulo="Precificação"
      resumo={`piso ${formatBRL(form.precificacao.pisoPrecificacao)} · ${nichos} nichos · ${form.precificacao.presets.length} presets`}
    >
      <p className="mt-1 text-xs text-ink-muted">
        Parâmetros da calculadora do card &quot;Precificação&quot; (ficha do lead e grupo de
        busca): preço sugerido = preço-base × índice efetivo da região × multiplicador do
        nicho, nunca abaixo do piso.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Field label="Piso (R$)">
          <input
            type="number"
            min={0}
            step={1}
            value={form.precificacao.pisoPrecificacao}
            onChange={(e) =>
              onChange({
                ...form,
                precificacao: {
                  ...form.precificacao,
                  pisoPrecificacao: Number(e.target.value) || 0,
                },
              })
            }
            className={INPUT_CLS}
          />
        </Field>
        <Field label="Fator mínimo do índice">
          <input
            type="number"
            min={0.01}
            step={0.05}
            value={form.precificacao.fatorMinimoIndice}
            onChange={(e) =>
              onChange({
                ...form,
                precificacao: {
                  ...form.precificacao,
                  fatorMinimoIndice: Number(e.target.value) || 0,
                },
              })
            }
            className={INPUT_CLS}
          />
        </Field>
      </div>
      <p className="mt-1 text-xs text-ink-muted">
        Regiões baratas reduzem o preço em no máximo (1 − fator mínimo); regiões caras (índice
        &gt; 1) sobem sem teto.
      </p>

      <div className="mt-4">
        <h3 className="text-xs font-medium text-ink-secondary">Multiplicador por nicho</h3>
        <p className="mt-1 text-xs text-ink-muted">
          Nicho sem entrada aqui usa multiplicador 1.0 (neutro).
        </p>
        <MultiplicadoresNichoEditor
          value={form.precificacao.multiplicadoresNicho}
          onChange={(multiplicadoresNicho) =>
            onChange({ ...form, precificacao: { ...form.precificacao, multiplicadoresNicho } })
          }
        />
      </div>

      <div className="mt-4">
        <h3 className="text-xs font-medium text-ink-secondary">Presets do slider</h3>
        <p className="mt-1 text-xs text-ink-muted">
          Atalhos que reposicionam o preço-base no card de precificação.
        </p>
        <PresetsEditor
          value={form.precificacao.presets}
          onChange={(presets) =>
            onChange({ ...form, precificacao: { ...form.precificacao, presets } })
          }
        />
      </div>
    </PainelColapsavel>
  );
}

interface NichoRow {
  id: string;
  nicho: string;
  multiplicador: string;
}

function linhasIniciais(value: Record<string, number>): NichoRow[] {
  return Object.entries(value).map(([nicho, multiplicador]) => ({
    id: crypto.randomUUID(),
    nicho,
    multiplicador: String(multiplicador),
  }));
}

/**
 * Lista chave-valor livre (nicho → multiplicador). Estado local em linhas
 * (com id estável pra key do React, já que a chave em si é editável);
 * sincroniza para `onChange` como Record a cada edição, ignorando linhas
 * com nicho vazio (rascunho ainda sendo digitado).
 */
function MultiplicadoresNichoEditor({
  value,
  onChange,
}: {
  value: Record<string, number>;
  onChange: (value: Record<string, number>) => void;
}) {
  const [linhas, setLinhas] = useState<NichoRow[]>(() => linhasIniciais(value));

  function propagar(novas: NichoRow[]) {
    setLinhas(novas);
    const record: Record<string, number> = {};
    for (const linha of novas) {
      const nome = linha.nicho.trim();
      const numero = Number(linha.multiplicador);
      if (nome && Number.isFinite(numero) && numero > 0) record[nome] = numero;
    }
    onChange(record);
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      {linhas.map((linha) => (
        <div key={linha.id} className="flex items-center gap-2">
          <input
            value={linha.nicho}
            onChange={(e) =>
              propagar(
                linhas.map((l) => (l.id === linha.id ? { ...l, nicho: e.target.value } : l)),
              )
            }
            placeholder="ex.: dentista"
            className={`${INPUT_CLS} flex-1`}
          />
          <input
            type="number"
            min={0}
            step={0.05}
            value={linha.multiplicador}
            onChange={(e) =>
              propagar(
                linhas.map((l) =>
                  l.id === linha.id ? { ...l, multiplicador: e.target.value } : l,
                ),
              )
            }
            className="w-24 rounded border border-line bg-surface-2 px-2 py-2 text-sm text-foreground outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={() => propagar(linhas.filter((l) => l.id !== linha.id))}
            className="shrink-0 text-xs text-critical hover:underline"
          >
            Remover
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          propagar([...linhas, { id: crypto.randomUUID(), nicho: "", multiplicador: "1" }])
        }
        className="self-start text-xs font-medium text-accent hover:underline"
      >
        + Adicionar nicho
      </button>
    </div>
  );
}

interface PresetRow {
  id: string;
  nome: string;
  valorBRL: string;
}

/** Presets do slider (nome + valor em BRL) — mesmo padrão de edição em linhas do editor acima. */
function PresetsEditor({
  value,
  onChange,
}: {
  value: PresetPrecificacao[];
  onChange: (value: PresetPrecificacao[]) => void;
}) {
  const [linhas, setLinhas] = useState<PresetRow[]>(() =>
    value.map((preset) => ({
      id: crypto.randomUUID(),
      nome: preset.nome,
      valorBRL: String(preset.valorBRL),
    })),
  );

  function propagar(novas: PresetRow[]) {
    setLinhas(novas);
    onChange(
      novas
        .map((linha) => ({ nome: linha.nome.trim(), valorBRL: Number(linha.valorBRL) }))
        .filter((preset) => preset.nome && Number.isFinite(preset.valorBRL) && preset.valorBRL > 0),
    );
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      {linhas.map((linha) => (
        <div key={linha.id} className="flex items-center gap-2">
          <input
            value={linha.nome}
            onChange={(e) =>
              propagar(linhas.map((l) => (l.id === linha.id ? { ...l, nome: e.target.value } : l)))
            }
            placeholder="ex.: Vitrine"
            className={`${INPUT_CLS} flex-1`}
          />
          <input
            type="number"
            min={SLIDER_MIN_BRL}
            max={SLIDER_MAX_BRL}
            step={SLIDER_STEP_BRL}
            value={linha.valorBRL}
            onChange={(e) =>
              propagar(
                linhas.map((l) => (l.id === linha.id ? { ...l, valorBRL: e.target.value } : l)),
              )
            }
            className="w-28 rounded border border-line bg-surface-2 px-2 py-2 text-sm text-foreground outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={() => propagar(linhas.filter((l) => l.id !== linha.id))}
            className="shrink-0 text-xs text-critical hover:underline"
          >
            Remover
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          propagar([...linhas, { id: crypto.randomUUID(), nome: "", valorBRL: "1000" }])
        }
        className="self-start text-xs font-medium text-accent hover:underline"
      >
        + Adicionar preset
      </button>
    </div>
  );
}
