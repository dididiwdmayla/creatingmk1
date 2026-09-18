"use client";

import { useCallback, useEffect, useState } from "react";

import { NIVEL_CLS, NIVEL_LABEL } from "@/components/config/comum";
import { ApiError, api, type FilaBalaoResponse } from "@/lib/api-client";
import { MOTIVO_FISICO_LABEL, type LinhaFilaPainel, type LinhaPendenteManual } from "@/lib/fila/estado";
import { formatDateTime, formatInt, formatTempoRelativo } from "@/lib/format";

/**
 * O BALÃO DA FILA — indicador fixo na lateral direita, em TODA tela do app,
 * ADMIN ONLY (quem decide é o layout do servidor: para membro ele não chega
 * a entrar no HTML).
 *
 * **O custo é o projeto.** Um indicador que existe em toda tela não pode
 * buscar a fila inteira a cada navegação — isso multiplicaria leitura por
 * página aberta, o oposto do que o pool de candidatos existe para fazer.
 * Daí os dois estados, com custos separados:
 *
 * - **fechado**: 2 leituras de doc (`config/fila` + contador do dia). Como o
 *   componente vive no layout do app, ele NÃO remonta ao trocar de aba —
 *   são 2 leituras por carregamento de página, não por navegação. E **não há
 *   polling**: o número muda quando o aparelho envia, não a cada segundo.
 * - **aberto**: a lista completa, buscada só no clique que abre (4 leituras
 *   de doc + uma por linha). Fechar e abrir de novo relê; navegar não.
 *
 * **NADA aqui dispara envio.** Quem entrega é o ciclo do aparelho pedindo
 * `GET /api/fila/proximo`; isto mostra o que ele vai encontrar quando pedir.
 *
 * **Arrastar para reordenar não existe, e não é esquecimento:** a ordem muda
 * sozinha conforme as janelas de horário abrem e fecham, então uma ordem
 * arrastada à mão seria uma promessa que a rota não consegue honrar.
 *
 * **Sem animação contínua e sem desfoque**, como todo o cromo que fica na
 * tela o dia inteiro (ver "Custo" em ARCHITECTURE.md e
 * `globals.custo.test.ts`, que trava isto lendo este arquivo).
 */

/** Rótulo de cada portão de ritmo — espelha `RITMO_LABEL` do painel da /config. */
const RITMO_LABEL: Record<string, string> = {
  pausado: "a fila está pausada",
  meta_atingida: "a meta do dia já foi atingida",
  teto_hora: "o teto por hora foi atingido",
  intervalo: "ainda não passou o intervalo mínimo entre envios",
};

/**
 * Uma linha da sequência. Traz os parâmetros que explicam a POSIÇÃO dela —
 * nicho, nível da janela, hora local do lead e o selo "manual", que é a
 * resposta visível a "por que esse está na frente de quem chegou antes".
 */
