"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { NivelIA } from "@/lib/ai/nivel";
import { Button } from "@/components/Button";
import { ConfirmModal } from "@/components/ConfirmModal";
import { ApiError, api } from "@/lib/api-client";
import { EFEITOS } from "@/lib/demos/efeitos/registry";
import {
  patchCriacaoLote,
  projecaoChamadasIA,
  projecaoCotaIA,
  relatorioVazio,
  type RelatorioLote,
} from "@/lib/demos/lote";
import { montarDemoData } from "@/lib/demos/montar";
import { montarPatch } from "@/lib/demos/patch";
import { SKINS, getSkin } from "@/lib/demos/registry";
import { aplicarSugestaoTexto } from "@/lib/demos/sugestaoTexto";
import { IMAGENS_MODOS, type ImagensModo } from "@/lib/demos/types";
import type { Lead } from "@/lib/leads/types";

const SELECT_CLASS =
  "rounded border border-line bg-surface-2 px-2 py-1.5 text-xs text-foreground outline-none focus:border-accent";

const MODO_LABEL: Record<ImagensModo, string> = {
  foto: "Foto (fotos de produção do template)",
  grafico: "Gráfico (ilustração/SVG do template)",
};

/** Níveis oferecidos na geração de texto em lote — "toque-leve" não tem texto nenhum, não faz sentido aqui. */
const NIVEL_TEXTO_LABEL: Record<Exclude<NivelIA, "toque-leve">, string> = {
  equilibrado: "Equilibrado (slogan, descrição, títulos de seção)",
  completo: "Completo (reescreve toda seção, serviços e depoimentos)",
};

/**
 * Diálogo "Gerar demos em lote" — a partir de um grupo de busca
 * (`/leads?buscaId=`), cria a demo de N leads de uma vez com skin/preset de
 * tema/efeito/modo de imagem escolhidos aqui (um valor para o lote
 * inteiro). Criar demo é só `PUT /api/leads/[id]/demo` — Firestore, sem
 * request pago — por isso essa parte processa sem tocar cota nenhuma.
 *
 * Geração de texto por IA é uma AÇÃO SEPARADA, com botão e confirmação
 * próprios (nunca junto do botão de criação): opera só sobre os leads que
 * este diálogo acabou de criar, mostra o número exato de chamadas e o
 * consumo da cota de IA do mês antes de confirmar.
 *
 * Processamento RESILIENTE nas duas etapas: loop serial no CLIENTE (mesmo
 * padrão de `autoEnrichSerial` em app/(app)/leads/page.tsx) — cada request
 * é uma escrita/chamada independente por lead, então uma falha num lead
 * não trava o resto, e nenhuma chamada de servidor processa o lote inteiro
 * de uma vez (sem risco de estourar o timeout de uma função serverless).
 */
