"use client";

import { useEffect, useState } from "react";

import { SkeletonRows } from "@/components/Skeleton";
import { PainelColapsavel } from "@/components/config/PainelColapsavel";
import { NIVEL_CLS, NIVEL_LABEL, mensagemErroFila } from "@/components/config/comum";
import {
  ApiError,
  api,
  type FilaDiagnosticoResponse,
  type FilaRetidosResponse,
} from "@/lib/api-client";
import type { LinhaFilaPainel, LinhaRetido } from "@/lib/fila/estado";
import { formatDateTime, formatInt, formatTempoAte, formatTempoRelativo } from "@/lib/format";
import type { NivelContato } from "@/lib/leads/janelaContato";

/** Chave da persistência deste bloco — ver `PainelColapsavel`. */
export const PAINEL_VISAO_FILA = "fila-visao";

/**
 * Rótulo de cada portão de ritmo — o motivo pelo qual NINGUÉM sai agora,
 * seja qual for o lead. Mesma ordem e mesmos nomes de `MOTIVOS_SEM_TAREFA`
 * (lib/fila/selecao.ts); o `?? motivo` na tela é a rede para um motivo novo
 * aparecer cru em vez de sumir.
 */
const RITMO_LABEL: Record<string, string> = {
  pausado: "a fila está pausada",
  meta_atingida: "a meta do dia já foi atingida",
  teto_hora: "o teto por hora foi atingido",
  intervalo: "ainda não passou o intervalo mínimo entre envios",
};

/**
 * As oito peneiras ESTRUTURAIS na ordem real de avaliação (`motivoEstrutural`,
 * lib/fila/candidatos.ts) — um lead que falha em várias conta só na
 * primeira, então a ordem é o que torna a coluna de números legível.
 *
 * `contactadoForaDaFila` é a peneira que falhava antes: contato feito pelo
 * clique manual do WhatsApp (ficha/hoje) não muda `status`, então esse lead
 * ficava invisível — a fila continuava contando ele como candidato até
 * mandar mensagem de novo. Rótulo explícito aqui é o que evita o operador
 * ver a contagem de elegíveis cair e não saber por quê.
 */
const FUNIL_ESTRUTURAL: Array<{ chave: string; label: string }> = [
  { chave: "status", label: "já não está em “novo”" },
  { chave: "contactadoForaDaFila", label: "já contactado fora da fila (selo/registro manual)" },
  { chave: "descartado", label: "descartado à mão" },
  { chave: "telefoneInvalido", label: "número sem WhatsApp" },
  { chave: "semTelefone", label: "sem telefone" },
  { chave: "semDemo", label: "sem demo" },
  { chave: "capturaNaoPronta", label: "print da demo não pronto" },
  { chave: "semFuso", label: "sem fuso conhecido" },
];

/** Uma linha do funil: rótulo à esquerda, quantos pararam ali à direita. */
function LinhaFunil({ label, valor }: { label: string; valor: number }) {
  return (
    <li className="flex items-baseline justify-between gap-2">
      <span className={valor > 0 ? "text-ink-secondary" : "text-ink-muted"}>{label}</span>
      <span
        className={`shrink-0 font-mono ${valor > 0 ? "text-foreground" : "text-ink-muted"}`}
      >
        {formatInt(valor)}
      </span>
    </li>
  );
}

/** Selo do nível da janela — mesmas cores da barra do dia. `null` = fechado. */
function SeloNivel({ nivel }: { nivel: NivelContato | null }) {
  if (nivel === null) {
    return (
      <span className="rounded border border-line bg-surface-2 px-1 text-[10px] text-ink-muted">
        fechado
      </span>
    );
  }
  return (
    <span className={`rounded border px-1 text-[10px] ${NIVEL_CLS[nivel]}`}>
      {NIVEL_LABEL[nivel]}
    </span>
  );
}

