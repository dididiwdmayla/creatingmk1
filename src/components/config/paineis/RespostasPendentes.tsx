"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { SkeletonRows } from "@/components/Skeleton";
import { PainelColapsavel } from "@/components/config/PainelColapsavel";
import { CAMPO_BASE_CLS, mensagemErroFila } from "@/components/config/comum";
import { ApiError, api } from "@/lib/api-client";
import type { RespostaPendente } from "@/lib/fila/estado";
import { formatDateTime } from "@/lib/format";
import { linkWhatsAppBusinessAndroid, podeAbrirBusiness } from "@/lib/wa";

/** Chave da persistência deste painel — ver `PainelColapsavel`. */
const PAINEL_RESPOSTAS = "respostas-pendentes";

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
  const [erro, setErro] = useState<string | null>(null);
  const [restrito, setRestrito] = useState(false);
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

  function carregar() {
    api
      .getFilaRespostas()
      .then(({ respostas, respostaAutomatica }) => {
        setLinhas(respostas);
        setAutomatica(respostaAutomatica);
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

  useEffect(carregar, []);

  /** Tira a linha da lista na hora; a relê depois, que é quem tem a verdade. */
  function resolvida(id: string) {
    setLinhas((atual) => atual?.filter((l) => l.id !== id) ?? null);
    carregar();
  }

  /**
   * Quantas esperam decisão — e, quando a automática está ligada, a razão
   * de a contagem ser curta, dita já no cabeçalho fechado. Sem isso o
   * operador olharia "0" e concluiria que ninguém respondeu.
   */
  const resumo =
    linhas === null
      ? undefined
      : `${linhas.length}${automatica ? " · automática ligada" : ""}`;

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

      {linhas?.length === 0 && !erro && (
        // Estado vazio de UMA linha: nada de caixa vazia ocupando o painel.
        // `!erro` porque falhar ao carregar não é "não há resposta": dizer
        // isso quando a lista nem chegou esconderia o que ela existe para
        // mostrar.
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