export function GerarDemosLoteDialog({
  leads,
  iaDisponivel,
  onFechar,
  onLeadAtualizado,
}: {
  /** Leads do grupo de busca atual (o diálogo filtra os que já têm demo). */
  leads: Lead[];
  /** GEMINI_API_KEY configurada — sem ela a seção de IA nem aparece. */
  iaDisponivel: boolean;
  onFechar: () => void;
  /** Chamado a cada lead salvo com sucesso, para o caller mesclar na lista local. */
  onLeadAtualizado: (lead: Lead) => void;
}) {
  // Lista de candidatos CONGELADA no momento em que o diálogo abriu: como
  // cada PUT bem-sucedido faz o lead ganhar `demo` (via onLeadAtualizado →
  // a página-mãe atualiza `leads` → este componente recebe um `leads` novo
  // por prop), derivar a lista direto da prop faria cada item SUMIR do
  // checklist assim que fosse processado, em vez de mostrar o ✓. O estado
  // vivo de cada lead (pra montar o patch da IA depois) mora em `leadsMap`.
  const [candidatos] = useState(() => leads.filter((lead) => !lead.demo));
  const [leadsMap, setLeadsMap] = useState<Map<string, Lead>>(
    () => new Map(leads.map((lead) => [lead.placeId, lead])),
  );

  function registrarLead(lead: Lead) {
    setLeadsMap((atual) => new Map(atual).set(lead.placeId, lead));
    onLeadAtualizado(lead);
  }

  const [selecionados, setSelecionados] = useState<Set<string>>(
    () => new Set(candidatos.map((lead) => lead.placeId)),
  );
  const [skinId, setSkinId] = useState(SKINS[0]?.id ?? "");
  const skin = getSkin(skinId);
  const [themeId, setThemeId] = useState(skin?.themeDefault.id ?? "");
  const [efeitoId, setEfeitoId] = useState("nenhum");
  const [imagensModo, setImagensModo] = useState<ImagensModo>("foto");

  const [processando, setProcessando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [relatorio, setRelatorio] = useState<RelatorioLote | null>(null);
  const canceladoRef = useRef(false);
  const iaCanceladoRef = useRef(false);

  // Desmontar o diálogo (navegação, troca de grupo) durante um loop em
  // andamento equivale a cancelar: nenhum request novo sai depois disso —
  // o request EM VOO ainda termina (não dá pra abortar um fetch já
  // disparado sem invalidar a resposta), mas o loop para no próximo lead.
  useEffect(
    () => () => {
      canceladoRef.current = true;
      iaCanceladoRef.current = true;
    },
    [],
  );

  function trocarSkin(novoSkinId: string) {
    setSkinId(novoSkinId);
    const novaSkin = getSkin(novoSkinId);
    setThemeId(novaSkin?.themeDefault.id ?? "");
  }

  function alternarSelecao(placeId: string) {
    setSelecionados((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(placeId)) proximo.delete(placeId);
      else proximo.add(placeId);
      return proximo;
    });
  }

  const alvos = candidatos.filter((lead) => selecionados.has(lead.placeId));

  async function criarDemos() {
    if (!skin || alvos.length === 0 || processando) return;
    canceladoRef.current = false;
    setProcessando(true);
    setProgresso(0);
    const relatorioAtual = relatorioVazio();
    const { dados, tema } = patchCriacaoLote({ skinId, themeId, efeitoId, imagensModo });

    for (const lead of alvos) {
      if (canceladoRef.current) {
        relatorioAtual.cancelado = true;
        break;
      }
      try {
        const { lead: atualizado } = await api.putLeadDemo(lead.placeId, {
          skinId,
          themeId,
          dados,
          ...(tema && { tema }),
        });
        relatorioAtual.sucessos.push({ placeId: lead.placeId, nome: lead.nome, ok: true });
        registrarLead(atualizado);
      } catch (error) {
        relatorioAtual.falhas.push({
          placeId: lead.placeId,
          nome: lead.nome,
          ok: false,
          erro: error instanceof ApiError ? error.message : "falha desconhecida",
        });
      }
      setProgresso((n) => n + 1);
      setRelatorio({ ...relatorioAtual });
    }

    setRelatorio(relatorioAtual);
    setProcessando(false);
  }

  function cancelar() {
    canceladoRef.current = true;
  }

  // ── Geração de textos por IA — ação separada, sobre os leads que este
  // diálogo acabou de criar com sucesso ─────────────────────────────────
  const criadosComSucesso = useMemo(
    () =>
      (relatorio?.sucessos ?? [])
        .map((r) => leadsMap.get(r.placeId))
        .filter((lead): lead is Lead => Boolean(lead?.demo)),
    [relatorio, leadsMap],
  );

  const [iaSelecionados, setIaSelecionados] = useState<Set<string>>(new Set());
  const [iaNivel, setIaNivel] = useState<Exclude<NivelIA, "toque-leve">>("completo");
  const [confirmandoIA, setConfirmandoIA] = useState(false);
  const [uso, setUso] = useState<{ usado: number; teto: number } | null>(null);
  const [iaProcessando, setIaProcessando] = useState(false);
  const [iaProgresso, setIaProgresso] = useState(0);
  const [iaRelatorio, setIaRelatorio] = useState<RelatorioLote | null>(null);

  // Seleciona todos os recém-criados por padrão, uma vez (quando a lista
  // de "criados com sucesso" deixa de estar vazia pela primeira vez) — ver
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes.
  const [iaSeedFeito, setIaSeedFeito] = useState(false);
  if (criadosComSucesso.length > 0 && !iaSeedFeito) {
    setIaSeedFeito(true);
    setIaSelecionados(new Set(criadosComSucesso.map((lead) => lead.placeId)));
  }

  function alternarSelecaoIA(placeId: string) {
    setIaSelecionados((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(placeId)) proximo.delete(placeId);
      else proximo.add(placeId);
      return proximo;
    });
  }

  const alvosIA = criadosComSucesso.filter((lead) => iaSelecionados.has(lead.placeId));
  const { minimo, maximo } = projecaoChamadasIA(alvosIA.length);
  const projecao = uso ? projecaoCotaIA(uso.usado, uso.teto, alvosIA.length) : null;

  function abrirConfirmacaoIA() {
    if (alvosIA.length === 0 || iaProcessando) return;
    api
      .getUsage()
      .then(({ usage, caps }) => setUso({ usado: usage.aiGeneration, teto: caps.aiGeneration }))
      .catch(() => setUso(null));
    setConfirmandoIA(true);
  }

  async function gerarTextosIA() {
    if (!skin || alvosIA.length === 0 || iaProcessando) return;
    setConfirmandoIA(false);
    iaCanceladoRef.current = false;
    setIaProcessando(true);
    setIaProgresso(0);
    const relatorioAtual = relatorioVazio();

    for (let i = 0; i < alvosIA.length; i++) {
      const lead = alvosIA[i];
      if (iaCanceladoRef.current) {
        relatorioAtual.cancelado = true;
        break;
      }
      try {
        const { sugestao } = await api.gerarSugestaoDemo(lead.placeId, skin.id, iaNivel);
        const base = montarDemoData(skin.demoDataExemplo, lead, undefined, skin.id);
        const efetivo = montarDemoData(skin.demoDataExemplo, lead, lead.demo?.dados, skin.id);
        const comTexto = aplicarSugestaoTexto(sugestao, efetivo);
        const patch = montarPatch(base, comTexto, skin);
        const { lead: atualizado } = await api.putLeadDemo(lead.placeId, {
          skinId: skin.id,
          themeId: lead.demo?.themeId ?? skin.themeDefault.id,
          dados: patch,
          ...(lead.demo?.tema && { tema: lead.demo.tema }),
          ...(lead.demo?.idioma && { idioma: lead.demo.idioma }),
        });
        relatorioAtual.sucessos.push({ placeId: lead.placeId, nome: lead.nome, ok: true });
        registrarLead(atualizado);
      } catch (error) {
        relatorioAtual.falhas.push({
          placeId: lead.placeId,
          nome: lead.nome,
          ok: false,
          erro: error instanceof ApiError ? error.message : "falha desconhecida",
        });
        // Teto de cota estourado é um bloqueio GLOBAL, não deste lead — os
        // próximos vão falhar pelo mesmo motivo. Registra o resto como não
        // tentado (sem gastar N-i requests pra confirmar o óbvio) em vez de
        // continuar tentando um a um.
        if (error instanceof ApiError && error.code === "quota_exceeded") {
          for (const restante of alvosIA.slice(i + 1)) {
            relatorioAtual.falhas.push({
              placeId: restante.placeId,
              nome: restante.nome,
              ok: false,
              erro: "não tentado — teto de cota de IA atingido",
            });
          }
          setIaProgresso(alvosIA.length);
          setIaRelatorio({ ...relatorioAtual });
          break;
        }
      }
      setIaProgresso((n) => n + 1);
      setIaRelatorio({ ...relatorioAtual });
    }

    setIaRelatorio(relatorioAtual);
    setIaProcessando(false);
  }

  function cancelarIA() {
    iaCanceladoRef.current = true;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={processando || iaProcessando ? undefined : onFechar}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-y-auto rounded-lg border border-line bg-surface p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">Gerar demos em lote</h2>
          {!processando && !iaProcessando && (
            <button
              type="button"
              onClick={onFechar}
              className="text-xs text-ink-muted hover:text-foreground"
            >
              Fechar
            </button>
          )}
        </div>

        {candidatos.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">
            Todos os leads deste grupo já têm demo — edite individualmente pela ficha.
          </p>
        ) : (
          <>
            <p className="mt-1 text-xs text-ink-muted">
              Cria a demo de cada lead selecionado com a mesma skin/tema/efeito/modo de imagem —
              render do Firestore, gratuito, não consome cota.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <select
                value={skinId}
                onChange={(event) => trocarSkin(event.target.value)}
                className={SELECT_CLASS}
                disabled={processando}
              >
                {SKINS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </select>
              <select
                value={themeId}
                onChange={(event) => setThemeId(event.target.value)}
                className={SELECT_CLASS}
                disabled={processando}
              >
                {skin?.themePresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.nome}
                  </option>
                ))}
              </select>
              <select
                value={efeitoId}
                onChange={(event) => setEfeitoId(event.target.value)}
                className={SELECT_CLASS}
                disabled={processando}
              >
                <option value="nenhum">Sem efeito de fundo</option>
                {EFEITOS.map((efeito) => (
                  <option key={efeito.id} value={efeito.id}>
                    {efeito.nome}
                  </option>
                ))}
              </select>
              <select
                value={imagensModo}
                onChange={(event) => setImagensModo(event.target.value as ImagensModo)}
                className={SELECT_CLASS}
                disabled={processando}
              >
                {IMAGENS_MODOS.map((modo) => (
                  <option key={modo} value={modo}>
                    {MODO_LABEL[modo]}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-ink-muted">
              <span>
                {alvos.length} de {candidatos.length} lead{candidatos.length === 1 ? "" : "s"} sem
                demo selecionado{alvos.length === 1 ? "" : "s"}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={processando}
                  onClick={() => setSelecionados(new Set(candidatos.map((l) => l.placeId)))}
                  className="font-medium text-accent hover:underline disabled:opacity-50"
                >
                  Selecionar todos
                </button>
                <button
                  type="button"
                  disabled={processando}
                  onClick={() => setSelecionados(new Set())}
                  className="font-medium text-accent hover:underline disabled:opacity-50"
                >
                  Limpar
                </button>
              </div>
            </div>

            <ul className="mt-2 flex max-h-40 flex-col gap-1 overflow-y-auto rounded border border-line p-2">
              {candidatos.map((lead) => {
                const resultado =
                  relatorio?.sucessos.find((r) => r.placeId === lead.placeId) ??
                  relatorio?.falhas.find((r) => r.placeId === lead.placeId);
                return (
                  <li key={lead.placeId} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={selecionados.has(lead.placeId)}
                      onChange={() => alternarSelecao(lead.placeId)}
                      disabled={processando}
                    />
                    <span className="min-w-0 flex-1 truncate text-ink-secondary">{lead.nome}</span>
                    {resultado && (
                      <span className={resultado.ok ? "text-good" : "text-critical"}>
                        {resultado.ok ? "✓" : `✗ ${resultado.erro}`}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>

            {processando && (
              <p className="mt-2 text-xs text-ink-muted">
                Processando {progresso}/{alvos.length}…
              </p>
            )}

            {relatorio && !processando && (
              <p className="mt-2 text-sm">
                <span className="text-good">{relatorio.sucessos.length} criada(s)</span>
                {relatorio.falhas.length > 0 && (
                  <span className="text-critical"> · {relatorio.falhas.length} falhou(aram)</span>
                )}
                {relatorio.cancelado && <span className="text-ink-muted"> · cancelado</span>}
              </p>
            )}

            <div className="mt-3 flex justify-end gap-2">
              {processando ? (
                <Button variant="secondary" onClick={cancelar}>
                  Cancelar
                </Button>
              ) : (
                <Button onClick={criarDemos} disabled={!skin || alvos.length === 0}>
                  Criar {alvos.length} demo{alvos.length === 1 ? "" : "s"}
                </Button>
              )}
            </div>

            {/* Ação DISTINTA — próprio botão/confirmação, nunca junto da criação. */}
            {iaDisponivel && criadosComSucesso.length > 0 && (
              <div className="mt-4 flex flex-col gap-2 border-t border-line pt-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Gerar textos com IA (opcional, consome cota)
                </h3>
                <p className="text-xs text-ink-muted">
                  Reescreve os textos (slogan, seções, serviços…) dos leads recém-criados
                  escolhidos abaixo — a skin/tema/efeito ficam como já configurados acima.
                </p>

                <select
                  value={iaNivel}
                  onChange={(event) => setIaNivel(event.target.value as typeof iaNivel)}
                  className={SELECT_CLASS}
                  disabled={iaProcessando}
                >
                  {(Object.keys(NIVEL_TEXTO_LABEL) as Array<keyof typeof NIVEL_TEXTO_LABEL>).map(
                    (nivel) => (
                      <option key={nivel} value={nivel}>
                        {NIVEL_TEXTO_LABEL[nivel]}
                      </option>
                    ),
                  )}
                </select>

                <div className="flex items-center justify-between text-xs text-ink-muted">
                  <span>
                    {alvosIA.length} de {criadosComSucesso.length} lead
                    {criadosComSucesso.length === 1 ? "" : "s"} selecionado
                    {alvosIA.length === 1 ? "" : "s"} pra texto por IA
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={iaProcessando}
                      onClick={() =>
                        setIaSelecionados(new Set(criadosComSucesso.map((l) => l.placeId)))
                      }
                      className="font-medium text-accent hover:underline disabled:opacity-50"
                    >
                      Selecionar todos
                    </button>
                    <button
                      type="button"
                      disabled={iaProcessando}
                      onClick={() => setIaSelecionados(new Set())}
                      className="font-medium text-accent hover:underline disabled:opacity-50"
                    >
                      Limpar
                    </button>
                  </div>
                </div>

                <ul className="flex max-h-32 flex-col gap-1 overflow-y-auto rounded border border-line p-2">
                  {criadosComSucesso.map((lead) => {
                    const resultado =
                      iaRelatorio?.sucessos.find((r) => r.placeId === lead.placeId) ??
                      iaRelatorio?.falhas.find((r) => r.placeId === lead.placeId);
                    return (
                      <li key={lead.placeId} className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={iaSelecionados.has(lead.placeId)}
                          onChange={() => alternarSelecaoIA(lead.placeId)}
                          disabled={iaProcessando}
                        />
                        <span className="min-w-0 flex-1 truncate text-ink-secondary">
                          {lead.nome}
                        </span>
                        {resultado && (
                          <span className={resultado.ok ? "text-good" : "text-critical"}>
                            {resultado.ok ? "✓" : `✗ ${resultado.erro}`}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>

                {iaProcessando && (
                  <p className="text-xs text-ink-muted">
                    Gerando texto {iaProgresso}/{alvosIA.length}…
                  </p>
                )}

                {iaRelatorio && !iaProcessando && (
                  <p className="text-sm">
                    <span className="text-good">{iaRelatorio.sucessos.length} gerada(s)</span>
                    {iaRelatorio.falhas.length > 0 && (
                      <span className="text-critical">
                        {" "}
                        · {iaRelatorio.falhas.length} falhou(aram)
                      </span>
                    )}
                    {iaRelatorio.cancelado && <span className="text-ink-muted"> · cancelado</span>}
                  </p>
                )}

                <div className="flex justify-end gap-2">
                  {iaProcessando ? (
                    <Button variant="secondary" onClick={cancelarIA}>
                      Cancelar
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      onClick={abrirConfirmacaoIA}
                      disabled={alvosIA.length === 0}
                    >
                      Gerar textos com IA para {alvosIA.length} lead
                      {alvosIA.length === 1 ? "" : "s"}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmModal
        aberto={confirmandoIA}
        titulo="Gerar textos com IA"
        mensagem={[
          `${alvosIA.length} lead${alvosIA.length === 1 ? "" : "s"} selecionado${alvosIA.length === 1 ? "" : "s"}.`,
          `Chamadas à IA: ${minimo} (1 por lead; até ${maximo} se algum precisar de nova tentativa por resposta fora do formato).`,
          uso
            ? `Cota de IA este mês: ${uso.usado}/${uso.teto} usadas — depois deste lote, ${projecao?.restanteDepoisMax}–${projecao?.restanteDepoisMin} restantes${projecao?.podeEstourar ? " (pode não sobrar cota pra todo mundo — quem estourar aparece como falha no relatório)" : ""}.`
            : "Não deu pra carregar a cota de IA do mês — o servidor ainda barra se o teto estourar.",
        ].join(" ")}
        confirmarLabel={`Gerar para ${alvosIA.length} lead${alvosIA.length === 1 ? "" : "s"}`}
        onConfirmar={gerarTextosIA}
        onCancelar={() => setConfirmandoIA(false)}
      />
    </div>
  );
}
