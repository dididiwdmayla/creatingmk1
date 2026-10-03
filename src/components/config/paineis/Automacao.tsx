"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/Button";
import { SkeletonRows } from "@/components/Skeleton";
import { PainelColapsavel } from "@/components/config/PainelColapsavel";
import { AprovacaoAutomacao } from "@/components/config/paineis/AprovacaoAutomacao";
import { OperadorAutomacao } from "@/components/config/paineis/OperadorAutomacao";
import { CAMPO_BASE_CLS, FilaNumeroInput, mensagemErroFila } from "@/components/config/comum";
import { ApiError, api } from "@/lib/api-client";
import type { AutomacaoConfig } from "@/lib/automacao/config";
import type { ExecucaoAtiva } from "@/lib/automacao/disparo";
import {
  EXPIRACAO_MIN_HORAS,
  contarAApagar,
  estoqueExcedeFila,
  execucaoMorta,
  resumoCabecalho,
  type PainelAutomacao,
  type ResumoExecucao,
} from "@/lib/automacao/painelTipos";
import { formatDateTime, formatInt } from "@/lib/format";

/** Chave da persistência deste painel — ver `PainelColapsavel`. */
export const PAINEL_AUTOMACAO = "automacao";

type Interruptor = keyof Pick<AutomacaoConfig, "ativo" | "textoIA" | "aprovacaoAutomatica">;

const INTERRUPTORES: Array<{ campo: Interruptor; label: string; ajuda: string }> = [
  {
    campo: "ativo",
    label: "Automação",
    ajuda:
      "Desligada, a execução da madrugada só registra que não fez nada. Ligada, ela gasta cota paga (busca e IA) para completar o estoque até o alvo.",
  },
  {
    campo: "textoIA",
    label: "Texto por IA",
    ajuda:
      "Nunca obrigatório: desligado, sem chave ou no teto da noite, a demo fica com o texto de exemplo da skin.",
  },
  {
    campo: "aprovacaoAutomatica",
    label: "Aprovação automática",
    ajuda:
      "Ligada, a demo que tem telefone, horário e idioma nasce aprovada. Desligada, toda demo automática espera a fila de aprovação abaixo.",
  },
];

const NUMEROS: Array<{
  campo: keyof Pick<AutomacaoConfig, "alvoEstoque" | "tetoBuscasNoite" | "tetoIANoite">;
  label: string;
  sufixo?: string;
}> = [
  { campo: "alvoEstoque", label: "Estoque alvo", sufixo: "leads" },
  { campo: "tetoBuscasNoite", label: "Teto de buscas por noite", sufixo: "páginas" },
  { campo: "tetoIANoite", label: "Teto de IA por noite", sufixo: "chamadas" },
];

/**
 * Painel "Automação" (admin) — a automação do estoque de leads prontos
 * (ver "Automação do estoque" e "O painel Automação" no ARCHITECTURE.md).
 *
 * Painel AUTÔNOMO: uma leitura ao montar (`GET /api/config/automacao/painel`)
 * traz config, estoque, última execução, execução ativa e a fila de
 * aprovação — e é dessa mesma resposta que sai a linha do cabeçalho
 * fechado. A leitura não varre `/leads`: o estoque é o retrato que o pool
 * da fila já apura (ver `lib/automacao/painel.ts`).
 *
 * Cada campo salva sozinho no `PUT /api/config/automacao` (patch), no molde
 * da "Fila de envio": interruptor no clique, número e data no blur.
 */