function LinhaFila({
  posicao,
  linha,
  ocupado,
  erro,
  onRemover,
}: {
  posicao: number;
  linha: LinhaFilaPainel;
  ocupado: boolean;
  erro: string | null;
  onRemover: () => void;
}) {
  return (
    <li className="flex items-start gap-2 rounded border border-line p-2">
      <span className="mt-0.5 w-4 shrink-0 text-right font-mono text-[10px] text-ink-muted">
        {posicao}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <a
            href={`/leads/${linha.leadId}`}
            className="text-xs text-foreground underline decoration-line underline-offset-2"
          >
            {linha.nome || linha.leadId}
          </a>
          {linha.nivel && (
            <span className={`rounded border px-1 text-[10px] ${NIVEL_CLS[linha.nivel]}`}>
              {NIVEL_LABEL[linha.nivel]}
            </span>
          )}
          {linha.manual && (
            <span className="rounded border border-accent/40 bg-accent/10 px-1 text-[10px] text-accent">
              manual
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[10px] text-ink-muted">
          {linha.nicho && `${linha.nicho} · `}
          {linha.horaLocal} na hora do lead
        </p>
        {erro && <p className="mt-0.5 text-[10px] text-critical">{erro}</p>}
      </div>
      <button
        type="button"
        onClick={onRemover}
        disabled={ocupado}
        title="Descarta o lead: sai da fila. Reversível na ficha. Não cancela um envio já em andamento."
        className="shrink-0 rounded border border-line bg-surface-2 px-1.5 py-0.5 text-[10px] text-ink-muted hover:border-critical/60 hover:text-critical disabled:opacity-50"
      >
        remover
      </button>
    </li>
  );
}

/**
 * Uma linha PENDENTE: escolhida à mão, sem a peça que o envio exige. Não tem
 * posição nem nível — ela não está na sequência de entrega, e numerá-la
 * prometeria uma vez que não vai chegar. O motivo fica visível, que é a
 * única coisa capaz de fazer alguém resolver a pendência.
 */
function LinhaPendente({
  linha,
  ocupado,
  erro,
  onRemover,
}: {
  linha: LinhaPendenteManual;
  ocupado: boolean;
  erro: string | null;
  onRemover: () => void;
}) {
  return (
    <li className="flex items-start gap-2 rounded border border-warning/30 bg-warning/5 p-2">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <a
            href={`/leads/${linha.leadId}`}
            className="text-xs text-foreground underline decoration-line underline-offset-2"
          >
            {linha.nome || linha.leadId}
          </a>
          <span className="rounded border border-warning/50 bg-warning/15 px-1 text-[10px] text-warning">
            {MOTIVO_FISICO_LABEL[linha.motivo]}
          </span>
        </div>
        <p className="mt-0.5 text-[10px] text-ink-muted">
          {linha.nicho && `${linha.nicho} · `}não sai enquanto faltar essa peça
        </p>
        {erro && <p className="mt-0.5 text-[10px] text-critical">{erro}</p>}
      </div>
      <button
        type="button"
        onClick={onRemover}
        disabled={ocupado}
        title="Descarta o lead: sai da fila. Reversível na ficha."
        className="shrink-0 rounded border border-line bg-surface-2 px-1.5 py-0.5 text-[10px] text-ink-muted hover:border-critical/60 hover:text-critical disabled:opacity-50"
      >
        remover
      </button>
    </li>
  );
}

export function BalaoFila() {
  const [dados, setDados] = useState<FilaBalaoResponse | null>(null);
  const [aberto, setAberto] = useState(false);
  const [carregandoLista, setCarregandoLista] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  /** Recusa por claim ativa, POR LINHA: o motivo aparece onde se clicou. */
  const [erroLinha, setErroLinha] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);
  /** Instante FIXO da carga — nunca `Date.now()` no render. */
  const [agora, setAgora] = useState(() => Date.now());
  /**
   * A rota respondeu 403 (papel mudou no meio da sessão, aba velha): o balão
   * SOME em vez de virar caixa de erro em toda tela. Ele é acessório.
   */
  const [semAcesso, setSemAcesso] = useState(false);

  const buscar = useCallback(async (comLista: boolean) => {
    try {
      const resposta = await api.getFilaBalao(comLista);
      setDados(resposta);
      setAgora(Date.now());
      setErro(null);
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        setSemAcesso(true);
        return;
      }
      setErro("Falha ao ler a fila.");
    }
  }, []);

  // UMA carga, na montagem. Sem refetch por rota e sem polling: o componente
  // vive no layout, então trocar de aba não remonta nada — e o custo de um
  // indicador global é justamente o que este desenho existe para conter.
  useEffect(() => {
    void buscar(false);
  }, [buscar]);

  // Escape fecha, como qualquer sobreposição.
  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setAberto(false);
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aberto]);

  async function abrir() {
    setAberto(true);
    // A lista só é buscada AQUI — é a chamada cara, e ela acontece no
    // clique, nunca na navegação.
    setCarregandoLista(true);
    await buscar(true);
    setCarregandoLista(false);
  }

  async function remover(leadId: string) {
    setOcupado(leadId);
    setErroLinha((atual) => {
      const resto = { ...atual };
      delete resto[leadId];
      return resto;
    });
    try {
      // A resposta já traz o balão relido: quem continua na fila é decisão
      // do servidor, que reconfere cada linha contra o doc fresco.
      setDados(await api.deleteFilaBalaoLead(leadId));
      setAgora(Date.now());
    } catch (error) {
      setErroLinha((atual) => ({
        ...atual,
        [leadId]:
          error instanceof ApiError && error.status === 409
            ? "O aparelho está com esse lead reservado agora — remover não cancela o envio. Tente em alguns minutos."
            : "Falha ao remover.",
      }));
    } finally {
      setOcupado(null);
    }
  }

  if (semAcesso) return null;

  const restante = dados?.contador.restante ?? 0;
  const pausada = dados ? !dados.ativo : false;
  const motivoRitmo = dados?.ritmo ? (RITMO_LABEL[dados.ritmo] ?? dados.ritmo) : null;

  return (
    <>
      {/* A sobreposição que fecha ao clicar fora. Sem desfoque (regra do
          cromo) e sem escurecer: o balão é um indicador, não um diálogo que
          exige decisão — escurecer a tela inteira para uma consulta seria
          dramático demais. */}
      {aberto && (
        <button
          type="button"
          aria-label="Fechar a fila"
          onClick={() => setAberto(false)}
          className="fixed inset-0 z-30 cursor-default"
        />
      )}

      <div
        data-balao={aberto ? "aberto" : "fechado"}
        // ANCORADO no canto inferior direito, ACIMA da barra de navegação:
        // `--app-nav-h` mais uma folga, para nunca cobrir uma aba nem a
        // área segura do aparelho. À direita porque no desktop o conteúdo é
        // uma coluna centrada de 512px — ali sobra margem vazia e o balão
        // não encosta em nada.
        className="fixed right-2 z-40 flex flex-col items-end"
        style={{ bottom: "calc(var(--app-nav-h) + env(safe-area-inset-bottom) + 0.5rem)" }}
      >
        {aberto && (
          <div
            role="dialog"
            aria-label="Fila de envio"
            // Largura presa à viewport para não vazar no celular; altura
            // limitada com rolagem PRÓPRIA, para a lista nunca empurrar a
            // página nem sair por baixo do cromo.
            className="mb-2 flex w-[min(21rem,calc(100vw-1rem))] flex-col overflow-y-auto rounded-lg border border-line bg-surface p-3 shadow-lg"
            style={{ maxHeight: "calc(100dvh - var(--app-nav-h) - var(--app-header-h) - 3rem)" }}
          >
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Fila de envio
              </h2>
              <a href="/config" className="text-[10px] text-ink-muted underline-offset-2 hover:underline">
                painel
              </a>
            </div>

            {dados && (
              <>
                <p className="mt-2 text-xs">
                  <span className="font-mono text-sm text-foreground">
                    {formatInt(dados.contador.enviados)}
                  </span>
                  <span className="text-ink-muted"> de {formatInt(dados.contador.meta)} hoje · </span>
                  <span className="text-ink-secondary">
                    {restante === 0 ? "meta cumprida" : `faltam ${formatInt(restante)}`}
                  </span>
                </p>

                {motivoRitmo ? (
                  <p className="mt-2 rounded border border-warning/40 bg-warning/10 px-2 py-1 text-[10px] text-warning">
                    Nada sai agora: {motivoRitmo}.
                  </p>
                ) : (
                  <p className="mt-2 text-[10px] text-good">
                    Ritmo liberado — o próximo pedido do celular leva tarefa.
                  </p>
                )}

                {/* Dito na tela, e não só na documentação: esta lista é o
                    que o aparelho VAI encontrar, não um comando. */}
                <p className="mt-2 text-[10px] text-ink-muted">
                  Só leitura: nada aqui dispara envio. A ordem muda sozinha conforme as janelas de
                  horário abrem e fecham.
                </p>

                <h3 className="mt-3 text-[10px] font-medium uppercase tracking-wide text-ink-secondary">
                  Nesta ordem
                </h3>
                {carregandoLista && dados.fila.length === 0 && !dados.lista ? (
                  <p className="mt-1 text-xs text-ink-muted">Carregando…</p>
                ) : dados.poolGeradoEm === null ? (
                  <p className="mt-1 text-xs text-ink-muted">
                    O celular ainda não pediu tarefa nenhuma — não há fila montada.
                  </p>
                ) : dados.fila.length === 0 ? (
                  <p className="mt-1 text-xs text-ink-muted">
                    {motivoRitmo ? `Ninguém sai enquanto ${motivoRitmo}.` : "Nenhum lead elegível agora."}
                  </p>
                ) : (
                  <>
                    <ul data-lista="balao-fila" className="mt-1 flex flex-col gap-1.5">
                      {dados.fila.map((linha, i) => (
                        <LinhaFila
                          key={linha.leadId}
                          posicao={i + 1}
                          linha={linha}
                          ocupado={ocupado === linha.leadId}
                          erro={erroLinha[linha.leadId] ?? null}
                          onRemover={() => remover(linha.leadId)}
                        />
                      ))}
                    </ul>
                    {dados.elegiveis > dados.fila.length && (
                      <p className="mt-1 text-[10px] text-ink-muted">
                        e mais {formatInt(dados.elegiveis - dados.fila.length)} na fila, nesta ordem.
                      </p>
                    )}
                  </>
                )}

                {/* Os PENDENTES ao final: escolhidos à mão, sem a peça que o
                    envio exige. Sem esta seção eles ficariam marcados e
                    invisíveis — o operador clicou e nada aconteceria. */}
                {dados.pendentes.length > 0 && (
                  <>
                    <h3 className="mt-3 text-[10px] font-medium uppercase tracking-wide text-ink-secondary">
                      Pendentes de demo
                    </h3>
                    <p className="mt-0.5 text-[10px] text-ink-muted">
                      Adicionados à mão, mas falta a peça que o envio exige.
                    </p>
                    <ul data-lista="balao-pendentes" className="mt-1 flex flex-col gap-1.5">
                      {dados.pendentes.map((linha) => (
                        <LinhaPendente
                          key={linha.leadId}
                          linha={linha}
                          ocupado={ocupado === linha.leadId}
                          erro={erroLinha[linha.leadId] ?? null}
                          onRemover={() => remover(linha.leadId)}
                        />
                      ))}
                    </ul>
                    {dados.pendentesTotal > dados.pendentes.length && (
                      <p className="mt-1 text-[10px] text-ink-muted">
                        e mais {formatInt(dados.pendentesTotal - dados.pendentes.length)} pendentes.
                      </p>
                    )}
                  </>
                )}

                {/* O retrato é DATADO: a fila sai do pool, que pode ter até
                    dez minutos. Número defasado lido como se fosse agora é
                    pior que número ausente. */}
                {dados.poolGeradoEm && (
                  <p className="mt-3 border-t border-line pt-1 text-[10px] text-ink-muted">
                    Fila montada sobre o pool de {formatDateTime(dados.poolGeradoEm)} (
                    {formatTempoRelativo(dados.poolGeradoEm, agora)}).
                  </p>
                )}
              </>
            )}

            {erro && <p className="mt-2 text-[10px] text-critical">{erro}</p>}
          </div>
        )}

        <button
          type="button"
          onClick={() => (aberto ? setAberto(false) : void abrir())}
          aria-expanded={aberto}
          aria-label={
            dados
              ? `Fila de envio: ${pausada ? "pausada" : "ativa"}, ${restante} mensagens ainda saem hoje`
              : "Fila de envio"
          }
          title="Fila de envio — o que o celular vai encontrar quando pedir a próxima tarefa"
          className={`flex items-center gap-1.5 rounded-full border bg-surface px-2.5 py-1 shadow-md ${
            pausada ? "border-warning/50" : "border-line"
          }`}
        >
          {/* Halo ESTÁTICO, nunca `animate-ping`: este ponto fica na tela o
              dia inteiro, em toda aba — a mesma regra do ponto do RADAR no
              cabeçalho (ver "Custo" em ARCHITECTURE.md). */}
          <span
            className={`h-1.5 w-1.5 rounded-full ${pausada ? "bg-warning" : "bg-accent"}`}
            aria-hidden
          />
          <span className="font-mono text-xs text-foreground">
            {dados ? formatInt(restante) : "–"}
          </span>
          <span className="text-[10px] text-ink-muted">{pausada ? "pausada" : "hoje"}</span>
        </button>
      </div>
    </>
  );
}
