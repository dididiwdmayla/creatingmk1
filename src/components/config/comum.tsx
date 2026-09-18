"use client";

import { useState } from "react";

import { ApiError } from "@/lib/api-client";
import type { NivelContato } from "@/lib/leads/janelaContato";

/**
 * As peças de FORMULÁRIO compartilhadas entre painéis da /config — o que
 * mais de um painel usa e por isso não cabe no arquivo de nenhum deles.
 * Painel novo que precise de campo próprio declara o campo NO ARQUIVO DELE:
 * só sobe para cá o que um segundo painel passar a usar.
 */

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-ink-secondary">{label}</span>
      {children}
    </label>
  );
}

/**
 * Os tokens do campo SEM o tamanho do texto — separado porque a caixa do
 * rascunho (painel "Respostas pendentes") precisa do mesmo campo em
 * `text-xs`, para ficar na escala das mensagens que ela responde. Duas
 * classes de tamanho na mesma string dependeriam da ordem no CSS gerado,
 * não da ordem em que foram escritas.
 */
export const CAMPO_BASE_CLS =
  "w-full rounded border border-line bg-surface-2 px-3 py-2 text-foreground outline-none focus:border-accent";

export const INPUT_CLS = `${CAMPO_BASE_CLS} text-sm`;

/** Mensagem de erro com o `code` da API — sem isso, um 500 inesperado vira só "falha genérica". */
export function mensagemErroFila(error: unknown, fallback: string): string {
  return error instanceof ApiError ? `${fallback} (${error.code}): ${error.message}` : fallback;
}

/** Input controlado: vazio = sem limite (null), número = limite. Salva no blur. */
export function LimiteInput({
  valor,
  disabled,
  onSalvar,
}: {
  valor: number | undefined;
  disabled: boolean;
  onSalvar: (valor: number | null) => void;
}) {
  const [texto, setTexto] = useState(valor !== undefined ? String(valor) : "");
  // Ressincroniza quando o valor vem de fora (salvo com sucesso ou recarga)
  // — ajuste de estado durante a renderização, não em efeito (o valor pode
  // mudar sem esta instância ter disparado a mudança, ex.: outra aba).
  const [ultimoValor, setUltimoValor] = useState(valor);
  if (valor !== ultimoValor) {
    setUltimoValor(valor);
    setTexto(valor !== undefined ? String(valor) : "");
  }

  function commit() {
    const trimmed = texto.trim();
    if (trimmed === "") {
      if (valor !== undefined) onSalvar(null);
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
      setTexto(valor !== undefined ? String(valor) : ""); // inválido: reverte
      return;
    }
    if (n !== valor) onSalvar(n);
  }

  return (
    <input
      type="number"
      min={0}
      step={1}
      inputMode="numeric"
      value={texto}
      placeholder="∞"
      disabled={disabled}
      onChange={(event) => setTexto(event.target.value)}
      onBlur={commit}
      className="w-16 rounded border border-line bg-surface-2 px-2 py-1 text-center font-mono text-xs text-foreground outline-none focus:border-accent disabled:opacity-50"
    />
  );
}

/** Inteiro ≥ 0 (e ≤ `max`, quando informado). Salva no blur, como LimiteInput. */
export function FilaNumeroInput({
  valor,
  max,
  disabled,
  onSalvar,
}: {
  valor: number;
  max?: number;
  disabled: boolean;
  onSalvar: (valor: number) => void;
}) {
  const [texto, setTexto] = useState(String(valor));
  const [ultimoValor, setUltimoValor] = useState(valor);
  if (valor !== ultimoValor) {
    setUltimoValor(valor);
    setTexto(String(valor));
  }

  function commit() {
    const n = Number(texto.trim());
    if (
      !Number.isFinite(n) ||
      !Number.isInteger(n) ||
      n < 0 ||
      (max !== undefined && n > max)
    ) {
      setTexto(String(valor)); // inválido: reverte
      return;
    }
    if (n !== valor) onSalvar(n);
  }

  return (
    <input
      type="number"
      min={0}
      max={max}
      step={1}
      inputMode="numeric"
      value={texto}
      disabled={disabled}
      onChange={(event) => setTexto(event.target.value)}
      onBlur={commit}
      className="w-20 rounded border border-line bg-surface-2 px-2 py-1 text-center font-mono text-xs text-foreground outline-none focus:border-accent disabled:opacity-50"
    />
  );
}