export function AutomacaoSection() {
  const [painel, setPainel] = useState<PainelAutomacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [avisoDisparo, setAvisoDisparo] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    try {
      const novo = await api.getAutomacaoPainel();
      setPainel(novo);
      setErro(null);
    } catch (error) {
      setErro(
        error instanceof ApiError && error.status === 403
          ? "Automação é restrita ao admin."
          : mensagemErroFila(error, "Falha ao carregar a automação"),
      );
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    let ignore = false;
    api
      .getAutomacaoPainel()
      .then((novo) => {
        if (ignore) return;
        setPainel(novo);
      })
      .catch((error) => {
        if (ignore) return;
        setErro(
          error instanceof ApiError && error.status === 403
            ? "Automação é restrita ao admin."
            : mensagemErroFila(error, "Falha ao carregar a automação"),
        );
      });
    return () => {
      ignore = true;
    };
  }, []);

  async function salvar(patch: Partial<AutomacaoConfig>, chave: string) {
    setOcupado(chave);
    setErro(null);
    try {
      const { automacao } = await api.putAutomacaoConfig(patch);
      setPainel((atual) => (atual ? { ...atual, config: automacao } : atual));
    } catch (error) {
      setErro(mensagemErroFila(error, "Falha ao salvar"));
    } finally {
      setOcupado(null);
    }
  }

  async function rodarAgora() {
    setOcupado("disparar");
    setErro(null);
    setAvisoDisparo(null);
    try {
      const { em } = await api.dispararAutomacao();
      setAvisoDisparo(
        `Pedido enviado às ${formatDateTime(em)}. O GitHub leva alguns minutos para começar e a execução outros tantos para terminar — use "Atualizar" para ver o resultado.`,
      );
    } catch (error) {
      // A recusa por execução ativa não é falha: é a resposta, dita como tal.
      setErro(
        error instanceof ApiError && error.status === 409
          ? error.message
          : mensagemErroFila(error, "Falha ao disparar"),
      );
    } finally {
      setOcupado(null);
      // Relê nos dois casos: sucesso mostra o pedido como execução ativa;
      // 409 mostra QUAL execução está ativa.
      await carregar();
    }
  }

  if (erro && painel === null) {
    return (
      <PainelColapsavel id={PAINEL_AUTOMACAO} titulo="Automação" resumo="restrito">
        <p className="mt-2 text-sm text-ink-muted">{erro}</p>
      </PainelColapsavel>
    );
  }

  const config = painel?.config;

  return (
    <PainelColapsavel
      id={PAINEL_AUTOMACAO}
      titulo="Automação"
      // Duas formas, e só uma visível por vez: a longa não cabe no celular
      // ao lado do título (ver `resumoCabecalho`).
      resumo={
        <>
          <span className="sm:hidden">{resumoCabecalho(painel, true)}</span>
          <span className="hidden sm:inline">{resumoCabecalho(painel)}</span>
        </>
      }
    >
      <p className="mt-1 text-xs text-ink-muted">
        Quando o estoque de leads prontos fica abaixo do alvo, a execução da madrugada (03:30 em
        Brasília) faz demo para os leads que já estão na base e, se não bastar, busca leads novos.
      </p>

      {painel === null && <SkeletonRows count={1} className="mt-3 h-40 rounded border border-line" />}

      {painel && config && (
        <>
          <div className="mt-3 flex flex-col gap-2">
            {INTERRUPTORES.map(({ campo, label, ajuda }) => (
              <div key={campo} className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2 text-xs text-ink-secondary">
                  <span className="w-32 shrink-0 sm:w-44">{label}</span>
                  <button
                    type="button"
                    data-interruptor={campo}
                    onClick={() => salvar({ [campo]: !config[campo] }, campo)}
                    disabled={ocupado === campo}
                    aria-pressed={config[campo]}
                    className={`rounded border px-2 py-1 text-xs font-semibold disabled:opacity-50 ${
                      config[campo]
                        ? "border-good bg-good/15 text-good"
                        : "border-line bg-surface-2 text-ink-muted"
                    }`}
                  >
                    {config[campo] ? "ligada" : "desligada"}
                  </button>
                </div>
                <p className="text-xs text-ink-muted">{ajuda}</p>
              </div>
            ))}

            {NUMEROS.map(({ campo, label, sufixo }) => (
              <div key={campo} className="flex items-center gap-2 text-xs text-ink-secondary">
                <span className="w-32 shrink-0 sm:w-44">{label}</span>
                <FilaNumeroInput
                  valor={config[campo]}
                  disabled={ocupado === campo}
                  onSalvar={(valor) => salvar({ [campo]: valor }, campo)}
                />
                {sufixo && <span className="text-ink-muted">{sufixo}</span>}
              </div>
            ))}

            <div className="flex items-center gap-2 text-xs text-ink-secondary">
              <span className="w-32 shrink-0 sm:w-44">Corte do legado</span>
              <CorteInput
                valor={config.corteLegado}
                disabled={ocupado === "corteLegado"}
                onSalvar={(valor) => salvar({ corteLegado: valor }, "corteLegado")}
              />
            </div>
            <p className="text-xs text-ink-muted">
              Lead criado antes desta data nunca recebe demo automática: antes do registro de
              contato existir, o contato à mão não deixava rastro, e demo para ele pode ser
              mensagem repetida.
            </p>
          </div>

          <EstoqueBloco painel={painel} />
          <ExpiracaoBloco
            painel={painel}
            ocupado={ocupado === "expiracaoDemoHoras"}
            onSalvar={(valor) => salvar({ expiracaoDemoHoras: valor }, "expiracaoDemoHoras")}
          />
          <UltimaExecucao ultima={painel.ultima} ativa={painel.ativa} tetos={config} />

          <div className="mt-4 flex flex-col gap-1 border-t border-line pt-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                onClick={rodarAgora}
                loading={ocupado === "disparar"}
                disabled={painel.ativa !== null || !painel.disparoDisponivel}
                data-acao="rodar-agora"
              >
                Rodar agora
              </Button>
              {/* Fora do cabeçalho de propósito: ali ele roubava a largura
                  que o resumo precisa para não truncar. */}
              <Button variant="ghost" onClick={carregar} loading={carregando} data-acao="atualizar">
                ↻ Atualizar
              </Button>
              <span className="text-xs text-ink-muted">
                {textoRodarAgora(painel.ativa, painel.disparoDisponivel)}
              </span>
            </div>
            {avisoDisparo && (
              <p data-aviso="disparo" className="text-xs text-ink-secondary">
                {avisoDisparo}
              </p>
            )}
          </div>

          <AprovacaoAutomacao
            itens={painel.aprovacao.itens}
            total={painel.aprovacao.total}
            onDecidido={carregar}
          />
          <OperadorAutomacao painelId={PAINEL_AUTOMACAO} />
        </>
      )}

      {erro && <p className="mt-2 text-sm text-critical">{erro}</p>}
    </PainelColapsavel>
  );
}

