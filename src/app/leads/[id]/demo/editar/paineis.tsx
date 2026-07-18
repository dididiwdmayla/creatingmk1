"use client";

import Image from "next/image";
import { Reorder, useDragControls } from "motion/react";
import { useRef, type ChangeEvent, type ReactNode } from "react";

import { ordemEfetiva } from "@/lib/demos/estrutura";
import { fontesPorPapel } from "@/lib/demos/fontes";
import { SKINS } from "@/lib/demos/registry";
import { TEMA_RAIOS, inkPara } from "@/lib/demos/tema";
import type {
  Alinhamento,
  Animacao,
  AnimacaoEntrada,
  CliqueEstilo,
  DemoData,
  DemoItem,
  Densidade,
  FundoEfeito,
  HoverEstilo,
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
}: {
  dados: DemoData;
  skin: SkinDefinition;
  abertos: Record<string, boolean>;
  setAberto: (grupo: string, aberto: boolean) => void;
  atualizar: Atualizar;
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
          Campo esvaziado volta ao padrão do template ao salvar.
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
                  value={servico.preco}
                  onChange={(e) =>
                    atualizar((d) => ({
                      ...d,
                      servicos: d.servicos.map((s, j) =>
                        j === i ? { ...s, preco: e.target.value } : s,
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
                  area={"area" in extra}
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

export function PainelImagens({
  dados,
  skin,
  uploadSlot,
  erro,
  onUpload,
  onRemover,
}: {
  dados: DemoData;
  skin: SkinDefinition;
  uploadSlot: string | null;
  erro: string | null;
  onUpload: (slot: string, file: File) => void;
  onRemover: (slot: string) => void;
}) {
  const slots = Object.keys(skin.demoDataExemplo.imagens);
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

const FUNDOS: Array<{ id: FundoEfeito; rotulo: string }> = [
  { id: "nenhum", rotulo: "Nenhum" },
  { id: "gradiente", rotulo: "Gradiente animado" },
  { id: "particulas", rotulo: "Partículas" },
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

export function PainelTema({
  skinId,
  onSkinChange,
  skin,
  themeId,
  setThemeId,
  tema,
  setTema,
}: {
  skinId: string;
  onSkinChange: (skinId: string) => void;
  skin: SkinDefinition;
  themeId: string;
  setThemeId: (themeId: string) => void;
  tema: TemaPatch;
  setTema: (tema: TemaPatch) => void;
}) {
  const preset = skin.themePresets.find((t) => t.id === themeId) ?? skin.themeDefault;
  const destaque = tema.destaque ?? preset.paleta.destaque;

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
        <select
          value={tema.fonteDisplay ?? ""}
          onChange={(e) => setTema({ ...tema, fonteDisplay: e.target.value || undefined })}
          className={INPUT_CLS}
        >
          <option value="">Padrão do preset</option>
          {fontesPorPapel("display").map((fonte) => (
            <option key={fonte.id} value={fonte.id}>
              {fonte.nome}
            </option>
          ))}
        </select>
      </label>

      <label className={LABEL_CLS}>
        Fonte do corpo
        <select
          value={tema.fonteCorpo ?? ""}
          onChange={(e) => setTema({ ...tema, fonteCorpo: e.target.value || undefined })}
          className={INPUT_CLS}
        >
          <option value="">Padrão do preset</option>
          {fontesPorPapel("corpo").map((fonte) => (
            <option key={fonte.id} value={fonte.id}>
              {fonte.nome}
            </option>
          ))}
        </select>
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
  onOcultar,
  onAlinhar,
  onEntrada,
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
  onOcultar: () => void;
  onAlinhar: (opcao: Alinhamento) => void;
  onEntrada: (opcao: AnimacaoEntrada | undefined) => void;
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
      {def.entradaOptions && !oculta && (
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
        quiser. O template segue responsivo — sem posicionamento livre.
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
              onOcultar={() => setSecao(id, { oculta: oculta ? undefined : true })}
              onAlinhar={(opcao) => setSecao(id, { alinhamento: opcao })}
              onEntrada={(opcao) => setSecao(id, { animacaoEntrada: opcao })}
            />
          );
        })}
      </Reorder.Group>
    </div>
  );
}
