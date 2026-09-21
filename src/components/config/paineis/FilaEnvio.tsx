"use client";

import { useEffect, useState } from "react";

import { SkeletonRows } from "@/components/Skeleton";
import { PainelColapsavel } from "@/components/config/PainelColapsavel";
import {
  FilaNichosInput,
  FilaNumeroDigitosInput,
  FilaNumeroInput,
  mensagemErroFila,
} from "@/components/config/comum";
import { DisparoTeste } from "@/components/config/paineis/DisparoTeste";
import { PrintPendenteLista } from "@/components/config/paineis/PrintPendente";
import { RespostaAutomaticaBloco } from "@/components/config/paineis/RespostaAutomatica";
import { VisaoFila } from "@/components/config/paineis/VisaoFila";
import { ApiError, api, type FilaDiagnosticoResponse } from "@/lib/api-client";
import type { FilaConfig } from "@/lib/fila/config";
import { formatInt } from "@/lib/format";
import type { LinhaFilaPainel } from "@/lib/fila/estado";

/** Chave da persistência deste painel — ver `PainelColapsavel`. */
export const PAINEL_FILA = "fila-envio";

const FILA_CAMPOS_NUMERO: Array<{
  campo: keyof Pick<
    FilaConfig,
    | "metaDiaria"
    | "tetoPorHora"
    | "intervaloMinimoSegundos"
    | "retencaoEnvioHoras"
    | "inicioDiaOperacionalHora"
  >;
  label: string;
  max?: number;
  sufixo?: string;
}> = [
  { campo: "metaDiaria", label: "Meta diária" },
  { campo: "tetoPorHora", label: "Teto por hora" },
  { campo: "intervaloMinimoSegundos", label: "Intervalo mínimo", sufixo: "s" },
  { campo: "retencaoEnvioHoras", label: "Retenção sem confirmação", sufixo: "h" },
  { campo: "inicioDiaOperacionalHora", label: "Início do dia operacional", max: 23, sufixo: "h" },
];

/**
 * Painel "Fila de envio" (admin): estado e tetos que o celular (MacroDroid)
 * consulta antes de puxar o próximo lead — ver "Fila de envio" no
 * ARCHITECTURE.md. Mesmo padrão de MetasUsuariosSection acima (seção
 * autocontida: busca e salva sozinha, cada campo no seu próprio blur/clique
 * — sem botão "salvar" geral). `ativo` é o botão de pausa: o rótulo mostra
 * o estado atual sem precisar clicar, e o clique já aplica (sem confirmação
 * — pausar/retomar a fila é reversível na hora).
 */
