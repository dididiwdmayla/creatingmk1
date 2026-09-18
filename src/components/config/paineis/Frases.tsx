"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/Button";
import { ConfirmModal } from "@/components/ConfirmModal";
import { SkeletonRows } from "@/components/Skeleton";
import { PainelColapsavel } from "@/components/config/PainelColapsavel";
import { INPUT_CLS } from "@/components/config/comum";
import { ApiError, api, type FrasesResponse } from "@/lib/api-client";
import { frasesEfetivas, normalizarSlots, posicaoAtual } from "@/lib/frases/rotacao";
import {
  FRASES_SLOTS,
  type FrasesProspeccao,
  type RelatorioMigracao,
} from "@/lib/frases/types";

/** Chave da persistência deste painel — ver `PainelColapsavel`. */
export const PAINEL_FRASES = "frases";

/**
 * Frases de abordagem por SKIN (ver "Frases de prospecção por skin" no
 * ARCHITECTURE.md). A lista vem pronta de GET /api/frases: uma linha por
 * skin do registro — skin nova aparece aqui sozinha ao ser registrada, sem
 * cadastro manual e sem deploy, e nada nesta tela nasce de texto digitado
 * numa busca.
 *
 * Cada conjunto salva sozinho (PUT de um conjunto por vez), como as demais
 * seções auto-suficientes desta página — por isso vive FORA do formulário
 * principal, que tem um "Salvar" só para a config.
 */
export function FrasesSection() {
  const [dados, setDados] = useState<FrasesResponse | null>(null);
  // Rascunho por conjunto (id da skin): o que está nas caixas de texto
  // antes de salvar.
  const [rascunhos, setRascunhos] = useState<Record<string, string[]>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [salvo, setSalvo] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    api
      .listFrases()
      .then((resposta) => {
        if (ignore) return;
        setDados(resposta);
        setRascunhos(rascunhosDe(resposta));
        setErro(null);
      })
      .catch((error) => {
        if (ignore) return;
        setErro(error instanceof ApiError ? error.message : "Falha ao carregar as frases.");
      });
    return () => {
      ignore = true;
    };
  }, []);

  /**
   * Recarrega depois da migração: o texto antigo acabou de virar frase de
   * uma skin, e as caixas precisam mostrá-lo sem exigir F5.
   */
  function recarregar() {
    api
      .listFrases()
      .then((resposta) => {
        setDados(resposta);
        setRascunhos(rascunhosDe(resposta));
      })
      .catch(() => {
        // o relatório da migração continua na tela — recarregar é conforto
      });
  }

  async function salvar(skinId: string) {
    setSalvando(skinId);
    setErro(null);
    setSalvo(null);
    try {
      const { conjunto } = await api.salvarFrases(skinId, rascunhos[skinId] ?? []);
      setDados((atual) => (atual ? aplicarConjunto(atual, conjunto) : atual));
      setRascunhos((atual) => ({ ...atual, [skinId]: normalizarSlots(conjunto.frases) }));
      setSalvo(skinId);
    } catch (error) {
      setErro(error instanceof ApiError ? error.message : "Falha ao salvar as frases.");
    } finally {
      setSalvando(null);
    }
  }

  /**
   * Quantas skins do registro já têm frase preenchida — o que decide se a
   * prospecção vai sair com frase própria ou cair na mensagem padrão. Sai
   * da lista que a seção já carregou.
   */
  const preenchidas = (dados?.conjuntos ?? []).filter(
    (conjunto) => frasesEfetivas(conjunto).length > 0,
  ).length;
  const resumo =
    dados === null
      ? undefined
      : `${dados.conjuntos.length} skins · ${preenchidas} preenchidas`;

  return (
    <PainelColapsavel
      id={PAINEL_FRASES}
      titulo="Frases de prospecção por skin"
      resumo={resumo}
    >
      <p className="mt-1 text-xs text-ink-muted">
        Três frases por skin da Forja, girando 1 → 2 → 3 → 1. O contador é único por skin e vale
        para o time inteiro; ele só anda no clique de enviar pro WhatsApp — abrir a ficha, copiar
        ou editar a frase não giram nada. A frase vale para o lead cuja DEMO usa aquela skin: skin
        sem nenhuma frase preenchida não participa, e lead sem demo cai na mensagem do grupo e
        depois na mensagem padrão global.
      </p>
      <p className="mt-1 text-xs text-ink-muted">
        Valem os mesmos marcadores da mensagem padrão: <code className="font-mono">{"{nome}"}</code>,{" "}
        <code className="font-mono">{"{demo}"}</code> e{" "}
        <code className="font-mono">{"{penetracao}"}</code>.
      </p>

      <MigracaoFrasesLegadas onMigrado={recarregar} />

      <div className="mt-3 flex flex-col gap-3">
        {dados === null ? (
          <SkeletonRows count={3} className="h-44 rounded border border-line" />
        ) : (
          dados.conjuntos.map((conjunto) => (
            <ConjuntoFrasesEditor
              key={conjunto.skinId}
              titulo={conjunto.skinNome}
              descricao={`Skin ${conjunto.nicho} · ${conjunto.skinId}`}
              conjunto={conjunto}
              valor={rascunhos[conjunto.skinId] ?? ["", "", ""]}
              onChange={(frases) =>
                setRascunhos((atual) => ({ ...atual, [conjunto.skinId]: frases }))
              }
              salvando={salvando === conjunto.skinId}
              salvo={salvo === conjunto.skinId}
              onSalvar={() => salvar(conjunto.skinId)}
            />
          ))
        )}
      </div>

      {erro && <p className="mt-2 text-sm text-critical">{erro}</p>}
    </PainelColapsavel>
  );
}

