"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/Button";
import { ApiError, api, type MensagensResumoResponse } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import { MENSAGEM_TEXTO_MAX, type Mensagem } from "@/lib/mensagens/types";

/**
 * Mensagens privadas entre os usuários do time. Duas visões na mesma
 * página: lista de conversas (um card por colega, com última mensagem e
 * badge de não-lidas) e a conversa aberta (bolhas + envio de texto
 * simples). Atualização por POLLING leve (sem websocket): a conversa
 * aberta a cada 5s, a lista a cada 10s — o GET da conversa já marca as
 * recebidas como lidas no servidor.
 */

const POLL_CONVERSA_MS = 5_000;
const POLL_LISTA_MS = 10_000;

export default function MensagensPage() {
  const [meuId, setMeuId] = useState<string | null>(null);
  const [resumo, setResumo] = useState<MensagensResumoResponse | null>(null);
  const [com, setCom] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[] | null>(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fimRef = useRef<HTMLDivElement>(null);
  const totalRef = useRef(0);

  useEffect(() => {
    let ignore = false;
    api
      .me()
      .then(({ usuario }) => {
        if (!ignore) setMeuId(usuario.id);
      })
      .catch(() => {
        if (!ignore) setErro("Falha ao identificar a sessão.");
      });
    return () => {
      ignore = true;
    };
  }, []);

  // Lista de conversas: carga + polling enquanto nenhuma conversa aberta.
  useEffect(() => {
    if (com) return;
    let ignore = false;
    function carregar() {
      api
        .mensagensResumo()
        .then((data) => {
          if (!ignore) {
            setResumo(data);
            setErro(null);
          }
        })
        .catch((error) => {
          if (!ignore) {
            setErro(
              error instanceof ApiError ? error.message : "Falha ao carregar as conversas.",
            );
          }
        });
    }
    carregar();
    const timer = setInterval(carregar, POLL_LISTA_MS);
    return () => {
      ignore = true;
      clearInterval(timer);
    };
  }, [com]);

  // Conversa aberta: carga + polling (o GET marca as recebidas como lidas).
  useEffect(() => {
    if (!com) return;
    let ignore = false;
    function carregar() {
      api
        .listConversa(com as string)
        .then(({ mensagens: novas }) => {
          if (!ignore) {
            setMensagens(novas);
            setErro(null);
          }
        })
        .catch((error) => {
          if (!ignore) {
            setErro(
              error instanceof ApiError ? error.message : "Falha ao carregar a conversa.",
            );
          }
        });
    }
    carregar();
    const timer = setInterval(carregar, POLL_CONVERSA_MS);
    return () => {
      ignore = true;
      clearInterval(timer);
    };
  }, [com]);

  // Rola pro fim quando chega mensagem nova (inclusive a recém-enviada).
  useEffect(() => {
    const total = mensagens?.length ?? 0;
    if (total > totalRef.current) {
      fimRef.current?.scrollIntoView({ block: "end" });
    }
    totalRef.current = total;
  }, [mensagens]);

  async function handleEnviar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!com || !texto.trim() || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      const { mensagem } = await api.enviarMensagem(com, texto);
      setMensagens((atuais) => [...(atuais ?? []), mensagem]);
      setTexto("");
    } catch (error) {
      setErro(error instanceof ApiError ? error.message : "Falha ao enviar a mensagem.");
    } finally {
      setEnviando(false);
    }
  }

  const interlocutor = resumo?.usuarios.find((u) => u.id === com);

  // ── Conversa aberta ───────────────────────────────────────────────
  // Estilo WhatsApp, mas SEM sair do fluxo normal (sem position:fixed):
  // o header e a barra inferior do app (Nav.tsx) continuam visíveis e
  // intocados; este bloco só ocupa, dentro do <main> do AppLayout, a
  // altura exata que sobra entre os dois — 100dvh (viewport DINÂMICA,
  // não 100vh) menos as alturas fixas de Nav.tsx (--app-header-h/
  // --app-nav-h, ver globals.css) e a faixa de segurança do notch. As
  // margens negativas cancelam o padding do <main> (px-4 pt-4 pb-20) pra
  // este bloco ficar coladinho no header em cima e na nav embaixo — sem
  // isso o cálculo de altura ficaria errado (padding duplicado) e era
  // exatamente esse descompasso que colapsava a área de mensagens.
  //
  // Como a altura do bloco é exata (não "flex-1 solto"), o formulário de
  // envio não precisa de position:fixed: sendo o último item de uma
  // coluna flex com altura fechada, ele naturalmente encosta no fim do
  // bloco — que É o topo da nav. O teclado mobile empurra ele pra cima
  // porque interactiveWidget:"resizes-content" (ver app/layout.tsx) faz o
  // 100dvh encolher quando o teclado abre, e como tudo aqui é fluxo
  // normal (não fixed), o encolhimento reflui pra cá sozinho.
  if (com) {
    return (
      <div
        className="-mx-4 -mt-4 -mb-20 flex flex-col overflow-hidden"
        style={{
          height:
            "calc(100dvh - var(--app-header-h) - var(--app-nav-h) - env(safe-area-inset-bottom))",
        }}
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-line bg-surface px-4 py-3">
          <button
            type="button"
            onClick={() => {
              setCom(null);
              setMensagens(null);
              totalRef.current = 0;
            }}
            className="text-xs text-ink-muted hover:text-foreground"
          >
            ← Conversas
          </button>
          <h1 className="font-display text-base font-bold text-foreground">
            {interlocutor?.nome ?? "usuário removido"}
          </h1>
          {interlocutor && !interlocutor.ativo && (
            <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-ink-muted">
              desativado
            </span>
          )}
        </div>

        {erro && (
          <p className="mx-4 mt-2 shrink-0 rounded border border-critical/30 bg-critical/10 px-3 py-2 text-xs text-critical">
            {erro}
          </p>
        )}

        {/* justify-end: histórico curto fica ancorado embaixo; histórico
            longo estoura o topo e o overflow-y-auto scrolla pra cima —
            o mesmo comportamento do WhatsApp. */}
        <div className="flex min-h-0 flex-1 flex-col justify-end gap-2 overflow-y-auto px-4 py-3">
          {mensagens === null && <p className="text-sm text-ink-muted">Carregando…</p>}
          {mensagens?.length === 0 && (
            <p className="text-sm text-ink-muted">
              Nenhuma mensagem ainda — puxe o assunto abaixo.
            </p>
          )}
          {mensagens?.map((mensagem) => {
            const minha = mensagem.deUserId === meuId;
            return (
              <div
                key={mensagem.id}
                className={`flex flex-col ${minha ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[85%] whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm ${
                    minha
                      ? "bg-accent text-accent-ink"
                      : "border border-line bg-surface text-foreground"
                  }`}
                >
                  {mensagem.texto}
                </div>
                <span className="mt-0.5 text-[10px] text-ink-muted">
                  {formatDateTime(mensagem.criadaEm)}
                  {minha && mensagem.lidaEm ? " · lida" : ""}
                </span>
              </div>
            );
          })}
          <div ref={fimRef} />
        </div>

        <form
          onSubmit={handleEnviar}
          className="shrink-0 border-t border-line bg-surface px-4 py-2"
        >
          <div className="flex items-center gap-2">
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              maxLength={MENSAGEM_TEXTO_MAX}
              placeholder="Escreva uma mensagem…"
              className="min-w-0 flex-1 rounded border border-line bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            />
            <Button type="submit" loading={enviando} disabled={!texto.trim()}>
              Enviar
            </Button>
          </div>
        </form>
      </div>
    );
  }

  // ── Lista de conversas ──────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-lg font-bold text-foreground">Mensagens</h1>
        <p className="text-xs text-ink-muted">
          Conversas privadas entre os usuários do Radar — só os dois participantes leem.
        </p>
      </div>

      {erro && (
        <p className="rounded border border-critical/30 bg-critical/10 px-3 py-2 text-xs text-critical">
          {erro}
        </p>
      )}

      {resumo === null && !erro && <p className="text-sm text-ink-muted">Carregando…</p>}

      {resumo?.conversas.length === 0 && (
        <p className="text-sm text-ink-muted">Nenhum outro usuário cadastrado ainda.</p>
      )}

      <ul className="flex flex-col gap-2">
        {resumo?.conversas.map((conversa) => {
          const usuario = resumo.usuarios.find((u) => u.id === conversa.comUserId);
          const ultima = conversa.ultimaMensagem;
          return (
            <li key={conversa.comUserId}>
              <button
                type="button"
                onClick={() => setCom(conversa.comUserId)}
                className="card-lift flex w-full items-center gap-3 rounded-lg border border-line bg-surface p-3 text-left"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 font-display text-sm font-bold uppercase text-accent">
                  {(usuario?.nome ?? "usuário removido").slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">
                      {usuario?.nome ?? "usuário removido"}
                    </span>
                    {usuario && !usuario.ativo && (
                      <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-ink-muted">
                        desativado
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-ink-muted">
                    {ultima
                      ? `${ultima.deUserId === meuId ? "Você: " : ""}${ultima.texto}`
                      : "Sem mensagens ainda"}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  {ultima && (
                    <span className="text-[10px] text-ink-muted">
                      {formatDateTime(ultima.criadaEm)}
                    </span>
                  )}
                  {conversa.naoLidas > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-accent-ink">
                      {conversa.naoLidas}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