export function FilaEnvioSection() {
  const [config, setConfig] = useState<FilaConfig | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  // Sobe a cada config salva: o funil e as listas abaixo dependem dela
  // (exigirJanelaBoa e nichosPermitidos mudam quem é elegível AGORA).
  const [versaoConfig, setVersaoConfig] = useState(0);
  // Os leads que a visão já carregou, emprestados ao disparo de teste como
  // atalho de escolha de alvo. Vêm de lá em vez de uma segunda chamada: o
  // funil e as listas saem da MESMA `ordenarCandidatos`, e recalculá-las
  // aqui seriam duas respostas capazes de discordar entre si.
  const [leadsDaVisao, setLeadsDaVisao] = useState<LinhaFilaPainel[]>([]);
  /**
   * O contador do dia, emprestado da visão pelo mesmo motivo (e pelo mesmo
   * caminho) dos leads acima: é o que a linha de resumo do cabeçalho
   * FECHADO mostra, e ele já foi lido ali.
   */
  const [contador, setContador] = useState<FilaDiagnosticoResponse["contador"] | null>(null);

  useEffect(() => {
    let ignore = false;
    api
      .getFilaConfig()
      .then(({ fila }) => {
        if (!ignore) setConfig(fila);
      })
      .catch((error) => {
        if (ignore) return;
        setErro(
          error instanceof ApiError && error.status === 403
            ? "Fila de envio é restrita ao admin."
            : mensagemErroFila(error, "Falha ao carregar a fila"),
        );
      });
    return () => {
      ignore = true;
    };
  }, []);

  async function salvar(patch: Partial<FilaConfig>, chave: string) {
    setOcupado(chave);
    setErro(null);
    try {
      const { fila } = await api.putFilaConfig(patch);
      setConfig(fila);
      setVersaoConfig((n) => n + 1);
    } catch (error) {
      setErro(mensagemErroFila(error, "Falha ao salvar"));
    } finally {
      setOcupado(null);
    }
  }

  /**
   * O estado do interruptor mais o andamento do dia — o par que decide se
   * vale abrir. O contador vem da VISÃO (ela é quem lê o diagnóstico), pelo
   * mesmo empréstimo que já entrega os leads ao disparo de teste: o número
   * já está na página, e buscá-lo de novo aqui seriam duas respostas
   * capazes de discordar entre si.
   */
  const resumo =
    config === null
      ? undefined
      : `${config.ativo ? "Ativa" : "Pausada"}${
          contador
            ? ` · ${formatInt(contador.enviados)}/${formatInt(contador.meta)} hoje`
            : ""
        }`;

  if (erro && config === null) {
    return (
      <PainelColapsavel id={PAINEL_FILA} titulo="Fila de envio" resumo="restrito">
        <p className="mt-2 text-sm text-ink-muted">{erro}</p>
      </PainelColapsavel>
    );
  }

  return (
    <PainelColapsavel
      id={PAINEL_FILA}
      titulo="Fila de envio"
      resumo={resumo}
      acoes={
        config && (
          <button
            type="button"
            onClick={() => salvar({ ativo: !config.ativo }, "ativo")}
            disabled={ocupado === "ativo"}
            title={
              config.ativo
                ? "Pausar a fila — o celular para de receber leads novos"
                : "Retomar a fila"
            }
            className={`shrink-0 rounded px-2 py-1 text-xs font-semibold disabled:opacity-50 ${
              config.ativo ? "bg-good/15 text-good" : "bg-critical/15 text-critical"
            }`}
          >
            {config.ativo ? "Ativa ✓" : "Pausada ⏸"}
          </button>
        )
      }
    >
      <p className="mt-1 text-xs text-ink-muted">
        Estado e tetos que o celular consulta antes de puxar o próximo lead. Com a fila pausada,
        nenhum envio sai.
      </p>

      {config === null && !erro && (
        <SkeletonRows count={1} className="mt-3 h-32 rounded border border-line" />
      )}

      {config && (
        <div className="mt-3 flex flex-col gap-2">
          {FILA_CAMPOS_NUMERO.map(({ campo, label, max, sufixo }) => (
            <div key={campo} className="flex items-center gap-2 text-xs text-ink-secondary">
              <span className="w-48 shrink-0">{label}</span>
              <FilaNumeroInput
                valor={config[campo]}
                max={max}
                disabled={ocupado === campo}
                onSalvar={(valor) => salvar({ [campo]: valor }, campo)}
              />
              {sufixo && <span className="text-ink-muted">{sufixo}</span>}
            </div>
          ))}

          <p className="text-xs text-ink-muted">
            Retenção: lead cuja reserva venceu sem o aparelho confirmar nada fica fora da fila
            por essas horas — na dúvida entre não mandar e mandar duas vezes, não manda. Falha
            REPORTADA não retém (essa segue as 3 tentativas). 0 desliga.
          </p>

          <div className="flex items-center gap-2 text-xs text-ink-secondary">
            <span className="w-48 shrink-0">Exigir janela boa</span>
            <button
              type="button"
              onClick={() => salvar({ exigirJanelaBoa: !config.exigirJanelaBoa }, "exigirJanelaBoa")}
              disabled={ocupado === "exigirJanelaBoa"}
              aria-pressed={config.exigirJanelaBoa}
              className={`rounded border px-2 py-1 text-xs disabled:opacity-50 ${
                config.exigirJanelaBoa
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-line bg-surface-2 text-ink-muted"
              }`}
            >
              {config.exigirJanelaBoa ? "sim" : "não"}
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-ink-secondary">
            <span className="w-48 shrink-0">Nichos permitidos</span>
            <FilaNichosInput
              valor={config.nichosPermitidos}
              disabled={ocupado === "nichosPermitidos"}
              onSalvar={(valor) => salvar({ nichosPermitidos: valor }, "nichosPermitidos")}
            />
          </div>
          <p className="text-xs text-ink-muted">Vazio = todos os nichos.</p>

          <div className="flex items-center gap-2 text-xs text-ink-secondary">
            <span className="w-48 shrink-0">Número do teste</span>
            <FilaNumeroDigitosInput
              valor={config.numeroTeste}
              disabled={ocupado === "numeroTeste"}
              onSalvar={(valor) => salvar({ numeroTeste: valor }, "numeroTeste")}
            />
          </div>
          <p className="text-xs text-ink-muted">
            Destino de TODO disparo de teste — nunca o telefone do lead. Dígitos com DDI; vazio
            desliga o disparo.
          </p>

          {/* ── Número de exceção — ver "Número de exceção" em ARCHITECTURE.md.
              Fica junto do número do teste de propósito: os dois são a MESMA
              fila de segurança, em direções opostas, e um interruptor ligado
              longe do outro é o que fica esquecido ligado. */}
          <div className="flex items-center gap-2 text-xs text-ink-secondary">
            <span className="w-48 shrink-0">Número de exceção</span>
            <FilaNumeroDigitosInput
              valor={config.numeroExcecao}
              disabled={ocupado === "numeroExcecao"}
              onSalvar={(valor) => salvar({ numeroExcecao: valor }, "numeroExcecao")}
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-ink-secondary">
            <span className="w-48 shrink-0">Lead de contexto (exceção)</span>
            <LeadContextoExcecaoInput
              valor={config.leadContextoExcecao}
              disabled={ocupado === "leadContextoExcecao"}
              onSalvar={(valor) => salvar({ leadContextoExcecao: valor }, "leadContextoExcecao")}
            />
          </div>
          <p className="text-xs text-ink-muted">
            Mensagem vinda deste número gera rascunho de TESTE usando o lead de contexto acima —
            nunca vira tarefa de envio, mesmo com resposta automática ligada, e não toca no
            histórico nem no status daquele lead. Pode ser o MESMO número do teste, e aí o ensaio
            fica mais parecido com o real: você dispara para ele, responde dele, e a conversa no
            Business fica com as duas mensagens. Vazio = sem exceção.
          </p>
        </div>
      )}

      {config && (
        <RespostaAutomaticaBloco config={config} ocupado={ocupado} onSalvar={salvar} />
      )}

      <VisaoFila
        versao={versaoConfig}
        onLeads={setLeadsDaVisao}
        onContador={setContador}
      />
      <DisparoTeste versao={versaoConfig} leadsDaVisao={leadsDaVisao} />
      <PrintPendenteLista />

      {erro && <p className="mt-2 text-sm text-critical">{erro}</p>}
    </PainelColapsavel>
  );
}

