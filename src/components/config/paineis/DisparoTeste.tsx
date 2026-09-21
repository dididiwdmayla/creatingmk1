"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/Button";
import { SkeletonRows } from "@/components/Skeleton";
import { CapturaBadge } from "@/components/capturas/CapturaBadge";
import { useEstadoCapturas } from "@/components/capturas/useEstadoCapturas";
import { PainelColapsavel } from "@/components/config/PainelColapsavel";
import { SeletorLead } from "@/components/config/SeletorLead";
import { mensagemErroFila } from "@/components/config/comum";
import { ApiError, api, type FilaTesteEstadoResponse } from "@/lib/api-client";
import { estadoVisivel } from "@/lib/demos/capturas/estado";
import {
  ETAPAS_TESTE,
  repeticoesRestantesEfetivas,
  type EtapaTeste,
  type FilaTesteDoc,
} from "@/lib/fila/estado";
import { formatDateTime, formatTempoAte, formatTempoRelativo } from "@/lib/format";

/** Chave da persistência deste bloco — ver `PainelColapsavel`. */
export const PAINEL_DISPARO_TESTE = "fila-disparo-teste";

/* ── Disparo de teste ──────────────────────────────────────────────────── */

/** Rótulo de cada etapa onde o disparo de teste pode parar. */
const ETAPA_TESTE_LABEL: Record<string, string> = {
  numero: "número do teste",
  ritmo: "ritmo",
  estruturais: "filtros estruturais",
  nicho: "nicho",
  janela: "janela de contato",
  conteudo: "o que enviar",
};

/**
 * O motivo DENTRO da etapa, em português. As chaves são os códigos que
 * `avaliarTeste` devolve (`MotivoSemTarefa`, `MotivoEstrutural`, o nível da
 * janela) — o `?? motivo` na tela é a rede para um código novo aparecer cru
 * em vez de sumir, mesmo padrão de `RITMO_LABEL`.
 */
const MOTIVO_TESTE_LABEL: Record<string, string> = {
  numero_teste_vazio: "o “Número do teste” acima está vazio — sem destino não há disparo",
  pausado: "a fila está pausada",
  meta_atingida: "a meta do dia já foi atingida",
  teto_hora: "o teto por hora foi atingido",
  intervalo: "ainda não passou o intervalo mínimo entre envios",
  status: "o lead já não está em “novo”",
  descartado: "o lead foi descartado à mão",
  telefoneInvalido: "o número do lead está marcado como sem WhatsApp",
  semTelefone: "o lead não tem telefone",
  semDemo: "o lead não tem demo",
  capturaNaoPronta: "o print da demo não está pronto",
  semFuso: "o lead não tem fuso conhecido",
  fora_dos_nichos: "o nicho do lead não está em “nichos permitidos”",
  sem_janela: "não dá para saber que horas são no lead (sem fuso)",
  fechado: "o lead está fechado neste minuto",
  razoavel: "a hora do lead é razoável, e a config só aceita “boa”",
  ruim: "a hora do lead está ruim agora",
  sem_demo: "sem demo, não há o que enviar",
  captura_nao_pronta: "a captura não está pronta: não há print para mandar",
  sem_print: "a captura não tem imagem de celular: não há print para mandar",
};

/** Rótulo curto de cada interruptor, na ordem real de avaliação. */
const ETAPA_PULAR_LABEL: Record<EtapaTeste, string> = {
  ritmo: "ritmo",
  estruturais: "estruturais",
  nicho: "nicho",
  janela: "janela",
};

const RESULTADO_TESTE_LABEL: Record<string, string> = {
  enviado: "enviado",
  invalido: "número inválido",
  falhou: "falhou",
};

/**
 * A linha de estado da tarefa atual — o que ela é AGORA, sem o operador
 * abrir log de aparelho. Pendente mostra o tempo restante; expirada diz
 * isso em vez de ficar eternamente "aguardando", que seria um estado que
 * mente.
 */
