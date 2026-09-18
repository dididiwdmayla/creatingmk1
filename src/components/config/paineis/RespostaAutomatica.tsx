"use client";

import { PainelColapsavel } from "@/components/config/PainelColapsavel";
import { FilaNumeroInput } from "@/components/config/comum";
import type { FilaConfig } from "@/lib/fila/config";

/** Chave da persistência deste bloco — ver `PainelColapsavel`. */
export const PAINEL_RESPOSTA_AUTOMATICA = "fila-resposta-automatica";

/** Os números do ritmo humano da resposta — ver `FilaConfig`. */
const RESPOSTA_CAMPOS_NUMERO: Array<{
  campo: keyof Pick<
    FilaConfig,
    | "respostaDelayMinSegundos"
    | "respostaDelayMaxSegundos"
    | "respostaJanelaInicio"
    | "respostaJanelaFim"
    | "respostasAutomaticasMaxDia"
  >;
  label: string;
  max?: number;
  sufixo?: string;
}> = [
  { campo: "respostaDelayMinSegundos", label: "Atraso mínimo", sufixo: "s" },
  { campo: "respostaDelayMaxSegundos", label: "Atraso máximo", sufixo: "s" },
  { campo: "respostaJanelaInicio", label: "Janela — início", max: 23, sufixo: "h" },
  { campo: "respostaJanelaFim", label: "Janela — fim", max: 23, sufixo: "h" },
  { campo: "respostasAutomaticasMaxDia", label: "Máximo de respostas/dia" },
];

/**
 * Bloco subordinado ao painel "Fila de envio" (`<h3>` "Resposta
 * automática"), ao lado da visão, do disparo de teste e da lista de print.
 *
 * Mora AQUI, e não na seção "Respostas pendentes" ao lado, porque estes
 * campos são o mesmo doc `/config/fila` que o painel acima já carrega e
 * salva — uma segunda seção editando o mesmo documento seriam dois donos da
 * mesma escrita, capazes de sobrescrever um ao outro. O que a seção de
 * respostas mostra é o EFEITO do interruptor (a lista encurta), e ela recebe
 * isso da própria rota dela.
 *
 * Os dois interruptores são interruptores de verdade: `respostaAutomatica`
 * liga o mecanismo (padrão desligado) e `respostaAutomaticaApenasPrimeira`
 * limita à primeira resposta de cada lead (padrão ligado). Nenhum dos dois é
 * constante no código.
 */
export function RespostaAutomaticaBloco({
  config,
  ocupado,
  onSalvar,
}: {
  config: FilaConfig;
  ocupado: string | null;
  onSalvar: (patch: Partial<FilaConfig>, chave: string) => void;
}) {
  return (
    <PainelColapsavel
      id={PAINEL_RESPOSTA_AUTOMATICA}
      titulo="Resposta automática"
      nivel={3}
      dataBloco="resposta-automatica"
      resumo={
        config.respostaAutomatica
          ? `Ligada · ${config.respostaAutomaticaApenasPrimeira ? "só a primeira" : "todas"} · até ${config.respostasAutomaticasMaxDia}/dia`
          : "Desligada"
      }
      acoes={
        <button
          type="button"
          onClick={() => onSalvar({ respostaAutomatica: !config.respostaAutomatica }, "respostaAutomatica")}
          disabled={ocupado === "respostaAutomatica"}
          aria-pressed={config.respostaAutomatica}
          title={
            config.respostaAutomatica
              ? "Desligar — os rascunhos voltam a esperar aprovação no painel"
              : "Ligar — o rascunho vira tarefa de envio na fila do aparelho"
          }
          className={`shrink-0 rounded px-2 py-1 text-xs font-semibold disabled:opacity-50 ${
            config.respostaAutomatica ? "bg-good/15 text-good" : "bg-surface-2 text-ink-muted"
          }`}
        >
          {config.respostaAutomatica ? "Ligada ✓" : "Desligada"}
        </button>
      }
    >
      <p className="mt-1 text-xs text-ink-muted">
        Ligada, o rascunho da IA deixa de esperar aprovação e vira tarefa de envio para o aparelho.
        Desligar não descarta nada: os rascunhos voltam para “Respostas pendentes”.
      </p>

      <div className="mt-3 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs text-ink-secondary">
          <span className="w-48 shrink-0">Só a primeira resposta</span>
          <button
            type="button"
            onClick={() =>
              onSalvar(
                { respostaAutomaticaApenasPrimeira: !config.respostaAutomaticaApenasPrimeira },
                "respostaAutomaticaApenasPrimeira",
              )
            }
            disabled={ocupado === "respostaAutomaticaApenasPrimeira"}
            aria-pressed={config.respostaAutomaticaApenasPrimeira}
            className={`rounded border px-2 py-1 text-xs disabled:opacity-50 ${
              config.respostaAutomaticaApenasPrimeira
                ? "border-accent bg-accent/15 text-accent"
                : "border-line bg-surface-2 text-ink-muted"
            }`}
          >
            {config.respostaAutomaticaApenasPrimeira ? "sim" : "não"}
          </button>
        </div>
        <p className="text-xs text-ink-muted">
          Com “sim”, da segunda mensagem do mesmo lead em diante o rascunho volta para a aprovação
          manual.
        </p>

        {RESPOSTA_CAMPOS_NUMERO.map(({ campo, label, max, sufixo }) => (
          <div key={campo} className="flex items-center gap-2 text-xs text-ink-secondary">
            <span className="w-48 shrink-0">{label}</span>
            <FilaNumeroInput
              valor={config[campo]}
              max={max}
              disabled={ocupado === campo}
              onSalvar={(valor) => onSalvar({ [campo]: valor }, campo)}
            />
            {sufixo && <span className="text-ink-muted">{sufixo}</span>}
          </div>
        ))}
        <p className="text-xs text-ink-muted">
          O atraso é sorteado dentro da faixa, a cada resposta — responder na hora é a assinatura
          mais óbvia de robô. A janela é o horário DAQUI (São Paulo), não o do lead: fora dela a
          resposta espera a abertura seguinte. O teto do dia é próprio, e não consome a meta de
          prospecção.
        </p>
      </div>
    </PainelColapsavel>
  );
}