/**
 * O leadId de contexto do número de exceção — texto livre (placeId do
 * Google, ou `radar-lead-teste`), sem validação de formato aqui: quem
 * confere se o lead existe é o flush, na hora de gerar o rascunho (lead
 * sumido = mensagem perdida, mesmo tratamento de "lead sumiu" do resto da
 * fila). Mesmo padrão de commit-no-blur de `FilaNumeroDigitosInput`, e mora
 * SÓ neste arquivo (não em `comum.tsx`) porque só este painel usa.
 */
function LeadContextoExcecaoInput({
  valor,
  disabled,
  onSalvar,
}: {
  valor: string;
  disabled: boolean;
  onSalvar: (valor: string) => void;
}) {
  const [texto, setTexto] = useState(valor);
  const [ultimoValor, setUltimoValor] = useState(valor);
  if (valor !== ultimoValor) {
    setUltimoValor(valor);
    setTexto(valor);
  }

  function commit() {
    const limpo = texto.trim();
    if (limpo !== valor) onSalvar(limpo);
    else setTexto(valor);
  }

  return (
    <input
      value={texto}
      placeholder="placeId do lead"
      disabled={disabled}
      onChange={(event) => setTexto(event.target.value)}
      onBlur={commit}
      className="min-w-0 flex-1 rounded border border-line bg-surface-2 px-2 py-1 font-mono text-xs text-foreground outline-none focus:border-accent disabled:opacity-50"
    />
  );
}