function textoRodarAgora(ativa: ExecucaoAtiva | null, disponivel: boolean): string {
  if (!disponivel) return "Disparo não configurado: falta GITHUB_CAPTURAS_TOKEN na Vercel.";
  if (ativa?.tipo === "execucao") return "Há uma execução rodando — espere ela terminar.";
  if (ativa?.tipo === "disparo") {
    return `Pedido às ${formatDateTime(ativa.em)}, aguardando o GitHub começar.`;
  }
  return "Roda fora do horário. O resultado leva alguns minutos.";
}

/** Data "YYYY-MM-DD" que salva no blur (e só se mudou e é válida). */
function CorteInput({
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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
      setTexto(valor);
      return;
    }
    if (texto !== valor) onSalvar(texto);
  }
  return (
    <input
      type="date"
      aria-label="Data de corte do legado"
      value={texto}
      disabled={disabled}
      onChange={(event) => setTexto(event.target.value)}
      onBlur={commit}
      className={`${CAMPO_BASE_CLS.replace("w-full", "w-40")} min-w-0 text-sm disabled:opacity-50`}
    />
  );
}

function EstoqueBloco({ painel }: { painel: PainelAutomacao }) {
  const { estoque, config } = painel;
  if (!estoque) {
    return (
      <p className="mt-4 border-t border-line pt-3 text-xs text-ink-muted">
        Estoque: ainda sem retrato (a fila nunca foi varrida).
      </p>
    );
  }
  const aCaminho = estoque.aguardandoAprovacao + estoque.capturasEmAndamento;
  const abaixo = estoque.total < config.alvoEstoque;
  return (
    <div data-bloco="automacao-estoque" className="mt-4 border-t border-line pt-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-xs font-medium text-ink-secondary">Estoque</span>
        <span className={`text-lg font-semibold ${abaixo ? "text-warning" : "text-good"}`}>
          {formatInt(estoque.total)}/{formatInt(config.alvoEstoque)}
        </span>
        <span className="text-xs text-ink-secondary">
          {formatInt(estoque.prontos)} pronto{estoque.prontos === 1 ? "" : "s"} · {formatInt(aCaminho)} a
          caminho
        </span>
      </div>
      {aCaminho > 0 && (
        <p className="text-xs text-ink-muted">
          a caminho: {formatInt(estoque.aguardandoAprovacao)} aguardando aprovação ·{" "}
          {formatInt(estoque.capturasEmAndamento)} com captura gerando
        </p>
      )}
      <p className="text-xs text-ink-muted">
        Retrato de {formatDateTime(estoque.geradoEm)} — a varredura da fila, refeita a cada 10
        minutos.
      </p>
    </div>
  );
}

function plural(n: number, um: string, varios: string): string {
  return `${formatInt(n)} ${n === 1 ? um : varios}`;
}

/**
 * EXPIRAÇÃO das demos automáticas não enviadas (ver "Expiração das demos
 * automáticas" no ARCHITECTURE.md): o prazo, quantas a próxima varredura
 * apaga — contadas aqui, sobre a lista do retrato, para acompanhar o campo
 * enquanto ele é editado — e o aviso do estoque maior do que a fila manda.
 */
