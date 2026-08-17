"use client";

import { useState } from "react";

import { Button } from "@/components/Button";
import { api } from "@/lib/api-client";
import { formatAlvo } from "@/lib/demos/capturas/alvo.mjs";
import { estadoVisivel, type LeadCapturas } from "@/lib/demos/capturas/estado";

import { CapturaBadge } from "./CapturaBadge";
import { GaleriaCapturas } from "./GaleriaCapturas";
import { useEstadoCapturas } from "./useEstadoCapturas";

/**
 * Seção "Capturas": dispara a geração, mostra em que pé ela está e (quando
 * pronta) as imagens.
 *
 * Serve as duas famílias de demo — a de um lead (na ficha) e a AVULSA (no
 * editor dela). O que muda é só o ALVO: um id cru é lead, `avulsa:<id>` é
 * demo avulsa (ver lib/demos/capturas/alvo.mjs). Estado, fila, motor e
 * galeria são os mesmos.
 *
 * O estado vem do doc do próprio registro, perguntado de tempos em tempos
 * pelo hook — a execução roda num runner do GitHub e leva minutos, então
 * nada aqui depende de a aba ter ficado aberta desde o clique. Fechar e
 * voltar mostra o mesmo andamento.
 */
export function CapturasSecao({
  id,
  nome,
  temDemo,
  capturasIniciais,
  avulsa = false,
}: {
  /** Place ID do lead, ou UUID da demo avulsa. */
  id: string;
  /** Nome do negócio — vai no nome dos arquivos baixados. */
  nome: string;
  /** Já existe demo salva? Sem ela não há seção pra enquadrar. */
  temDemo: boolean;
  /** O `capturas` que veio junto do registro, pra tela não piscar "sem capturas". */
  capturasIniciais?: LeadCapturas;
  avulsa?: boolean;
}) {
  const alvo = formatAlvo(id, avulsa);
  const { mapa, agora, disponivel, carregado, recarregar } = useEstadoCapturas([alvo]);
  const [disparando, setDisparando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Enquanto a primeira resposta não chega, vale o que veio com o registro
  // — assim a tela não pisca "Sem capturas" em quem já tem.
  const capturas = carregado ? (mapa[alvo] ?? undefined) : capturasIniciais;
  const visivel = estadoVisivel(capturas, agora);
  const rodando = visivel.acompanhar;

  function gerar(forcar: boolean) {
    setDisparando(true);
    setErro(null);
    setAviso(null);
    // A rota de LOTE serve as duas famílias porque recebe o alvo já
    // prefixado — um caminho só, em vez de um `if` escolhendo entre duas
    // rotas que fazem exatamente a mesma coisa.
    api
      .gerarCapturasLote([alvo], forcar)
      .then((r) => {
        if (r.enfileirados.length > 0) {
          // Confirmação explícita: o botão nunca volta ao normal calado.
          setAviso("Geração enfileirada — leva alguns minutos.");
        } else {
          setAviso(`Nada a gerar: ${r.pulados[0]?.motivo ?? "sem demo salva"}.`);
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

          {/* As imagens prontas ficam ACIMA do botão: quando há resultado,
              olhar e baixar é o que o operador vem fazer aqui; refazer é a
              exceção. */}
          {visivel.estado === "pronto" && capturas?.imagens && (
            <GaleriaCapturas
              imagens={capturas.imagens}
              nomeLead={nome}
              leadId={id}
              avulsa={avulsa}
              previa={capturas.previa}
            />
          )}

          {/* Rodada parcial: algumas âncoras saíram, outras reprovaram no
              portão. O aviso evita o operador contar 4 onde esperava 6 e
              não saber por quê. */}
          {visivel.estado === "pronto" && capturas?.erro && (
            <p className="rounded border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
              {capturas.erro}
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
