"use client";

import { useState, type FormEvent } from "react";

import { ApiError, api } from "@/lib/api-client";

export default function LoginPage() {
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setErro(null);
    try {
      await api.login(senha);
      window.location.href = "/";
    } catch (error) {
      setErro(
        error instanceof ApiError
          ? error.message
          : "Não foi possível entrar. Tente novamente.",
      );
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-xs rounded-lg border border-line bg-surface p-6"
      >
        <h1 className="font-mono text-sm font-semibold tracking-[0.2em] text-ink-secondary">
          RADAR
        </h1>
        <p className="mt-1 text-xs text-ink-muted">Prospecção de leads locais</p>

        <label htmlFor="senha" className="mt-6 block text-sm text-ink-secondary">
          Senha
        </label>
        <input
          id="senha"
          type="password"
          autoFocus
          autoComplete="current-password"
          value={senha}
          onChange={(event) => setSenha(event.target.value)}
          className="mt-1.5 w-full rounded border border-line bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
        />

        {erro && <p className="mt-3 text-sm text-critical">{erro}</p>}

        <button
          type="submit"
          disabled={loading || senha.length === 0}
          className="mt-5 w-full rounded bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