/**
 * Uma linha de lead nas listas da visão. A ÚNICA ação é "tirar da fila", e
 * ela é o `descartar` que já existe (`PATCH /api/leads/{id}`) — o mesmo do
 * card e da ficha, já reversível por lá, e que já exclui o lead do pool na
 * próxima reconstrução. Nada de campo novo, e nada de `telefoneInvalido`,
 * que quer dizer outra coisa (o número não tem WhatsApp).
 */
function LinhaLeadFila({
  linha,
  ocupado,
  onTirar,
  esperando = false,
}: {
  linha: LinhaFilaPainel;
  ocupado: boolean;
  onTirar: () => void;
  /** Linha da lista de BLOQUEADOS: é ela que fala da próxima faixa aceita. */
  esperando?: boolean;
}) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-2 rounded border border-line p-2">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <a
            href={`/leads/${linha.leadId}`}
            className="text-xs text-foreground underline decoration-line underline-offset-2"
          >
            {linha.nome || linha.leadId}
          </a>
          {linha.nicho && <span className="text-[10px] text-ink-muted">{linha.nicho}</span>}
          <SeloNivel nivel={linha.nivel} />
          {/* Sem este selo, um lead na frente de quem chegou antes pareceria
              erro de ordenação. Ele é a resposta visível a "por que esse
              está em primeiro". */}
          {linha.manual && (
            <span
              title="Adicionado à fila à mão: fura o nicho permitido e a ordem natural, dentro da mesma janela."
              className="rounded border border-accent/40 bg-accent/10 px-1 text-[10px] text-accent"
            >
              manual
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[10px] text-ink-muted">
          {linha.horaLocal} na hora do lead
          {/* A PRÓXIMA FAIXA ACEITA, não o "próximo bom": com
              `exigirJanelaBoa` desmarcado, o razoável vale e vem antes.
              Sem nenhuma em 7 dias, dizer isso é melhor do que calar — calado
              pareceria que o lead entra a qualquer hora. */}
          {esperando &&
            (linha.proximaFaixa
              ? ` · entra ${linha.proximaFaixa.rotuloDia} ${linha.proximaFaixa.hora}`
              : " · sem faixa aceita nos próximos 7 dias")}
        </p>
      </div>
      <button
        type="button"
        onClick={onTirar}
        disabled={ocupado}
        title="Descarta o lead: sai da fila de envio. É o mesmo descarte do card, reversível na ficha."
        className="shrink-0 rounded border border-line bg-surface-2 px-2 py-1 text-xs text-ink-muted hover:border-critical/60 hover:text-critical disabled:opacity-50"
      >
        tirar da fila
      </button>
    </li>
  );
}

/**
 * Uma linha da lista de RETIDOS. Mostra as três coisas que a decisão de
 * liberar exige — quem é, quando foi a reserva (o instante em que a mensagem
 * provavelmente saiu, o que o operador confere no WhatsApp) e quando a
 * retenção vence sozinha. Só o número não bastaria: sem isso não há como
 * liberar um ESPECÍFICO.
 *
 * A ação é de mão única e não é o `descartar` das outras listas: aqui o
 * operador afirma um fato que o servidor não tem como saber ("conferi, não
 * saiu"), e o lead volta à fila. Recusa por claim ativa aparece NA LINHA, com
 * a hora — recusa sem explicação faz clicar de novo.
 */
function LinhaRetidoFila({
  linha,
  agora,
  ocupado,
  erro,
  onLiberar,
}: {
  linha: LinhaRetido;
  agora: number;
  ocupado: boolean;
  erro: string | null;
  onLiberar: () => void;
}) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-2 rounded border border-line p-2">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <a
            href={`/leads/${linha.leadId}`}
            className="text-xs text-foreground underline decoration-line underline-offset-2"
          >
            {linha.nome || linha.leadId}
          </a>
          <span className="text-[10px] text-ink-muted">{linha.dispositivo}</span>
        </div>
        <p className="mt-0.5 text-[10px] text-ink-muted">
          reservado {formatDateTime(linha.reservadoEm)} (
          {formatTempoRelativo(linha.reservadoEm, agora)}) · volta à fila{" "}
          {formatTempoAte(linha.venceEm, agora)}
        </p>
        {erro && <p className="mt-0.5 text-[10px] text-critical">{erro}</p>}
      </div>
      <button
        type="button"
        onClick={onLiberar}
        disabled={ocupado}
        title="Só se você conferiu no WhatsApp que a mensagem NÃO saiu: devolve o lead à fila agora."
        className="shrink-0 rounded border border-line bg-surface-2 px-2 py-1 text-xs text-ink-muted hover:border-accent/60 hover:text-accent disabled:opacity-50"
      >
        liberar
      </button>
    </li>
  );
}

