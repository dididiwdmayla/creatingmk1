"use client";

import { useState } from "react";

import { Button } from "@/components/Button";
import { api } from "@/lib/api-client";
import { estadoVisivel } from "@/lib/demos/capturas/estado";
import type { Lead } from "@/lib/leads/types";

import { CapturaBadge } from "./CapturaBadge";
import { useEstadoCapturas } from "./useEstadoCapturas";

/**
 * Seção "Capturas" da ficha do lead: dispara a geração, mostra em que pé
 * ela está e (quando pronta) as imagens.
 *
 * O estado vem do doc do lead, perguntado de tempos em tempos pelo hook —
 * a execução roda num runner do GitHub e leva minutos, então nada aqui
 * depende de a aba ter ficado aberta desde o clique. Fechar e voltar
 * mostra o mesmo andamento.
 */
export function CapturasSecao({ lead }: { lead: Lead }) {
  const { mapa, agora, disponivel, carregado, recarregar } = useEstadoCapturas([lead.placeId]);
  const [disparando, setDisparando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Enquanto a primeira resposta não chega, vale o que veio com o lead —
  // assim a ficha não pisca "Sem capturas" num lead que já tem.
  const capturas = carregado ? (mapa[lead.placeId] ?? undefined) : lead.capturas;
  const visivel = estadoVisivel(capturas, agora);
  const temDemo = Boolean(lead.demo?.skinId);
  const rodando = visivel.acompanhar;

  function gerar(forcar: boolean) {
    setDisparando(true);
    setErro(null);
    setAviso(null);
    api
      .gerarCapturas(lead.placeId, forcar)
      .then((r) => {
        if (r.enfileirados.length > 0) {
          // Confirmação explícita: o botão nunca volta ao normal calado.
          setAviso("Geração enfileirada — leva alguns minutos.");
        } else {
          setAviso(`Nada a gerar: ${r.pulados[0]?.motivo ?? "lead sem demo"}.`);
        }
        recarregar();
      })
      .catch((e: unknown) => setErro(e instanceof Error ? e.message : "falha ao disparar"))
      .finally(() => setDisparando(false));
  }

  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Capturas</h2>
        <CapturaBadge capturas={capturas} agora={agora} />
      </div>

      {!temDemo ? (
        <p className="mt-2 text-xs text-ink-muted">
          Crie a demo primeiro — as capturas enquadram as seções dela.
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          <p className="text-xs text-ink-muted">
            Prints das seções marcadas da demo, em celular e desktop, prontos para mandar no
            WhatsApp. A geração roda fora do Radar e leva alguns minutos.
          </p>

          {visivel.estado === "falhou" && visivel.detalhe && (
            <p className="rounded border border-critical/40 bg-critical/10 px-3 py-2 text-xs text-critical">
              {visivel.detalhe}
              {capturas?.runUrl && (
                <>
                  {" "}
                  <a
                    href={capturas.runUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    ver o log da execução ↗
                  </a>
                </>
              )}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => gerar(rodando)}
              loading={disparando}
              disabled={disparando || !disponivel}
              variant={visivel.estado === "pronto" ? "secondary" : "primary"}
            >
              {rodando ? "Gerar de novo" : visivel.estado === "pronto" ? "Refazer" : "Gerar capturas"}
            </Button>
            {aviso && <span className="text-xs text-good">{aviso}</span>}
            {erro && <span className="text-xs text-critical">{erro}</span>}
          </div>

          {carregado && !disponivel && (
            <p className="text-xs text-ink-muted">
              Geração indisponível: falta configurar <code className="font-mono">GITHUB_CAPTURAS_TOKEN</code>{" "}
              no servidor.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
