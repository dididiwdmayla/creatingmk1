"use client";

import { useState, type FormEvent } from "react";

import { RadarSweep } from "@/components/RadarSweep";
import { ApiError, api } from "@/lib/api-client";

export default function LoginPage() {
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setErro(null);
    try {
      await api.login(nome, senha);
      // A fila do dia é a home pós-login (o painel continua em /).
      window.location.href = "/hoje";
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
        className="page-transition w-full max-w-xs rounded-lg border border-line bg-surface p-6"
      >
        <div className="flex items-center gap-3">
          <RadarSweep size={40} />
          <div>
            <h1 className="font-display text-2xl font-bold tracking-[0.05em] text-foreground">
              RADAR
            </h1>
            <p className="text-xs text-ink-muted">Prospecção de leads locais</p>
          </div>
        </div>

        <label htmlFor="nome" className="mt-6 block text-sm text-ink-secondary">
          Usuário
        </label>
        <input
          id="nome"
          autoFocus
          autoComplete="username"
          placeholder="ex.: admin"
          value={nome}
          onChange={(event) => setNome(event.target.value)}
          className="mt-1.5 w-full rounded border border-line bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
        />

        <label htmlFor="senha" className="mt-4 block text-sm text-ink-secondary">
          Senha
        </label>
        <input
          id="senha"
          type="password"
          autoComplete="current-password"
          value={senha}
          onChange={(event) => setSenha(event.target.value)}
          className="mt-1.5 w-full rounded border border-line bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
        />

        {erro && <p className="mt-3 text-sm text-critical">{erro}</p>}

        <button
          type="submit"
          disabled={loading || senha.length === 0 || nome.trim().length === 0}
          className="mt-5 w-full rounded bg-accent px-3 py-2 text-sm font-semibold text-accent-ink transition-all hover:bg-accent/90 hover:-translate-y-px hover:shadow-[0_6px_16px_-6px_var(--accent)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
        >
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
