"use client";

import { useState } from "react";

import { PainelColapsavel } from "@/components/config/PainelColapsavel";
import { INPUT_CLS } from "@/components/config/comum";
import type { PainelFormProps } from "@/components/config/tipos";
import { bandeiraDoPais, type PaisProspeccao } from "@/lib/prospeccao/paises";

/** Chave da persistência deste painel — ver `PainelColapsavel`. */
export const PAINEL_PAISES = "paises-prospeccao";

/** A lista curta que a tela "Onde prospectar agora" percorre. */
export function PainelPaisesProspeccao({ form, onChange }: PainelFormProps) {
  return (
    <PainelColapsavel
      id={PAINEL_PAISES}
      titulo="Países candidatos (tela Mundo)"
      resumo={`${form.paisesProspeccao.length} países`}
    >
      <p className="mt-1 text-xs text-ink-muted">
        A lista curta que a tela &ldquo;Onde prospectar agora&rdquo; percorre: o critério de
        entrada é o WhatsApp ser canal padrão de contato comercial por lá. O fuso decide a hora
        local do país (fuso padrão, sem horário de verão), os idiomas decidem a ordem da tela
        (português, inglês, espanhol, depois os demais) e o índice é o de partida — assim que
        uma cidade daquele país entra em /regioes, vale a média das cidades reais.
      </p>
      <PaisesProspeccaoEditor
        value={form.paisesProspeccao}
        onChange={(paisesProspeccao) => onChange({ ...form, paisesProspeccao })}
      />
    </PainelColapsavel>
  );
}

interface PaisRow {
  id: string;
  codigo: string;
  nome: string;
  /** Fuso em HORAS (o que se digita); vira minutos no patch. */
  horas: string;
  /** Idiomas separados por vírgula. */
  idiomas: string;
  indice: string;
}

/**
 * Editor da lista de países da tela Mundo. Como `PresetsEditor` e
 * `MultiplicadoresNichoEditor`: as linhas são rascunho local (dá pra
 * esvaziar um campo enquanto se digita) e o que sobe pro `form` é só o que
 * está completo. Linha incompleta não vira país meio pronto no doc — some
 * do patch até ficar preenchida, e a validação do servidor continua sendo
 * a palavra final.
 */
function PaisesProspeccaoEditor({
  value,
  onChange,
}: {
  value: PaisProspeccao[];
  onChange: (value: PaisProspeccao[]) => void;
}) {
  const [linhas, setLinhas] = useState<PaisRow[]>(() =>
    value.map((pais) => ({
      id: crypto.randomUUID(),
      codigo: pais.codigo,
      nome: pais.nome,
      horas: String(pais.utcOffsetMinutos / 60),
      idiomas: pais.idiomas.join(", "),
      indice: String(pais.indice),
    })),
  );

  function propagar(novas: PaisRow[]) {
    setLinhas(novas);
    onChange(
      novas
        .map((linha) => ({
          codigo: linha.codigo.trim().toUpperCase(),
          nome: linha.nome.trim(),
          utcOffsetMinutos: Math.round(Number(linha.horas) * 60),
          idiomas: linha.idiomas
            .split(",")
            .map((idioma) => idioma.trim())
            .filter(Boolean),
          indice: Number(linha.indice),
        }))
        .filter(
          (pais) =>
            pais.codigo.length === 2 &&
            pais.nome !== "" &&
            Number.isFinite(pais.utcOffsetMinutos) &&
            pais.idiomas.length > 0 &&
            Number.isFinite(pais.indice) &&
            pais.indice > 0,
        ),
    );
  }

  function atualizar(id: string, campo: keyof Omit<PaisRow, "id">, valor: string) {
    propagar(linhas.map((l) => (l.id === id ? { ...l, [campo]: valor } : l)));
  }

  return (
    <div className="mt-3 flex flex-col gap-3">
      {linhas.map((linha) => (
        <div key={linha.id} className="rounded border border-line bg-surface-2 p-2">
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-lg leading-none" aria-hidden="true">
              {linha.codigo.trim().length === 2 ? bandeiraDoPais(linha.codigo) : "🏳"}
            </span>
            <input
              value={linha.nome}
              onChange={(e) => atualizar(linha.id, "nome", e.target.value)}
              placeholder="País em português (ex.: Portugal)"
              aria-label="Nome do país"
              className={`${INPUT_CLS} min-w-0 flex-1`}
            />
            <button
              type="button"
              onClick={() => propagar(linhas.filter((l) => l.id !== linha.id))}
              className="shrink-0 text-xs text-critical hover:underline"
            >
              Remover
            </button>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-ink-muted">ISO</span>
              <input
                value={linha.codigo}
                onChange={(e) => atualizar(linha.id, "codigo", e.target.value)}
                maxLength={2}
                placeholder="PT"
                className={INPUT_CLS}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-ink-muted">UTC (h)</span>
              <input
                type="number"
                step={0.5}
                min={-12}
                max={14}
                value={linha.horas}
                onChange={(e) => atualizar(linha.id, "horas", e.target.value)}
                className={INPUT_CLS}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-ink-muted">Índice</span>
              <input
                type="number"
                step={0.1}
                min={0.1}
                value={linha.indice}
                onChange={(e) => atualizar(linha.id, "indice", e.target.value)}
                className={INPUT_CLS}
              />
            </label>
          </div>
          <label className="mt-2 flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-ink-muted">
              Idiomas (o primeiro manda na ordem)
            </span>
            <input
              value={linha.idiomas}
              onChange={(e) => atualizar(linha.id, "idiomas", e.target.value)}
              placeholder="pt-PT, es-ES"
              className={INPUT_CLS}
            />
          </label>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          propagar([
            ...linhas,
            { id: crypto.randomUUID(), codigo: "", nome: "", horas: "0", idiomas: "", indice: "1" },
          ])
        }
        className="self-start text-xs font-medium text-accent hover:underline"
      >
        + Adicionar país
      </button>
    </div>
  );
}
