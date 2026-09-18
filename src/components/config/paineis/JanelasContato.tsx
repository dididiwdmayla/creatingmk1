"use client";

import { useState } from "react";

import { BarraFaixasPreview } from "@/components/BarraDoDia";
import { PainelColapsavel } from "@/components/config/PainelColapsavel";
import { NIVEL_CLS, NIVEL_LABEL } from "@/components/config/comum";
import type { PainelFormProps } from "@/components/config/tipos";
import {
  FAMILIAS_JANELA_CONTATO,
  NIVEIS_CONTATO,
  ROTULO_FAMILIA,
  type FaixaNivelContato,
  type FamiliaJanelaContato,
  type HoraMinuto,
} from "@/lib/leads/janelaContato";

/** Chave da persistência deste painel — ver `PainelColapsavel`. */
export const PAINEL_JANELAS = "janelas-contato";

/** A tabela determinística que pinta a barra do dia na ficha do lead. */
export function PainelJanelasContato({ form, onChange }: PainelFormProps) {
  // Família cujo dia nenhum tem faixa marcada não é opinião gravada: vale
  // "razoável" o dia inteiro. O resumo conta só as que alguém de fato
  // configurou.
  const comFaixa = FAMILIAS_JANELA_CONTATO.filter((familia) =>
    Object.values(form.janelasContato[familia]?.dias ?? {}).some((faixas) => faixas.length > 0),
  ).length;

  return (
    <PainelColapsavel
      id={PAINEL_JANELAS}
      titulo="Faixas de contato por família"
      resumo={`${comFaixa} de ${FAMILIAS_JANELA_CONTATO.length} famílias`}
    >
      <p className="mt-1 text-xs text-ink-muted">
        Três níveis — bom, razoável e ruim — ao longo do dia, por família de negócio e por dia da
        semana. Determinístico: nenhuma IA gera horário aqui. É esta tabela que pinta a barra do
        dia na ficha do lead, sempre recortada pelo horário de funcionamento e na hora local
        dele. Trecho aberto sem faixa marcada vale &ldquo;razoável&rdquo;.
      </p>
      <div className="mt-3 flex flex-col gap-3">
        {FAMILIAS_JANELA_CONTATO.map((familiaId) => (
          <JanelaFamiliaEditor
            key={familiaId}
            familiaId={familiaId}
            valor={form.janelasContato[familiaId]}
            onChange={(valor) =>
              onChange({
                ...form,
                janelasContato: { ...form.janelasContato, [familiaId]: valor },
              })
            }
          />
        ))}
      </div>
    </PainelColapsavel>
  );
}

// Segunda primeiro (semana de trabalho), domingo por último — mesma ordem
// de leitura de `resumirHorarios` (lib/leads/horarios.ts).
const DIAS_SEMANA_ORDEM: Array<{ dia: number; abrev: string }> = [
  { dia: 1, abrev: "SEG" },
  { dia: 2, abrev: "TER" },
  { dia: 3, abrev: "QUA" },
  { dia: 4, abrev: "QUI" },
  { dia: 5, abrev: "SEX" },
  { dia: 6, abrev: "SÁB" },
  { dia: 0, abrev: "DOM" },
];


/** Dias úteis que o botão "aplicar a seg–qui" preenche de uma vez. */
const DIAS_UTEIS = [1, 2, 3, 4];


/** "9h30" ↔ "09:30" — HoraMinuto guarda hora/minuto separados; <input type="time"> quer "HH:MM". */
function horaMinutoParaInputTime(valor: HoraMinuto): string {
  return `${String(valor.hora).padStart(2, "0")}:${String(valor.minuto).padStart(2, "0")}`;
}

function inputTimeParaHoraMinuto(valor: string): HoraMinuto | null {
  const [horaTexto, minutoTexto] = valor.split(":");
  const hora = Number(horaTexto);
  const minuto = Number(minutoTexto);
  if (!Number.isInteger(hora) || !Number.isInteger(minuto)) return null;
  return { hora, minuto };
}

function ordenarFaixas(faixas: FaixaNivelContato[]): FaixaNivelContato[] {
  return [...faixas].sort(
    (a, b) => a.inicio.hora * 60 + a.inicio.minuto - (b.inicio.hora * 60 + b.inicio.minuto),
  );
}

