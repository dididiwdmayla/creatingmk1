"use client";

import Image from "next/image";
import { Reorder, useDragControls } from "motion/react";
import { useRef, type ChangeEvent, type ReactNode } from "react";

import { FUMACA_COLORIDA, resolverCoresAura } from "@/lib/demos/efeitos/aura/cores";
import { EFEITOS, getEfeito, intensidadePadrao } from "@/lib/demos/efeitos/registry";
import type { EfeitoIntensidade } from "@/lib/demos/efeitos/types";
import { ordemEfetiva, secaoAnimada } from "@/lib/demos/estrutura";
import { fontesPorPapel, type FontePapel } from "@/lib/demos/fontes";
import { LED_ESTILOS } from "@/lib/demos/led/registry";
import { CAMPOS_IDENTIDADE_DEMO } from "@/lib/demos/patch";
import { formatarPrecoServico } from "@/lib/demos/precos";
import { SKINS } from "@/lib/demos/registry";
import { TEMA_RAIOS, inkPara } from "@/lib/demos/tema";
import { IDIOMAS_SUPORTADOS, idiomaLabel } from "@/lib/idioma";
import type {
  Alinhamento,
  Animacao,
  AnimacaoEntrada,
  AuraCoresPatch,
  CliqueEstilo,
  CorModo,
  CoresModoValor,
  DemoData,
  DemoItem,
  Densidade,
  HoverEstilo,
  LedPreset,
  SkinDefinition,
  TemaPatch,
} from "@/lib/demos/types";

/**
 * Painéis do editor de demos (abas Conteúdo/Imagens/Tema/Estrutura).
 * Todos editam o DemoData efetivo via `atualizar` — o EditorClient cuida
 * de dirty state, preview e persistência. Os ids `campo-{slot}` casam com
 * os data-demo-slot da skin: clicar no preview foca o campo daqui.
 */

export type Aba = "conteudo" | "imagens" | "tema" | "estrutura";

type Atualizar = (fn: (atual: DemoData) => DemoData) => void;

const INPUT_CLS =
  "w-full rounded border border-line bg-surface-2 px-2.5 py-2 text-sm text-foreground outline-none focus:border-accent";
const LABEL_CLS = "flex flex-col gap-1 text-xs text-ink-muted";

function Campo({
  slot,
  rotulo,
  valor,
  onChange,
  area,
}: {
  slot: string;
  rotulo: string;
  valor: string;
  onChange: (valor: string) => void;
  area?: boolean;
}) {
  return (
    <label className={LABEL_CLS}>
      {rotulo}
      {area ? (
        <textarea
          id={`campo-${slot}`}
          value={valor}
          rows={3}
          onChange={(e) => onChange(e.target.value)}
          className={`${INPUT_CLS} resize-y`}
        />
      ) : (
        <input
          id={`campo-${slot}`}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          className={INPUT_CLS}
        />
      )}
    </label>
  );
}

/** Grupo colapsável do painel Conteúdo (aberto controlado pelo EditorClient). */
function Grupo({
  id,
  titulo,
  aberto,
  setAberto,
  children,
}: {
  id: string;
  titulo: string;
  aberto: boolean;
  setAberto: (grupo: string, aberto: boolean) => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded border border-line">
      <button
        type="button"
        onClick={() => setAberto(id, !aberto)}
        aria-expanded={aberto}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted hover:text-foreground"
      >
        {titulo}
        <span aria-hidden>{aberto ? "−" : "+"}</span>
      </button>
      {aberto && <div className="flex flex-col gap-3 border-t border-line p-3">{children}</div>}
    </section>
  );
}

/* ── Conteúdo ─────────────────────────────────────────────────── */

const CAMPOS_NEGOCIO = [
  { chave: "nome", rotulo: "Nome do negócio" },
  { chave: "slogan", rotulo: "Slogan" },
  { chave: "endereco", rotulo: "Endereço" },
  { chave: "telefone", rotulo: "Telefone" },
  { chave: "whatsapp", rotulo: "WhatsApp" },
  { chave: "instagram", rotulo: "Instagram" },
  { chave: "cidade", rotulo: "Cidade" },
  { chave: "horarios", rotulo: "Horários" },
] as const;

const ROTULOS_IDENTIDADE = CAMPOS_NEGOCIO.filter((c) =>
  (CAMPOS_IDENTIDADE_DEMO as readonly string[]).includes(c.chave),
)
  .map((c) => c.rotulo)
  .join(", ");

const CAMPOS_SECAO = [
  { chave: "rotulo", rotulo: "Etiqueta" },
  { chave: "titulo", rotulo: "Título" },
  { chave: "texto", rotulo: "Texto", area: true },
  { chave: "cta", rotulo: "Botão (CTA)" },
  { chave: "ctaSecundaria", rotulo: "CTA secundária" },
] as const;

const CAMPOS_ITEM = [
  { chave: "titulo", rotulo: "Título" },
  { chave: "subtitulo", rotulo: "Subtítulo" },
  { chave: "detalhe", rotulo: "Detalhe" },
  { chave: "texto", rotulo: "Texto", area: true },
] as const;

