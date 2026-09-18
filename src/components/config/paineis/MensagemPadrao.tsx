"use client";

import { PainelColapsavel } from "@/components/config/PainelColapsavel";
import type { PainelFormProps } from "@/components/config/tipos";

/** Chave da persistência deste painel — ver `PainelColapsavel`. */
export const PAINEL_MENSAGEM = "mensagem-padrao";

/** A mensagem global — o último degrau da precedência de `frases/resolver.ts`. */
export function PainelMensagemPadrao({ form, onChange }: PainelFormProps) {
  return (
    <PainelColapsavel
      id={PAINEL_MENSAGEM}
      titulo="Mensagem padrão"
      resumo={`${form.mensagemPadrao.length} caracteres`}
    >
      <p className="mt-1 text-xs text-ink-muted">
        Use <code className="font-mono">{"{nome}"}</code> para o nome do lead,{" "}
        <code className="font-mono">{"{demo}"}</code> para o link da demo personalizada e{" "}
        <code className="font-mono">{"{penetracao}"}</code> para a linha de argumento de
        penetração de site (só quando o lead não tem site próprio).
      </p>
      <textarea
        value={form.mensagemPadrao}
        onChange={(e) => onChange({ ...form, mensagemPadrao: e.target.value })}
        rows={4}
        className="mt-2 w-full rounded border border-line bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
      />
    </PainelColapsavel>
  );
}
