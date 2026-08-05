"use client";

import Image from "next/image";

import { porAncora, type CapturaImagem } from "@/lib/demos/capturas/estado";

/**
 * As capturas prontas de um lead, agrupadas por âncora (a seção que virou
 * a imagem) e, dentro de cada uma, as duas telas.
 *
 * Cada imagem tem link direto para baixar. O objeto no Storage é gravado
 * com `Content-Disposition: attachment` (ver `subirParaStorage` em
 * scripts/capturas.mjs), então o clique salva o arquivo com nome bom em
 * vez de abrir uma aba — sem depender de configurar CORS no bucket, que é
 * o que um download por `fetch` no cliente exigiria.
 *
 * A miniatura é `unoptimized`: as imagens já saem do motor no tamanho e
 * na qualidade que vão para o WhatsApp, e passá-las pelo otimizador do
 * Next só gastaria transformação para reencodar o que já está pronto.
 */

const ROTULO_TELA: Record<string, string> = { celular: "Celular", desktop: "Desktop" };

export function GaleriaCapturas({
  imagens,
  nomeLead,
}: {
  imagens: CapturaImagem[];
  nomeLead: string;
}) {
  const grupos = porAncora(imagens);
  if (grupos.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {grupos.map((grupo) => (
        <div key={grupo.ancora}>
          <p className="mb-2 flex items-baseline gap-2 text-xs">
            <span className="font-mono text-ink-muted">
              {String(grupo.ordem).padStart(2, "0")}
            </span>
            <span className="font-medium text-ink-secondary">{grupo.ancora}</span>
          </p>
          <div className="flex flex-wrap gap-3">
            {(["celular", "desktop"] as const).map((tela) => {
              const img = grupo.telas[tela];
              if (!img) {
                // Uma tela pode faltar: a âncora reprovou no portão só
                // naquela largura (ex.: seção que não coube). Dizer isso é
                // melhor que um buraco silencioso na grade.
                return (
                  <p
                    key={tela}
                    className="w-40 rounded border border-dashed border-line px-3 py-6 text-center text-[11px] text-ink-muted"
                  >
                    {ROTULO_TELA[tela]} não saiu nesta rodada
                  </p>
                );
              }
              return (
                <figure key={tela} className="m-0 w-40">
                  <a
                    href={img.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block overflow-hidden rounded border border-line bg-surface-2 hover:border-accent/40"
                  >
                    <Image
                      src={img.url}
                      alt={`${nomeLead} — ${grupo.ancora} (${ROTULO_TELA[tela]})`}
                      width={img.largura}
                      height={img.altura}
                      unoptimized
                      className="h-auto w-full"
                    />
                  </a>
                  <figcaption className="mt-1 flex items-baseline justify-between gap-2 text-[11px]">
                    <span className="text-ink-muted">
                      {ROTULO_TELA[tela]} · {img.largura}×{img.altura}
                    </span>
                    <a href={img.url} download className="font-medium text-accent hover:underline">
                      Baixar
                    </a>
                  </figcaption>
                </figure>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
