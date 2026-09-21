"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { SkeletonRows } from "@/components/Skeleton";
import { PainelColapsavel } from "@/components/config/PainelColapsavel";
import { CAMPO_BASE_CLS, mensagemErroFila } from "@/components/config/comum";
import { ApiError, api } from "@/lib/api-client";
import type { RespostaPendente } from "@/lib/fila/estado";
import type { GrupoComErro } from "@/lib/fila/respostasPainel";
import type { SimulacaoResposta } from "@/lib/fila/simularResposta";
import { formatDateTime } from "@/lib/format";
import { linkWhatsAppBusinessAndroid, podeAbrirBusiness } from "@/lib/wa";

/** Chave da persistência deste painel — ver `PainelColapsavel`. */
export const PAINEL_RESPOSTAS = "respostas-pendentes";

/* ── Painel "Respostas pendentes" ────────────────────────────────────── */

/**
 * O lead respondeu, a IA rascunhou (ver `flushRespostas.ts`), e agora
 * alguém precisa decidir. Esta é a tela dessa decisão.
 *
 * **Seção PRÓPRIA, irmã de "Fila de envio", e não um bloco subordinado a
 * ela** como a lista de print. A pendência de print é um efeito colateral
 * do ENVIO (mesma claim, mesmo `filaEnvios`, mesmo ciclo), então pertence
 * àquele painel. A resposta do lead é o outro pilar: coleção própria
 * (`filaRespostas`), rota própria, ciclo de vida próprio — e no
 * ARCHITECTURE.md "Fila de envio" e "Fila de respostas" já são seções
 * irmãs, não uma dentro da outra. Nada de linguagem nova, porém: é o mesmo
 * `<section>` de todo painel da página.
 *
 * ADMIN ONLY, como o bloco da fila — com uma razão a mais: o corpo destas
 * mensagens é conversa PRIVADA captada do celular pessoal do operador (ver
 * PRIVACIDADE no ARCHITECTURE.md). 403 mostra a linha de restrição e nada
 * mais.
 */
