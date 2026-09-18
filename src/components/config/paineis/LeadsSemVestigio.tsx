"use client";

import { useState } from "react";

import { Button } from "@/components/Button";
import { ConfirmModal } from "@/components/ConfirmModal";
import { SkeletonRows } from "@/components/Skeleton";
import { PainelColapsavel } from "@/components/config/PainelColapsavel";
import { CAMPO_BASE_CLS, mensagemErroFila } from "@/components/config/comum";
import { api } from "@/lib/api-client";
import { formatDateShortSP } from "@/lib/format";
import {
  CORTE_PADRAO,
  SEM_VESTIGIO_LOTE_MAX,
  type LinhaSemVestigio,
  type RevisaoSemVestigio,
} from "@/lib/leads/semVestigio";

/** Chave da persistência deste painel — ver `PainelColapsavel`. */
export const PAINEL_SEM_VESTIGIO = "leads-sem-vestigio";

/** O que o operador digita para liberar a exclusão (padrão de /demos). */
const FRASE_CONFIRMACAO = "EXCLUIR";

/**
 * A REVISÃO DOS LEADS ANTIGOS SEM VESTÍGIO NENHUM DE CONTATO.
 *
 * `seloContato` existe desde 2026-08-05 e `registrosEnvio` desde
 * 2026-08-10. Quem foi abordado à mão antes disso não deixou rastro: nem
 * status, nem selo, nem registro — é irrecuperável por consulta e fica no
 * caminho como se fosse prospect fresco. No MESMO conjunto antigo, porém,
 * há leads que nunca foram abordados, cada um com uma chamada paga ao
 * Google Places dentro e, às vezes, demo e captura prontas. É por isso que
 * a saída não é varrer por data: é esta lista, revisada a olho.
 *
 * **Painel autônomo** (`posicao: "antes"`): busca e age pelas próprias
 * rotas sob `/api/config/leads-sem-vestigio`, admin nos três verbos.
 *
 * **NÃO BUSCA AO MONTAR — e essa é a quebra deliberada da convenção.** Os
 * outros painéis autônomos buscam na montagem, e a convenção pede que o
 * corpo fechado continue montado justamente para o resumo do cabeçalho
 * sair de estado já carregado. Aqui a varredura lê `/leads` inteira MAIS
 * `filaEnvios` inteira: pagá-la a cada abertura da /config, com o painel
 * fechado, seria custo de varredura por enfeite. E é também o mais
 * honesto: não existe "a" lista até o operador escolher a data de corte. O
 * resumo continua saindo de estado que o painel já tem em mãos — só que
 * ele começa vazio de propósito, e diz isso ("não procurado").
 */