function estadoDoTeste(doc: FilaTesteDoc, agora: number): { texto: string; tom: string } {
  if (doc.estado === "pendente") {
    return new Date(doc.expiraEm).getTime() <= agora
      ? { texto: "Expirou sem o aparelho puxar.", tom: "text-ink-muted" }
      : {
          texto: `Aguardando o aparelho puxar — expira ${formatTempoAte(doc.expiraEm, agora)}.`,
          tom: "text-accent",
        };
  }
  if (doc.estado === "entregue") {
    return {
      texto: `O aparelho puxou ${formatTempoRelativo(doc.entregueEm ?? doc.criadoEm, agora)} — aguardando o confirmar.`,
      tom: "text-accent",
    };
  }
  const resultado = RESULTADO_TESTE_LABEL[doc.resultado ?? ""] ?? doc.resultado ?? "";
  return {
    texto:
      `Confirmado ${formatTempoRelativo(doc.confirmadoEm ?? doc.criadoEm, agora)}: ${resultado}` +
      (doc.detalhe ? ` — ${doc.detalhe}` : "."),
    tom: doc.resultado === "enviado" ? "text-good" : "text-warning",
  };
}

/**
 * O DISPARO DE TESTE — a única coisa nesta seção que faz o aparelho mandar
 * mensagem. Bloco subordinado ao painel "Fila de envio", como a visão e a
 * lista de pendência.
 *
 * **O operador ESCOLHE o lead**, com o fixo de teste pré-selecionado. Não é
 * "o próximo elegível" de propósito: aquele é justamente quem já passou por
 * todos os filtros, e testá-lo não ensina nada. Os interruptores existem
 * para rodar um lead ESPECÍFICO pelo pipeline e ver onde ele para — daí o
 * resultado dizer qual etapa barrou, nominalmente.
 *
 * O destino é sempre o "Número do teste" do painel acima, nunca o telefone
 * do lead: é a rede de segurança de quando o alvo escolhido é um negócio
 * real.
 */