/** Uma faixa do dia: início, fim e o nível em três botões (sem select). */
function FaixaNivelEditor({
  faixa,
  onChange,
  onRemover,
}: {
  faixa: FaixaNivelContato;
  onChange: (faixa: FaixaNivelContato) => void;
  onRemover: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="time"
        aria-label="início"
        value={horaMinutoParaInputTime(faixa.inicio)}
        onChange={(e) => {
          const novo = inputTimeParaHoraMinuto(e.target.value);
          if (novo) onChange({ ...faixa, inicio: novo });
        }}
        className="rounded border border-line bg-surface-2 px-2 py-1.5 text-sm text-foreground outline-none focus:border-accent"
      />
      <span className="text-xs text-ink-muted">até</span>
      <input
        type="time"
        aria-label="fim"
        value={horaMinutoParaInputTime(faixa.fim)}
        onChange={(e) => {
          const novo = inputTimeParaHoraMinuto(e.target.value);
          if (novo) onChange({ ...faixa, fim: novo });
        }}
        className="rounded border border-line bg-surface-2 px-2 py-1.5 text-sm text-foreground outline-none focus:border-accent"
      />
      <div className="flex gap-1">
        {NIVEIS_CONTATO.map((nivel) => (
          <button
            key={nivel}
            type="button"
            aria-pressed={faixa.nivel === nivel}
            onClick={() => onChange({ ...faixa, nivel })}
            className={`rounded border px-2 py-1 text-[11px] font-medium ${
              faixa.nivel === nivel
                ? NIVEL_CLS[nivel]
                : "border-line bg-surface-2 text-ink-muted hover:text-foreground"
            }`}
          >
            {NIVEL_LABEL[nivel]}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onRemover}
        aria-label="remover faixa"
        className="ml-auto text-xs text-ink-muted hover:text-critical"
      >
        remover
      </button>
    </div>
  );
}

/**
 * Uma família: os 7 dias como abas (o dia selecionado é o que se edita) e,
 * dentro do dia, as faixas de nível. Dia sem faixa nenhuma é um dia
 * DESMARCADO — o que estiver aberto vale "razoável", que é o neutro; não
 * existe quarto nível.
 */
function JanelaFamiliaEditor({
  familiaId,
  valor,
  onChange,
}: {
  familiaId: string;
  valor: FamiliaJanelaContato;
  onChange: (valor: FamiliaJanelaContato) => void;
}) {
  const [diaAtivo, setDiaAtivo] = useState(1);
  const faixas = ordenarFaixas(valor.dias[diaAtivo] ?? []);

  function trocarDia(dia: number, lista: FaixaNivelContato[]) {
    onChange({ ...valor, dias: { ...valor.dias, [dia]: ordenarFaixas(lista) } });
  }

  return (
    <div className="rounded border border-line p-3">
      <p className="text-sm font-medium text-foreground">{ROTULO_FAMILIA[familiaId] ?? familiaId}</p>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {DIAS_SEMANA_ORDEM.map(({ dia, abrev }) => {
          const doDia = valor.dias[dia] ?? [];
          const ativo = dia === diaAtivo;
          return (
            <button
              key={dia}
              type="button"
              aria-pressed={ativo}
              title={doDia.length === 0 ? "desmarcado" : `${doDia.length} faixa(s)`}
              onClick={() => setDiaAtivo(dia)}
              className={`rounded border px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide ${
                ativo
                  ? "border-accent bg-accent/15 text-accent"
                  : doDia.length > 0
                    ? "border-line bg-surface-2 text-foreground"
                    : "border-line bg-surface-2 text-ink-muted"
              }`}
            >
              {abrev}
              <span className="ml-1 font-sans font-normal normal-case">
                {doDia.length === 0 ? "—" : doDia.length}
              </span>
            </button>
          );
        })}
      </div>

      <BarraFaixasPreview faixas={faixas} className="mt-2" />

      <div className="mt-2 flex flex-col gap-2">
        {faixas.length === 0 && (
          <p className="text-xs text-ink-muted">
            Dia desmarcado — o expediente inteiro vale &ldquo;razoável&rdquo;.
          </p>
        )}
        {faixas.map((faixa, i) => (
          <FaixaNivelEditor
            key={i}
            faixa={faixa}
            onChange={(nova) => trocarDia(diaAtivo, faixas.map((f, j) => (j === i ? nova : f)))}
            onRemover={() => trocarDia(diaAtivo, faixas.filter((_, j) => j !== i))}
          />
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() =>
            trocarDia(diaAtivo, [
              ...faixas,
              {
                inicio: { hora: 9, minuto: 0 },
                fim: { hora: 11, minuto: 0 },
                nivel: "bom",
              },
            ])
          }
          className="text-xs font-medium text-accent hover:underline"
        >
          + Adicionar faixa
        </button>
        <button
          type="button"
          onClick={() => {
            const dias = { ...valor.dias };
            for (const dia of DIAS_UTEIS) dias[dia] = faixas.map((f) => ({ ...f }));
            onChange({ ...valor, dias });
          }}
          className="text-xs text-ink-muted hover:text-foreground"
        >
          aplicar a seg–qui
        </button>
      </div>
    </div>
  );
}
