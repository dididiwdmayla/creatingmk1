"use client";

import { useState } from "react";

/**
 * Captura de e-mail fiel ao original: pílula com input + botão, que vira
 * uma confirmação ao enviar. A demo não tem backend de verdade (é uma
 * prévia), então o envio é só local — mesmo espírito neutro do `OrderCta`
 * das outras skins (nenhuma chamada de rede, nenhum dado do lead
 * necessário além do texto do botão). Placeholder/confirmação são chrome
 * fixo do template (como o "ROLE" da lancheria), não conteúdo do negócio.
 */
export function NewsletterForm({ ctaTexto }: { ctaTexto: string }) {
  const [enviado, setEnviado] = useState(false);

  if (enviado) {
    return (
      <p className="d-cta inline-block rounded-full px-8 py-4 text-base font-semibold">
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
      className="d-newsletter-form mx-auto inline-flex w-full max-w-[560px] items-center gap-2.5 rounded-full border-2 p-2 pl-6"
    >
      <input
        type="email"
        required
        placeholder="seu@email.com"
        className="min-w-0 flex-1 border-none bg-transparent py-3 font-[family-name:var(--d-corpo)] text-base text-[var(--d-text)] outline-none placeholder:text-[var(--d-text)]/40"
      />
      <button type="submit" data-demo-slot="secoes.contato.cta" className="d-cta group inline-flex items-center gap-0 rounded-full px-7 py-4 text-base font-semibold">
        {ctaTexto}
        <span className="ml-0 inline-block w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-300 group-hover:ml-2 group-hover:w-4 group-hover:opacity-100">
          →
        </span>
      </button>
    </form>
  );
}