/**
 * O número de destino do disparo de teste. Dígitos com DDI, vazio = disparo
 * desligado. Reverte o que não for dígito em vez de mandar ao servidor: a
 * validação de verdade está lá (`validateFilaConfigPatch`), mas o WhatsApp
 * do celular não resolve parêntese nem traço, e é melhor o campo dizer isso
 * na hora do que a mensagem falhar de madrugada.
 */
export function FilaNumeroTesteInput({
  valor,
  disabled,
  onSalvar,
}: {
  valor: string;
  disabled: boolean;
  onSalvar: (valor: string) => void;
}) {
  const [texto, setTexto] = useState(valor);
  const [ultimoValor, setUltimoValor] = useState(valor);
  if (valor !== ultimoValor) {
    setUltimoValor(valor);
    setTexto(valor);
  }

  function commit() {
    const limpo = texto.trim();
    if (limpo !== "" && !/^\d{10,15}$/.test(limpo)) {
      setTexto(valor); // inválido: reverte
      return;
    }
    if (limpo !== valor) onSalvar(limpo);
    else setTexto(valor);
  }

  return (
    <input
      inputMode="numeric"
      value={texto}
      placeholder="desligado"
      disabled={disabled}
      onChange={(event) => setTexto(event.target.value)}
      onBlur={commit}
      className="min-w-0 flex-1 rounded border border-line bg-surface-2 px-2 py-1 font-mono text-xs text-foreground outline-none focus:border-accent disabled:opacity-50"
    />
  );
}

/** Lista livre separada por vírgula. Vazio = nenhum nicho digitado = todos liberados. */
export function FilaNichosInput({
  valor,
  disabled,
  onSalvar,
}: {
  valor: string[];
  disabled: boolean;
  onSalvar: (valor: string[]) => void;
}) {
  const [texto, setTexto] = useState(valor.join(", "));
  const [ultimoValor, setUltimoValor] = useState(valor);
  if (valor !== ultimoValor) {
    setUltimoValor(valor);
    setTexto(valor.join(", "));
  }

  function commit() {
    const lista = texto
      .split(",")
      .map((n) => n.trim())
      .filter((n) => n.length > 0);
    if (JSON.stringify(lista) !== JSON.stringify(valor)) onSalvar(lista);
    else setTexto(lista.join(", ")); // normaliza espaçamento sem round-trip
  }

  return (
    <input
      value={texto}
      placeholder="todos"
      disabled={disabled}
      onChange={(event) => setTexto(event.target.value)}
      onBlur={commit}
      className="min-w-0 flex-1 rounded border border-line bg-surface-2 px-2 py-1 text-xs text-foreground outline-none focus:border-accent disabled:opacity-50"
    />
  );
}

/**
 * Rótulo e cor por nível de janela de contato — compartilhados pelo selo
 * da visão da fila e pelo editor de faixas, para os dois falarem a mesma
 * língua da barra do dia da ficha.
 */
export const NIVEL_LABEL: Record<NivelContato, string> = {
  bom: "bom",
  razoavel: "razoável",
  ruim: "ruim",
};

/**
 * Cor + preenchimento por nível, o mesmo par usado na barra do dia da ficha
 * (`components/BarraDoDia.tsx`) — quem edita aqui vê a mesma linguagem que
 * vai aparecer lá.
 */
export const NIVEL_CLS: Record<NivelContato, string> = {
  bom: "border-good/60 bg-good/20 text-good",
  razoavel: "border-warning/60 bg-warning/20 text-warning",
  ruim: "border-critical/60 bg-critical/20 text-critical",
};
