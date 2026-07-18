"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/Button";
import { ApiError, api } from "@/lib/api-client";
import { montarDemoData } from "@/lib/demos/montar";
import { montarPatch } from "@/lib/demos/patch";
import { DEFAULT_SKIN, getSkin, getTheme } from "@/lib/demos/registry";
import { aplicarTema } from "@/lib/demos/tema";
import type { DemoData, TemaPatch } from "@/lib/demos/types";
import type { Lead } from "@/lib/leads/types";
import { prepararImagem } from "./comprimir";
import {
  PainelConteudo,
  PainelEstrutura,
  PainelImagens,
  PainelTema,
  type Aba,
} from "./paineis";

/**
 * Editor visual de demos: preview ao vivo (iframe /demo-preview, estado
 * completo via postMessage) + painel de edição por abas. O painel edita o
 * DemoData EFETIVO; ao salvar, montarPatch reduz ao diff contra a base
 * (exemplo ← dados do lead) e o PUT normal da demo persiste. Clicar num
 * slot do preview foca o campo correspondente aqui (mapa slot→campo).
 * Em telas pequenas o painel vira um drawer inferior.
 */

const MSG_PREVIEW = "radar-demo-preview";
const MSG_SLOT = "radar-demo-slot";
const MSG_PRONTO = "radar-demo-preview-pronto";

/** Estado inicial do editor a partir do lead (ou ao trocar de skin). */
function estadoInicial(lead: Lead, skinPedida?: string) {
  const skin = getSkin(skinPedida ?? lead.demo?.skinId) ?? DEFAULT_SKIN;
  const daSkin = lead.demo?.skinId === skin.id;
  const themeSalvo = daSkin ? lead.demo?.themeId : undefined;
  return {
    skinId: skin.id,
    themeId: skin.themePresets.some((t) => t.id === themeSalvo)
      ? (themeSalvo as string)
      : skin.themeDefault.id,
    tema: (daSkin ? lead.demo?.tema : undefined) ?? {},
    dados: montarDemoData(skin.demoDataExemplo, lead, daSkin ? lead.demo?.dados : undefined),
  };
}

/** Grupo do painel Conteúdo que contém o campo do slot. */
function grupoDoSlot(slot: string): string {
  if (slot.startsWith("servicos.")) return "servicos";
  if (slot.startsWith("depoimentos.")) return "depoimentos";
  if (slot.startsWith("secoes.")) return `secao-${slot.split(".")[1]}`;
  return "negocio";
}

