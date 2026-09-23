"use client";

import { useState, type FormEvent } from "react";

import { microcopiaDemo } from "@/lib/demos/microcopy";
import { digitosWhatsapp, mensagemTroca, waHref, type CarroDaTroca } from "./logic";

/**
 * Formulário de TROCA — marca, modelo, ano e km viram a mensagem de
 * WhatsApp (docs/plano-multimarcas.md §5, "Troca com avaliação"; desenhado
 * pela composição `formulario` da avaliação, §6).
 *
 * Três regras do §7:
 *  - **Sem WhatsApp, não existe.** Um formulário que não envia para lugar
 *    nenhum é pior que nenhum: a seção fica com título, texto e marcas.
 *  - **Sem JavaScript, ainda envia.** É um `<form>` de verdade, `GET` para
 *    `wa.me/<número>` com o `text` genérico num campo oculto — os campos do
 *    carro não têm `name`, então não viram parâmetros que o wa.me ignoraria.
 *  - Com JavaScript, o envio monta a mensagem com o carro digitado.
 *
 * O rótulo do botão é o CTA da seção (conteúdo, slot
 * `secoes.avaliacao.cta`); os rótulos dos campos são cromo (microcópia).
 */
export function FormTroca({
  whatsapp,
  cta,
  marcas,
  idioma,
}: {
  whatsapp?: string;
  cta?: string;
  /** As marcas da seção (`secoes.avaliacao.itens`) — sugestões do campo marca. */
  marcas: readonly string[];
  idioma?: string;
}) {
  const m = microcopiaDemo(idioma);
  const [carro, setCarro] = useState<CarroDaTroca>({});
  const digitos = digitosWhatsapp(whatsapp);
  const rotulo = cta?.trim();
  if (!digitos || !rotulo) return null;

  const enviar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const href = waHref(whatsapp, mensagemTroca(carro, m, idioma));
    if (href) window.open(href, "_blank", "noopener,noreferrer");
  };

  const campo = (chave: keyof CarroDaTroca, rotuloCampo: string, extra: Record<string, string> = {}) => (
    <label className="mm-troca-campo flex flex-col gap-1.5">
      <span className="font-[family-name:var(--d-corpo)] text-[11px] font-semibold tracking-[2px] text-[var(--d-muted)]">
        {rotuloCampo.toUpperCase()}
      </span>
      <input
        {...extra}
        value={carro[chave] ?? ""}
        onChange={(e) => setCarro((c) => ({ ...c, [chave]: e.target.value }))}
        className="w-full rounded-lg border px-4 py-3 font-[family-name:var(--d-corpo)] text-[15px] text-[var(--d-text)] outline-none focus:border-[var(--d-accent)]"
        style={{ background: "var(--d-bg)", borderColor: "var(--d-border)" }}
      />
    </label>
  );

  return (
    <form
      action={`https://wa.me/${digitos}`}
      method="get"
      target="_blank"
      onSubmit={enviar}
      className="mm-troca grid gap-4 sm:grid-cols-2"
    >
      <input type="hidden" name="text" value={m.trocaMensagem} />
      {campo("marca", m.trocaMarca, { list: "mm-troca-marcas", autoComplete: "off" })}
      {campo("modelo", m.trocaModelo, { autoComplete: "off" })}
      {campo("ano", m.trocaAno, { inputMode: "numeric", maxLength: "4" })}
      {campo("km", m.trocaKm, { inputMode: "numeric" })}
      {marcas.length > 0 && (
        <datalist id="mm-troca-marcas">
          {marcas.map((marca) => (
            <option key={marca} value={marca} />
          ))}
        </datalist>
      )}
      <button
        type="submit"
        data-demo-slot="secoes.avaliacao.cta"
        className="d-press rounded-lg py-4 font-[family-name:var(--d-corpo)] text-sm font-bold tracking-[1.5px] sm:col-span-2"
        style={{ background: "var(--d-accent)", color: "var(--d-accent-ink)" }}
      >
        {rotulo.toUpperCase()}
      </button>
    </form>
  );
}
