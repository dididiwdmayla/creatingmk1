"use client";

import { estadoVisivel, type LeadCapturas } from "@/lib/demos/capturas/estado";
import { formatDateTime } from "@/lib/format";

/**
 * Selo do estado da geração de capturas de um lead: enfileirado, rodando,
 * pronto ou falhou.
 *
 * Nunca só cor — cada estado carrega palavra e marcador, mesma regra do
 * `UsageMeter` e dos status de lead (ver "Paleta" no ARCHITECTURE). Um
 * operador que não distingue verde de vermelho continua sabendo o que
 * aconteceu.
 */

/**
 * Marcadores escolhidos POR CAPTURA, não por simetria com o funil de
 * status: os glifos de círculo parcial (◔/◑) que o `StatusBadge` usa saem
 * nesta fonte como lascas sem o contorno do círculo, e a 12px leem como um
 * cisco em vez de "andando" — o marcador de status funciona lá porque
 * aparece numa sequência que dá o contexto, e aqui ele aparece sozinho.
 */
const MARCADOR: Record<string, string> = {
  nunca: "○",
  enfileirado: "⋯",
  rodando: "↻",
  pronto: "●",
  falhou: "✗",
};

const COR: Record<string, string> = {
  nunca: "text-ink-muted",
  enfileirado: "text-ink-secondary",
  rodando: "text-accent",
  pronto: "text-good",
  falhou: "text-critical",
};

export function CapturaBadge({
  capturas,
  agora,
  compacto = false,
}: {
  capturas: LeadCapturas | undefined;
  /** Instante da última leitura (ver useEstadoCapturas) — nunca `Date.now()` no render. */
  agora: number;
  compacto?: boolean;
}) {
  const visivel = estadoVisivel(capturas, agora);
  // O detalhe do estado "pronto" é o horário de geração — formatado aqui
  // porque só a UI sabe o fuso de quem está lendo.
  const detalhe =
    visivel.estado === "pronto" && visivel.detalhe
      ? `gerado em ${formatDateTime(visivel.detalhe)}`
      : visivel.detalhe;

  return (
    <span className={`inline-flex items-baseline gap-1.5 text-xs ${COR[visivel.estado]}`}>
      <span aria-hidden>{MARCADOR[visivel.estado]}</span>
      <span className="font-medium">{visivel.rotulo}</span>
      {!compacto && detalhe && (
        <span className="text-ink-muted">
          <span aria-hidden>·</span> {detalhe}
        </span>
      )}
    </span>
  );
}