export function DisparoTeste({ versao }: { versao: number }) {
  const [estado, setEstado] = useState<FilaTesteEstadoResponse | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const [agora, setAgora] = useState(() => Date.now());
  // `""` = ninguém escolheu ainda, e aí o alvo é o FIXO DE TESTE (ver
  // `alvoEfetivo`). Guardar a ausência, e não o id do fixo, é o que deixa
  // o seletor nascer preenchido sem esperar resposta nenhuma: o nome do
  // fixo chega no mesmo `GET /api/fila/teste` que desenha o bloco.
  const [alvo, setAlvo] = useState("");
  const [pular, setPular] = useState<EtapaTeste[]>([]);
  const [repeticoes, setRepeticoes] = useState("1");
  const [cancelando, setCancelando] = useState(false);
  const [barreira, setBarreira] = useState<{ etapa: string; motivo: string; nome: string } | null>(
    null,
  );
  const [gerandoCaptura, setGerandoCaptura] = useState(false);
  const [avisoCaptura, setAvisoCaptura] = useState<string | null>(null);
  const [erroCaptura, setErroCaptura] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    api
      .getFilaTeste()
      .then((resposta) => {
        if (ignore) return;
        setEstado(resposta);
        setAgora(Date.now());
      })
      .catch((error) => {
        if (ignore) return;
        setErro(
          error instanceof ApiError && error.status === 403
            ? "O disparo de teste é restrito ao admin."
            : mensagemErroFila(error, "Falha ao carregar o disparo de teste"),
        );
      });
    return () => {
      ignore = true;
    };
  }, [versao, recarga]);

  async function disparar() {
    setOcupado(true);
    setErro(null);
    setBarreira(null);
    try {
      const resposta = await api.postFilaTeste({
        ...(alvoEfetivo && { leadId: alvoEfetivo }),
        ...(pular.length > 0 && { pular }),
        repeticoes: repeticoesNumero,
      });
      if (!resposta.injetada) {
        setBarreira({ etapa: resposta.etapa, motivo: resposta.motivo, nome: resposta.nome });
      }
      setRecarga((n) => n + 1);
    } catch (error) {
      setErro(mensagemErroFila(error, "Falha ao disparar o teste"));
    } finally {
      setOcupado(false);
    }
  }

  async function cancelarRepeticoes() {
    setCancelando(true);
    setErro(null);
    try {
      await api.deleteFilaTesteRepeticoes();
      setRecarga((n) => n + 1);
    } catch (error) {
      setErro(mensagemErroFila(error, "Falha ao cancelar as repetições"));
    } finally {
      setCancelando(false);
    }
  }

  function alternarEtapa(etapa: EtapaTeste) {
    setPular((atual) =>
      atual.includes(etapa) ? atual.filter((e) => e !== etapa) : [...atual, etapa],
    );
  }

  const fixo = estado?.leadDeTeste;
  /**
   * O alvo de fato: o que o operador escolheu, ou o LEAD FIXO DE TESTE
   * enquanto ninguém escolheu nada. O fixo é o padrão de propósito — "o
   * próximo elegível" seria justamente quem já passou por todos os
   * filtros, e testá-lo não ensina nada.
   */
  const alvoEfetivo = alvo || fixo?.leadId || "";
  /**
   * O fixo entra no seletor como opção EXTRA porque `listLeads` o exclui
   * na ORIGEM — e é assim que tem que ser: afrouxar aquela exclusão o
   * vazaria para /leads, /demos, /hoje, /mundo e para a penetração por
   * nicho. Nome e prontidão vêm do mesmo `GET /api/fila/teste` que desenha
   * este bloco, sem chamada a mais.
   */
  const extrasSeletor = useMemo(
    () =>
      fixo
        ? [
            {
              leadId: fixo.leadId,
              nome: `${fixo.nome} (fixo de teste)`,
              nicho: "",
              cidade: "",
              temDemo: fixo.pronto,
            },
          ]
        : [],
    [fixo],
  );
  const linha = estado?.atual ? estadoDoTeste(estado.atual, agora) : null;
  const repeticoesMax = estado?.repeticoesMax ?? 10;
  // Teto do lado do CLIENTE é só UX (evita o clique óbvio); quem barra de
  // verdade é a rota — o campo é para operador distraído, não uma segunda
  // fonte de política.
  const repeticoesNumero = Math.min(
    repeticoesMax,
    Math.max(1, Math.round(Number(repeticoes)) || 1),
  );
  const restantes = estado?.atual ? repeticoesRestantesEfetivas(estado.atual, new Date(agora)) : 0;
  /**
   * O estado da tarefa atual em UMA expressão — o mesmo `estadoDoTeste` que
   * o corpo já usa, reduzido ao rótulo. Sem destino configurado, é isso que
   * o cabeçalho fechado precisa dizer: o disparo está desligado, e nenhum
   * clique aqui dentro muda isso.
   */
  const resumo =
    estado === null
      ? undefined
      : !estado.numeroTeste
        ? "sem destino"
        : estado.atual === null
          ? "nenhuma tarefa"
          : estado.atual.estado === "pendente"
            ? new Date(estado.atual.expiraEm).getTime() <= agora
              ? "expirou"
              : `pendente${restantes > 0 ? ` · ${restantes} repetições` : ""}`
            : estado.atual.estado === "entregue"
              ? "entregue, aguardando confirmar"
              : `confirmado: ${estado.atual.resultado ?? ""}`;
  const canceladas = Boolean(estado?.atual?.repeticoesCanceladasEm);
  // Só multi-ciclo pedido tem o que mostrar: `restantes > 0` já garante que
  // não é o caso "terminou/expirou sozinho" (repeticoesRestantesEfetivas
  // zera os dois), e `!canceladas` separa de "operador interrompeu".
  const emAndamento = Boolean(
    estado?.atual && estado.atual.repeticoesTotal > 1 && restantes > 0 && !canceladas,
  );

  // O painel que é DONO do lead de teste é o dono da manutenção dele: o
  // mesmo laço de acompanhamento da ficha (`useEstadoCapturas`), aqui, sem
  // o operador sair do painel para ver POR QUE o teste não injeta.
  const {
    mapa: mapaCapturas,
    agora: agoraCaptura,
    carregado: capturasCarregadas,
    recarregar: recarregarCapturas,
  } = useEstadoCapturas(fixo ? [fixo.leadId] : []);
  const capturasDoFixo = fixo ? (mapaCapturas[fixo.leadId] ?? undefined) : undefined;
  const visivelCaptura = capturasCarregadas ? estadoVisivel(capturasDoFixo, agoraCaptura) : null;
  const capturaEmAndamento = visivelCaptura?.acompanhar === true;
  // Só bloqueia o disparo quando o alvo É o lead fixo — outro lead
  // escolhido no seletor não depende desta captura.
  const injetarBloqueadoPelaCaptura = alvoEfetivo === fixo?.leadId && capturaEmAndamento;

  function gerarCapturaTeste(forcar: boolean) {
    setGerandoCaptura(true);
    setAvisoCaptura(null);
    setErroCaptura(null);
    api
      .postFilaTesteCapturas(forcar)
      .then((resposta) => {
        if (resposta.enfileirados.length > 0) {
          setAvisoCaptura("Geração enfileirada — leva alguns minutos.");
        } else {
          setAvisoCaptura(`Nada a gerar: ${resposta.pulados[0]?.motivo ?? "sem demo salva"}.`);
        }
        recarregarCapturas();
        setRecarga((n) => n + 1); // também atualiza `fixo.pronto`, usado pela etapa "conteudo".
      })
      .catch((error: unknown) => setErroCaptura(mensagemErroFila(error, "Falha ao gerar a captura")))
      .finally(() => setGerandoCaptura(false));
  }

  // `data-bloco` é o gancho do QA visual (mesmo espírito de `data-lista`
  // na visão): o painel inteiro passa de 2000px, e é este bloco que o
  // `--so=teste` precisa mostrar legível.
  return (
    <PainelColapsavel
      id={PAINEL_DISPARO_TESTE}
      titulo="Disparo de teste"
      nivel={3}
      dataBloco="disparo-teste"
      resumo={resumo}
    >
      <p className="mt-1 text-xs text-ink-muted">
        Injeta UMA tarefa na fila. O aparelho a recebe na próxima vez que pedir trabalho — e ele
        pergunta a cada ~3 minutos, então pode levar até isso para sair. Clicar de novo não
        acelera: substitui a tarefa que está esperando.
      </p>

      {estado === null && !erro && (
        <SkeletonRows count={1} className="mt-2 h-24 rounded border border-line" />
      )}

      {estado && (
        <>
          <p className="mt-2 text-xs text-ink-secondary">
            Destino:{" "}
            {estado.numeroTeste ? (
              <span className="font-mono text-foreground">{estado.numeroTeste}</span>
            ) : (
              <span className="text-critical">não configurado</span>
            )}{" "}
            <span className="text-ink-muted">— nunca o telefone do lead.</span>
          </p>

          {/* ── Alvo ──────────────────────────────────────────────────────
              QUALQUER lead da base, procurado pelo NOME — antes eram os
              poucos que a visão ao lado tinha carregado, mais um campo de
              placeId à mão, que é um dado que a interface não mostra em
              lugar nenhum. O fixo de teste entra como opção extra (ver
              `extrasSeletor`) e continua sendo o padrão. */}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-secondary">
            <span className="w-20 shrink-0">Lead alvo</span>
            <SeletorLead
              nome="disparo-alvo"
              ariaLabel="Lead alvo do disparo de teste"
              valor={alvoEfetivo}
              extras={extrasSeletor}
              onEscolher={setAlvo}
            />
          </div>
          {/* ── Captura do lead fixo — visível sem clicar, e re-disparável ─
              O painel dono do lead de teste é o dono da manutenção dele:
              a regra "sem captura pronta o teste não injeta" já existia
              (`avaliarTeste`, etapa "conteudo"), mas até aqui o operador só
              via a CONSEQUÊNCIA (barrou em "o que enviar"), nunca o motivo
              — nem tinha como gerar sem sair do painel para a ficha. */}
          <div
            data-bloco="captura-teste"
            className="mt-2 rounded border border-line bg-surface-2 px-2 py-1.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs">
                <span className="text-ink-muted">Captura: </span>
                {capturasCarregadas && visivelCaptura ? (
                  <CapturaBadge capturas={capturasDoFixo} agora={agoraCaptura} />
                ) : (
                  <span className="text-ink-muted">carregando…</span>
                )}
              </div>
              <Button
                onClick={() => gerarCapturaTeste(capturaEmAndamento)}
                loading={gerandoCaptura}
                disabled={gerandoCaptura || !capturasCarregadas}
                variant={visivelCaptura?.estado === "pronto" ? "secondary" : "primary"}
              >
                {capturaEmAndamento
                  ? "Gerar de novo"
                  : visivelCaptura?.estado === "pronto"
                    ? "Refazer"
                    : "Gerar captura"}
              </Button>
            </div>
            {visivelCaptura?.estado === "pronto" && (
              <p className="mt-1 text-[10px] text-ink-muted">
                Já há captura pronta — gerar de novo substitui as imagens atuais.
              </p>
            )}
            {visivelCaptura?.estado === "falhou" && visivelCaptura.detalhe && (
              <p className="mt-1 rounded border border-critical/40 bg-critical/10 px-2 py-1 text-xs text-critical">
                {visivelCaptura.detalhe}
                {capturasDoFixo?.runUrl && (
                  <>
                    {" "}
                    <a
                      href={capturasDoFixo.runUrl}
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
            {avisoCaptura && <p className="mt-1 text-xs text-good">{avisoCaptura}</p>}
            {erroCaptura && <p className="mt-1 text-xs text-critical">{erroCaptura}</p>}
          </div>

          {/* ── Interruptores, na ordem real de avaliação ──────────────── */}
          <div className="mt-2 flex items-start gap-2 text-xs text-ink-secondary">
            <span className="w-20 shrink-0 py-1">Pular</span>
            {/* Grupo PRÓPRIO: no celular os quatro não cabem numa linha, e
                sem esta caixa o que sobra quebra para debaixo do rótulo, em
                vez de alinhar com os irmãos. */}
            <div className="flex min-w-0 flex-1 flex-wrap gap-2">
              {ETAPAS_TESTE.map((etapa) => (
                <button
                  key={etapa}
                  type="button"
                  onClick={() => alternarEtapa(etapa)}
                  aria-pressed={pular.includes(etapa)}
                  className={`rounded border px-2 py-1 text-xs ${
                    pular.includes(etapa)
                      ? "border-accent bg-accent/15 text-accent"
                      : "border-line bg-surface-2 text-ink-muted"
                  }`}
                >
                  {ETAPA_PULAR_LABEL[etapa]}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-1 text-[10px] text-ink-muted">
            Na ordem em que a seleção avalia. Ligado = a etapa não barra este disparo. Mesmo com
            tudo ligado, sem demo, sem captura pronta ou sem print a tarefa não é injetada — tarefa
            sem print quebra o ciclo no aparelho sem ensinar nada.
          </p>

          {/* ── Repetições — rearma sozinho a cada confirmação ──────────── */}
          <div data-bloco="repeticoes-teste" className="mt-2 flex items-center gap-2 text-xs text-ink-secondary">
            <span className="w-20 shrink-0">Repetições</span>
            <input
              type="number"
              min={1}
              max={repeticoesMax}
              step={1}
              value={repeticoes}
              onChange={(event) => setRepeticoes(event.target.value)}
              className="w-16 rounded border border-line bg-surface-2 px-2 py-1 text-xs text-foreground outline-none focus:border-accent"
            />
            <span className="text-[10px] text-ink-muted">
              de 1 a {repeticoesMax} — a cada confirmação, o servidor rearma sozinho.
            </span>
          </div>
          <p className="mt-1 text-[10px] text-ink-muted">
            A macro pergunta a cada ~3 minutos, então cada volta pode levar até isso para ser
            puxada.{" "}
            {repeticoesNumero > 1
              ? `${repeticoesNumero} repetições podem levar até ~${repeticoesNumero * 3} minutos — não é travamento.`
              : "Só rearma na CONFIRMAÇÃO: se ela não chegar, para aí — nunca vira laço de envios."}
          </p>
          {(emAndamento || canceladas) && (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <p className={`text-xs ${canceladas ? "text-warning" : "text-accent"}`}>
                {canceladas
                  ? `Repetições canceladas pelo operador${estado?.atual ? ` (pedidas ${estado.atual.repeticoesTotal}).` : "."}`
                  : `Faltam ${restantes} de ${estado?.atual?.repeticoesTotal ?? 0} repetições.`}
              </p>
              {emAndamento && (
                <button
                  type="button"
                  onClick={cancelarRepeticoes}
                  disabled={cancelando}
                  className="rounded border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning disabled:opacity-50"
                >
                  {cancelando ? "cancelando…" : "Cancelar repetições restantes"}
                </button>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={disparar}
            disabled={ocupado || injetarBloqueadoPelaCaptura}
            className="mt-2 rounded border border-accent bg-accent/15 px-2 py-1 text-xs font-semibold text-accent disabled:opacity-50"
          >
            {ocupado ? "disparando…" : "Disparar teste"}
          </button>
          {injetarBloqueadoPelaCaptura && (
            <p className="mt-1 text-[10px] text-warning">
              Desabilitado: a captura do lead fixo está{" "}
              {visivelCaptura?.estado === "rodando" ? "gerando" : "enfileirada"} — a tarefa não sai
              sem print pronto.
            </p>
          )}

          {/* ── O resultado do último clique ───────────────────────────── */}
          {barreira && (
            <p className="mt-2 rounded border border-warning/40 bg-warning/10 px-2 py-1 text-xs text-warning">
              Não injetou — {barreira.nome} parou em{" "}
              <strong>{ETAPA_TESTE_LABEL[barreira.etapa] ?? barreira.etapa}</strong>:{" "}
              {MOTIVO_TESTE_LABEL[barreira.motivo] ?? barreira.motivo}.
            </p>
          )}

          {/* ── A tarefa atual ─────────────────────────────────────────── */}
          {linha && estado.atual ? (
            <div className="mt-2 rounded border border-line p-2">
              <p className={`text-xs ${linha.tom}`}>{linha.texto}</p>
              <p className="mt-0.5 text-[10px] text-ink-muted">
                {estado.atual.nome} · para{" "}
                <span className="font-mono">{estado.atual.numero}</span> · disparada em{" "}
                {formatDateTime(estado.atual.criadoEm)}
                {estado.atual.pulou.length > 0 &&
                  ` · pulou ${estado.atual.pulou.map((e) => ETAPA_PULAR_LABEL[e]).join(", ")}`}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-xs text-ink-muted">Nenhum teste disparado ainda.</p>
          )}
        </>
      )}

      {erro && <p className="mt-2 text-xs text-critical">{erro}</p>}
    </PainelColapsavel>
  );
}
