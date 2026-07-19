"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ApiError, api } from "@/lib/api-client";
import { SKINS } from "@/lib/demos/registry";
import type { Lead } from "@/lib/leads/types";

/**
 * Passo de escolha da skin base, antes de criar a demo (ver Skin.tsx dos
 * templates + SkinDefinition.thumbnail): um card por skin registrada, com
 * miniatura e nome do nicho. Se o lead JÁ tem demo salva, o skin já foi
 * escolhido — pula direto pro editor (a troca de skin continua disponível
 * lá, na aba Tema).
 */
export function EscolherSkinClient({ id }: { id: string }) {
  const router = useRouter();
  const [lead, setLead] = useState<Lead | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    api
      .getLead(id)
      .then(({ lead: leadData }) => {
        if (ignore) return;
        if (leadData.demo) {
          router.replace(`/leads/${id}/demo/editar`);
          return;
        }
        setLead(leadData);
      })
      .catch((error) => {
        if (ignore) return;
        if (error instanceof ApiError && error.code === "not_found") setNotFound(true);
        else setErro(error instanceof ApiError ? error.message : "Falha ao carregar o lead.");
      });
    return () => {
      ignore = true;
    };
  }, [id, router]);

  if (notFound || erro) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background text-foreground">
        <p className="text-sm text-ink-muted">{notFound ? "Lead não encontrado." : erro}</p>
        <Link href="/leads" className="text-sm text-accent">
          Voltar para leads
        </Link>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <p className="text-sm text-ink-muted">Carregando…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center bg-background px-4 py-10 text-foreground">
      <div className="w-full max-w-4xl">
        <Link href={`/leads/${id}`} className="text-xs text-ink-muted hover:text-foreground">
          ← Ficha de {lead.nome}
        </Link>
        <h1 className="mt-3 text-xl font-semibold">Escolha o template da demo</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Cada skin é um site completo, com seções e tema próprios — dá pra trocar depois na aba
          Tema do editor, mas já sai daqui com uma base fiel ao nicho do negócio.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {SKINS.map((skin) => (
            <Link
              key={skin.id}
              href={`/leads/${id}/demo/editar?skin=${skin.id}`}
              className="group flex flex-col overflow-hidden rounded-lg border border-line bg-surface transition-colors hover:border-accent"
            >
              <span className="relative aspect-[4/3] w-full overflow-hidden bg-surface-2">
                <Image
                  src={skin.thumbnail}
                  alt={`Miniatura: ${skin.nome}`}
                  fill
                  unoptimized
                  className="object-cover transition-transform group-hover:scale-[1.03]"
                />
              </span>
              <span className="flex flex-col gap-1 p-4">
                <span className="text-[11px] font-medium uppercase tracking-wide text-accent">
                  {skin.nicho}
                </span>
                <span className="text-base font-semibold text-foreground">{skin.nome}</span>
                {skin.descricao && (
                  <span className="text-xs text-ink-muted">{skin.descricao}</span>
                )}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