export function LeadsSemVestigioSection() {
  const [corte, setCorte] = useState(CORTE_PADRAO);
  /** O corte da lista EM TELA — não o do campo, que o operador pode já ter mexido. */
  const [revisao, setRevisao] = useState<RevisaoSemVestigio | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [buscando, setBuscando] = useState(false);
  const [agindo, setAgindo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [textoConfirmacao, setTextoConfirmacao] = useState("");

  const linhas = revisao?.linhas ?? [];
  const marcados = linhas.filter((linha) => selecionados.has(linha.leadId));

  function aplicar(nova: RevisaoSemVestigio) {
    setRevisao(nova);
    // A seleção é limpa a cada resposta: as linhas que sobraram são outras
    // e manter marca velha aqui é convite a agir sobre o lead errado.
    setSelecionados(new Set());
  }

  async function procurar() {
    setBuscando(true);
    setErro(null);
    try {
      aplicar(await api.getLeadsSemVestigio(corte));
    } catch (error) {
      setErro(mensagemErroFila(error, "Falha ao procurar os leads"));
    } finally {
      setBuscando(false);
    }
  }

  /**
   * As duas ações mandam em LEVAS sequenciais de `SEM_VESTIGIO_LOTE_MAX`. Um
   * lote grande demais estoura o tempo da serverless no meio da destruição —
   * o pior resultado possível. Em levas, o que passou está gravado, e a
   * última resposta traz a lista nova (quem continua na revisão é decisão do
   * servidor, não desta tela).
   */
  async function emLevas(
    ids: string[],
    rotulo: string,
    executar: (leva: string[]) => Promise<RevisaoSemVestigio>,
  ) {
    setAgindo(rotulo);
    setErro(null);
    let feitos = 0;
    try {
      for (let i = 0; i < ids.length; i += SEM_VESTIGIO_LOTE_MAX) {
        const leva = ids.slice(i, i + SEM_VESTIGIO_LOTE_MAX);
        const nova = await executar(leva);
        feitos += leva.length;
        setAgindo(feitos < ids.length ? `${rotulo} ${feitos}/${ids.length}` : rotulo);
        aplicar(nova);
      }
    } catch (error) {
      setErro(
        // Diz quantos já foram: numa ação em levas, "falhou" sozinho deixa o
        // operador sem saber o que aconteceu com a primeira metade.
        `${mensagemErroFila(error, "Falha na ação")}${feitos > 0 ? ` — ${feitos} de ${ids.length} já foram processados` : ""}`,
      );
      // Relê para a tela refletir o que de fato ficou, não o que se esperava.
      await api.getLeadsSemVestigio(revisao?.corte ?? corte).then(aplicar).catch(() => {});
    } finally {
      setAgindo(null);
    }
  }

  const corteDaLista = revisao?.corte ?? corte;

  const descartar = () =>
    emLevas(marcados.map((l) => l.leadId), "Tirando da fila", (leva) =>
      api.descartarLeadsSemVestigio(leva, corteDaLista),
    );

  async function excluir() {
    const ids = marcados.map((l) => l.leadId);
    setConfirmarExclusao(false);
    setTextoConfirmacao("");
    await emLevas(ids, "Excluindo", (leva) => api.excluirLeadsSemVestigio(leva, corteDaLista));
  }

  function alternar(leadId: string) {
    setSelecionados((atual) => {
      const proximo = new Set(atual);
      if (!proximo.delete(leadId)) proximo.add(leadId);
      return proximo;
    });
  }

  const todosMarcados = linhas.length > 0 && marcados.length === linhas.length;

  return (
    <PainelColapsavel
      id={PAINEL_SEM_VESTIGIO}
      titulo="Leads antigos sem vestígio de contato"
      resumo={
        revisao === null
          ? `antes de ${formatCorte(corte)} · não procurado`
          : `antes de ${formatCorte(revisao.corte)} · ${revisao.total} lead${revisao.total === 1 ? "" : "s"}${revisao.truncado ? ` (mostrando ${revisao.linhas.length})` : ""}`
      }
    >
      <p className="mt-1 text-xs text-ink-muted">
        Em &quot;novo&quot;, criados antes da data, e sem vestígio nenhum de contato: sem selo de
        WhatsApp, sem registro de disparo, sem carimbo de primeiro contato e sem reserva da fila
        de envio. Quem tem qualquer um desses já está tratado e não aparece aqui.
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-ink-secondary">
          Criados antes de
          <input
            type="date"
            value={corte}
            onChange={(event) => setCorte(event.target.value)}
            className={`${CAMPO_BASE_CLS} text-sm`}
          />
        </label>
        <Button variant="secondary" onClick={procurar} loading={buscando}>
          Procurar
        </Button>
      </div>

      {buscando && revisao === null && (
        <SkeletonRows count={2} className="mt-3 h-12 rounded border border-line" />
      )}

      {revisao !== null && revisao.total === 0 && (
        // Estado vazio de UMA linha: nada de caixa vazia ocupando o painel.
        <p className="mt-3 text-xs text-ink-muted">
          Nenhum lead sem vestígio antes de {formatCorte(revisao.corte)}.
        </p>
      )}

      {linhas.length > 0 && (
        <>
          {revisao?.truncado && (
            <p className="mt-3 text-xs text-warning">
              São {revisao.total} no total; a lista mostra os {linhas.length} mais antigos. Trate
              esta leva e procure de novo.
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setSelecionados(todosMarcados ? new Set() : new Set(linhas.map((l) => l.leadId)))
              }
              className="rounded border border-line px-2 py-1 text-xs text-ink-secondary hover:text-foreground"
            >
              {todosMarcados ? "desmarcar todos" : `marcar os ${linhas.length}`}
            </button>
            <span className="text-xs text-ink-muted">{marcados.length} selecionado{marcados.length === 1 ? "" : "s"}</span>
          </div>

          <ul data-lista="sem-vestigio" className="mt-2 flex flex-col gap-1.5">
            {linhas.map((linha) => (
              <LinhaRevisao
                key={linha.leadId}
                linha={linha}
                marcado={selecionados.has(linha.leadId)}
                onAlternar={() => alternar(linha.leadId)}
              />
            ))}
          </ul>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {/* A ação PADRÃO, e a que fica em destaque: nada é destruído. */}
            <Button
              variant="primary"
              onClick={descartar}
              disabled={marcados.length === 0 || agindo !== null}
              loading={agindo?.startsWith("Tirando") ?? false}
            >
              Tirar da fila ({marcados.length})
            </Button>
            <Button
              variant="ghost"
              onClick={() => setConfirmarExclusao(true)}
              disabled={marcados.length === 0 || agindo !== null}
              className="text-critical hover:text-critical"
            >
              Excluir em definitivo
            </Button>
            {agindo && <span className="text-xs text-ink-muted">{agindo}…</span>}
          </div>
          <p className="mt-1.5 text-xs text-ink-muted">
            &quot;Tirar da fila&quot; usa o descarte suave: o lead continua na base, sai da fila
            automática e volta com &quot;Restaurar lead&quot; na ficha.
          </p>
        </>
      )}

      {erro && <p className="mt-2 text-xs text-critical">{erro}</p>}

      <ConfirmModal
        aberto={confirmarExclusao}
        titulo={`Excluir ${marcados.length} lead${marcados.length === 1 ? "" : "s"} em definitivo`}
        mensagem={mensagemDaExclusao(marcados)}
        confirmarLabel="Excluir em definitivo"
        confirmarDesabilitado={textoConfirmacao !== FRASE_CONFIRMACAO}
        onConfirmar={excluir}
        onCancelar={() => {
          setConfirmarExclusao(false);
          setTextoConfirmacao("");
        }}
        filhos={
          <input
            type="text"
            value={textoConfirmacao}
            onChange={(event) => setTextoConfirmacao(event.target.value)}
            placeholder={FRASE_CONFIRMACAO}
            aria-label={`Digite ${FRASE_CONFIRMACAO} para confirmar`}
            autoFocus
            className={`${CAMPO_BASE_CLS} w-full text-sm`}
          />
        }
      />
    </PainelColapsavel>
  );
}

/**
 * O texto da confirmação cita a MESMA lista do cabeçalho de
 * `lib/leads/exclusao.ts`, item por item. A promessa que o operador lê
 * antes de apertar e o que o código faz têm que ser a mesma frase — e a
 * consequência mais cara (o link já compartilhado virando página morta) só
 * é citada quando ALGUM dos marcados tem demo aberta por fora, porque um
 * aviso que aparece sempre é um aviso que ninguém lê.
 */
function mensagemDaExclusao(marcados: LinhaSemVestigio[]): string {
  const n = marcados.length;
  const abertas = marcados.filter((l) => l.abertaPorFora).length;
  const comDemo = marcados.filter((l) => l.temDemo).length;

  const partes = [
    `Isso apaga ${n} lead${n === 1 ? "" : "s"} da base, sem desfazer.`,
    comDemo > 0
      ? `A rota pública /demo/{lead} de ${comDemo} del${comDemo === 1 ? "e" : "es"} passa a dar 404.`
      : "",
    abertas > 0
      ? `ATENÇÃO: ${abertas} ${abertas === 1 ? "tem demo que já foi aberta" : "têm demo que já foi aberta"} por alguém de fora — há link circulando, e quem tiver o link vai ver página morta.`
      : "",
    "As capturas e as imagens de demo saem do Storage junto.",
    "A penetração por nicho/cidade muda, porque ela agrega o temSite salvo de cada lead.",
    "O doc correspondente em filaEnvios é removido junto.",
    `Para confirmar, digite "${FRASE_CONFIRMACAO}" abaixo.`,
  ];
  return partes.filter(Boolean).join(" ");
}

/** "10/08/2026" a partir da chave de calendário YYYY-MM-DD. */
function formatCorte(corte: string): string {
  const [ano, mes, dia] = corte.split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : corte;
}

function LinhaRevisao({
  linha,
  marcado,
  onAlternar,
}: {
  linha: LinhaSemVestigio;
  marcado: boolean;
  onAlternar: () => void;
}) {
  return (
    <li
      className={`flex items-start gap-2 rounded border p-2 ${
        marcado ? "border-accent bg-accent/10" : "border-line"
      }`}
    >
      <input
        type="checkbox"
        checked={marcado}
        onChange={onAlternar}
        aria-label={`Selecionar ${linha.nome || linha.leadId}`}
        className="mt-0.5 shrink-0 accent-[var(--accent)]"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <a
            href={`/leads/${linha.leadId}`}
            className="min-w-0 max-w-full truncate text-xs text-foreground underline decoration-line underline-offset-2"
          >
            {linha.nome || linha.leadId}
          </a>
          {linha.nicho && <span className="text-[10px] text-ink-muted">{linha.nicho}</span>}
          <span className="text-[10px] text-ink-muted">{formatDateShortSP(linha.criadoEm)}</span>
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          <Etiqueta ligada={linha.temDemo} texto="demo" />
          <Etiqueta ligada={linha.capturaPronta} texto="captura" />
          {/* A que mais pesa na decisão, e por isso a única em tom de alerta. */}
          <Etiqueta ligada={linha.abertaPorFora} texto="aberta por fora" alerta />
        </div>
      </div>
    </li>
  );
}

/**
 * Presença explícita nos dois sentidos — "sem demo" é informação tão útil
 * quanto "demo", e uma etiqueta que só aparece quando ligada faria o
 * operador ler ausência como "ainda não carregou".
 */
function Etiqueta({
  ligada,
  texto,
  alerta = false,
}: {
  ligada: boolean;
  texto: string;
  alerta?: boolean;
}) {
  const cls = !ligada
    ? "border-line text-ink-muted"
    : alerta
      ? "border-warning/50 bg-warning/10 text-warning"
      : "border-accent/40 bg-accent/10 text-accent";
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[10px] ${cls}`}>
      {ligada ? texto : `sem ${texto}`}
    </span>
  );
}
