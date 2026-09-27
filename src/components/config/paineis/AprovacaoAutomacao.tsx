"use client";

import Image from "next/image";
import { useState } from "react";

import { Button } from "@/components/Button";
import { ConfirmModal } from "@/components/ConfirmModal";
import { PainelColapsavel } from "@/components/config/PainelColapsavel";
import { mensagemErroFila } from "@/components/config/comum";
import { api } from "@/lib/api-client";
import { APROVACAO_LOTE_MAX, type DecisaoLote, type ItemAprovacao } from "@/lib/automacao/painelTipos";
import { formatDateTime } from "@/lib/format";

/** Chave da persistência deste bloco (subordinado a "Automação"). */
export const PAINEL_AUTOMACAO_APROVACAO = "automacao-aprovacao";

const CAPTURA_CLS: Record<ItemAprovacao["captura"]["estado"], string> = {
  pronto: "text-good",
  enfileirado: "text-accent",
  rodando: "text-accent",
  falhou: "text-critical",
  nunca: "text-ink-muted",
};

/**
 * A FILA DE APROVAÇÃO — demos que a automação fez e que esperam o operador.
 * Bloco `nivel={3}` DENTRO de "Automação", porque os itens chegam na mesma
 * resposta do painel (o total é o que o cabeçalho fechado do painel diz);
 * como bloco irmão, precisaria de uma segunda chamada ou de estado
 * compartilhado entre painéis.
 *
 * Aprovar e reprovar, um ou em lote, pela MESMA rota (lote de um é o
 * individual). Reprovar pede confirmação porque tem efeito que não se vê na
 * fila: o lead sai da automação para sempre.
 */
