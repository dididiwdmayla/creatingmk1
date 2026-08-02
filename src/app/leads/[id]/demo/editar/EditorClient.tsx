"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/Button";
import { NIVEIS_IA, NIVEL_IA_PADRAO, nivelIaValido, type NivelIA } from "@/lib/ai/nivel";
import type { SugestaoDemo } from "@/lib/ai/sugestao";
import { ApiError, api } from "@/lib/api-client";
import { demoUrlComToken, envioVigente } from "@/lib/demos/envio";
import { getFonte } from "@/lib/demos/fontes";
import { idiomaPadraoDoLead } from "@/lib/demos/idioma";
import { montarDemoData } from "@/lib/demos/montar";
import { montarPatch } from "@/lib/demos/patch";
import { DEFAULT_SKIN, getSkin, getTheme } from "@/lib/demos/registry";
import { aplicarTema } from "@/lib/demos/tema";
import type { DemoData, TemaPatch } from "@/lib/demos/types";
import { IDIOMA_PADRAO } from "@/lib/idioma";
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

/** Rótulo + explicação curta de cada nível de intervenção da IA (ver lib/ai/nivel.ts). */
const NIVEL_INFO: Record<NivelIA, { rotulo: string; descricao: string }> = {
  "toque-leve": { rotulo: "Toque leve", descricao: "Só paleta e fonte — nenhum texto." },
  equilibrado: {
    rotulo: "Equilibrado",
    descricao: "Paleta, fonte, animação + slogan e descrições curtas.",
  },
  completo: {
    rotulo: "Completo",
    descricao:
      "Tudo do equilibrado + reescreve os textos de todas as seções no tom do nicho e no idioma da região.",
  },
};

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
    dados: montarDemoData(skin.demoDataExemplo, lead, daSkin ? lead.demo?.dados : undefined, skin.id),
    idioma: lead.demo?.idioma ?? idiomaPadraoDoLead(lead),
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
  const searchParams = useSearchParams();
  const [lead, setLead] = useState<Lead | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [skinId, setSkinId] = useState(DEFAULT_SKIN.id);
  const [themeId, setThemeId] = useState(DEFAULT_SKIN.themeDefault.id);
  const [tema, setTema] = useState<TemaPatch>({});
  const [dados, setDados] = useState<DemoData | null>(null);
  const [idioma, setIdioma] = useState<string>(IDIOMA_PADRAO);
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
  const [uploadVideoSlot, setUploadVideoSlot] = useState<string | null>(null);
  const [videoErro, setVideoErro] = useState<string | null>(null);

  // IA na Forja: sem GEMINI_API_KEY o botão fica oculto (nada quebra).
  const [iaDisponivel, setIaDisponivel] = useState<boolean | null>(null);
  const [mostrarIA, setMostrarIA] = useState(false);
  // Nível de intervenção (toque-leve/equilibrado/completo): escolhido ANTES
  // da chamada — o modal abre nesta etapa antes de gerar (exceto no fluxo
  // ?ia=1, que já chega com o nível escolhido no passo de escolha de skin).
  const [escolhendoNivel, setEscolhendoNivel] = useState(false);
  // ?nivel= vem do passo de escolha (checkbox "começar com sugestões de
  // IA") — lido já no valor inicial (sem setState num efeito) porque
  // useSearchParams resolve de forma síncrona no client.
  const [nivelIA, setNivelIA] = useState<NivelIA>(() => {
    const nivelDaUrl = searchParams.get("nivel");
    return nivelIaValido(nivelDaUrl) ? nivelDaUrl : NIVEL_IA_PADRAO;
  });
  // Fica true assim que ?nivel= (URL) ou o último nível salvo (GET /api/ia/nivel)
  // resolver — o fluxo ?ia=1 espera isso pra não gerar com o padrão errado.
  const [nivelResolvido, setNivelResolvido] = useState(() =>
    nivelIaValido(searchParams.get("nivel")),
  );
  const [gerandoIA, setGerandoIA] = useState(false);
  const [sugestao, setSugestao] = useState<SugestaoDemo | null>(null);
  const [iaErro, setIaErro] = useState<string | null>(null);
  // ?ia=1 (checkbox "começar com sugestões de IA" do passo de escolha).
  const [iaAuto, setIaAuto] = useState(false);
  const iaAutoDisparadaRef = useRef(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let ignore = false;
    api
      .getLead(id)
      .then(({ lead: leadData }) => {
        if (ignore) return;
        setLead(leadData);
        // ?skin= vem do passo de escolha (/leads/{id}/demo/escolher) — só
        // vale pra demo NOVA; uma já salva mantém o skin dela (a troca
        // continua disponível na aba Tema).
        const skinDaUrl = !leadData.demo ? searchParams.get("skin") : null;
        const inicial = estadoInicial(leadData, skinDaUrl ?? undefined);
        setSkinId(inicial.skinId);
        setThemeId(inicial.themeId);
        setTema(inicial.tema);
        setDados(inicial.dados);
        setIdioma(inicial.idioma);
        // Só demo NOVA começa com sugestões de IA — nunca por cima de algo salvo.
        if (!leadData.demo && searchParams.get("ia") === "1") setIaAuto(true);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- searchParams só é lido no load inicial do lead.
  }, [id]);

  useEffect(() => {
    let ignore = false;
    api
      .iaStatus()
      .then(({ disponivel }) => {
        if (!ignore) setIaDisponivel(disponivel);
      })
      .catch(() => {
        if (!ignore) setIaDisponivel(false);
      });
    // Sem ?nivel= na URL (já aplicado no valor inicial do estado), busca o
    // último nível que o próprio usuário escolheu.
    if (!nivelIaValido(searchParams.get("nivel"))) {
      api
        .iaNivel()
        .then(({ nivel }) => {
          if (!ignore) setNivelIA(nivel);
        })
        .catch(() => {
          /* sem sessão/erro: mantém o padrão já no estado inicial. */
        })
        .finally(() => {
          if (!ignore) setNivelResolvido(true);
        });
    }
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- searchParams só é lido no load inicial.
  }, []);

  const skin = getSkin(skinId) ?? DEFAULT_SKIN;
  const themeEfetivo = useMemo(
    () => aplicarTema(getTheme(skin, themeId), tema, skin.heroEscalaLimites),
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
      { tipo: MSG_PREVIEW, skinId: skin.id, data: dados, theme: themeEfetivo, tema, idioma },
      window.location.origin,
    );
  }, [dados, skin.id, themeEfetivo, tema, idioma]);

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

  // Chegou com ?ia=1: o nível já foi escolhido no passo de escolha de skin
  // (?nivel= na URL) — gera direto assim que lead + disponibilidade + nível
  // resolverem, abrindo o MESMO preview aplicar/descartar do botão: a demo
  // "começa com sugestões", mas nada entra sem confirmação.
  useEffect(() => {
    if (!iaAuto || iaDisponivel !== true || !lead || !nivelResolvido || iaAutoDisparadaRef.current)
      return;
    iaAutoDisparadaRef.current = true;
    setMostrarIA(true);
    setGerandoIA(true);
    api
      .gerarSugestaoDemo(lead.placeId, skinId, nivelIA, idioma)
      .then(({ sugestao: nova }) => setSugestao(nova))
      .catch((error) =>
        setIaErro(error instanceof ApiError ? error.message : "Falha ao gerar sugestões."),
      )
      .finally(() => setGerandoIA(false));
  }, [iaAuto, iaDisponivel, lead, skinId, nivelResolvido, nivelIA, idioma]);

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

  const idiomaPadrao = lead ? idiomaPadraoDoLead(lead) : IDIOMA_PADRAO;

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
        ...(idioma !== idiomaPadrao && { idioma }),
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

  async function handleUploadVideo(slot: string, file: File) {
    setVideoErro(null);
    setUploadVideoSlot(slot);
    try {
      const { url } = await api.uploadDemoVideo(id, slot, file, skin.id);
      atualizar((d) => ({ ...d, videos: { ...d.videos, [slot]: url } }));
    } catch (error) {
      setVideoErro(
        error instanceof ApiError || error instanceof Error
          ? error.message
          : "Falha ao subir o vídeo.",
      );
    } finally {
      setUploadVideoSlot(null);
    }
  }

  async function handleRemoverVideo(slot: string) {
    setVideoErro(null);
    setUploadVideoSlot(slot);
    try {
      const { lead: updated } = await api.deleteDemoVideo(id, slot, skin.id);
      setLead(updated);
      atualizar((d) => {
        const videos = { ...d.videos };
        delete videos[slot];
        return { ...d, videos };
      });
    } catch (error) {
      setVideoErro(error instanceof ApiError ? error.message : "Falha ao remover o vídeo.");
    } finally {
      setUploadVideoSlot(null);
    }
  }

  /** Botão "Gerar com IA": abre o escolhedor de nível ANTES de chamar o Gemini. */
  function handleAbrirGerarIA() {
    setMostrarIA(true);
    setEscolhendoNivel(true);
    setIaErro(null);
    setSugestao(null);
  }

  /** Confirma o nível escolhido (persiste como último nível) e gera. */
  function handleConfirmarNivel() {
    setEscolhendoNivel(false);
    setIaErro(null);
    setGerandoIA(true);
    api.salvarIaNivel(nivelIA).catch(() => {
      /* preferência não salvou — não impede a geração desta vez. */
    });
    api
      .gerarSugestaoDemo(id, skin.id, nivelIA, idioma)
      .then(({ sugestao: nova }) => setSugestao(nova))
      .catch((error) =>
        setIaErro(error instanceof ApiError ? error.message : "Falha ao gerar sugestões."),
      )
      .finally(() => setGerandoIA(false));
  }

  /** Aplica a sugestão ao estado do editor — nada persiste sem "Salvar". */
  function handleAplicarSugestao() {
    if (!sugestao) return;
    const aplicada = sugestao;
    setThemeId(aplicada.themeId);
    setTema((atual) => ({
      ...atual,
      destaque: aplicada.destaque,
      fonteDisplay: aplicada.fonteDisplay,
      animacao: aplicada.animacao,
    }));

    const temTextos =
      aplicada.slogan !== undefined ||
      aplicada.descricao !== undefined ||
      aplicada.heroRotulo !== undefined ||
      aplicada.heroCta !== undefined ||
      aplicada.heroCtaSecundaria !== undefined ||
      aplicada.heroItens !== undefined ||
      aplicada.titulosSecoes !== undefined ||
      aplicada.textosSecoes !== undefined ||
      aplicada.servicos !== undefined ||
      aplicada.depoimentos !== undefined;

    if (temTextos) {
      atualizar((d) => {
        const secoes = { ...d.secoes };
        for (const [idSecao, titulo] of Object.entries(aplicada.titulosSecoes ?? {})) {
          secoes[idSecao] = { ...secoes[idSecao], titulo };
        }
        for (const [idSecao, textos] of Object.entries(aplicada.textosSecoes ?? {})) {
          secoes[idSecao] = {
            ...secoes[idSecao],
            ...(textos.rotulo !== undefined && { rotulo: textos.rotulo }),
            ...(textos.titulo !== undefined && { titulo: textos.titulo }),
            ...(textos.texto !== undefined && { texto: textos.texto }),
            ...(textos.cta !== undefined && { cta: textos.cta }),
            ...(textos.ctaSecundaria !== undefined && { ctaSecundaria: textos.ctaSecundaria }),
            ...(textos.itens !== undefined && { itens: textos.itens }),
          };
        }
        if (
          aplicada.descricao !== undefined ||
          aplicada.heroRotulo !== undefined ||
          aplicada.heroCta !== undefined ||
          aplicada.heroCtaSecundaria !== undefined ||
          aplicada.heroItens !== undefined
        ) {
          secoes.hero = {
            ...secoes.hero,
            ...(aplicada.descricao !== undefined && { texto: aplicada.descricao }),
            ...(aplicada.heroRotulo !== undefined && { rotulo: aplicada.heroRotulo }),
            ...(aplicada.heroCta !== undefined && { cta: aplicada.heroCta }),
            ...(aplicada.heroCtaSecundaria !== undefined && {
              ctaSecundaria: aplicada.heroCtaSecundaria,
            }),
            ...(aplicada.heroItens !== undefined && { itens: aplicada.heroItens }),
          };
        }
        // servicos/depoimentos: só nome/descricao (ou autor/texto) mudam —
        // preço, categoria, destaques e nota/contexto do item atual são
        // preservados (não vêm da IA, são dado do lead/editor).
        const servicos = aplicada.servicos
          ? d.servicos.map((servico, i) => {
              const novo = aplicada.servicos?.[i];
              if (!novo) return servico;
              return {
                ...servico,
                nome: novo.nome,
                ...(novo.descricao !== undefined && { descricao: novo.descricao }),
              };
            })
          : d.servicos;
        const depoimentos = aplicada.depoimentos
          ? d.depoimentos.map((depoimento, i) => {
              const novo = aplicada.depoimentos?.[i];
              if (!novo) return depoimento;
              return { ...depoimento, autor: novo.autor, texto: novo.texto };
            })
          : d.depoimentos;
        return {
          ...d,
          ...(aplicada.slogan !== undefined && { slogan: aplicada.slogan }),
          secoes,
          servicos,
          depoimentos,
        };
      });
    }

    setMostrarIA(false);
    setSugestao(null);
    setAviso("Sugestões de IA aplicadas — salve para publicar.");
  }

  function handleDescartarSugestao() {
    setMostrarIA(false);
    setEscolhendoNivel(false);
    setSugestao(null);
    setIaErro(null);
  }

  function handleVoltar() {
    if (sujo && !window.confirm("Sair sem salvar? As edições não salvas serão perdidas.")) {
      return;
    }
    router.push(`/leads/${id}`);
  }

  async function handleCopiarLink() {
    try {
      // Canal "link", igual à ficha e a /demos — não queima o token que
      // possa estar numa mensagem de WhatsApp já montada (EnvioDemo.canal).
      const tokenLink = lead ? envioVigente(lead.demo, "link")?.token : undefined;
      const url = demoUrlComToken(window.location.origin, id, tokenLink);
      await navigator.clipboard.writeText(url);
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
          {iaDisponivel && (
            <button
              type="button"
              onClick={handleAbrirGerarIA}
              disabled={gerandoIA}
              className="rounded border border-line px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-accent disabled:opacity-50"
            >
              ✨ <span className="hidden sm:inline">Gerar com IA</span>
              <span className="sm:hidden">IA</span>
            </button>
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
                uploadVideoSlot={uploadVideoSlot}
                videoErro={videoErro}
                onUploadVideo={handleUploadVideo}
                onRemoverVideo={handleRemoverVideo}
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
                idioma={idioma}
                idiomaPadrao={idiomaPadrao}
                setIdioma={(valor) => {
                  setIdioma(valor);
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

      {/* Preview das sugestões de IA: aplicar ou descartar — nunca escreve
          por cima sem confirmação, e nada persiste sem o Salvar normal.
          Antes de chamar o Gemini, o usuário escolhe o nível de intervenção
          (toque-leve/equilibrado/completo — ver lib/ai/nivel.ts). */}
      {mostrarIA && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">
                {escolhendoNivel ? "✨ Gerar com IA" : "✨ Sugestões de IA"}
              </h2>
              <button
                type="button"
                onClick={handleDescartarSugestao}
                className="text-xs text-ink-muted hover:text-foreground"
              >
                Fechar ✕
              </button>
            </div>

            {escolhendoNivel ? (
              <>
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 text-sm">
                  <p className="mb-3 text-xs text-ink-muted">
                    Quanto a IA pode mexer nesta geração?
                  </p>
                  <div className="flex flex-col gap-2">
                    {NIVEIS_IA.map((valor) => (
                      <label
                        key={valor}
                        className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm text-foreground transition-colors ${
                          nivelIA === valor
                            ? "border-accent bg-surface-2"
                            : "border-line hover:border-accent/50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="nivel-ia"
                          checked={nivelIA === valor}
                          onChange={() => setNivelIA(valor)}
                          className="mt-0.5 accent-[var(--accent)]"
                        />
                        <span>
                          {NIVEL_INFO[valor].rotulo}
                          <span className="block text-xs text-ink-muted">
                            {NIVEL_INFO[valor].descricao}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
                  <button
                    type="button"
                    onClick={handleDescartarSugestao}
                    className="rounded border border-line px-3 py-1.5 text-xs text-ink-muted hover:text-foreground"
                  >
                    Cancelar
                  </button>
                  <Button onClick={handleConfirmarNivel} className="!px-3 !py-1.5 text-xs">
                    Gerar sugestões
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 text-sm">
                  {gerandoIA && (
                    <p className="py-6 text-center text-ink-muted">
                      Gerando sugestões para {lead.nome}…
                    </p>
                  )}
                  {iaErro && !gerandoIA && (
                    <p className="rounded border border-critical/30 bg-critical/10 px-3 py-2 text-xs text-critical">
                      {iaErro}
                    </p>
                  )}
                  {sugestao && !gerandoIA && (
                    <div className="flex flex-col gap-3">
                      <div className="rounded border border-line bg-surface-2 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                          Tema
                        </p>
                        <ul className="mt-1.5 flex flex-col gap-1 text-xs text-foreground">
                          <li>
                            Preset:{" "}
                            {skin.themePresets.find((p) => p.id === sugestao.themeId)?.nome ??
                              sugestao.themeId}
                          </li>
                          <li className="flex items-center gap-1.5">
                            Cor primária:
                            <span
                              className="inline-block h-3.5 w-3.5 rounded-full border border-line"
                              style={{ backgroundColor: sugestao.destaque }}
                            />
                            <code className="font-mono">{sugestao.destaque}</code>
                          </li>
                          <li>
                            Fonte dos títulos:{" "}
                            {getFonte(sugestao.fonteDisplay)?.nome ?? sugestao.fonteDisplay}
                          </li>
                          <li>Animação: {sugestao.animacao}</li>
                        </ul>
                      </div>
                      {(sugestao.slogan !== undefined ||
                        sugestao.descricao !== undefined ||
                        sugestao.heroRotulo !== undefined ||
                        sugestao.heroCta !== undefined ||
                        sugestao.heroCtaSecundaria !== undefined) && (
                        <div className="rounded border border-line bg-surface-2 p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                            Textos
                          </p>
                          {sugestao.slogan !== undefined && (
                            <p className="mt-1.5 text-xs text-foreground">
                              <span className="text-ink-muted">Slogan:</span> {sugestao.slogan}
                            </p>
                          )}
                          {sugestao.descricao !== undefined && (
                            <p className="mt-1 text-xs text-foreground">
                              <span className="text-ink-muted">Descrição:</span>{" "}
                              {sugestao.descricao}
                            </p>
                          )}
                          {sugestao.heroRotulo !== undefined && (
                            <p className="mt-1 text-xs text-foreground">
                              <span className="text-ink-muted">Rótulo do hero:</span>{" "}
                              {sugestao.heroRotulo}
                            </p>
                          )}
                          {sugestao.heroCta !== undefined && (
                            <p className="mt-1 text-xs text-foreground">
                              <span className="text-ink-muted">CTA do hero:</span>{" "}
                              {sugestao.heroCta}
                            </p>
                          )}
                          {sugestao.heroCtaSecundaria !== undefined && (
                            <p className="mt-1 text-xs text-foreground">
                              <span className="text-ink-muted">CTA secundária do hero:</span>{" "}
                              {sugestao.heroCtaSecundaria}
                            </p>
                          )}
                          {sugestao.heroItens && sugestao.heroItens.length > 0 && (
                            <ul className="mt-1 flex flex-col gap-0.5 pl-2 text-xs text-ink-muted">
                              {sugestao.heroItens.map((item, i) => (
                                <li key={i}>
                                  {[item.titulo, item.subtitulo, item.detalhe, item.texto]
                                    .filter(Boolean)
                                    .join(" — ")}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                      {sugestao.titulosSecoes &&
                        Object.keys(sugestao.titulosSecoes).length > 0 && (
                          <div className="rounded border border-line bg-surface-2 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                              Títulos de seções
                            </p>
                            <ul className="mt-1.5 flex flex-col gap-1 text-xs text-foreground">
                              {Object.entries(sugestao.titulosSecoes).map(([idSecao, titulo]) => (
                                <li key={idSecao}>
                                  <span className="text-ink-muted">
                                    {skin.secoes.find((s) => s.id === idSecao)?.nome ?? idSecao}:
                                  </span>{" "}
                                  {titulo}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      {sugestao.textosSecoes &&
                        Object.keys(sugestao.textosSecoes).length > 0 && (
                          <div className="rounded border border-line bg-surface-2 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                              Textos de seções
                            </p>
                            <ul className="mt-1.5 flex flex-col gap-2 text-xs text-foreground">
                              {Object.entries(sugestao.textosSecoes).map(([idSecao, textos]) => (
                                <li key={idSecao}>
                                  <span className="font-medium">
                                    {skin.secoes.find((s) => s.id === idSecao)?.nome ?? idSecao}
                                  </span>
                                  <ul className="mt-0.5 flex flex-col gap-0.5 pl-2 text-ink-muted">
                                    {textos.rotulo !== undefined && (
                                      <li>Rótulo: {textos.rotulo}</li>
                                    )}
                                    {textos.titulo !== undefined && (
                                      <li>Título: {textos.titulo}</li>
                                    )}
                                    {textos.texto !== undefined && <li>Texto: {textos.texto}</li>}
                                    {textos.cta !== undefined && <li>CTA: {textos.cta}</li>}
                                    {textos.ctaSecundaria !== undefined && (
                                      <li>CTA secundária: {textos.ctaSecundaria}</li>
                                    )}
                                    {textos.itens && textos.itens.length > 0 && (
                                      <li>
                                        Itens:
                                        <ul className="pl-2">
                                          {textos.itens.map((item, i) => (
                                            <li key={i}>
                                              {[item.titulo, item.subtitulo, item.detalhe, item.texto]
                                                .filter(Boolean)
                                                .join(" — ")}
                                            </li>
                                          ))}
                                        </ul>
                                      </li>
                                    )}
                                  </ul>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      {sugestao.servicos && sugestao.servicos.length > 0 && (
                        <div className="rounded border border-line bg-surface-2 p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                            Serviços
                          </p>
                          <ul className="mt-1.5 flex flex-col gap-1 text-xs text-foreground">
                            {sugestao.servicos.map((servico, i) => (
                              <li key={i}>
                                <span className="font-medium">{servico.nome}</span>
                                {servico.descricao && (
                                  <span className="text-ink-muted"> — {servico.descricao}</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {sugestao.depoimentos && sugestao.depoimentos.length > 0 && (
                        <div className="rounded border border-line bg-surface-2 p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                            Depoimentos
                          </p>
                          <ul className="mt-1.5 flex flex-col gap-1 text-xs text-foreground">
                            {sugestao.depoimentos.map((dep, i) => (
                              <li key={i}>
                                <span className="text-ink-muted">{dep.autor}:</span> {dep.texto}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <p className="text-[11px] text-ink-muted">
                        Aplicar só muda o rascunho do editor — nada é publicado sem Salvar.
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
                  {iaErro && !gerandoIA && (
                    <Button onClick={handleConfirmarNivel} className="!px-3 !py-1.5 text-xs">
                      Tentar de novo
                    </Button>
                  )}
                  <button
                    type="button"
                    onClick={handleDescartarSugestao}
                    className="rounded border border-line px-3 py-1.5 text-xs text-ink-muted hover:text-foreground"
                  >
                    Descartar
                  </button>
                  {sugestao && !gerandoIA && (
                    <Button onClick={handleAplicarSugestao} className="!px-3 !py-1.5 text-xs">
                      Aplicar sugestões
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

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