/**
 * A VISÃO da fila — o que vai acontecer, quando, com quem, e por que os
 * demais não entram. Subordinada ao painel "Fila de envio" (mesma seção,
 * separada por um filete), como a lista de print pendente.
 *
 * É LEITURA mais uma ação pontual: nada aqui dispara envio. Quem entrega é
 * o celular, quando pedir a próxima tarefa — esta tela só mostra o que ele
 * vai encontrar quando pedir.
 *
 * `versao` sobe a cada config salva no painel acima: mexer em
 * `exigirJanelaBoa` ou nos nichos muda o funil inteiro, e um funil que não
 * reage à edição ao lado dele seria um número defasado lido como se fosse
 * agora — exatamente o que esta tela existe para não fazer.
 */
export function VisaoFila({
  versao,
  onContador,
}: {
  versao: number;
  /**
   * Empresta ao cabeçalho do painel "Fila de envio" o contador do dia: ele
   * já veio nesta resposta, e o resumo do bloco fechado não pode custar uma
   * chamada a mais.
   */
  onContador: (contador: FilaDiagnosticoResponse["contador"] | null) => void;
}) {
  const [dados, setDados] = useState<FilaDiagnosticoResponse | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);
  // Instante FIXO do carregamento — nunca Date.now() no render.
  const [agora, setAgora] = useState(() => Date.now());
  /**
   * Os RETIDOS vêm de rota própria (`/api/config/fila/retidos`), e não do
   * diagnóstico: achá-los exige varrer `filaEnvios`, que é exatamente o custo
   * que `/api/fila/diagnostico` existe para não pagar (ele lê UM doc, o
   * pool). O que importa é que a contagem do funil e a lista saiam do MESMO
   * payload — aí não têm como discordar.
   */
  const [retidos, setRetidos] = useState<FilaRetidosResponse | null>(null);
  const [erroRetidos, setErroRetidos] = useState<string | null>(null);
  /** Recusa por claim ativa, por linha: o motivo aparece ONDE se clicou. */
  const [erroLinha, setErroLinha] = useState<Record<string, string>>({});

  useEffect(() => {
    let ignore = false;
    api
      .getFilaDiagnostico()
      .then((resposta) => {
        if (ignore) return;
        setDados(resposta);
        setAgora(Date.now());
        onContador(resposta.contador);
      })
      .catch((error) => {
        if (ignore) return;
        setErro(
          error instanceof ApiError && error.status === 403
            ? "A visão da fila é restrita ao admin."
            : mensagemErroFila(error, "Falha ao carregar a visão da fila"),
        );
      });
    return () => {
      ignore = true;
    };
    // `onContador` é setState do pai (identidade estável): entra na lista
    // por exigência do lint, sem recarregar nada a mais.
  }, [versao, recarga, onContador]);

  // Efeito SEPARADO do de cima de propósito: são duas rotas, e uma que falha
  // não pode apagar a outra da tela. O funil diz "—" no lugar do número
  // quando esta cai, em vez de mostrar zero — que seria mentira.
  useEffect(() => {
    let ignore = false;
    api
      .getFilaRetidos()
      .then((resposta) => {
        if (ignore) return;
        setRetidos(resposta);
        setErroRetidos(null);
      })
      .catch((error) => {
        if (ignore) return;
        setErroRetidos(
          error instanceof ApiError && error.status === 403
            ? "A lista de retidos é restrita ao admin."
            : mensagemErroFila(error, "Falha ao carregar os leads retidos"),
        );
      });
    return () => {
      ignore = true;
    };
  }, [versao, recarga]);

  async function liberarRetido(leadId: string) {
    setOcupado(leadId);
    setErroLinha((atual) => {
      const resto = { ...atual };
      delete resto[leadId];
      return resto;
    });
    try {
      // A resposta JÁ traz a lista nova: quem continua retido é decisão do
      // servidor, não da tela.
      setRetidos(await api.deleteFilaRetido(leadId));
    } catch (error) {
      setErroLinha((atual) => ({
        ...atual,
        [leadId]:
          error instanceof ApiError && error.status === 409
            ? "O aparelho está com esse lead reservado agora — pode estar enviando. Tente em alguns minutos."
            : mensagemErroFila(error, "Falha ao liberar"),
      }));
    } finally {
      setOcupado(null);
    }
  }

  async function tirarDaFila(leadId: string) {
    setOcupado(leadId);
    setErro(null);
    try {
      await api.patchLead(leadId, { descartado: true });
      // Relê: quem decide se o lead sumiu da lista é o servidor, que
      // reconfere cada linha contra o doc fresco do lead.
      setRecarga((n) => n + 1);
    } catch (error) {
      setErro(mensagemErroFila(error, "Falha ao tirar da fila"));
    } finally {
      setOcupado(null);
    }
  }

  const motivoRitmo = dados?.ritmo ? (RITMO_LABEL[dados.ritmo] ?? dados.ritmo) : null;

  /**
   * Quem está na fila agora, nas três contagens que a visão inteira
   * detalha. Os retidos dizem "—" quando a rota deles caiu, pelo mesmo
   * motivo do funil: zero seria mentira.
   */
  const resumo = dados
    ? `${dados.proximos.length} próximos · ${dados.bloqueados.length} bloqueados · ${
        erroRetidos ? "—" : (retidos?.linhas.length ?? 0)
      } retidos`
    : undefined;

  return (
    <PainelColapsavel
      id={PAINEL_VISAO_FILA}
      titulo="O que vai acontecer"
      nivel={3}
      resumo={resumo}
      acoes={
        <button
          type="button"
          onClick={() => setRecarga((n) => n + 1)}
          className="shrink-0 rounded px-1.5 py-0.5 text-xs text-ink-muted hover:text-foreground"
        >
          atualizar
        </button>
      }
    >
      <p className="mt-1 text-xs text-ink-muted">
        Só leitura: nada aqui dispara envio. Quem entrega é o celular, quando pedir a próxima
        tarefa.
      </p>

      {dados === null && !erro && (
        <SkeletonRows count={1} className="mt-2 h-40 rounded border border-line" />
      )}

      {dados && (
        <>
          {/* ── Contador do dia ───────────────────────────────────────── */}
          <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs">
            <span>
              <span className="font-mono text-sm text-foreground">
                {formatInt(dados.contador.enviados)}
              </span>
              <span className="text-ink-muted"> de {formatInt(dados.contador.meta)} hoje</span>
            </span>
            <span className="text-ink-secondary">
              {dados.contador.restante === 0
                ? "meta cumprida"
                : `faltam ${formatInt(dados.contador.restante)}`}
            </span>
            <span className="text-ink-muted">
              {formatInt(dados.contador.ultimaHora)}/{formatInt(dados.contador.tetoPorHora)} na
              última hora
            </span>
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            O dia operacional vira às {dados.contador.inicioHora}h (
            {formatTempoAte(dados.contador.viraEm, agora)}) — é quando o contador zera.
          </p>

          {motivoRitmo ? (
            <p className="mt-2 rounded border border-warning/40 bg-warning/10 px-2 py-1 text-xs text-warning">
              Nada sai agora: {motivoRitmo}.
            </p>
          ) : (
            <p className="mt-2 text-xs text-good">
              Ritmo liberado — o próximo pedido do celular leva tarefa, se houver lead em janela.
            </p>
          )}

          {/* ── Funil ─────────────────────────────────────────────────── */}
          <h4 className="mt-3 text-xs font-medium text-ink-secondary">
            Por onde os leads param
          </h4>
          <p className="mt-1 text-[10px] text-ink-muted">
            {dados.pool.geradoEm ? (
              <>
                Retrato do pool de {formatDateTime(dados.pool.geradoEm)} (
                {formatTempoRelativo(dados.pool.geradoEm, agora)}), {formatInt(dados.pool.lidos)}{" "}
                leads lidos. Estas oito contagens só são apuráveis na varredura completa, então
                são desse instante — não de agora.
                {dados.pool.truncado && " A base passou do teto e o pool saiu cortado."}
              </>
            ) : (
              <>
                O pool ainda não foi construído — o celular não pediu tarefa nenhuma. As oito
                contagens abaixo ficam zeradas até a primeira chamada.
              </>
            )}
          </p>
          <ul className="mt-1 flex flex-col gap-0.5 text-xs">
            {FUNIL_ESTRUTURAL.map(({ chave, label }) => (
              <LinhaFunil key={chave} label={label} valor={dados.pool.estrutural[chave] ?? 0} />
            ))}
          </ul>

          {/* A RETENÇÃO entra no funil — e é a exceção deliberada ao
              precedente de `filaParado`, que fica fora do diagnóstico
              estrutural por já ter vitrine na ficha do lead. Esta não tem
              vitrine em lugar nenhum: sem a linha, o lead pararia em
              silêncio. Vem de varredura PRÓPRIA e fresca de `filaEnvios`,
              não do retrato do pool — daí a linha separada, com a lista
              inteira logo abaixo. */}
          <p className="mt-2 flex items-baseline justify-between gap-2 border-t border-line pt-1 text-xs">
            <span className={retidos && retidos.total > 0 ? "text-ink-secondary" : "text-ink-muted"}>
              retidos por envio recente não confirmado
            </span>
            <span
              className={`shrink-0 font-mono ${
                retidos && retidos.total > 0 ? "text-foreground" : "text-ink-muted"
              }`}
            >
              {retidos ? formatInt(retidos.total) : "—"}
            </span>
          </p>
          <p className="mt-0.5 text-[10px] text-ink-muted">
            {retidos?.retencaoHoras === 0
              ? "Retenção desligada: claim que expira sem confirmação devolve o lead na hora."
              : `Contado agora, direto da fila de envio — não é do retrato do pool. Janela de ${formatInt(retidos?.retencaoHoras ?? 0)}h a partir da reserva.`}
          </p>

          <p className="mt-2 text-[10px] text-ink-muted">
            {/* Sem pool não há "esse mesmo pool" a que se referir — e a
                etapa continua sendo calculada agora, sobre nada. */}
            {dados.pool.geradoEm ? "Calculado agora, sobre esse mesmo pool:" : "Calculado agora:"}
          </p>
          <ul className="mt-1 flex flex-col gap-0.5 text-xs">
            <LinhaFunil label="fora dos nichos permitidos" valor={dados.nichoBarrado} />
            <LinhaFunil label="em hora razoável (não aceita agora)" valor={dados.janela.razoavel} />
            <LinhaFunil label="em hora ruim" valor={dados.janela.ruim} />
            <LinhaFunil label="fechado na hora do lead" valor={dados.janela.semNivel} />
          </ul>
          <p className="mt-1 flex items-baseline justify-between gap-2 border-t border-line pt-1 text-xs">
            <span className="text-foreground">elegíveis agora</span>
            <span className="shrink-0 font-mono text-foreground">{formatInt(dados.elegiveis)}</span>
          </p>

          {/* ── Próximos ──────────────────────────────────────────────── */}
          <h4 className="mt-3 text-xs font-medium text-ink-secondary">Próximos a receber</h4>
          {dados.proximos.length === 0 ? (
            <p className="mt-1 text-xs text-ink-muted">
              {motivoRitmo
                ? `Ninguém sai enquanto ${motivoRitmo}.`
                : "Nenhum lead elegível agora."}
            </p>
          ) : (
            <>
              {/* `data-lista` é o gancho do QA visual: o funil também usa
                  <li>, e "sobrou linha de lista" só pode olhar as de LEAD. */}
              <ul data-lista="proximos" className="mt-1 flex flex-col gap-1.5">
                {dados.proximos.map((linha) => (
                  <LinhaLeadFila
                    key={linha.leadId}
                    linha={linha}
                    ocupado={ocupado === linha.leadId}
                    onTirar={() => tirarDaFila(linha.leadId)}
                  />
                ))}
              </ul>
              {dados.elegiveis > dados.proximos.length && (
                <p className="mt-1 text-[10px] text-ink-muted">
                  e mais {formatInt(dados.elegiveis - dados.proximos.length)} na fila, nesta ordem.
                </p>
              )}
            </>
          )}

          {/* ── Bloqueados por janela ─────────────────────────────────── */}
          <h4 className="mt-3 text-xs font-medium text-ink-secondary">Bloqueados por janela</h4>
          {dados.bloqueados.length === 0 ? (
            <p className="mt-1 text-xs text-ink-muted">Ninguém parado na janela.</p>
          ) : (
            <>
              <ul data-lista="bloqueados" className="mt-1 flex flex-col gap-1.5">
                {dados.bloqueados.map((linha) => (
                  <LinhaLeadFila
                    key={linha.leadId}
                    linha={linha}
                    ocupado={ocupado === linha.leadId}
                    onTirar={() => tirarDaFila(linha.leadId)}
                    esperando
                  />
                ))}
              </ul>
              {totalJanela(dados) > dados.bloqueados.length && (
                <p className="mt-1 text-[10px] text-ink-muted">
                  e mais {formatInt(totalJanela(dados) - dados.bloqueados.length)} parados na
                  janela.
                </p>
              )}
            </>
          )}

          {/* ── Retidos por envio não confirmado ─────────────────────── */}
          <h4 className="mt-3 text-xs font-medium text-ink-secondary">
            Retidos por envio recente não confirmado
          </h4>
          <p className="mt-1 text-[10px] text-ink-muted">
            O aparelho levou a tarefa e não disse o que houve. Na dúvida entre não mandar e mandar
            duas vezes, o lead fica fora da fila — libere só depois de conferir no WhatsApp que a
            mensagem não saiu.
          </p>
          {erroRetidos ? (
            <p className="mt-1 text-xs text-critical">{erroRetidos}</p>
          ) : retidos === null ? (
            <SkeletonRows count={1} className="mt-1 h-10 rounded border border-line" />
          ) : retidos.linhas.length === 0 ? (
            <p className="mt-1 text-xs text-ink-muted">
              {retidos.retencaoHoras === 0
                ? "Retenção desligada."
                : "Nenhum lead retido — toda tarefa entregue foi confirmada."}
            </p>
          ) : (
            <ul data-lista="retidos" className="mt-1 flex flex-col gap-1.5">
              {retidos.linhas.map((linha) => (
                <LinhaRetidoFila
                  key={linha.leadId}
                  linha={linha}
                  agora={agora}
                  ocupado={ocupado === linha.leadId}
                  erro={erroLinha[linha.leadId] ?? null}
                  onLiberar={() => liberarRetido(linha.leadId)}
                />
              ))}
            </ul>
          )}
        </>
      )}

      {erro && <p className="mt-2 text-xs text-critical">{erro}</p>}
    </PainelColapsavel>
  );
}

/** Quantos pararam na janela ao todo — a soma dos três baldes do diagnóstico. */
function totalJanela(dados: FilaDiagnosticoResponse): number {
  return dados.janela.razoavel + dados.janela.ruim + dados.janela.semNivel;
}