export function AprovacaoAutomacao({
  itens,
  total,
  onDecidido,
}: {
  itens: ItemAprovacao[];
  total: number;
  /** Relê o painel — estoque e contagens mudam junto. */
  onDecidido: () => Promise<void>;
}) {
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [agindo, setAgindo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  /** Os ids que o modal de reprovação vai reprovar (um ou a seleção). */
  const [reprovar, setReprovar] = useState<string[] | null>(null);

  const ids = new Set(itens.map((i) => i.leadId));
  const marcados = [...selecionados].filter((id) => ids.has(id));
  const todosMarcados = itens.length > 0 && marcados.length === itens.length;

  async function decidir(leadIds: string[], aprovacao: DecisaoLote, rotulo: string) {
    setAgindo(rotulo);
    setErro(null);
    setAviso(null);
    try {
      const falhas: string[] = [];
      for (let i = 0; i < leadIds.length; i += APROVACAO_LOTE_MAX) {
        const { resultados } = await api.decidirAprovacaoAutomacao(
          leadIds.slice(i, i + APROVACAO_LOTE_MAX),
          aprovacao,
        );
        for (const r of resultados) if (!r.ok) falhas.push(`${r.leadId}: ${r.erro}`);
      }
      const feitos = leadIds.length - falhas.length;
      setAviso(
        `${feitos} ${aprovacao === "aprovada" ? "aprovada" : "reprovada"}${feitos === 1 ? "" : "s"}.` +
          (aprovacao === "aprovada"
            ? " Com a captura ainda gerando, o lead entra na fila quando o print ficar pronto."
            : ""),
      );
      if (falhas.length > 0) setErro(`Não deu em ${falhas.length}: ${falhas.join(" · ")}`);
      setSelecionados(new Set());
    } catch (error) {
      setErro(mensagemErroFila(error, "Falha ao decidir"));
    } finally {
      await onDecidido();
      setAgindo(null);
    }
  }

  function alternar(leadId: string) {
    setSelecionados((atual) => {
      const proximo = new Set(atual);
      if (!proximo.delete(leadId)) proximo.add(leadId);
      return proximo;
    });
  }

  return (
    <PainelColapsavel
      id={PAINEL_AUTOMACAO_APROVACAO}
      titulo="Fila de aprovação"
      nivel={3}
      resumo={total === 0 ? "vazia" : `${total} aguardando`}
    >
      {itens.length === 0 ? (
        <p data-vazio="aprovacao" className="mt-2 text-xs text-ink-muted">
          Nenhuma demo automática esperando aprovação.
        </p>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelecionados(todosMarcados ? new Set() : new Set(itens.map((i) => i.leadId)))}
              className="rounded border border-line px-2 py-1 text-xs text-ink-secondary hover:text-foreground"
            >
              {todosMarcados ? "desmarcar todos" : `marcar os ${itens.length}`}
            </button>
            <Button
              variant="primary"
              onClick={() => decidir(marcados, "aprovada", "lote-aprovar")}
              disabled={marcados.length === 0 || agindo !== null}
              loading={agindo === "lote-aprovar"}
              data-acao="aprovar-lote"
            >
              Aprovar ({marcados.length})
            </Button>
            <Button
              variant="ghost"
              onClick={() => setReprovar(marcados)}
              disabled={marcados.length === 0 || agindo !== null}
              className="text-critical hover:text-critical"
              data-acao="reprovar-lote"
            >
              Reprovar ({marcados.length})
            </Button>
          </div>
          {total > itens.length && (
            <p className="mt-1 text-xs text-warning">
              São {total} no total; a lista mostra as {itens.length} mais antigas.
            </p>
          )}

          <ul data-lista="aprovacao" className="mt-2 flex flex-col gap-2">
            {itens.map((item) => (
              <li
                key={item.leadId}
                data-lead={item.leadId}
                className="flex gap-3 rounded border border-line bg-surface-2/40 p-2"
              >
                <input
                  type="checkbox"
                  aria-label={`Selecionar ${item.nome}`}
                  checked={selecionados.has(item.leadId)}
                  onChange={() => alternar(item.leadId)}
                  className="mt-1 shrink-0"
                />
                <Miniatura item={item} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm font-medium">{item.nome}</span>
                  <span className="truncate text-xs text-ink-secondary">
                    {[item.nicho, item.cidade].filter(Boolean).join(" · ") || "—"}
                  </span>
                  <span className="truncate text-xs text-ink-muted">
                    {item.skinNome} · {item.presetNome}
                  </span>
                  <span className={`text-xs ${CAPTURA_CLS[item.captura.estado]}`}>
                    captura: {item.captura.rotulo.toLowerCase()}
                    {item.captura.estado === "pronto" && item.captura.detalhe
                      ? ` em ${formatDateTime(item.captura.detalhe)}`
                      : item.captura.detalhe
                        ? ` — ${item.captura.detalhe}`
                        : ""}
                  </span>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <a
                      href={`/demo/${encodeURIComponent(item.leadId)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-accent underline"
                    >
                      abrir demo
                    </a>
                    <button
                      type="button"
                      onClick={() => decidir([item.leadId], "aprovada", `aprovar-${item.leadId}`)}
                      disabled={agindo !== null}
                      data-acao="aprovar"
                      className="rounded bg-good/15 px-2 py-0.5 text-xs font-semibold text-good disabled:opacity-50"
                    >
                      {agindo === `aprovar-${item.leadId}` ? "…" : "Aprovar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setReprovar([item.leadId])}
                      disabled={agindo !== null}
                      data-acao="reprovar"
                      className="rounded px-2 py-0.5 text-xs text-critical hover:bg-critical/10 disabled:opacity-50"
                    >
                      Reprovar
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {aviso && <p className="mt-2 text-xs text-ink-secondary">{aviso}</p>}
      {erro && <p className="mt-2 text-xs text-critical">{erro}</p>}

      <ConfirmModal
        aberto={reprovar !== null}
        titulo={`Reprovar ${reprovar?.length ?? 0} demo${reprovar?.length === 1 ? "" : "s"}`}
        mensagem="O lead sai da automação: ela não volta a fazer demo para ele. Ele continua na base e disponível para demo manual — e a demo reprovada pode ser editada e aprovada depois, à mão."
        confirmarLabel="Reprovar"
        onConfirmar={() => {
          const alvo = reprovar ?? [];
          setReprovar(null);
          void decidir(alvo, "reprovada", "lote-reprovar");
        }}
        onCancelar={() => setReprovar(null)}
      />
    </PainelColapsavel>
  );
}

/**
 * O print do hero quando a captura está pronta; enquanto não está, uma
 * caixa do MESMO tamanho com o estado — a linha não muda de altura quando o
 * print chega.
 */
function Miniatura({ item }: { item: ItemAprovacao }) {
  const cls = "h-24 w-14 shrink-0 overflow-hidden rounded border border-line";
  if (item.captura.heroUrl) {
    return (
      // `unoptimized`, como a galeria de capturas: o print já sai do motor no
      // tamanho certo e mora no Storage público.
      <Image
        src={item.captura.heroUrl}
        alt={`Hero da demo de ${item.nome}`}
        width={56}
        height={96}
        unoptimized
        loading="lazy"
        className={`${cls} object-cover object-top`}
      />
    );
  }
  return (
    <div
      className={`${cls} flex items-center justify-center bg-surface-2 p-1 text-center text-[10px] leading-tight ${CAPTURA_CLS[item.captura.estado]}`}
    >
      {item.captura.estado === "enfileirado" || item.captura.estado === "rodando"
        ? "print gerando…"
        : item.captura.estado === "falhou"
          ? "print falhou"
          : "sem print"}
    </div>
  );
}