export function PainelConteudo({
  dados,
  skin,
  abertos,
  setAberto,
  atualizar,
  idioma,
  moeda,
}: {
  dados: DemoData;
  skin: SkinDefinition;
  abertos: Record<string, boolean>;
  setAberto: (grupo: string, aberto: boolean) => void;
  atualizar: Atualizar;
  idioma?: string;
  moeda?: string;
}) {
  const setSecaoCampo = (id: string, campo: string, valor: string) =>
    atualizar((d) => ({
      ...d,
      secoes: { ...d.secoes, [id]: { ...d.secoes[id], [campo]: valor } },
    }));

  const setItem = (id: string, i: number, campo: string, valor: string) =>
    atualizar((d) => {
      const itens = (d.secoes[id]?.itens ?? []).map((item, j) =>
        j === i ? { ...item, [campo]: valor } : item,
      );
      return { ...d, secoes: { ...d.secoes, [id]: { ...d.secoes[id], itens } } };
    });

  return (
    <div className="flex flex-col gap-3">
      <Grupo
        id="negocio"
        titulo="Negócio"
        aberto={abertos.negocio ?? false}
        setAberto={setAberto}
      >
        {CAMPOS_NEGOCIO.map(({ chave, rotulo }) => (
          <Campo
            key={chave}
            slot={chave}
            rotulo={rotulo}
            valor={dados[chave] ?? ""}
            onChange={(valor) => atualizar((d) => ({ ...d, [chave]: valor }))}
          />
        ))}
        <p className="text-[11px] text-ink-muted">
          Nome, slogan e endereço esvaziados voltam ao padrão do template ao
          salvar. Já {ROTULOS_IDENTIDADE} esvaziados não voltam ao texto de
          exemplo — o elemento correspondente some da demo.
        </p>
      </Grupo>

      <Grupo
        id="servicos"
        titulo={`Serviços e preços (${dados.servicos.length})`}
        aberto={abertos.servicos ?? false}
        setAberto={setAberto}
      >
        {dados.servicos.map((servico, i) => (
          <div key={i} className="flex flex-col gap-2 rounded border border-line p-2.5">
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Campo
                slot={`servicos.${i}.nome`}
                rotulo="Serviço"
                valor={servico.nome}
                onChange={(v) =>
                  atualizar((d) => ({
                    ...d,
                    servicos: d.servicos.map((s, j) => (j === i ? { ...s, nome: v } : s)),
                  }))
                }
              />
              <label className={`${LABEL_CLS} w-24`}>
                Preço
                <input
                  id={`campo-servicos.${i}.preco`}
                  // Preview do preço EFETIVO (precoPrefixo/precoValor, se
                  // vierem do template/migração — ver lib/demos/precos.ts)
                  // quando `preco` (texto livre) está vazio, senão o
                  // digitado fica invisível pro operador.
                  value={servico.preco || formatarPrecoServico(servico, idioma, moeda)}
                  onChange={(e) =>
                    atualizar((d) => ({
                      ...d,
                      // Editar aqui volta o serviço pro texto livre: quem
                      // digita assume o controle do preço exibido — sem
                      // isso, precoValor (se presente) continuaria vencendo
                      // e a edição pareceria não ter efeito nenhum.
                      servicos: d.servicos.map((s, j) =>
                        j === i
                          ? { ...s, preco: e.target.value, precoPrefixo: undefined, precoValor: undefined }
                          : s,
                      ),
                    }))
                  }
                  className={INPUT_CLS}
                />
              </label>
            </div>
            <Campo
              slot={`servicos.${i}.descricao`}
              rotulo="Descrição"
              valor={servico.descricao ?? ""}
              area
              onChange={(v) =>
                atualizar((d) => ({
                  ...d,
                  servicos: d.servicos.map((s, j) => (j === i ? { ...s, descricao: v } : s)),
                }))
              }
            />
            <button
              type="button"
              onClick={() =>
                atualizar((d) => ({ ...d, servicos: d.servicos.filter((_, j) => j !== i) }))
              }
              className="self-end text-[11px] text-critical hover:underline"
            >
              Remover serviço
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            atualizar((d) => ({
              ...d,
              servicos: [...d.servicos, { nome: "NOVO SERVIÇO", preco: "R$ 0" }],
            }))
          }
          className="self-start text-xs text-accent hover:underline"
        >
          + Adicionar serviço
        </button>
      </Grupo>

      <Grupo
        id="depoimentos"
        titulo={`Depoimentos (${dados.depoimentos.length})`}
        aberto={abertos.depoimentos ?? false}
        setAberto={setAberto}
      >
        {dados.depoimentos.map((dep, i) => (
          <div key={i} className="flex flex-col gap-2 rounded border border-line p-2.5">
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Campo
                slot={`depoimentos.${i}.autor`}
                rotulo="Autor"
                valor={dep.autor}
                onChange={(v) =>
                  atualizar((d) => ({
                    ...d,
                    depoimentos: d.depoimentos.map((x, j) => (j === i ? { ...x, autor: v } : x)),
                  }))
                }
              />
              <label className={`${LABEL_CLS} w-20`}>
                Nota (1–5)
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={dep.nota ?? ""}
                  onChange={(e) =>
                    atualizar((d) => ({
                      ...d,
                      depoimentos: d.depoimentos.map((x, j) =>
                        j === i
                          ? { ...x, nota: e.target.value ? Number(e.target.value) : undefined }
                          : x,
                      ),
                    }))
                  }
                  className={INPUT_CLS}
                />
              </label>
            </div>
            <Campo
              slot={`depoimentos.${i}.texto`}
              rotulo="Depoimento"
              valor={dep.texto}
              area
              onChange={(v) =>
                atualizar((d) => ({
                  ...d,
                  depoimentos: d.depoimentos.map((x, j) => (j === i ? { ...x, texto: v } : x)),
                }))
              }
            />
            <button
              type="button"
              onClick={() =>
                atualizar((d) => ({
                  ...d,
                  depoimentos: d.depoimentos.filter((_, j) => j !== i),
                }))
              }
              className="self-end text-[11px] text-critical hover:underline"
            >
              Remover depoimento
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            atualizar((d) => ({
              ...d,
              depoimentos: [...d.depoimentos, { autor: "Cliente", texto: "", nota: 5 }],
            }))
          }
          className="self-start text-xs text-accent hover:underline"
        >
          + Adicionar depoimento
        </button>
      </Grupo>

      {skin.secoes.map((def) => {
        const secao = dados.secoes[def.id];
        const exemplo = skin.demoDataExemplo.secoes[def.id];
        if (!exemplo) return null;
        return (
          <Grupo
            key={def.id}
            id={`secao-${def.id}`}
            titulo={def.nome}
            aberto={abertos[`secao-${def.id}`] ?? false}
            setAberto={setAberto}
          >
            {CAMPOS_SECAO.filter(({ chave }) => exemplo[chave] !== undefined).map(
              ({ chave, rotulo, ...extra }) => (
                <Campo
                  key={chave}
                  slot={`secoes.${def.id}.${chave}`}
                  rotulo={rotulo}
                  valor={secao?.[chave] ?? ""}
                  // Título principal (hero): aceita quebra de linha — as
                  // skins renderizam com white-space respeitado (ver
                  // Skin.tsx de cada nicho).
                  area={"area" in extra || (def.id === "hero" && chave === "titulo")}
                  onChange={(valor) => setSecaoCampo(def.id, chave, valor)}
                />
              ),
            )}
            {exemplo.itens !== undefined &&
              (secao?.itens ?? []).map((item: DemoItem, i: number) => (
                <div key={i} className="flex flex-col gap-2 rounded border border-line p-2.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                    Item {i + 1}
                  </span>
                  {CAMPOS_ITEM.filter(
                    ({ chave }) =>
                      item[chave] !== undefined || exemplo.itens?.[0]?.[chave] !== undefined,
                  ).map(({ chave, rotulo, ...extra }) => (
                    <Campo
                      key={chave}
                      slot={`secoes.${def.id}.itens.${i}.${chave}`}
                      rotulo={rotulo}
                      valor={item[chave] ?? ""}
                      area={"area" in extra}
                      onChange={(valor) => setItem(def.id, i, chave, valor)}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      atualizar((d) => ({
                        ...d,
                        secoes: {
                          ...d.secoes,
                          [def.id]: {
                            ...d.secoes[def.id],
                            itens: (d.secoes[def.id]?.itens ?? []).filter((_, j) => j !== i),
                          },
                        },
                      }))
                    }
                    className="self-end text-[11px] text-critical hover:underline"
                  >
                    Remover item
                  </button>
                </div>
              ))}
            {exemplo.itens !== undefined && (
              <button
                type="button"
                onClick={() =>
                  atualizar((d) => ({
                    ...d,
                    secoes: {
                      ...d.secoes,
                      [def.id]: {
                        ...d.secoes[def.id],
                        itens: [...(d.secoes[def.id]?.itens ?? []), { titulo: "NOVO ITEM" }],
                      },
                    },
                  }))
                }
                className="self-start text-xs text-accent hover:underline"
              >
                + Adicionar item
              </button>
            )}
          </Grupo>
        );
      })}
    </div>
  );
}

/* ── Imagens ──────────────────────────────────────────────────── */

function rotuloDoSlot(slot: string): string {
  const texto = slot.replace(/-/g, " ");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function LinhaImagem({
  slot,
  atual,
  placeholder,
  ocupado,
  onUpload,
  onRemover,
}: {
  slot: string;
  atual: string;
  placeholder: string;
  ocupado: boolean;
  onUpload: (slot: string, file: File) => void;
  onRemover: (slot: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const customizada = atual !== placeholder;

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) onUpload(slot, file);
    event.target.value = "";
  }

  return (
    <div
      id={`slot-${slot}`}
      tabIndex={-1}
      className="flex items-center gap-3 rounded border border-line p-2.5"
    >
      <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded border border-line bg-surface-2">
        <Image src={atual} alt={`Imagem do slot ${slot}`} fill unoptimized className="object-cover" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground">{rotuloDoSlot(slot)}</p>
        <p className="truncate text-[11px] text-ink-muted">
          {customizada ? "Imagem própria" : "Placeholder do template"}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={ocupado}
          className="text-xs text-accent hover:underline disabled:opacity-50"
        >
          {ocupado ? "Enviando…" : "Trocar"}
        </button>
        {customizada && (
          <button
            type="button"
            onClick={() => onRemover(slot)}
            disabled={ocupado}
            className="text-[11px] text-critical hover:underline disabled:opacity-50"
          >
            Remover
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={onFile}
        className="hidden"
      />
    </div>
  );
}

/** Rótulo por slot de vídeo — hoje só "titulo" (vídeo-no-título do wordmark). */
const ROTULO_SLOT_VIDEO: Record<string, string> = {
  titulo: "Vídeo no título",
};

function LinhaVideo({
  slot,
  atual,
  ocupado,
  onUpload,
  onRemover,
}: {
  slot: string;
  atual: string | undefined;
  ocupado: boolean;
  onUpload: (slot: string, file: File) => void;
  onRemover: (slot: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) onUpload(slot, file);
    event.target.value = "";
  }

  return (
    <div className="flex items-center gap-3 rounded border border-line p-2.5">
      <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded border border-line bg-surface-2 text-[10px] text-ink-muted">
        {atual ? (
          <video src={atual} muted className="h-full w-full object-cover" />
        ) : (
          "sem vídeo"
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground">{ROTULO_SLOT_VIDEO[slot] ?? rotuloDoSlot(slot)}</p>
        <p className="truncate text-[11px] text-ink-muted">
          {atual ? "Vídeo próprio" : "Sem vídeo — cai na imagem ou cor sólida"}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={ocupado}
          className="text-xs text-accent hover:underline disabled:opacity-50"
        >
          {ocupado ? "Enviando…" : atual ? "Trocar" : "Enviar"}
        </button>
        {atual && (
          <button
            type="button"
            onClick={() => onRemover(slot)}
            disabled={ocupado}
            className="text-[11px] text-critical hover:underline disabled:opacity-50"
          >
            Remover
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/webm"
        onChange={onFile}
        className="hidden"
      />
    </div>
  );
}

export function PainelImagens({
  dados,
  skin,
  uploadSlot,
  erro,
  onUpload,
  onRemover,
  uploadVideoSlot,
  videoErro,
  onUploadVideo,
  onRemoverVideo,
}: {
  dados: DemoData;
  skin: SkinDefinition;
  uploadSlot: string | null;
  erro: string | null;
  onUpload: (slot: string, file: File) => void;
  onRemover: (slot: string) => void;
  uploadVideoSlot?: string | null;
  videoErro?: string | null;
  onUploadVideo?: (slot: string, file: File) => void;
  onRemoverVideo?: (slot: string) => void;
}) {
  const slots = Object.keys(skin.demoDataExemplo.imagens);
  const videoSlots = skin.videoSlots ?? [];
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] text-ink-muted">
        JPG, PNG ou WebP até 2MB (imagens grandes são comprimidas antes do envio). Remover
        volta ao placeholder do template.
      </p>
      {erro && <p className="text-xs text-critical">{erro}</p>}
      {slots.map((slot) => (
        <LinhaImagem
          key={slot}
          slot={slot}
          atual={dados.imagens[slot] ?? skin.demoDataExemplo.imagens[slot]}
          placeholder={skin.demoDataExemplo.imagens[slot]}
          ocupado={uploadSlot === slot}
          onUpload={onUpload}
          onRemover={onRemover}
        />
      ))}

      {videoSlots.length > 0 && onUploadVideo && onRemoverVideo && (
        <div className="mt-2 flex flex-col gap-2 border-t border-line pt-3">
          <p className="text-[11px] text-ink-muted">
            MP4 ou WebM até 15MB — vídeo pesa e carrega devagar em conexões ruins; sem vídeo (ou
            se ele não conseguir tocar a tempo), o título cai automaticamente na imagem do hero
            ou, na falta dela, numa cor sólida.
          </p>
          {videoErro && <p className="text-xs text-critical">{videoErro}</p>}
          {videoSlots.map((slot) => (
            <LinhaVideo
              key={slot}
              slot={slot}
              atual={dados.videos?.[slot]}
              ocupado={uploadVideoSlot === slot}
              onUpload={onUploadVideo}
              onRemover={onRemoverVideo}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Tema ─────────────────────────────────────────────────────── */

const DENSIDADES: Array<{ id: Densidade; rotulo: string }> = [
  { id: "compacta", rotulo: "Compacta" },
  { id: "confortavel", rotulo: "Confortável" },
  { id: "arejada", rotulo: "Arejada" },
];

const ANIMACOES: Array<{ id: Animacao; rotulo: string }> = [
  { id: "nenhuma", rotulo: "Sem animação" },
  { id: "sutil", rotulo: "Sutil" },
  { id: "marcante", rotulo: "Marcante" },
];

const HOVERS: Array<{ id: HoverEstilo; rotulo: string }> = [
  { id: "lift", rotulo: "Elevar" },
  { id: "zoom", rotulo: "Zoom" },
  { id: "brilho", rotulo: "Brilho" },
];

const CLIQUES: Array<{ id: CliqueEstilo; rotulo: string }> = [
  { id: "nenhum", rotulo: "Sem animação" },
  { id: "pressao", rotulo: "Pressionar" },
  { id: "pulso", rotulo: "Pulso" },
];

/**
 * Opções do seletor "Efeito de fundo": montadas a partir do registro de
 * efeitos (`src/lib/demos/efeitos/registry.ts`), não de uma lista fixa —
 * um efeito novo no registro aparece aqui sem tocar o editor. "Nenhum"
 * continua fixo no topo (não é um efeito do registro).
 */
const FUNDOS: Array<{ id: string; rotulo: string }> = [
  { id: "nenhum", rotulo: "Nenhum" },
  ...EFEITOS.map((efeito) => ({ id: efeito.id, rotulo: efeito.nome })),
];

const LEDS: Array<{ id: LedPreset; rotulo: string }> = [
  { id: "desligado", rotulo: "Desligado" },
  { id: "sutil", rotulo: "Sutil" },
  { id: "marcante", rotulo: "Marcante" },
];

/**
 * Opções do seletor "Estilo do LED": montadas a partir do registro de
 * estilos (`src/lib/demos/led/registry.ts`), mesmo padrão de FUNDOS —
 * um estilo novo no registro aparece aqui sem tocar o editor.
 */
const LED_ESTILO_OPCOES: Array<{ id: string; rotulo: string }> = LED_ESTILOS.map((estilo) => ({
  id: estilo.id,
  rotulo: estilo.nome,
}));

const ALINHAMENTOS_HERO: Array<{ id: Alinhamento; rotulo: string }> = [
  { id: "esquerda", rotulo: "Esquerda" },
  { id: "centro", rotulo: "Centro" },
  { id: "direita", rotulo: "Direita" },
];

/** Linha de botões Padrão + opções, padrão visual das escolhas do tema. */
function Escolha<T extends string>({
  titulo,
  padraoRotulo,
  opcoes,
  valor,
  onChange,
}: {
  titulo: string;
  padraoRotulo: string;
  opcoes: Array<{ id: T; rotulo: string }>;
  valor: T | undefined;
  onChange: (valor: T | undefined) => void;
}) {
  const btn = (ativo: boolean) =>
    `rounded border px-2.5 py-1.5 text-xs ${
      ativo ? "border-accent text-foreground" : "border-line text-ink-muted hover:border-accent/50"
    }`;
  return (
    <div>
      <span className="text-xs text-ink-muted">{titulo}</span>
      <div className="mt-1.5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange(undefined)}
          aria-pressed={valor === undefined}
          className={btn(valor === undefined)}
        >
          Padrão ({padraoRotulo})
        </button>
        {opcoes.map(({ id, rotulo }) => (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-pressed={valor === id}
            className={btn(valor === id)}
          >
            {rotulo}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Remove campos vazios/undefined; devolve undefined se não sobrar nada (volta a seguir o tema). */
function auraCoresLimpo(patch: AuraCoresPatch): AuraCoresPatch | undefined {
  const limpo: AuraCoresPatch = {};
  if (patch.primaria) limpo.primaria = patch.primaria;
  if (patch.secundaria) limpo.secundaria = patch.secundaria;
  return Object.keys(limpo).length > 0 ? limpo : undefined;
}

/**
 * Controle de cores do efeito "aura" (aba Tema, só aparece com "aura"
 * selecionado como efeito de fundo): duas cores editáveis (uma por blob —
 * ver Aura.tsx), cada uma cai no default do tema (`paleta.destaque`/
 * `acentoSecundario`) quando ausente, mais o preset fixo "Fumaça
 * colorida" (independente da paleta do tema — ver
 * efeitos/aura/cores.ts#FUMACA_COLORIDA). Editar uma cor manualmente
 * enquanto o preset está ativo parte das cores do preset (não do tema),
 * pra não perder a outra cor escolhida.
 */
function AuraCoresControl({
  auraCores,
  paletaTema,
  onChange,
}: {
  auraCores: TemaPatch["auraCores"];
  paletaTema: { destaque: string; acentoSecundario: string };
  onChange: (valor: TemaPatch["auraCores"]) => void;
}) {
  const presetAtivo = auraCores === "fumaca-colorida";
  const base: AuraCoresPatch = presetAtivo ? FUMACA_COLORIDA : (auraCores ?? {});
  const resolvido = resolverCoresAura(auraCores, paletaTema);

  function setCor(campo: "primaria" | "secundaria", valor: string) {
    onChange(auraCoresLimpo({ ...base, [campo]: valor }));
  }

  function limparCor(campo: "primaria" | "secundaria") {
    onChange(auraCoresLimpo({ ...base, [campo]: undefined }));
  }

  return (
    <div className="flex flex-col gap-3 rounded border border-line p-3">
      <span className="text-xs text-ink-muted">Cores da aura</span>

      <div className="flex flex-wrap gap-4">
        {(
          [
            ["primaria", "Primária"],
            ["secundaria", "Secundária"],
          ] as const
        ).map(([campo, rotulo]) => (
          <div key={campo} className="flex items-end gap-2">
            <label className={LABEL_CLS}>
              {rotulo}
              <span className="flex items-center gap-2">
                <input
                  type="color"
                  value={resolvido[campo]}
                  onChange={(e) => setCor(campo, e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded border border-line bg-surface-2 p-1"
                />
                <code className="font-mono text-xs text-ink-secondary">{resolvido[campo]}</code>
              </span>
            </label>
            {!presetAtivo && base[campo] && (
              <button
                type="button"
                onClick={() => limparCor(campo)}
                className="pb-2 text-[11px] text-ink-muted hover:text-foreground"
              >
                usar a do tema
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-pressed={presetAtivo}
          onClick={() => onChange(presetAtivo ? undefined : "fumaca-colorida")}
          className={`flex items-center gap-2 rounded border px-2.5 py-1.5 text-xs transition-colors ${
            presetAtivo
              ? "border-accent text-foreground"
              : "border-line text-ink-muted hover:border-accent/50"
          }`}
        >
          <span className="flex overflow-hidden rounded-sm border border-line">
            <span className="h-3 w-3" style={{ background: FUMACA_COLORIDA.primaria }} />
            <span className="h-3 w-3" style={{ background: FUMACA_COLORIDA.secundaria }} />
          </span>
          Fumaça colorida
        </button>
        {auraCores !== undefined && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="text-[11px] text-ink-muted hover:text-foreground"
          >
            usar cores do tema
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Modos de cor da camada decorativa (efeito de fundo e LED) ──── */

const COR_MODO_ROTULO: Record<CorModo, string> = {
  tema: "Do tema",
  fixa: "Cor fixa",
  transicao: "Transição",
  iridescente: "Iridescente",
  "arco-iris": "Arco-íris",
};

const COR_MODO_AJUDA: Record<CorModo, string> = {
  tema: "Deriva da paleta do preset — o padrão.",
  fixa: "Uma cor escolhida, sem variação.",
  transicao: "Duas ou três cores trocando lentamente entre si.",
  iridescente: "Cores do tema com o matiz deslizando de leve, sem parar.",
  "arco-iris": "Percurso completo de matiz, mais saturado.",
};

/**
 * Controle de MODO DE COR — o mesmo componente serve o efeito de fundo e
 * o LED (`TemaPatch.efeitoCores` / `TemaPatch.ledCores`), porque os dois
 * usam o mesmo contrato (ver lib/demos/cores/modos.ts). Trocar de modo
 * SEMEIA as cores a partir da paleta do preset, pra o usuário nunca cair
 * num seletor vazio (e a cor semeada é justamente a que ele já estava
 * vendo — a troca começa sem mudança visual).
 */
function CoresModoControl({
  titulo,
  valor,
  paletaTema,
  onChange,
  reprovados,
  motivoReprovados,
}: {
  titulo: string;
  valor: CoresModoValor | undefined;
  paletaTema: { destaque: string; acentoSecundario: string };
  onChange: (valor: CoresModoValor | undefined) => void;
  /** Modos que REPROVARAM no portão de fps para o efeito ativo — ver
   * EfeitoDefinition.modosDeCorReprovados. Ficam desabilitados com o
   * motivo à vista, em vez de serem escolhidos e silenciosamente
   * ignorados na hora de renderizar. */
  reprovados?: readonly CorModo[];
  motivoReprovados?: string;
}) {
  const modo = valor?.modo ?? "tema";
  const cores = valor?.cores ?? [];

  function trocarModo(novo: CorModo) {
    if (novo === "tema") return onChange(undefined);
    if (novo === "fixa") return onChange({ modo: novo, cores: [cores[0] ?? paletaTema.destaque] });
    if (novo === "transicao") {
      return onChange({
        modo: novo,
        cores: cores.length >= 2 ? cores : [paletaTema.destaque, paletaTema.acentoSecundario],
      });
    }
    onChange({ modo: novo });
  }

  const setCor = (i: number, cor: string) =>
    onChange({ modo: modo as CorModo, cores: cores.map((c, j) => (j === i ? cor : c)) });

  return (
    <div className="flex flex-col gap-2 rounded border border-line p-3">
      <span className="text-xs text-ink-muted">{titulo}</span>
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(COR_MODO_ROTULO) as CorModo[]).map((opcao) => {
          const reprovado = reprovados?.includes(opcao) ?? false;
          return (
            <button
              key={opcao}
              type="button"
              disabled={reprovado}
              title={reprovado ? motivoReprovados : undefined}
              onClick={() => trocarModo(opcao)}
              aria-pressed={modo === opcao}
              className={`rounded border px-2.5 py-1 text-xs transition-colors ${
                reprovado
                  ? "cursor-not-allowed border-line/50 text-ink-muted/40 line-through"
                  : modo === opcao
                    ? "border-accent text-foreground"
                    : "border-line text-ink-muted hover:border-accent/50"
              }`}
            >
              {COR_MODO_ROTULO[opcao]}
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-ink-muted">{COR_MODO_AJUDA[modo]}</p>
      {reprovados?.length ? (
        <p className="text-[11px] text-ink-muted/70">{motivoReprovados}</p>
      ) : null}

      {(modo === "fixa" || modo === "transicao") && (
        <div className="flex flex-wrap items-end gap-3">
          {cores.map((cor, i) => (
            <label key={i} className={LABEL_CLS}>
              {modo === "fixa" ? "Cor" : `Cor ${i + 1}`}
              <span className="flex items-center gap-2">
                <input
                  type="color"
                  value={cor}
                  onChange={(e) => setCor(i, e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded border border-line bg-surface-2 p-1"
                />
                <code className="font-mono text-xs text-ink-secondary">{cor}</code>
              </span>
            </label>
          ))}
          {modo === "transicao" && (
            <div className="flex gap-2 pb-2">
              {cores.length < 3 && (
                <button
                  type="button"
                  onClick={() =>
                    onChange({ modo, cores: [...cores, paletaTema.destaque] })
                  }
                  className="text-[11px] text-accent hover:underline"
                >
                  + 3ª cor
                </button>
              )}
              {cores.length > 2 && (
                <button
                  type="button"
                  onClick={() => onChange({ modo, cores: cores.slice(0, -1) })}
                  className="text-[11px] text-ink-muted hover:text-foreground"
                >
                  remover a última
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Seletor de fonte (título/corpo/hero) com as fontes curadas do nicho da
 * skin (`SkinDefinition.fontesRecomendadas`, ver registry.ts) destacadas no
 * topo, numa seção própria — o resto da lista curada (filtrada por papel)
 * continua abaixo, sempre acessível. Sem recomendadas para o papel pedido
 * (skin sem `fontesRecomendadas`, ou nenhuma delas serve pro papel), cai
 * pra uma lista única, igual ao seletor simples de antes.
 */
function SeletorFonte({
  papel,
  skin,
  value,
  placeholder,
  onChange,
}: {
  papel: FontePapel;
  skin: SkinDefinition;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const todas = fontesPorPapel(papel);
  const recomendadasIds = new Set(skin.fontesRecomendadas ?? []);
  const recomendadas = todas.filter((fonte) => recomendadasIds.has(fonte.id));
  const outras = todas.filter((fonte) => !recomendadasIds.has(fonte.id));

  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={INPUT_CLS}>
      <option value="">{placeholder}</option>
      {recomendadas.length > 0 ? (
        <>
          <optgroup label={`Recomendadas para ${skin.nicho}`}>
            {recomendadas.map((fonte) => (
              <option key={fonte.id} value={fonte.id}>
                {fonte.nome}
              </option>
            ))}
          </optgroup>
          <optgroup label="Todas as fontes">
            {outras.map((fonte) => (
              <option key={fonte.id} value={fonte.id}>
                {fonte.nome}
              </option>
            ))}
          </optgroup>
        </>
      ) : (
        todas.map((fonte) => (
          <option key={fonte.id} value={fonte.id}>
            {fonte.nome}
          </option>
        ))
      )}
    </select>
  );
}

export function PainelTema({
  skinId,
  onSkinChange,
  skin,
  themeId,
  setThemeId,
  tema,
  setTema,
  idioma,
  idiomaPadrao,
  setIdioma,
}: {
  skinId: string;
  onSkinChange: (skinId: string) => void;
  skin: SkinDefinition;
  themeId: string;
  setThemeId: (themeId: string) => void;
  tema: TemaPatch;
  setTema: (tema: TemaPatch) => void;
  idioma: string;
  /** Idioma derivado do país do endereço do lead — mostrado como referência do default. */
  idiomaPadrao: string;
  setIdioma: (idioma: string) => void;
}) {
  const preset = skin.themePresets.find((t) => t.id === themeId) ?? skin.themeDefault;
  const destaque = tema.destaque ?? preset.paleta.destaque;

  // Efeito de fundo efetivo (patch ou preset) — governa se o slider de
  // intensidade aparece e qual o default (nicho recomendado do efeito).
  const efeitoFundoAtivo = getEfeito(tema.fundoEfeito ?? preset.fundoEfeito);
  const efeitoFundoIntensidadePadrao = efeitoFundoAtivo
    ? intensidadePadrao(efeitoFundoAtivo, skin.nicho)
    : undefined;

  return (
    <div className="flex flex-col gap-4">
      <label className={LABEL_CLS}>
        Skin (template)
        <select value={skinId} onChange={(e) => onSkinChange(e.target.value)} className={INPUT_CLS}>
          {SKINS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nome} ({s.nicho})
            </option>
          ))}
        </select>
      </label>

      <label className={LABEL_CLS}>
        Idioma dos textos (gerados por IA)
        <select
          value={idioma}
          onChange={(e) => setIdioma(e.target.value)}
          className={INPUT_CLS}
        >
          {IDIOMAS_SUPORTADOS.map((id) => (
            <option key={id} value={id}>
              {idiomaLabel(id)}
              {id === idiomaPadrao ? " (do endereço do lead)" : ""}
            </option>
          ))}
        </select>
      </label>

      <div>
        <span className="text-xs text-ink-muted">Preset de tema</span>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {skin.themePresets.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setThemeId(p.id)}
              aria-pressed={themeId === p.id}
              className={`flex items-center gap-2 rounded border px-2.5 py-1.5 text-xs transition-colors ${
                themeId === p.id
                  ? "border-accent text-foreground"
                  : "border-line text-ink-muted hover:border-accent/50"
              }`}
            >
              <span className="flex overflow-hidden rounded-sm border border-line">
                <span className="h-3 w-3" style={{ background: p.paleta.fundo }} />
                <span className="h-3 w-3" style={{ background: p.paleta.destaque }} />
                <span className="h-3 w-3" style={{ background: p.paleta.texto }} />
              </span>
              {p.nome}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-end gap-3">
        <label className={LABEL_CLS}>
          Cor primária
          <span className="flex items-center gap-2">
            <input
              type="color"
              value={destaque}
              onChange={(e) => setTema({ ...tema, destaque: e.target.value })}
              className="h-9 w-12 cursor-pointer rounded border border-line bg-surface-2 p-1"
            />
            <code className="font-mono text-xs text-ink-secondary">{destaque}</code>
            <span
              className="rounded px-1.5 py-0.5 font-mono text-[10px]"
              style={{ background: destaque, color: tema.destaque ? inkPara(destaque) : preset.paleta.destaqueInk }}
            >
              Aa
            </span>
          </span>
        </label>
        {tema.destaque && (
          <button
            type="button"
            onClick={() => setTema({ ...tema, destaque: undefined })}
            className="pb-2 text-[11px] text-ink-muted hover:text-foreground"
          >
            usar a do preset
          </button>
        )}
      </div>

      <label className={LABEL_CLS}>
        Fonte dos títulos
        <SeletorFonte
          papel="display"
          skin={skin}
          value={tema.fonteDisplay ?? ""}
          placeholder="Padrão do preset"
          onChange={(value) => setTema({ ...tema, fonteDisplay: value || undefined })}
        />
      </label>

      <label className={LABEL_CLS}>
        Fonte do corpo
        <SeletorFonte
          papel="corpo"
          skin={skin}
          value={tema.fonteCorpo ?? ""}
          placeholder="Padrão do preset"
          onChange={(value) => setTema({ ...tema, fonteCorpo: value || undefined })}
        />
      </label>

      <div>
        <span className="text-xs text-ink-muted">Raio das bordas</span>
        <div className="mt-1.5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTema({ ...tema, raio: undefined })}
            aria-pressed={tema.raio === undefined}
            className={`rounded border px-2.5 py-1.5 text-xs ${tema.raio === undefined ? "border-accent text-foreground" : "border-line text-ink-muted hover:border-accent/50"}`}
          >
            Padrão ({preset.raio})
          </button>
          {TEMA_RAIOS.map((raio) => (
            <button
              key={raio}
              type="button"
              onClick={() => setTema({ ...tema, raio })}
              aria-pressed={tema.raio === raio}
              className={`rounded border px-2.5 py-1.5 text-xs ${tema.raio === raio ? "border-accent text-foreground" : "border-line text-ink-muted hover:border-accent/50"}`}
            >
              {raio}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="text-xs text-ink-muted">Densidade (respiro entre seções)</span>
        <div className="mt-1.5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTema({ ...tema, densidade: undefined })}
            aria-pressed={tema.densidade === undefined}
            className={`rounded border px-2.5 py-1.5 text-xs ${tema.densidade === undefined ? "border-accent text-foreground" : "border-line text-ink-muted hover:border-accent/50"}`}
          >
            Padrão
          </button>
          {DENSIDADES.map(({ id, rotulo }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTema({ ...tema, densidade: id })}
              aria-pressed={tema.densidade === id}
              className={`rounded border px-2.5 py-1.5 text-xs ${tema.densidade === id ? "border-accent text-foreground" : "border-line text-ink-muted hover:border-accent/50"}`}
            >
              {rotulo}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="text-xs text-ink-muted">
          Animação (entradas de seção, hovers, transições)
        </span>
        <div className="mt-1.5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTema({ ...tema, animacao: undefined })}
            aria-pressed={tema.animacao === undefined}
            className={`rounded border px-2.5 py-1.5 text-xs ${tema.animacao === undefined ? "border-accent text-foreground" : "border-line text-ink-muted hover:border-accent/50"}`}
          >
            Padrão ({ANIMACOES.find((a) => a.id === preset.animacao)?.rotulo ?? preset.animacao})
          </button>
          {ANIMACOES.map(({ id, rotulo }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTema({ ...tema, animacao: id })}
              aria-pressed={tema.animacao === id}
              className={`rounded border px-2.5 py-1.5 text-xs ${tema.animacao === id ? "border-accent text-foreground" : "border-line text-ink-muted hover:border-accent/50"}`}
            >
              {rotulo}
            </button>
          ))}
        </div>
      </div>

      <Escolha
        titulo="Intro de abertura (splash do template)"
        padraoRotulo={preset.intro ? "ligada" : "desligada"}
        opcoes={[
          { id: "ligada", rotulo: "Ligada" },
          { id: "desligada", rotulo: "Desligada" },
        ]}
        valor={tema.intro === undefined ? undefined : tema.intro ? "ligada" : "desligada"}
        onChange={(v) =>
          setTema({ ...tema, intro: v === undefined ? undefined : v === "ligada" })
        }
      />

      <Escolha
        titulo="Hover de cards e botões"
        padraoRotulo={HOVERS.find((h) => h.id === preset.hover)?.rotulo ?? preset.hover}
        opcoes={HOVERS}
        valor={tema.hover}
        onChange={(hover) => setTema({ ...tema, hover })}
      />

      <Escolha
        titulo="Animação de clique"
        padraoRotulo={CLIQUES.find((c) => c.id === preset.clique)?.rotulo ?? preset.clique}
        opcoes={CLIQUES}
        valor={tema.clique}
        onChange={(clique) => setTema({ ...tema, clique })}
      />

      <Escolha
        titulo="Efeito de fundo (sutil, leve em mobile)"
        padraoRotulo={FUNDOS.find((f) => f.id === preset.fundoEfeito)?.rotulo ?? preset.fundoEfeito}
        opcoes={FUNDOS}
        valor={tema.fundoEfeito}
        onChange={(fundoEfeito) => setTema({ ...tema, fundoEfeito })}
      />

      {efeitoFundoAtivo && (
        <label className={LABEL_CLS}>
          Intensidade do efeito de fundo (
          {tema.fundoEfeitoIntensidade ?? efeitoFundoIntensidadePadrao})
          <input
            type="range"
            min={0}
            max={3}
            step={1}
            value={tema.fundoEfeitoIntensidade ?? efeitoFundoIntensidadePadrao}
            onChange={(e) =>
              setTema({
                ...tema,
                fundoEfeitoIntensidade: Number(e.target.value) as EfeitoIntensidade,
              })
            }
            className="accent-accent"
          />
        </label>
      )}
      {tema.fundoEfeitoIntensidade !== undefined && (
        <button
          type="button"
          onClick={() => setTema({ ...tema, fundoEfeitoIntensidade: undefined })}
          className="self-start text-[11px] text-ink-muted hover:text-foreground"
        >
          usar o padrão do nicho ({efeitoFundoIntensidadePadrao})
        </button>
      )}

      {efeitoFundoAtivo && (
        <CoresModoControl
          titulo="Cor do efeito de fundo"
          valor={tema.efeitoCores}
          paletaTema={preset.paleta}
          onChange={(efeitoCores) => setTema({ ...tema, efeitoCores })}
          reprovados={efeitoFundoAtivo.modosDeCorReprovados}
          motivoReprovados={efeitoFundoAtivo.motivoModosReprovados}
        />
      )}

      {/* Controle específico da aura — anterior ao modo de cor genérico
          acima, que o VENCE quando está em qualquer modo != "do tema"
          (ver lib/demos/efeitos/camada.ts). */}
      {efeitoFundoAtivo?.id === "aura" && (tema.efeitoCores?.modo ?? "tema") === "tema" && (
        <AuraCoresControl
          auraCores={tema.auraCores}
          paletaTema={preset.paleta}
          onChange={(auraCores) => setTema({ ...tema, auraCores })}
        />
      )}

      <Escolha
        titulo="LED (bordas com luz, reage a scroll e clique)"
        padraoRotulo={LEDS.find((l) => l.id === preset.led)?.rotulo ?? preset.led}
        opcoes={LEDS}
        valor={tema.led}
        onChange={(led) => setTema({ ...tema, led })}
      />

      {(tema.led ?? preset.led) !== "desligado" && (
        <Escolha
          titulo="Estilo do LED"
          padraoRotulo={
            LED_ESTILO_OPCOES.find((e) => e.id === preset.ledEstilo)?.rotulo ?? preset.ledEstilo
          }
          opcoes={LED_ESTILO_OPCOES}
          valor={tema.ledEstilo}
          onChange={(ledEstilo) => setTema({ ...tema, ledEstilo })}
        />
      )}

      {(tema.led ?? preset.led) !== "desligado" && (
        <CoresModoControl
          titulo="Cor do LED"
          valor={tema.ledCores}
          paletaTema={preset.paleta}
          onChange={(ledCores) => setTema({ ...tema, ledCores })}
        />
      )}

      <div className="flex flex-col gap-3 rounded border border-line p-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Título principal (hero)
        </span>

        <label className={LABEL_CLS}>
          Fonte do título
          <SeletorFonte
            papel="display"
            skin={skin}
            value={tema.heroTitulo?.fonte ?? ""}
            placeholder="Padrão (acompanha a fonte dos títulos)"
            onChange={(value) =>
              setTema({
                ...tema,
                heroTitulo: { ...tema.heroTitulo, fonte: value || undefined },
              })
            }
          />
        </label>

        <label className={LABEL_CLS}>
          Tamanho ({(tema.heroTitulo?.escala ?? preset.heroTitulo.escala).toFixed(2)}×)
          <input
            type="range"
            min={skin.heroEscalaLimites.min}
            max={skin.heroEscalaLimites.max}
            step={0.05}
            value={tema.heroTitulo?.escala ?? preset.heroTitulo.escala}
            onChange={(e) =>
              setTema({
                ...tema,
                heroTitulo: { ...tema.heroTitulo, escala: Number(e.target.value) },
              })
            }
            className="accent-accent"
          />
        </label>

        <Escolha
          titulo="Alinhamento"
          padraoRotulo={
            ALINHAMENTOS_HERO.find((a) => a.id === preset.heroTitulo.alinhamento)?.rotulo ??
            preset.heroTitulo.alinhamento
          }
          opcoes={ALINHAMENTOS_HERO}
          valor={tema.heroTitulo?.alinhamento}
          onChange={(alinhamento) =>
            setTema({ ...tema, heroTitulo: { ...tema.heroTitulo, alinhamento } })
          }
        />
      </div>
    </div>
  );
}

/* ── Estrutura ────────────────────────────────────────────────── */

const ALINHAMENTO_ROTULO: Record<Alinhamento, string> = {
  esquerda: "Esq.",
  centro: "Centro",
  direita: "Dir.",
};

const ENTRADA_ROTULO: Record<AnimacaoEntrada, string> = {
  nenhuma: "Sem",
  fade: "Fade",
  "deslizar-esquerda": "Desl. esq.",
  "deslizar-direita": "Desl. dir.",
  typewriter: "Máquina",
};

/**
 * Liga/desliga a animação de UMA seção (`DemoSecao.animacao`). Aparece
 * tanto nas seções arrastáveis quanto nas fixas — ao contrário de
 * ocultar/reordenar, animação faz sentido em qualquer seção, o hero
 * inclusive. Desligada, a seção não anima na entrada e a camada
 * decorativa (efeito de fundo e LED) se apaga por interpolação enquanto
 * ela ocupa a viewport (ver lib/demos/animacao/cobertura.ts).
 */
function BotaoAnimacaoSecao({
  animada,
  onToggle,
}: {
  animada: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={animada}
      title="Animação de entrada e efeito de fundo nesta seção"
      className={`rounded border px-2 py-0.5 text-[11px] ${
        animada
          ? "border-accent text-foreground"
          : "border-line text-ink-muted hover:border-accent/50"
      }`}
    >
      {animada ? "Animação ligada" : "Animação desligada"}
    </button>
  );
}

/**
 * Uma linha arrastável da aba Estrutura. O drag só inicia pelo handle ⠿
 * (dragListener=false + dragControls.start no pointerdown do handle) —
 * o corpo do item continua tocável normalmente (abrir/ocultar, alinhar)
 * e, fora do handle, o toque rola a lista em vez de arrastar.
 */
function ItemEstrutura({
  id,
  def,
  oculta,
  alinhamento,
  entrada,
  animada,
  onOcultar,
  onAlinhar,
  onEntrada,
  onAnimacao,
}: {
  id: string;
  def: {
    nome: string;
    alignOptions?: readonly Alinhamento[];
    entradaOptions?: readonly AnimacaoEntrada[];
  };
  oculta: boolean;
  alinhamento: Alinhamento | undefined;
  entrada: AnimacaoEntrada | undefined;
  animada: boolean;
  onOcultar: () => void;
  onAlinhar: (opcao: Alinhamento) => void;
  onEntrada: (opcao: AnimacaoEntrada | undefined) => void;
  onAnimacao: () => void;
}) {
  const controls = useDragControls();

  return (
    <Reorder.Item
      value={id}
      dragListener={false}
      dragControls={controls}
      className="rounded border border-line bg-surface px-3 py-2.5"
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          onPointerDown={(e) => controls.start(e)}
          className="cursor-grab touch-none px-1 text-ink-muted active:cursor-grabbing"
        >
          ⠿
        </span>
        <span className={`text-sm ${oculta ? "text-ink-muted line-through" : "text-foreground"}`}>
          {def.nome}
        </span>
        <button
          type="button"
          onClick={onOcultar}
          className="ml-auto text-xs text-accent hover:underline"
        >
          {oculta ? "Exibir" : "Ocultar"}
        </button>
      </div>
      {def.alignOptions && !oculta && (
        <div className="mt-2 flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wide text-ink-muted">Alinhar</span>
          {def.alignOptions.map((opcao) => (
            <button
              key={opcao}
              type="button"
              onClick={() => onAlinhar(opcao)}
              aria-pressed={alinhamento === opcao}
              className={`rounded border px-2 py-0.5 text-[11px] ${
                alinhamento === opcao
                  ? "border-accent text-foreground"
                  : "border-line text-ink-muted hover:border-accent/50"
              }`}
            >
              {ALINHAMENTO_ROTULO[opcao]}
            </button>
          ))}
        </div>
      )}
      {!oculta && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wide text-ink-muted">Animação</span>
          <BotaoAnimacaoSecao animada={animada} onToggle={onAnimacao} />
        </div>
      )}
      {def.entradaOptions && !oculta && animada && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wide text-ink-muted">Entrada</span>
          <button
            type="button"
            onClick={() => onEntrada(undefined)}
            aria-pressed={entrada === undefined}
            className={`rounded border px-2 py-0.5 text-[11px] ${
              entrada === undefined
                ? "border-accent text-foreground"
                : "border-line text-ink-muted hover:border-accent/50"
            }`}
          >
            Padrão
          </button>
          {def.entradaOptions.map((opcao) => (
            <button
              key={opcao}
              type="button"
              onClick={() => onEntrada(opcao)}
              aria-pressed={entrada === opcao}
              className={`rounded border px-2 py-0.5 text-[11px] ${
                entrada === opcao
                  ? "border-accent text-foreground"
                  : "border-line text-ink-muted hover:border-accent/50"
              }`}
            >
              {ENTRADA_ROTULO[opcao]}
            </button>
          ))}
        </div>
      )}
    </Reorder.Item>
  );
}

export function PainelEstrutura({
  dados,
  skin,
  atualizar,
}: {
  dados: DemoData;
  skin: SkinDefinition;
  atualizar: Atualizar;
}) {
  const naoFixas = skin.secoes.filter((def) => !def.fixa);
  // Ordem atual das não-fixas, extraída da ordem efetiva completa.
  const ordem = ordemEfetiva(skin.secoes, dados.ordemSecoes).filter((id) =>
    naoFixas.some((def) => def.id === id),
  );

  const setSecao = (id: string, patch: Partial<DemoData["secoes"][string]>) =>
    atualizar((d) => ({
      ...d,
      secoes: { ...d.secoes, [id]: { ...d.secoes[id], ...patch } },
    }));

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] text-ink-muted">
        Arraste para reordenar. Seções ocultas continuam editáveis e podem voltar quando
        quiser. Desligar a animação de uma seção tira a entrada no scroll e apaga o efeito
        de fundo (com transição suave) enquanto ela estiver na tela. O template segue
        responsivo — sem posicionamento livre.
      </p>

      {skin.secoes
        .filter((def) => def.fixa)
        .map((def) => (
          <div
            key={def.id}
            className="flex items-center gap-2 rounded border border-dashed border-line px-3 py-2.5 text-sm text-ink-muted"
          >
            <span aria-hidden>◈</span>
            {def.nome}
            <span className="ml-auto text-[10px] uppercase tracking-wide">fixa</span>
            {/* Fixa não reordena nem oculta, mas anima — e pode deixar de animar. */}
            <BotaoAnimacaoSecao
              animada={secaoAnimada(dados, def.id)}
              onToggle={() =>
                setSecao(def.id, { animacao: secaoAnimada(dados, def.id) ? false : undefined })
              }
            />
          </div>
        ))}

      <Reorder.Group
        axis="y"
        values={ordem}
        onReorder={(nova: string[]) => atualizar((d) => ({ ...d, ordemSecoes: nova }))}
        className="flex flex-col gap-2"
      >
        {ordem.map((id) => {
          const def = naoFixas.find((s) => s.id === id);
          if (!def) return null;
          const secao = dados.secoes[id];
          const oculta = secao?.oculta === true;
          const alinhamento = secao?.alinhamento ?? def.alignOptions?.[0];
          return (
            <ItemEstrutura
              key={id}
              id={id}
              def={def}
              oculta={oculta}
              alinhamento={alinhamento}
              entrada={secao?.animacaoEntrada}
              animada={secaoAnimada(dados, id)}
              onOcultar={() => setSecao(id, { oculta: oculta ? undefined : true })}
              onAlinhar={(opcao) => setSecao(id, { alinhamento: opcao })}
              onEntrada={(opcao) => setSecao(id, { animacaoEntrada: opcao })}
              onAnimacao={() =>
                setSecao(id, { animacao: secaoAnimada(dados, id) ? false : undefined })
              }
            />
          );
        })}
      </Reorder.Group>
    </div>
  );
}