export function DemoEditorClient({ id }: { id: string }) {
  const router = useRouter();
  const [lead, setLead] = useState<Lead | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [skinId, setSkinId] = useState(DEFAULT_SKIN.id);
  const [themeId, setThemeId] = useState(DEFAULT_SKIN.themeDefault.id);
  const [tema, setTema] = useState<TemaPatch>({});
  const [dados, setDados] = useState<DemoData | null>(null);
  const [sujo, setSujo] = useState(false);

  const [aba, setAba] = useState<Aba>("conteudo");
  const [painelAberto, setPainelAberto] = useState(false);
  const [previewMobile, setPreviewMobile] = useState(false);
  const [abertos, setAbertos] = useState<Record<string, boolean>>({ negocio: true });

  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [salvarErro, setSalvarErro] = useState<string | null>(null);
  const [confirmaExcluir, setConfirmaExcluir] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [uploadSlot, setUploadSlot] = useState<string | null>(null);
  const [imgErro, setImgErro] = useState<string | null>(null);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let ignore = false;
    api
      .getLead(id)
      .then(({ lead: leadData }) => {
        if (ignore) return;
        setLead(leadData);
        const inicial = estadoInicial(leadData);
        setSkinId(inicial.skinId);
        setThemeId(inicial.themeId);
        setTema(inicial.tema);
        setDados(inicial.dados);
      })
      .catch((error) => {
        if (ignore) return;
        if (error instanceof ApiError && error.code === "not_found") setNotFound(true);
        else setErro(error instanceof ApiError ? error.message : "Falha ao carregar o lead.");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [id]);

  const skin = getSkin(skinId) ?? DEFAULT_SKIN;
  const themeEfetivo = useMemo(
    () => aplicarTema(getTheme(skin, themeId), tema),
    [skin, themeId, tema],
  );
  const base = useMemo(
    () => (lead ? montarDemoData(skin.demoDataExemplo, lead) : skin.demoDataExemplo),
    [skin, lead],
  );

  /** Única porta de edição do conteúdo — marca o estado como sujo. */
  const atualizar = useCallback((fn: (atual: DemoData) => DemoData) => {
    setDados((atual) => (atual ? fn(atual) : atual));
    setSujo(true);
  }, []);

  const enviarPreview = useCallback(() => {
    if (!dados) return;
    iframeRef.current?.contentWindow?.postMessage(
      { tipo: MSG_PREVIEW, skinId: skin.id, data: dados, theme: themeEfetivo, tema },
      window.location.origin,
    );
  }, [dados, skin.id, themeEfetivo, tema]);

  // Preview ao vivo: reposta a cada mudança de conteúdo/tema.
  useEffect(() => {
    enviarPreview();
  }, [enviarPreview]);

  // Mensagens do iframe: "pronto" (reenviar estado) e clique em slot.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const msg = event.data as { tipo?: string; slot?: string };
      if (msg?.tipo === MSG_PRONTO) enviarPreview();
      if (msg?.tipo === MSG_SLOT && typeof msg.slot === "string") {
        const slot = msg.slot;
        if (slot.startsWith("imagens.")) {
          setAba("imagens");
        } else {
          setAba("conteudo");
          const grupo = grupoDoSlot(slot);
          setAbertos((atual) => ({ ...atual, [grupo]: true }));
        }
        setPainelAberto(true);
        // Espera o painel/grupo abrir para focar e centralizar o campo.
        setTimeout(() => {
          const el =
            document.getElementById(`campo-${slot}`) ??
            document.getElementById(`slot-${slot.replace(/^imagens\./, "")}`);
          if (el instanceof HTMLElement) {
            el.focus({ preventScroll: true });
            el.scrollIntoView({ block: "center", behavior: "smooth" });
          }
        }, 120);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [enviarPreview]);

  // Rede de segurança contra fechar a aba com edição não salva.
  useEffect(() => {
    if (!sujo) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [sujo]);

  function handleSkinChange(novaSkinId: string) {
    if (!lead) return;
    const inicial = estadoInicial(lead, novaSkinId);
    setSkinId(inicial.skinId);
    setThemeId(inicial.themeId);
    setTema(inicial.tema);
    setDados(inicial.dados);
    setSujo(true);
    setAviso(null);
    setSalvarErro(null);
  }

  async function handleSalvar() {
    if (!lead || !dados) return;
    setSalvando(true);
    setSalvarErro(null);
    setAviso(null);
    try {
      const temaLimpo = Object.fromEntries(
        Object.entries(tema).filter(([, v]) => v !== undefined && v !== ""),
      ) as TemaPatch;
      const { lead: updated } = await api.putLeadDemo(id, {
        skinId: skin.id,
        themeId,
        dados: montarPatch(base, dados, skin),
        ...(Object.keys(temaLimpo).length > 0 && { tema: temaLimpo }),
      });
      setLead(updated);
      setSujo(false);
      setAviso("Demo salva e publicada.");
    } catch (error) {
      setSalvarErro(error instanceof ApiError ? error.message : "Falha ao salvar a demo.");
    } finally {
      setSalvando(false);
    }
  }

  async function handleExcluir() {
    if (!confirmaExcluir) {
      setConfirmaExcluir(true);
      return;
    }
    setExcluindo(true);
    setSalvarErro(null);
    try {
      await api.deleteLeadDemo(id);
      setSujo(false);
      router.push(`/leads/${id}`);
    } catch (error) {
      setSalvarErro(error instanceof ApiError ? error.message : "Falha ao excluir a demo.");
      setExcluindo(false);
      setConfirmaExcluir(false);
    }
  }

  async function handleUpload(slot: string, file: File) {
    setImgErro(null);
    setUploadSlot(slot);
    try {
      const preparado = await prepararImagem(file);
      const { url } = await api.uploadDemoImagem(id, slot, preparado, skin.id);
      atualizar((d) => ({ ...d, imagens: { ...d.imagens, [slot]: url } }));
    } catch (error) {
      setImgErro(
        error instanceof ApiError || error instanceof Error
          ? error.message
          : "Falha ao subir a imagem.",
      );
    } finally {
      setUploadSlot(null);
    }
  }

  async function handleRemoverImagem(slot: string) {
    setImgErro(null);
    setUploadSlot(slot);
    try {
      const { lead: updated } = await api.deleteDemoImagem(id, slot);
      setLead(updated);
      atualizar((d) => {
        const imagens = { ...d.imagens };
        const placeholder = skin.demoDataExemplo.imagens[slot];
        if (placeholder) imagens[slot] = placeholder;
        else delete imagens[slot];
        return { ...d, imagens };
      });
    } catch (error) {
      setImgErro(error instanceof ApiError ? error.message : "Falha ao remover a imagem.");
    } finally {
      setUploadSlot(null);
    }
  }

  function handleVoltar() {
    if (sujo && !window.confirm("Sair sem salvar? As edições não salvas serão perdidas.")) {
      return;
    }
    router.push(`/leads/${id}`);
  }

  async function handleCopiarLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/demo/${id}`);
      setAviso("Link copiado!");
    } catch {
      setSalvarErro("Não deu pra copiar — copie da barra de endereço da demo.");
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-sm text-ink-muted">Carregando editor…</p>
      </div>
    );
  }

  if (notFound || !lead || !dados) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3">
        <p className="text-sm text-ink-muted">
          {notFound ? "Lead não encontrado." : (erro ?? "Falha ao carregar o lead.")}
        </p>
        <Link href="/leads" className="text-sm text-accent">
          Voltar para leads
        </Link>
      </div>
    );
  }

  const abas: Array<{ id: Aba; rotulo: string }> = [
    { id: "conteudo", rotulo: "Conteúdo" },
    { id: "imagens", rotulo: "Imagens" },
    { id: "tema", rotulo: "Tema" },
    { id: "estrutura", rotulo: "Estrutura" },
  ];

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      {/* ── Barra superior ─────────────────────────────────────── */}
      <header className="flex shrink-0 items-center gap-3 border-b border-line bg-surface px-3 py-2">
        <button
          type="button"
          onClick={handleVoltar}
          className="text-xs text-ink-muted hover:text-foreground"
        >
          ← Ficha
        </button>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{lead.nome}</p>
          <p className="text-[11px] text-ink-muted">Editor de demo</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden items-center rounded border border-line md:flex" role="group">
            <button
              type="button"
              onClick={() => setPreviewMobile(false)}
              aria-pressed={!previewMobile}
              className={`px-2.5 py-1.5 text-xs ${!previewMobile ? "bg-surface-2 text-foreground" : "text-ink-muted hover:text-foreground"}`}
            >
              Desktop
            </button>
            <button
              type="button"
              onClick={() => setPreviewMobile(true)}
              aria-pressed={previewMobile}
              className={`px-2.5 py-1.5 text-xs ${previewMobile ? "bg-surface-2 text-foreground" : "text-ink-muted hover:text-foreground"}`}
            >
              Celular
            </button>
          </div>
          {aviso && <span className="hidden text-xs text-good sm:inline">{aviso}</span>}
          {sujo && !aviso && (
            <span className="hidden text-xs text-warning sm:inline">Alterações não salvas</span>
          )}
          <Button onClick={handleSalvar} loading={salvando}>
            Salvar
          </Button>
        </div>
      </header>
      {salvarErro && (
        <p className="border-b border-critical/30 bg-critical/10 px-3 py-1.5 text-xs text-critical">
          {salvarErro}
        </p>
      )}

      {/* ── Preview + painel ───────────────────────────────────── */}
      <div className="relative flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 bg-background p-0 md:p-3">
          <div
            className={
              previewMobile
                ? "mx-auto h-full w-[390px] max-w-full overflow-hidden rounded-lg border border-line"
                : "h-full w-full overflow-hidden md:rounded-lg md:border md:border-line"
            }
          >
            <iframe
              ref={iframeRef}
              src="/demo-preview"
              title="Prévia da demo"
              className="h-full w-full"
            />
          </div>
        </div>

        {/* Painel: coluna fixa no desktop; drawer inferior no celular. */}
        <aside
          className={`fixed inset-x-0 bottom-0 z-40 flex h-[72dvh] flex-col rounded-t-xl border-t border-line bg-surface shadow-2xl transition-transform md:static md:z-auto md:h-auto md:w-[400px] md:shrink-0 md:translate-y-0 md:rounded-none md:border-l md:border-t-0 md:shadow-none ${
            painelAberto ? "translate-y-0" : "translate-y-full"
          }`}
        >
          <div className="flex items-center justify-between border-b border-line px-2 md:hidden">
            <span className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Editar demo
            </span>
            <button
              type="button"
              onClick={() => setPainelAberto(false)}
              className="px-3 py-2 text-xs text-ink-muted hover:text-foreground"
            >
              Fechar ✕
            </button>
          </div>

          <nav className="flex shrink-0 border-b border-line" aria-label="Abas do editor">
            {abas.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setAba(tab.id)}
                aria-current={aba === tab.id}
                className={`flex-1 border-b-2 px-2 py-2.5 text-xs font-medium transition-colors ${
                  aba === tab.id
                    ? "border-accent text-foreground"
                    : "border-transparent text-ink-muted hover:text-foreground"
                }`}
              >
                {tab.rotulo}
              </button>
            ))}
          </nav>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {aba === "conteudo" && (
              <PainelConteudo
                dados={dados}
                skin={skin}
                abertos={abertos}
                setAberto={(grupo, aberto) =>
                  setAbertos((atual) => ({ ...atual, [grupo]: aberto }))
                }
                atualizar={atualizar}
              />
            )}
            {aba === "imagens" && (
              <PainelImagens
                dados={dados}
                skin={skin}
                uploadSlot={uploadSlot}
                erro={imgErro}
                onUpload={handleUpload}
                onRemover={handleRemoverImagem}
              />
            )}
            {aba === "tema" && (
              <PainelTema
                skinId={skinId}
                onSkinChange={handleSkinChange}
                skin={skin}
                themeId={themeId}
                setThemeId={(v) => {
                  setThemeId(v);
                  setSujo(true);
                }}
                tema={tema}
                setTema={(patch) => {
                  setTema(patch);
                  setSujo(true);
                }}
              />
            )}
            {aba === "estrutura" && (
              <PainelEstrutura dados={dados} skin={skin} atualizar={atualizar} />
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-line px-3 py-2">
            <a
              href={`/demo/${id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-accent hover:underline"
            >
              Abrir demo ↗
            </a>
            <button
              type="button"
              onClick={handleCopiarLink}
              className="text-xs text-ink-muted hover:text-foreground"
            >
              Copiar link
            </button>
            <span className="ml-auto" />
            {confirmaExcluir && (
              <span className="text-[11px] text-critical">
                Apaga registro e imagens; /demo volta a 404.
              </span>
            )}
            <Button
              variant="danger"
              onClick={handleExcluir}
              loading={excluindo}
              disabled={!lead.demo}
              title={lead.demo ? undefined : "Nada salvo ainda"}
              className="!px-2 !py-1 text-xs"
            >
              {confirmaExcluir ? "Confirmar exclusão" : "Excluir demo"}
            </Button>
            {confirmaExcluir && !excluindo && (
              <button
                type="button"
                onClick={() => setConfirmaExcluir(false)}
                className="text-xs text-ink-muted hover:text-foreground"
              >
                Cancelar
              </button>
            )}
          </div>
        </aside>
      </div>

      {/* Botão flutuante que abre o painel no celular. */}
      {!painelAberto && (
        <button
          type="button"
          onClick={() => setPainelAberto(true)}
          className="fixed bottom-4 right-4 z-40 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-ink shadow-lg md:hidden"
        >
          Editar
        </button>
      )}
    </div>
  );
}
