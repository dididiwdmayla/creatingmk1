"use client";

import { useState } from "react";

/**
 * Captação de e-mail — fiel ao original: submit "fake" (`state = {
 * enviado: false }`, `onSubmit` só troca o estado local pra mostrar o
 * agradecimento, sem request de verdade). A demo é uma prévia visual, não
 * um backend de newsletter; nenhum dado é enviado a lugar nenhum.
 */
export function ContatoFormClient({ label }: { label: string }) {
  const [enviado, setEnviado] = useState(false);

  if (enviado) {
    return (
      <p
        className="inline-block rounded-full px-[34px] py-[18px] text-[17px] font-semibold"
        style={{ backgroundColor: "var(--d-accent-3)", color: "var(--d-bg)" }}
      >
        Recebido! A próxima curadoria chega até sexta. ✳
      </p>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setEnviado(true);
      }}
      className="mx-auto flex w-full max-w-[560px] items-center gap-[10px] rounded-full border-2 py-2 pl-[26px] pr-2"
      style={{ borderColor: "var(--d-text)", backgroundColor: "var(--d-bg)" }}
    >
      <input
        type="email"
        required
        placeholder="seu@email.com"
        className="min-w-0 flex-1 border-none bg-transparent py-3 text-[17px] outline-none"
        style={{ color: "var(--d-text)" }}
      />
      <button
        type="submit"
        data-cta
        className="d-cta-pill d-arrow-cta"
      >
        {label}
        <span className="d-arrow-cta-tail">&nbsp;→</span>
      </button>
    </form>
  );
}