function ExpiracaoBloco({
  painel,
  ocupado,
  onSalvar,
}: {
  painel: PainelAutomacao;
  ocupado: boolean;
  onSalvar: (valor: number) => void;
}) {
  const { config, expiracao } = painel;
  const prazo = config.expiracaoDemoHoras;
  const excede = expiracao !== null && estoqueExcedeFila(config.alvoEstoque, expiracao.metaDiaria);
  // A hora do agendamento no fuso de quem olha — a mesma régua da data da
  // contagem, que `formatDateTime` também formata no fuso do navegador.
  const horaAgendada = expiracao
    ? new Date(expiracao.proximaVarreduraEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : undefined;

  let contagem: { texto: string; tom: "neutro" | "apaga" };
  if (!config.ativo) {
    contagem = { texto: "Automação desligada: a varredura não roda e nada é apagado.", tom: "neutro" };
  } else if (!expiracao) {
    contagem = { texto: "Contagem ainda sem retrato (a fila nunca foi varrida).", tom: "neutro" };
  } else {
    const quando = formatDateTime(expiracao.proximaVarreduraEm);
    const { vencidas, aApagar, ficam } = contarAApagar(expiracao, prazo, Date.parse(expiracao.proximaVarreduraEm));
    if (expiracao.naoRodaria) {
      contagem = {
        texto: `A próxima varredura (${quando}) não apaga nada: ${expiracao.naoRodaria}.${
          vencidas > 0 ? ` ${plural(vencidas, "demo já estaria", "demos já estariam")} vencida${vencidas === 1 ? "" : "s"}.` : ""
        }`,
        tom: "neutro",
      };
    } else if (aApagar === 0) {
      contagem = { texto: `Nenhuma demo será apagada na próxima varredura (${quando}).`, tom: "neutro" };
    } else {
      contagem = {
        texto: `${plural(aApagar, "demo automática não enviada será apagada", "demos automáticas não enviadas serão apagadas")} na próxima varredura (${quando}).${
          ficam > 0 ? ` Outras ${formatInt(ficam)} passam do teto de ${expiracao.teto} por execução e ficam para a seguinte.` : ""
        }`,
        tom: "apaga",
      };
    }
  }

  return (
    <div data-bloco="automacao-expiracao" className="mt-4 flex flex-col gap-1 border-t border-line pt-3">
      <span className="text-xs font-medium text-ink-secondary">Expiração das demos não enviadas</span>
      <div className="flex items-center gap-2 text-xs text-ink-secondary">
        <span className="w-32 shrink-0 sm:w-44">Prazo</span>
        <FilaNumeroInput
          valor={prazo}
          min={EXPIRACAO_MIN_HORAS}
          rotulo="Prazo da demo não enviada, em horas"
          disabled={ocupado}
          onSalvar={onSalvar}
        />
        <span className="text-ink-muted">horas</span>
      </div>
      {/* Uma string só, e não texto JSX: o espaço logo depois de uma
          expressão `{…}` sumia no build ("03:30(ou no") — a captura mostrou. */}
      <p className="text-xs text-ink-muted">
        {`Apagada na primeira varredura depois de ${prazo}h da criação. A varredura roda uma vez por dia, na execução ${
          horaAgendada ? `das ${horaAgendada}` : "da madrugada"
        } (ou no "Rodar agora") — na prática, entre ${prazo}h e ${prazo + 24}h. Mínimo de ${EXPIRACAO_MIN_HORAS}h. Só demo automática que nunca saiu: envio, reserva da fila, visita, contato ou foto subida à mão a protegem.`}
      </p>
      <p
        data-expiracao="contagem"
        data-tom={contagem.tom}
        className={`text-xs ${contagem.tom === "apaga" ? "font-medium text-foreground" : "text-ink-secondary"}`}
      >
        {contagem.texto}
      </p>
      {excede && expiracao && (
        <p
          data-aviso="estoque-excede-fila"
          role="note"
          className="mt-1 rounded border border-warning/50 bg-warning/10 px-2 py-1.5 text-xs text-warning"
        >
          ⚠ O estoque alvo ({formatInt(config.alvoEstoque)}) é maior do que a fila manda por dia
          (meta {formatInt(expiracao.metaDiaria)}). A sobra espera — e a demo que passar de {prazo}h
          sem sair vence antes de sair e é apagada.
        </p>
      )}
    </div>
  );
}

function textoVarredura(v: NonNullable<ResumoExecucao["varredura"]>): string {
  if (v.naoRodou) return `varredura (prazo ${v.prazoHoras}h): não rodou — ${v.naoRodou}`;
  const partes = [
    `varredura (prazo ${v.prazoHoras}h): ${plural(v.apagadas, "demo apagada", "demos apagadas")}`,
    plural(v.puladas, "pulada", "puladas"),
  ];
  if (v.restantes > 0) partes.push(`${formatInt(v.restantes)} para a próxima`);
  if (v.storageFalhou > 0) partes.push(`${plural(v.storageFalhou, "limpeza", "limpezas")} de Storage pendente${v.storageFalhou === 1 ? "" : "s"}`);
  return partes.join(" · ");
}

const ROTULO_DISPARO: Record<string, string> = {
  schedule: "agendada",
  workflow_dispatch: "manual no GitHub",
  repository_dispatch: "rodar agora",
};

function UltimaExecucao({
  ultima,
  ativa,
  tetos,
}: {
  ultima: ResumoExecucao | null;
  ativa: ExecucaoAtiva | null;
  tetos: AutomacaoConfig;
}) {
  if (!ultima) {
    return (
      <p className="mt-4 border-t border-line pt-3 text-xs text-ink-muted">
        Última execução: nenhuma ainda.
      </p>
    );
  }
  const morta = execucaoMorta(ultima, ativa);
  const tom = morta || ultima.estado === "falhou" ? "falha" : ultima.estado === "concluida" ? "ok" : ultima.estado === "rodando" ? "rodando" : "neutro";
  const selo =
    tom === "falha"
      ? { texto: morta ? "✕ Parou sem terminar" : "✕ Falhou", cls: "bg-critical text-critical-ink" }
      : tom === "ok"
        ? { texto: "✓ Concluída", cls: "bg-good/15 text-good" }
        : tom === "rodando"
          ? { texto: "● Rodando", cls: "bg-accent/15 text-accent" }
          : { texto: "— Nada a fazer", cls: "bg-surface-2 text-ink-secondary" };
  const moldura =
    tom === "falha" ? "border-2 border-critical bg-critical/10" : "border border-line bg-surface-2/40";

  const fez: string[] = [];
  fez.push(`${ultima.demosCriadas} demo${ultima.demosCriadas === 1 ? "" : "s"} criada${ultima.demosCriadas === 1 ? "" : "s"}`);
  if (ultima.buscas > 0) {
    fez.push(`${ultima.buscas} busca${ultima.buscas === 1 ? "" : "s"} (${ultima.leadsNovos} lead${ultima.leadsNovos === 1 ? "" : "s"} novo${ultima.leadsNovos === 1 ? "" : "s"})`);
  }
  fez.push(`buscas ${ultima.requisicoesBusca}/${tetos.tetoBuscasNoite} páginas`);
  fez.push(`IA ${ultima.chamadasIA}/${tetos.tetoIANoite} chamadas`);

  return (
    <div data-bloco="automacao-ultima" data-tom={tom} className={`mt-4 rounded p-3 ${moldura}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-ink-secondary">Última execução</span>
        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${selo.cls}`}>{selo.texto}</span>
        <span className="text-xs text-ink-muted">
          {formatDateTime(ultima.iniciadaEm)} · {ROTULO_DISPARO[ultima.disparo] ?? ultima.disparo}
        </span>
      </div>
      {tom === "falha" && (
        <p className="mt-1 text-sm font-medium text-critical">
          {morta
            ? "A execução parou de dar sinal de vida e não foi finalizada."
            : (ultima.erro ?? ultima.motivo ?? "falha sem mensagem")}
        </p>
      )}
      {ultima.estado !== "nada_a_fazer" && (
        <p className="mt-1 text-xs text-ink-secondary">{fez.join(" · ")}</p>
      )}
      {ultima.estoqueAntes && (
        <p className="text-xs text-ink-muted">
          estoque {ultima.estoqueAntes.total}
          {ultima.estoqueDepois ? ` → ${ultima.estoqueDepois.total}` : ""} (alvo {ultima.alvo}
          {ultima.falta > 0 ? `, faltavam ${ultima.falta}` : ""})
        </p>
      )}
      {ultima.varredura && (
        <p data-ultima="varredura" className="text-xs text-ink-muted">
          {textoVarredura(ultima.varredura)}
        </p>
      )}
      {ultima.falhas > 0 && (
        <p className="text-xs text-warning">
          {ultima.falhas} unidade{ultima.falhas === 1 ? "" : "s"} com falha
          {ultima.primeiraFalha ? ` — ${ultima.primeiraFalha}` : ""}
        </p>
      )}
      {ultima.motivo && tom !== "falha" && (
        <p className="text-xs text-ink-muted">motivo de parada: {ultima.motivo}</p>
      )}
      {ultima.runUrl && (
        <a
          href={ultima.runUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-block text-xs text-accent underline"
        >
          ver o run no GitHub
        </a>
      )}
    </div>
  );
}