export function RespostasPendentesSection() {
  const [linhas, setLinhas] = useState<RespostaPendente[] | null>(null);
  /**
   * Vem da MESMA chamada que trouxe a lista. Ligado, o que está na fila do
   * aparelho não é pendência de aprovação e não aparece aqui — e uma lista
   * curta sem explicação é um estado que mente.
   */
  const [automatica, setAutomatica] = useState(false);
  /**
   * A LINHA DE ESTADO. Entre a mensagem do lead chegar e o rascunho existir
   * corre a janela de agrupamento, e até este bloco não havia sinal nenhum
   * de que algo tinha chegado: o operador via "Nenhuma resposta esperando"
   * e não sabia se a captura no celular falhou ou se era só a janela ainda
   * aberta. `aguardando` é o "sim, chegou"; `comErro` é o que a geração não
   * conseguiu produzir, nomeado e retentável.
   */
  const [aguardando, setAguardando] = useState(0);
  const [comErro, setComErro] = useState<GrupoComErro[]>([]);
  const [janelaSegundos, setJanelaSegundos] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [restrito, setRestrito] = useState(false);
  /**
   * Só o "tentar de novo" liga isto, e não `carregar` — a carga da ABERTURA
   * sai de um efeito, e `setState` síncrono no corpo de um efeito é render
   * em cascata (o lint cobra, e tem razão: a tela já tem o esqueleto para
   * dizer que está carregando).
   */
  const [recarregando, setRecarregando] = useState(false);
  /**
   * Só o Android abre o Business por URI de intent. Sai de
   * `useSyncExternalStore`, e não de estado num efeito, porque é
   * exatamente o caso dele: um valor que o SERVIDOR não pode conhecer
   * (`navigator` não existe lá) e que o cliente conhece já na primeira
   * pintura. O instantâneo do servidor é `false` — o React reconcilia
   * sozinho depois da hidratação, sem divergência e sem render em
   * cascata. `subscribe` devolve um no-op porque o aparelho não vira
   * outro no meio da sessão.
   */
  const noCelular = useSyncExternalStore(
    () => () => {},
    () => podeAbrirBusiness(navigator.userAgent),
    () => false,
  );

  /**
   * ABRIR O PAINEL ESVAZIA OS GRUPOS MADUROS: este GET roda o MESMO
   * `flushGruposMaduros` dos outros dois gatilhos antes de listar (ver o
   * route handler). É por isso que ele é chamado na abertura e depois de
   * cada decisão — e NUNCA em intervalo: cada chamada pode custar uma
   * geração de IA por grupo vencido.
   */
  function carregar(): Promise<void> {
    return api
      .getFilaRespostas()
      .then(({ respostas, respostaAutomatica, aguardando, comErro, janelaSegundos }) => {
        setLinhas(respostas);
        setAutomatica(respostaAutomatica);
        setAguardando(aguardando);
        setComErro(comErro);
        setJanelaSegundos(janelaSegundos);
        setErro(null);
      })
      .catch((error) => {
        setLinhas([]);
        if (error instanceof ApiError && error.status === 403) {
          setRestrito(true);
          return;
        }
        setErro(mensagemErroFila(error, "Falha ao carregar as respostas"));
      });
  }

  useEffect(() => {
    void carregar();
    // Uma vez, na montagem: as recargas seguintes são por AÇÃO (uma
    // pendência resolvida, ou o "tentar de novo"), nunca por intervalo —
    // esta rota esvazia os grupos maduros, e cada chamada pode custar uma
    // geração de IA.
  }, []);

  /** O "tentar de novo" dos grupos com erro: mesma carga, com o botão travado. */
  function tentarDeNovo() {
    setRecarregando(true);
    void carregar().finally(() => setRecarregando(false));
  }

  /** Tira a linha da lista na hora; a relê depois, que é quem tem a verdade. */
  function resolvida(id: string) {
    setLinhas((atual) => atual?.filter((l) => l.id !== id) ?? null);
    void carregar();
  }

  /**
   * Quantas esperam decisão — e, quando a automática está ligada, a razão
   * de a contagem ser curta, dita já no cabeçalho fechado. Sem isso o
   * operador olharia "0" e concluiria que ninguém respondeu.
   */
  const resumo =
    linhas === null
      ? undefined
      : [
          `${linhas.length}`,
          // O cabeçalho FECHADO precisa dizer que algo chegou: é o único
          // lugar visível quando o painel está recolhido, e "0" sozinho
          // mentiria sobre uma conversa que está na janela agora.
          aguardando > 0 ? `${aguardando} na janela` : "",
          comErro.length > 0 ? `${comErro.length} com erro` : "",
          automatica ? "automática ligada" : "",
        ]
          .filter(Boolean)
          .join(" · ");

  if (restrito) {
    return (
      <PainelColapsavel id={PAINEL_RESPOSTAS} titulo="Respostas pendentes" resumo="restrito">
        <p className="mt-2 text-sm text-ink-muted">Respostas pendentes é restrito ao admin.</p>
      </PainelColapsavel>
    );
  }

  return (
    <PainelColapsavel id={PAINEL_RESPOSTAS} titulo="Respostas pendentes" resumo={resumo}>
      <p className="mt-1 text-xs text-ink-muted">
        O lead respondeu e a IA rascunhou. O rascunho é ponto de partida: edite antes de usar — o
        que sai é o que está na caixa.{" "}
        {/* Como a instrução da lista de print: a explicação do MECANISMO só
            aparece quando há o que fazer. Com a lista vazia, dizer como o
            botão abre o Business é instruir uma tarefa que não existe. */}
        {linhas !== null && linhas.length > 0 && (
          noCelular ? (
            "“Usar” abre a conversa no WhatsApp Business com o texto pronto."
          ) : (
            /* O caso que o botão sozinho não resolve: sem Android não há
               Business para abrir, e um botão que não faz nada em metade dos
               casos é pior que botão ausente. Aqui ele TROCA de mecanismo, e
               a tela diz qual — em vez de falhar calado. */
            <span data-aviso="sem-business">
              Aberta no computador, não há Business para abrir: “usar” copia o texto para a área de
              transferência. O botão do Business aparece com a /config aberta no celular.
            </span>
          )
        )}
      </p>

      {linhas === null && (
        <SkeletonRows count={1} className="mt-3 h-40 rounded border border-line" />
      )}

      {automatica && (
        // A razão de a lista ser curta, dita NA TELA. Sem isto, o operador
        // olha um painel vazio e conclui que ninguém respondeu.
        <p data-aviso="resposta-automatica" className="mt-2 text-xs text-ink-muted">
          Resposta automática ligada: o que já está na fila do aparelho não aparece aqui. Desligue
          em “Fila de envio → Resposta automática” para trazer tudo de volta para cá.
        </p>
      )}

      {/* ── A LINHA DE ESTADO ──────────────────────────────────────────
          O que chegou e ainda não virou rascunho. Antes dela, entre a
          mensagem do lead chegar e o rascunho existir não havia sinal
          NENHUM na tela: "Nenhuma resposta esperando" cobria tanto "a
          captura no celular falhou" quanto "chegou, a janela ainda está
          aberta" — duas causas muito diferentes com a mesma cara. */}
      {aguardando > 0 && (
        <p data-estado="aguardando" className="mt-2 text-xs text-ink-secondary">
          <strong className="font-medium text-foreground">
            {aguardando === 1 ? "1 conversa recebida" : `${aguardando} conversas recebidas`}
          </strong>{" "}
          esperando a janela de agrupamento
          {janelaSegundos > 0 && ` (${janelaSegundos}s de silêncio)`} fechar. O rascunho aparece
          aqui na próxima vez que você abrir este painel.
        </p>
      )}

      {comErro.length > 0 && (
        // A geração falhou e o grupo VOLTOU para o pendente, marcado — não
        // se perdeu. Fica nomeado porque, diferente do que está na janela,
        // este não se resolve sozinho se a causa persistir (IA fora do ar,
        // cota estourada). Nunca o texto das mensagens: é conversa privada,
        // e aqui basta quantas são.
        <div data-estado="com-erro" className="mt-2 rounded border border-critical/40 bg-critical/10 p-2">
          <p className="text-xs text-critical">
            {comErro.length === 1
              ? "1 conversa não virou rascunho"
              : `${comErro.length} conversas não viraram rascunho`}
            . As mensagens não se perderam — voltaram para a fila e são tentadas de novo a cada
            abertura deste painel.
          </p>
          <ul data-lista="grupos-com-erro" className="mt-1.5 flex flex-col gap-1">
            {comErro.map((grupo) => (
              <li key={grupo.leadId} className="text-[11px] text-ink-secondary">
                <span className="text-foreground">{grupo.nome || grupo.leadId}</span>
                {" · "}
                {grupo.mensagens === 1 ? "1 mensagem" : `${grupo.mensagens} mensagens`}
                {" · "}
                {grupo.tentativas === 1 ? "1 tentativa" : `${grupo.tentativas} tentativas`}
                {grupo.ultimaMensagemEm && ` · ${formatDateTime(grupo.ultimaMensagemEm)}`}
                <span className="block text-ink-muted">{grupo.ultimoErro}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={tentarDeNovo}
            disabled={recarregando}
            title="Roda o esvaziamento de novo — custa uma geração de IA por grupo"
            className={`${ACAO_RESPOSTA_CLS} mt-1.5 border-critical/40 bg-surface-2 text-critical disabled:opacity-50`}
          >
            {recarregando ? "tentando…" : "tentar de novo (1 geração por grupo)"}
          </button>
        </div>
      )}

      {linhas?.length === 0 && !erro && aguardando === 0 && comErro.length === 0 && (
        // Estado vazio de UMA linha: nada de caixa vazia ocupando o painel.
        // `!erro` porque falhar ao carregar não é "não há resposta": dizer
        // isso quando a lista nem chegou esconderia o que ela existe para
        // mostrar. E só quando não há NADA a caminho — com grupo na janela
        // ou com erro, "nenhuma resposta esperando" seria mentira.
        <p className="mt-3 text-xs text-ink-muted">Nenhuma resposta esperando.</p>
      )}

      {linhas && linhas.length > 0 && (
        <ul data-lista="respostas" className="mt-3 flex flex-col gap-3">
          {linhas.map((linha) => (
            <LinhaResposta
              key={linha.id}
              linha={linha}
              noCelular={noCelular}
              onResolvida={() => resolvida(linha.id)}
              onErro={setErro}
            />
          ))}
        </ul>
      )}

      <SimularMensagemBloco />

      {erro && <p className="mt-2 text-sm text-critical">{erro}</p>}
    </PainelColapsavel>
  );
}

/**
 * Copia para a área de transferência. `navigator.clipboard` exige contexto
 * seguro (https, ou 127.0.0.1 — onde o laço de captura roda); a reserva com
 * `execCommand` cobre o resto, inclusive um navegador que negue a permissão.
 * Retorna se deu certo: "usar" que não copiou nada não pode marcar a
 * pendência como usada e sumir com o único lugar onde o texto existia.
 */
async function copiarTexto(texto: string, campo: HTMLTextAreaElement | null): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    if (!campo) return false;
    try {
      campo.select();
      return document.execCommand("copy");
    } catch {
      return false;
    }
  }
}

/**
 * As três ações de uma linha. Classe COMPARTILHADA porque uma delas é
 * `<a>` e as outras `<button>`: o botão tem `line-height: normal` do
 * navegador e a âncora herda o da página, e sem fixar o leading a âncora
 * fica uns 4px mais alta que o botão ao lado — desalinhamento que só a
 * captura mostra.
 */
const ACAO_RESPOSTA_CLS = "rounded border px-2 py-1 text-xs leading-4";

/**
 * Uma resposta pendente: o contexto (o que o lead mandou, o que o Radar
 * tinha mandado), o rascunho EDITÁVEL, e as duas saídas.
 *
 * **A caixa é o estado, o rascunho é só o valor inicial.** É o texto
 * editado que vai para o WhatsApp e é ele que o `PATCH` guarda — gravar o
 * rascunho original registraria uma resposta que ninguém recebeu.
 *
 * **"Usar" no Android é uma âncora de VERDADE, não um `onClick` que
 * navega.** O Chrome recusa lançar aplicativo externo a partir de
 * navegação sem gesto do usuário; esperar o `PATCH` para só então mexer em
 * `location` gastaria o gesto e o intent não abriria nada. Então o `href`
 * carrega a URI de intent, o navegador navega sozinho, e a marcação sai na
 * mesma ação com `keepalive` (ver `patchFilaResposta`) — sem `await` no
 * caminho crítico.
 */
function LinhaResposta({
  linha,
  noCelular,
  onResolvida,
  onErro,
}: {
  linha: RespostaPendente;
  noCelular: boolean;
  onResolvida: () => void;
  onErro: (erro: string | null) => void;
}) {
  const [texto, setTexto] = useState(linha.rascunho);
  const [ocupado, setOcupado] = useState(false);
  const campo = useRef<HTMLTextAreaElement>(null);

  /**
   * A caixa cresce com o conteúdo. Altura fixa cortava o rascunho no meio
   * de uma linha — meia fileira de letras fatiada, que lê como quebrado
   * mesmo rolando —, e não dá para editar o que não se vê. `max-h` na
   * classe segura o caso patológico (o rascunho da IA é limitado em 700
   * caracteres, mas o operador cola o que quiser). Mexer no DOM dentro de
   * um efeito é o uso para o qual efeito existe; não há estado aqui.
   */
  useEffect(() => {
    const el = campo.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [texto]);

  // Sem telefone não há conversa para abrir (lead sem número, ou lead que
  // sumiu da base): o caminho vira o de copiar, no celular também.
  const linkBusiness = linha.telefone
    ? linkWhatsAppBusinessAndroid(texto, linha.telefone)
    : undefined;
  const abreNoBusiness = noCelular && linkBusiness !== undefined;

  async function marcar(estado: "usada" | "descartada") {
    setOcupado(true);
    onErro(null);
    try {
      await api.patchFilaResposta(linha.id, estado, estado === "usada" ? texto : undefined);
      onResolvida();
    } catch (error) {
      onErro(mensagemErroFila(error, "Falha ao salvar"));
      setOcupado(false);
    }
  }

  /** Fora do Android: copia PRIMEIRO, e só marca como usada se copiou. */
  async function usarCopiando() {
    if (!(await copiarTexto(texto, campo.current))) {
      onErro("Não consegui copiar o texto. Selecione e copie à mão antes de marcar como usada.");
      return;
    }
    await marcar("usada");
  }

  return (
    <li className="rounded border border-line p-2">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <a
          href={`/leads/${linha.leadId}`}
          className="text-xs text-foreground underline decoration-line underline-offset-2"
        >
          {linha.nome || linha.leadId}
        </a>
        {linha.nicho && <span className="text-[10px] text-ink-muted">{linha.nicho}</span>}
        {linha.geradoEm && (
          <span className="text-[10px] text-ink-muted">{formatDateTime(linha.geradoEm)}</span>
        )}
      </div>

      {/* O que o LEAD mandou — todas as mensagens do grupo, na ordem. É o
          bloco em destaque: é ele que decide o que responder. */}
      <ul data-bloco="mensagens" className="mt-2 flex flex-col gap-1">
        {linha.mensagens.map((mensagem, i) => (
          <li
            key={`${mensagem.recebidoEm}-${i}`}
            className="rounded border border-accent/30 bg-accent/10 px-2 py-1"
          >
            <p className="whitespace-pre-wrap text-xs text-foreground">{mensagem.texto}</p>
            <p className="mt-0.5 text-[10px] text-ink-muted">
              {formatDateTime(mensagem.recebidoEm)}
            </p>
          </li>
        ))}
      </ul>

      {/* O que o Radar tinha mandado — contexto, não ação. Some quando a
          reconstrução falha, em vez de deixar caixa vazia. */}
      {linha.mensagemEnviada && (
        <details data-bloco="enviada" className="mt-1.5">
          <summary className="cursor-pointer text-[10px] text-ink-muted">
            o que o Radar mandou
          </summary>
          <p className="mt-1 whitespace-pre-wrap border-l-2 border-line pl-2 text-[11px] text-ink-secondary">
            {linha.mensagemEnviada}
          </p>
        </details>
      )}

      <textarea
        ref={campo}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={3}
        aria-label="Rascunho da resposta"
        className={`${CAMPO_BASE_CLS} mt-2 max-h-[50vh] resize-y overflow-y-auto text-xs leading-relaxed`}
      />

      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        {abreNoBusiness ? (
          <a
            href={linkBusiness}
            onClick={() => {
              // Sem `await`: a navegação tem que sair NESTE gesto (ver o
              // comentário do componente). O PATCH vai junto, com keepalive.
              void marcar("usada");
            }}
            className={`${ACAO_RESPOSTA_CLS} border-accent bg-accent/15 text-accent`}
          >
            usar no Business
          </a>
        ) : (
          <button
            type="button"
            onClick={usarCopiando}
            disabled={ocupado}
            title={
              linha.telefone
                ? "Copia o texto e marca como usada"
                : "Lead sem telefone: não há conversa para abrir, só copiar"
            }
            className={`${ACAO_RESPOSTA_CLS} border-accent bg-accent/15 text-accent disabled:opacity-50`}
          >
            usar (copiar texto)
          </button>
        )}
        <button
          type="button"
          onClick={() => marcar("descartada")}
          disabled={ocupado}
          title="Some da lista — responda do seu jeito, sem usar o rascunho"
          className={`${ACAO_RESPOSTA_CLS} border-line bg-surface-2 text-ink-muted disabled:opacity-50`}
        >
          descartar
        </button>
        {texto !== linha.rascunho && (
          <span className="text-[10px] text-ink-muted">editado</span>
        )}
      </div>
    </li>
  );
}

/* ── Bloco "Simular mensagem" ────────────────────────────────────────── */

/** Chave da persistência deste bloco — ver `PainelColapsavel`. */
export const PAINEL_SIMULAR = "respostas-simular";

/**
 * O ensaio que testa a IA, e só a IA.
 *
 * O outro teste da fila de respostas é o NÚMERO DE EXCEÇÃO, e ele prova
 * duas coisas ao mesmo tempo e devagar: o caminho do CELULAR (notificação,
 * macro, rota, casamento, dedupe, agrupamento) e a QUALIDADE da IA
 * (contexto do lead, documento comercial, prompt). São problemas de ritmo
 * diferente — o primeiro se acerta uma vez e fica; no segundo o operador
 * itera dezenas de vezes, muda uma linha do contexto comercial e olha o que
 * mudou. Este bloco separa os dois.
 *
 * Bloco SUBORDINADO (nível 3) a "Respostas pendentes", e não painel próprio:
 * ele testa exatamente o que aquele painel mostra, e um painel irmão o
 * deixaria longe do resultado que explica. Mesma escolha do "Disparo de
 * teste" dentro de "Fila de envio".
 */
function SimularMensagemBloco() {
  const [leadId, setLeadId] = useState("");
  const [texto, setTexto] = useState("");
  const [resultado, setResultado] = useState<SimulacaoResposta | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // O lead PADRÃO é o `leadContextoExcecao` já escolhido em "Fila de envio":
  // o operador já disse ali qual lead usa para ensaiar, e perguntar de novo
  // seria pedir o mesmo dado duas vezes. Falhar aqui não é erro de tela —
  // o campo simplesmente nasce vazio e a pessoa digita.
  useEffect(() => {
    let ignore = false;
    api
      .getLeadPadraoSimulacao()
      .then(({ leadPadrao }) => {
        if (!ignore && leadPadrao) setLeadId(leadPadrao);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);

  async function simular() {
    setGerando(true);
    setErro(null);
    try {
      setResultado(await api.simularResposta(leadId.trim(), texto));
    } catch (error) {
      setErro(mensagemErroFila(error, "Falha ao simular"));
    } finally {
      setGerando(false);
    }
  }

  const podeSimular = leadId.trim().length > 0 && texto.trim().length > 0 && !gerando;

  return (
    <PainelColapsavel id={PAINEL_SIMULAR} titulo="Simular mensagem" nivel={3}>
      <p className="mt-1 text-xs text-ink-muted">
        Escreva o que um lead escreveria e veja o rascunho na hora. Pula a captura no celular, o
        casamento por telefone, o dedupe e a janela de agrupamento — mas NÃO pula a geração: é a
        mesma montagem de prompt e a mesma chamada de IA da produção. O resultado não entra na
        lista acima, não vira tarefa de envio e não toca no lead.
      </p>

      <div className="mt-3 flex items-center gap-2 text-xs text-ink-secondary">
        <span className="w-32 shrink-0">Lead de contexto</span>
        <input
          value={leadId}
          onChange={(event) => setLeadId(event.target.value)}
          placeholder="placeId do lead"
          disabled={gerando}
          aria-label="Lead de contexto da simulação"
          className="min-w-0 flex-1 rounded border border-line bg-surface-2 px-2 py-1 font-mono text-xs text-foreground outline-none focus:border-accent disabled:opacity-50"
        />
      </div>

      {/* MULTILINHA de propósito: um lead manda parágrafo, não uma linha —
          e testar com uma linha só testaria uma pergunta que ninguém faz. */}
      <textarea
        value={texto}
        onChange={(event) => setTexto(event.target.value)}
        rows={3}
        disabled={gerando}
        aria-label="Mensagem que o lead mandaria"
        placeholder="Ex.: “Oi, vi o site. Quanto custa? Tem manutenção depois?”"
        className={`${CAMPO_BASE_CLS} mt-2 resize-y text-xs leading-relaxed disabled:opacity-50`}
      />

      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={simular}
          disabled={!podeSimular}
          data-acao="simular"
          className={`${ACAO_RESPOSTA_CLS} border-accent bg-accent/15 text-accent disabled:opacity-50`}
        >
          {/* O PREÇO no próprio botão: cada clique gasta uma geração da cota
              do mês, e um clique barato de dar e caro de pagar precisa
              dizer isso antes, não num aviso depois. */}
          {gerando ? "gerando…" : "simular (1 geração de IA)"}
        </button>
        {resultado && (
          <button
            type="button"
            onClick={simular}
            disabled={!podeSimular}
            data-acao="regenerar"
            title="Mesma mensagem, outra geração — para comparar variações"
            className={`${ACAO_RESPOSTA_CLS} border-line bg-surface-2 text-ink-muted disabled:opacity-50`}
          >
            regenerar (mais 1)
          </button>
        )}
      </div>

      {resultado && <ResultadoSimulacao resultado={resultado} />}
      {erro && <p className="mt-2 text-sm text-critical">{erro}</p>}
    </PainelColapsavel>
  );
}

/**
 * O resultado, MARCADO como simulação — e o contexto que a IA recebeu.
 *
 * A seção recolhível existe por um motivo só: quando um rascunho sai ruim,
 * o operador precisa saber se FALTOU informação no contexto ou se a IA
 * errou com informação suficiente. Sem ela, as duas coisas parecem iguais —
 * e a reação a cada uma é oposta (escrever mais no contexto comercial vs.
 * mexer no prompt). Os campos saem de quem GEROU o prompt, nunca de um
 * recálculo na tela: um recálculo pode divergir do real justamente no dia
 * em que a pergunta importa.
 */
function ResultadoSimulacao({ resultado }: { resultado: SimulacaoResposta }) {
  const { contexto } = resultado;

  return (
    <div data-bloco="simulacao" className="mt-2 rounded border border-accent/30 bg-accent/5 p-2">
      <p className="text-[10px] uppercase tracking-wide text-accent">
        simulação — não entra na lista, não vira envio
      </p>
      <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-foreground">
        {resultado.rascunho}
      </p>

      <details data-bloco="contexto-enviado" className="mt-2">
        <summary className="cursor-pointer text-[10px] text-ink-muted">contexto enviado</summary>
        <dl className="mt-1 flex flex-col gap-1 border-l-2 border-line pl-2 text-[11px]">
          <LinhaContexto rotulo="lead">
            {contexto.nome || resultado.leadId}
            {contexto.nicho && ` · ${contexto.nicho}`}
            {` · responde em ${contexto.idioma}`}
          </LinhaContexto>
          <LinhaContexto rotulo="o Radar mandou">
            {contexto.mensagemEnviada || <Ausente>não foi possível reconstruir</Ausente>}
          </LinhaContexto>
          <LinhaContexto rotulo="a demo mostra">
            {contexto.resumoDemo || <Ausente>nada — o lead não tem demo com dados</Ausente>}
          </LinhaContexto>
          <LinhaContexto rotulo="preço">
            {contexto.posicionamentoPreco || <Ausente>nenhum — o lead não tem nicho</Ausente>}
          </LinhaContexto>
          {/* A pergunta mais frequente diante de um rascunho vago, e por isso
              é a que a linha responde direto: o documento estava preenchido? */}
          <LinhaContexto rotulo="contexto comercial">
            {contexto.contextoComercialPreenchido ? (
              "preenchido — foi junto no prompt"
            ) : (
              <Ausente>
                VAZIO — preencha o painel “Contexto comercial” para a IA saber o que você vende
              </Ausente>
            )}
          </LinhaContexto>
        </dl>
      </details>
    </div>
  );
}

function LinhaContexto({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-ink-muted">{rotulo}</dt>
      <dd className="whitespace-pre-wrap text-ink-secondary">{children}</dd>
    </div>
  );
}

/** O que NÃO foi ao prompt — dito como ausência, nunca como caixa vazia. */
function Ausente({ children }: { children: React.ReactNode }) {
  return <span className="text-ink-muted">{children}</span>;
}