/**
 * Bloco da MIGRAÇÃO das frases antigas — as que a versão anterior criava
 * chaveadas pelo texto do nicho digitado na busca. Só aparece enquanto
 * sobrar alguma entrada dessas no banco (`legados > 0`); sem nada legado,
 * ou para quem não é admin (403 na prévia), ele simplesmente não existe.
 *
 * O texto antigo nunca some em silêncio: a prévia já diz, item a item, o
 * que vai ser associado e o que não deu — e o que não deu vem com as
 * frases inteiras na tela, para copiar à mão antes de descartar.
 */
function MigracaoFrasesLegadas({ onMigrado }: { onMigrado: () => void }) {
  const [legados, setLegados] = useState(0);
  const [relatorio, setRelatorio] = useState<RelatorioMigracao | null>(null);
  const [migrado, setMigrado] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    api
      .previaMigracaoFrases()
      .then((resposta) => {
        if (ignore) return;
        setLegados(resposta.legados ?? 0);
        setRelatorio(resposta.relatorio);
      })
      .catch(() => {
        // membro (403) ou falha de rede: o bloco só não aparece
      });
    return () => {
      ignore = true;
    };
  }, []);

  async function migrar() {
    setOcupado(true);
    setErro(null);
    try {
      const { relatorio: feito } = await api.migrarFrases();
      setRelatorio(feito);
      setMigrado(true);
      setLegados(feito.pendentes.length);
      onMigrado();
    } catch (error) {
      setErro(error instanceof ApiError ? error.message : "Falha ao migrar as frases antigas.");
    } finally {
      setOcupado(false);
    }
  }

  async function descartar() {
    setConfirmandoDescarte(false);
    setOcupado(true);
    setErro(null);
    try {
      await api.descartarFrasesLegadas();
      setLegados(0);
      setRelatorio(null);
    } catch (error) {
      setErro(error instanceof ApiError ? error.message : "Falha ao descartar as antigas.");
    } finally {
      setOcupado(false);
    }
  }

  if (legados === 0 && !migrado) return null;

  return (
    <div className="mt-3 rounded border border-warning/40 bg-warning/10 p-3">
      <p className="text-sm font-medium text-foreground">
        {migrado ? "Migração das frases antigas" : `${legados} entrada(s) de frases antigas`}
      </p>
      <p className="mt-0.5 text-xs text-ink-muted">
        São as frases da versão anterior, chaveadas pelo texto do nicho digitado na busca. Elas já
        não valem para envio nenhum. Migrar copia o texto para as skins do mesmo nicho (skin que já
        tem frase própria nunca é sobrescrita) e apaga só as entradas aproveitadas.
      </p>

      {relatorio && (
        <div className="mt-2 flex flex-col gap-2">
          {relatorio.feitas.length > 0 && (
            <div>
              <p className="text-xs font-medium text-good">
                {migrado ? "Migradas" : "Serão migradas"}:
              </p>
              <ul className="mt-0.5 flex flex-col gap-0.5">
                {relatorio.feitas.map((feita) => (
                  <li key={`${feita.chave}:${feita.skinId}`} className="text-xs text-ink-secondary">
                    {feita.nicho} → {feita.skinNome}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {relatorio.pendentes.length > 0 && (
            <div>
              <p className="text-xs font-medium text-critical">
                Não deu pra associar — copie o texto antes de descartar:
              </p>
              <ul className="mt-0.5 flex flex-col gap-1.5">
                {relatorio.pendentes.map((pendente) => (
                  <li key={pendente.chave} className="rounded border border-line bg-surface-2 p-2">
                    <p className="text-xs text-foreground">
                      {pendente.nicho} <span className="text-ink-muted">— {pendente.motivo}</span>
                    </p>
                    {pendente.frases
                      .filter((frase) => frase.trim())
                      .map((frase, i) => (
                        <p key={i} className="mt-1 whitespace-pre-wrap text-[11px] text-ink-secondary">
                          {frase}
                        </p>
                      ))}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {relatorio.feitas.length === 0 && relatorio.pendentes.length === 0 && (
            <p className="text-xs text-ink-muted">
              Nada a aproveitar: as entradas antigas estavam sem texto.
            </p>
          )}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {!migrado && (
          <Button type="button" variant="secondary" onClick={migrar} loading={ocupado}>
            Migrar para as skins
          </Button>
        )}
        {legados > 0 && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => setConfirmandoDescarte(true)}
            disabled={ocupado}
          >
            Descartar as antigas
          </Button>
        )}
      </div>

      {erro && <p className="mt-2 text-sm text-critical">{erro}</p>}

      <ConfirmModal
        aberto={confirmandoDescarte}
        titulo="Descartar as frases antigas"
        mensagem={`Apaga ${legados} entrada(s) antiga(s) do banco, incluindo o texto que não deu pra associar. Não dá pra desfazer — copie o que quiser guardar antes.`}
        confirmarLabel="Descartar"
        onConfirmar={descartar}
        onCancelar={() => setConfirmandoDescarte(false)}
      />
    </div>
  );
}

/** Rascunhos iniciais: o que está salvo, por id de skin. */
function rascunhosDe(resposta: FrasesResponse): Record<string, string[]> {
  const rascunhos: Record<string, string[]> = {};
  for (const conjunto of resposta.conjuntos) {
    rascunhos[conjunto.skinId] = normalizarSlots(conjunto.frases);
  }
  return rascunhos;
}

/**
 * Substitui um conjunto na resposta carregada, preservando a ordem da lista
 * e o nome/nicho da skin (o PUT devolve só o conjunto salvo).
 */
function aplicarConjunto(atual: FrasesResponse, conjunto: FrasesProspeccao): FrasesResponse {
  return {
    ...atual,
    conjuntos: atual.conjuntos.map((c) =>
      c.skinId === conjunto.skinId ? { ...c, ...conjunto } : c,
    ),
  };
}

/** Um conjunto: os três campos, o estado da rotação e o próprio Salvar. */
function ConjuntoFrasesEditor({
  titulo,
  descricao,
  conjunto,
  valor,
  onChange,
  salvando,
  salvo,
  onSalvar,
}: {
  titulo: string;
  descricao?: string;
  conjunto: FrasesProspeccao;
  valor: string[];
  onChange: (frases: string[]) => void;
  salvando: boolean;
  salvo: boolean;
  onSalvar: () => void;
}) {
  // O estado da rotação é o do que está SALVO (o rascunho ainda não vale
  // para ninguém) — por isso lê `conjunto`, não `valor`.
  const efetivas = frasesEfetivas(conjunto);
  const posicao = posicaoAtual(conjunto);
  const alterado =
    JSON.stringify(normalizarSlots(valor)) !== JSON.stringify(normalizarSlots(conjunto.frases));

  return (
    <div className="rounded border border-line p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{titulo}</span>
        <span className="text-[11px] text-ink-muted">
          {posicao === undefined
            ? "sem frases — não participa"
            : `na vez: frase ${posicao + 1} de ${efetivas.length}`}
        </span>
      </div>
      {descricao && <p className="mt-0.5 text-xs text-ink-muted">{descricao}</p>}
      <div className="mt-2 flex flex-col gap-2">
        {Array.from({ length: FRASES_SLOTS }, (_, i) => (
          <textarea
            key={i}
            value={valor[i] ?? ""}
            onChange={(e) => {
              const frases = normalizarSlots(valor);
              frases[i] = e.target.value;
              onChange(frases);
            }}
            // 3 linhas, não 2: no celular a coluna é estreita e uma frase
            // típica (com {nome} e {demo}) quebra em três — com 2 o texto
            // ficava cortado dentro da caixa.
            rows={3}
            placeholder={`Frase ${i + 1} — vazia não entra na rotação`}
            className={INPUT_CLS}
          />
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onSalvar}
          loading={salvando}
          disabled={!alterado}
        >
          Salvar
        </Button>
        {salvo && !alterado && <span className="text-xs text-good">Frases salvas.</span>}
      </div>
    </div>
  );
}
