"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/Button";
import { ConfirmModal } from "@/components/ConfirmModal";
import { SkeletonRows } from "@/components/Skeleton";
import { UsageMeter } from "@/components/UsageMeter";
import {
  ApiError,
  api,
  type CotasUsuariosResponse,
  type FrasesResponse,
  type MetasUsuariosResponse,
  type UsageResponse,
} from "@/lib/api-client";
import {
  DEFAULT_CONFIG,
  type AppConfig,
  type FiltroPresenca,
  type PresetPrecificacao,
} from "@/lib/config";
import type { Sku, UsoUsuario } from "@/lib/costs";
import { chaveNicho } from "@/lib/frases/chave";
import { frasesEfetivas, normalizarSlots, posicaoAtual } from "@/lib/frases/rotacao";
import { CHAVE_GENERICAS, FRASES_SLOTS, type FrasesProspeccao } from "@/lib/frases/types";
import { SLIDER_MAX_BRL, SLIDER_MIN_BRL, SLIDER_STEP_BRL } from "@/lib/precificacao/calc";
import { SKUS, SKU_LABELS } from "@/lib/sku-labels";
import type { LimitesUsuario, MetasUsuario, Papel, UsuarioPublico } from "@/lib/usuarios/types";

/** SKUs relevantes à cota individual — resumo compacto no topo da seção de cotas. */
const SKUS_COTA_INDIVIDUAL: Sku[] = [
  "textSearch",
  "textSearchEnterprise",
  "detailsEnterprise",
  "detailsProHours",
];

type CampoLimite = keyof LimitesUsuario;

const JANELAS: Array<{ chave: "dia" | "semana" | "mes"; label: string; sufixo: "Dia" | "Semana" | "Mes" }> = [
  { chave: "dia", label: "Hoje", sufixo: "Dia" },
  { chave: "semana", label: "Semana", sufixo: "Semana" },
  { chave: "mes", label: "Mês", sufixo: "Mes" },
];

/** Fetcher puro (não mexe em estado) — reaproveitado pela carga inicial e por "zerar dia". */
async function fetchCotasData(): Promise<{ cotas: CotasUsuariosResponse; usage: UsageResponse }> {
  const [cotas, usage] = await Promise.all([api.getCotasUsuarios(), api.getUsage()]);
  return { cotas, usage };
}

/** Mensagem de erro com o `code` da API — sem isso, um 500 inesperado vira só "falha genérica". */
function mensagemErroCotas(error: unknown, fallback: string): string {
  return error instanceof ApiError ? `${fallback} (${error.code}): ${error.message}` : fallback;
}

const PRESENCA_OPTIONS: Array<{ value: FiltroPresenca; label: string }> = [
  { value: "qualquer", label: "Qualquer" },
  { value: "com", label: "Com" },
  { value: "sem", label: "Sem" },
];

export default function ConfigPage() {
  const [form, setForm] = useState<AppConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [problemas, setProblemas] = useState<string[]>([]);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    api
      .getConfig()
      .then(({ config }) => setForm(config))
      .catch((error) =>
        setErro(error instanceof ApiError ? error.message : "Falha ao carregar a config."),
      )
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setErro(null);
    setProblemas([]);
    setSalvo(false);
    try {
      const { config } = await api.putConfig(form);
      setForm(config);
      setSalvo(true);
    } catch (error) {
      if (error instanceof ApiError && error.code === "validation_error") {
        setProblemas((error.extra.problemas as string[]) ?? [error.message]);
      } else {
        setErro(error instanceof ApiError ? error.message : "Falha ao salvar.");
      }
    } finally {
      setSaving(false);
    }
  }

  // `form` já nasce com DEFAULT_CONFIG (mesmo shape do config real) — o
  // formulário renderiza desde o primeiro desenho, e a carga real só troca
  // os VALORES dos campos, sem mudar a estrutura. Nada de gate de página
  // inteira que troca um parágrafo por um formulário completo depois.
  return (
    <div className="flex flex-col gap-6 pb-6">
      <UsuariosSection />
      <CotasUsuariosSection />
      <MetasUsuariosSection />
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Busca</h2>
        <div className="mt-3 flex flex-col gap-3">
          <Field label="Nicho-alvo">
            <input
              value={form.nicho}
              onChange={(e) => setForm({ ...form, nicho: e.target.value })}
              placeholder="ex.: dentista"
              className="w-full rounded border border-line bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            />
          </Field>
          <Field label="Região de busca">
            <input
              value={form.regiao}
              onChange={(e) => setForm({ ...form, regiao: e.target.value })}
              placeholder="ex.: Sarandi PR"
              className="w-full rounded border border-line bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Filtro: tem site?">
              <select
                value={form.filtros.temSite}
                onChange={(e) =>
                  setForm({
                    ...form,
                    filtros: { ...form.filtros, temSite: e.target.value as FiltroPresenca },
                  })
                }
                className="w-full rounded border border-line bg-surface-2 px-2 py-2 text-sm text-foreground outline-none focus:border-accent"
              >
                {PRESENCA_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Filtro: tem telefone?">
              <select
                value={form.filtros.temTelefone}
                onChange={(e) =>
                  setForm({
                    ...form,
                    filtros: {
                      ...form.filtros,
                      temTelefone: e.target.value as FiltroPresenca,
                    },
                  })
                }
                className="w-full rounded border border-line bg-surface-2 px-2 py-2 text-sm text-foreground outline-none focus:border-accent"
              >
                {PRESENCA_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Mensagem padrão
        </h2>
        <p className="mt-1 text-xs text-ink-muted">
          Use <code className="font-mono">{"{nome}"}</code> para o nome do lead,{" "}
          <code className="font-mono">{"{demo}"}</code> para o link da demo personalizada e{" "}
          <code className="font-mono">{"{penetracao}"}</code> para a linha de argumento de
          penetração de site (só quando o lead não tem site próprio).
        </p>
        <textarea
          value={form.mensagemPadrao}
          onChange={(e) => setForm({ ...form, mensagemPadrao: e.target.value })}
          rows={4}
          className="mt-2 w-full rounded border border-line bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
        />
      </section>

      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Operação diária
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Follow-up após (dias sem resposta)">
            <input
              type="number"
              min={1}
              step={1}
              value={form.followUpDias}
              onChange={(e) =>
                setForm({ ...form, followUpDias: Number(e.target.value) || 0 })
              }
              className="w-full rounded border border-line bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            />
          </Field>
          <Field label="Teto de buscas recorrentes">
            <input
              type="number"
              min={0}
              step={1}
              value={form.maxBuscasRecorrentes}
              onChange={(e) =>
                setForm({ ...form, maxBuscasRecorrentes: Number(e.target.value) || 0 })
              }
              className="w-full rounded border border-line bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            />
          </Field>
        </div>
        <p className="mt-2 text-xs text-ink-muted">
          O cron da madrugada re-executa as buscas marcadas como recorrentes (até o teto) e a
          fila do dia (/hoje) marca follow-up quem está contactado sem resposta há mais dias
          que o limite.
        </p>
      </section>

      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Tetos mensais por SKU
        </h2>
        <div className="mt-3 flex flex-col gap-3">
          {SKUS.map((sku) => (
            <Field key={sku} label={SKU_LABELS[sku]}>
              <input
                type="number"
                min={0}
                step={1}
                value={form.caps[sku]}
                onChange={(e) =>
                  setForm({
                    ...form,
                    caps: { ...form.caps, [sku]: Number(e.target.value) || 0 },
                  })
                }
                className="w-full rounded border border-line bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
              />
            </Field>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Preços e câmbio
        </h2>
        <div className="mt-3 flex flex-col gap-3">
          <Field label="Câmbio USD → BRL">
            <input
              type="number"
              min={0}
              step={0.01}
              value={form.precos.usdBrl}
              onChange={(e) =>
                setForm({
                  ...form,
                  precos: { ...form.precos, usdBrl: Number(e.target.value) || 0 },
                })
              }
              className="w-full rounded border border-line bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            />
          </Field>
          {SKUS.map((sku) => (
            <div key={sku} className="grid grid-cols-2 gap-3">
              <Field label={`${SKU_LABELS[sku]} · US$/1.000`}>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.precos.usdPor1000[sku]}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      precos: {
                        ...form.precos,
                        usdPor1000: {
                          ...form.precos.usdPor1000,
                          [sku]: Number(e.target.value) || 0,
                        },
                      },
                    })
                  }
                  className="w-full rounded border border-line bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                />
              </Field>
              <Field label="Cota grátis/mês">
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={form.precos.cotaGratis[sku]}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      precos: {
                        ...form.precos,
                        cotaGratis: {
                          ...form.precos.cotaGratis,
                          [sku]: Number(e.target.value) || 0,
                        },
                      },
                    })
                  }
                  className="w-full rounded border border-line bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                />
              </Field>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Precificação
        </h2>
        <p className="mt-1 text-xs text-ink-muted">
          Parâmetros da calculadora do card &quot;Precificação&quot; (ficha do lead e grupo de
          busca): preço sugerido = preço-base × índice efetivo da região × multiplicador do
          nicho, nunca abaixo do piso.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Piso (R$)">
            <input
              type="number"
              min={0}
              step={1}
              value={form.precificacao.pisoPrecificacao}
              onChange={(e) =>
                setForm({
                  ...form,
                  precificacao: {
                    ...form.precificacao,
                    pisoPrecificacao: Number(e.target.value) || 0,
                  },
                })
              }
              className={INPUT_CLS}
            />
          </Field>
          <Field label="Fator mínimo do índice">
            <input
              type="number"
              min={0.01}
              step={0.05}
              value={form.precificacao.fatorMinimoIndice}
              onChange={(e) =>
                setForm({
                  ...form,
                  precificacao: {
                    ...form.precificacao,
                    fatorMinimoIndice: Number(e.target.value) || 0,
                  },
                })
              }
              className={INPUT_CLS}
            />
          </Field>
        </div>
        <p className="mt-1 text-xs text-ink-muted">
          Regiões baratas reduzem o preço em no máximo (1 − fator mínimo); regiões caras (índice
          &gt; 1) sobem sem teto.
        </p>

        <div className="mt-4">
          <h3 className="text-xs font-medium text-ink-secondary">Multiplicador por nicho</h3>
          <p className="mt-1 text-xs text-ink-muted">
            Nicho sem entrada aqui usa multiplicador 1.0 (neutro).
          </p>
          <MultiplicadoresNichoEditor
            value={form.precificacao.multiplicadoresNicho}
            onChange={(multiplicadoresNicho) =>
              setForm({ ...form, precificacao: { ...form.precificacao, multiplicadoresNicho } })
            }
          />
        </div>

        <div className="mt-4">
          <h3 className="text-xs font-medium text-ink-secondary">Presets do slider</h3>
          <p className="mt-1 text-xs text-ink-muted">
            Atalhos que reposicionam o preço-base no card de precificação.
          </p>
          <PresetsEditor
            value={form.precificacao.presets}
            onChange={(presets) =>
              setForm({ ...form, precificacao: { ...form.precificacao, presets } })
            }
          />
        </div>
      </section>

      {problemas.length > 0 && (
        <ul className="rounded border border-critical/40 bg-critical/10 p-3 text-sm text-critical">
          {problemas.map((problema) => (
            <li key={problema}>{problema}</li>
          ))}
        </ul>
      )}
      {erro && <p className="text-sm text-critical">{erro}</p>}
      {salvo && <p className="text-sm text-good">Configuração salva.</p>}

      <Button type="submit" loading={saving} disabled={loading}>
        Salvar
      </Button>
      </form>
      {/*
        Última seção da página DE PROPÓSITO: a lista de nichos tem tamanho
        variável (cresce com as buscas) e só chega depois do primeiro
        desenho — no meio da página ela empurraria o formulário inteiro pra
        baixo a cada carga. Sendo o último bloco, não há nada abaixo pra
        deslocar, que é a mesma razão de efeito/LED serem `fixed` nas demos
        (ver ARCHITECTURE.md, "Deslocamento de layout"). Ela tem salvamento
        próprio, então também não pertence ao formulário acima.
      */}
      <FrasesSection />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-ink-secondary">{label}</span>
      {children}
    </label>
  );
}

const INPUT_CLS =
  "w-full rounded border border-line bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent";

/**
 * Gestão de usuários (admin): criar, renomear, ativar/desativar, trocar
 * papel e redefinir senha. O proxy já manda membros de volta ao painel;
 * este componente é a UI sobre /api/usuarios.
 */
function UsuariosSection() {
  const [usuarios, setUsuarios] = useState<UsuarioPublico[] | null>(null);
  const [meuId, setMeuId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [novoNome, setNovoNome] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [senhaDe, setSenhaDe] = useState<string | null>(null);
  const [senhaNova, setSenhaNova] = useState("");
  // Exclusão (além de desativar): confirmação DUPLA — 2 modais em sequência,
  // cada um exigindo um clique deliberado antes da chamada real à API.
  const [excluindo, setExcluindo] = useState<{ id: string; nome: string; etapa: 1 | 2 } | null>(
    null,
  );

  useEffect(() => {
    let ignore = false;
    Promise.all([api.listUsuarios(), api.me()])
      .then(([{ usuarios: lista }, { usuario }]) => {
        if (ignore) return;
        setUsuarios(lista);
        setMeuId(usuario.id);
      })
      .catch((error) => {
        if (ignore) return;
        setErro(
          error instanceof ApiError && error.status === 403
            ? "Gestão de usuários é restrita ao admin."
            : "Falha ao carregar os usuários.",
        );
      });
    return () => {
      ignore = true;
    };
  }, []);

  function aplicar(id: string, patch: { papel?: Papel; ativo?: boolean; senha?: string }) {
    setOcupado(id);
    setErro(null);
    setAviso(null);
    api
      .patchUsuario(id, patch)
      .then(({ usuario }) => {
        setUsuarios((atual) =>
          (atual ?? []).map((u) => (u.id === usuario.id ? usuario : u)),
        );
        if (patch.senha !== undefined) {
          setAviso(`Senha de "${usuario.nome}" redefinida.`);
          setSenhaDe(null);
          setSenhaNova("");
        }
      })
      .catch((error) =>
        setErro(error instanceof ApiError ? error.message : "Falha ao salvar o usuário."),
      )
      .finally(() => setOcupado(null));
  }

  function confirmarExclusao() {
    if (!excluindo) return;
    if (excluindo.etapa === 1) {
      setExcluindo({ ...excluindo, etapa: 2 });
      return;
    }
    const { id, nome } = excluindo;
    setOcupado(id);
    setErro(null);
    setAviso(null);
    api
      .excluirUsuario(id)
      .then(() => {
        setUsuarios((atual) => (atual ?? []).filter((u) => u.id !== id));
        setAviso(`Usuário "${nome}" excluído — leads/contatos/mensagens dele permanecem, marcados "usuário removido".`);
      })
      .catch((error) =>
        setErro(error instanceof ApiError ? error.message : "Falha ao excluir o usuário."),
      )
      .finally(() => {
        setOcupado(null);
        setExcluindo(null);
      });
  }

  function criar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOcupado("novo");
    setErro(null);
    setAviso(null);
    api
      .createUsuario({ nome: novoNome, ...(novaSenha && { senha: novaSenha }) })
      .then(({ usuario }) => {
        setUsuarios((atual) => [...(atual ?? []), usuario]);
        setNovoNome("");
        setNovaSenha("");
        setAviso(`Usuário "${usuario.nome}" criado.`);
      })
      .catch((error) =>
        setErro(error instanceof ApiError ? error.message : "Falha ao criar o usuário."),
      )
      .finally(() => setOcupado(null));
  }

  if (erro && usuarios === null) {
    return (
      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Usuários</h2>
        <p className="mt-2 text-sm text-ink-muted">{erro}</p>
      </section>
    );
  }

  // A lista ainda não chegou: o mesmo invólucro da seção, com skeletons no
  // lugar das linhas — nunca uma seção vazia que cresce quando os dados
  // chegam (é isso que empurra o resto da página).
  if (usuarios === null) {
    return (
      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Usuários</h2>
        <p className="mt-1 text-xs text-ink-muted">
          Membro sem senha definida não consegue entrar — defina uma aqui. Desativar/redefinir
          derruba as sessões do usuário.
        </p>
        <div className="mt-3">
          <SkeletonRows count={2} className="h-14 rounded border border-line" />
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Usuários</h2>
      <p className="mt-1 text-xs text-ink-muted">
        Membro sem senha definida não consegue entrar — defina uma aqui. Desativar/redefinir
        derruba as sessões do usuário.
      </p>

      <div className="mt-3 flex flex-col gap-2">
        {(usuarios ?? []).map((u) => (
          <div key={u.id} className="rounded border border-line p-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-sm ${u.ativo ? "text-foreground" : "text-ink-muted line-through"}`}>
                {u.nome}
              </span>
              <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-ink-secondary">
                {u.papel}
              </span>
              {!u.temSenha && (
                <span className="text-[11px] text-warning">sem senha definida</span>
              )}
              {u.id === meuId && <span className="text-[11px] text-ink-muted">(você)</span>}
              <span className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  disabled={ocupado === u.id}
                  onClick={() => setSenhaDe(senhaDe === u.id ? null : u.id)}
                  className="text-xs text-accent hover:underline disabled:opacity-50"
                >
                  Redefinir senha
                </button>
                <button
                  type="button"
                  disabled={ocupado === u.id}
                  onClick={() => aplicar(u.id, { ativo: !u.ativo })}
                  className="text-xs text-ink-muted hover:text-foreground disabled:opacity-50"
                >
                  {u.ativo ? "Desativar" : "Reativar"}
                </button>
                <button
                  type="button"
                  disabled={ocupado === u.id || u.id === meuId}
                  title={u.id === meuId ? "Não dá pra excluir o próprio usuário" : undefined}
                  onClick={() => setExcluindo({ id: u.id, nome: u.nome, etapa: 1 })}
                  className="text-xs text-critical hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Excluir
                </button>
              </span>
            </div>
            {senhaDe === u.id && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Nova senha (mín. 4)"
                  value={senhaNova}
                  onChange={(e) => setSenhaNova(e.target.value)}
                  className={INPUT_CLS}
                />
                <button
                  type="button"
                  disabled={senhaNova.length < 4 || ocupado === u.id}
                  onClick={() => aplicar(u.id, { senha: senhaNova })}
                  className="shrink-0 rounded bg-accent px-3 py-2 text-xs font-semibold text-accent-ink disabled:opacity-50"
                >
                  Definir
                </button>
              </div>
            )}
          </div>
        ))}
        {usuarios === null && <p className="text-sm text-ink-muted">Carregando usuários…</p>}
      </div>

      <form onSubmit={criar} className="mt-3 flex items-center gap-2">
        <input
          placeholder="Novo usuário"
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          className={INPUT_CLS}
        />
        <input
          type="password"
          autoComplete="new-password"
          placeholder="Senha (opcional)"
          value={novaSenha}
          onChange={(e) => setNovaSenha(e.target.value)}
          className={INPUT_CLS}
        />
        <button
          type="submit"
          disabled={novoNome.trim().length < 2 || ocupado === "novo"}
          className="shrink-0 rounded bg-accent px-3 py-2 text-xs font-semibold text-accent-ink disabled:opacity-50"
        >
          Criar
        </button>
      </form>

      {erro && <p className="mt-2 text-sm text-critical">{erro}</p>}
      {aviso && <p className="mt-2 text-sm text-good">{aviso}</p>}

      <ConfirmModal
        aberto={excluindo?.etapa === 1}
        titulo={`Excluir "${excluindo?.nome}"?`}
        mensagem='Os leads/contatos/mensagens registrados por este usuário permanecem na base (marcados "usuário removido"); só os contadores de cota individual dele são apagados. Esta ação não pode ser desfeita.'
        confirmarLabel="Continuar"
        onConfirmar={confirmarExclusao}
        onCancelar={() => setExcluindo(null)}
      />
      <ConfirmModal
        aberto={excluindo?.etapa === 2}
        titulo="Confirmação final"
        mensagem={`Confirma DEFINITIVAMENTE a exclusão de "${excluindo?.nome}"?`}
        confirmarLabel="Excluir para sempre"
        onConfirmar={confirmarExclusao}
        onCancelar={() => setExcluindo(null)}
      />
    </section>
  );
}

/**
 * Cotas individuais (admin): tabela usado/limite × dia/semana/mês, por
 * usuário, para os dois tipos (buscas/enriquecimentos) — reserveQuota já
 * garante o bloqueio no servidor; esta seção só edita os limites e mostra
 * o uso. Edição inline com efeito imediato (cada campo salva sozinho no
 * blur, sem botão "Salvar" à parte — a config é lida fresca a cada
 * request, então vale na busca/enriquecimento seguinte). "Zerar dia" refaz
 * a leitura inteira: mais simples e correto que tentar ajustar local a
 * soma de semana/mês, que é agregação pura sobre os dias.
 */
function CotasUsuariosSection() {
  const [linhas, setLinhas] = useState<CotasUsuariosResponse["usuarios"] | null>(null);
  const [usoGlobal, setUsoGlobal] = useState<UsageResponse | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    fetchCotasData()
      .then(({ cotas, usage }) => {
        if (ignore) return;
        setLinhas(cotas.usuarios);
        setUsoGlobal(usage);
        setErro(null);
      })
      .catch((error) => {
        if (ignore) return;
        setErro(
          error instanceof ApiError && error.status === 403
            ? "Cotas são restritas ao admin."
            : mensagemErroCotas(error, "Falha ao carregar as cotas"),
        );
      });
    return () => {
      ignore = true;
    };
  }, []);

  async function salvarLimite(id: string, campo: CampoLimite, valor: number | null) {
    const chave = `${id}:${campo}`;
    setOcupado(chave);
    setErro(null);
    try {
      const { usuario } = await api.patchUsuario(id, { limites: { [campo]: valor } });
      setLinhas((atual) =>
        (atual ?? []).map((linha) =>
          linha.id === id ? { ...linha, limites: usuario.limites ?? {} } : linha,
        ),
      );
    } catch (error) {
      setErro(mensagemErroCotas(error, "Falha ao salvar o limite"));
    } finally {
      setOcupado(null);
    }
  }

  async function zerarDia(id: string, nome: string) {
    setOcupado(`${id}:zerar`);
    setErro(null);
    setAviso(null);
    try {
      await api.zerarCotaDiaUsuario(id);
      const { cotas, usage } = await fetchCotasData();
      setLinhas(cotas.usuarios);
      setUsoGlobal(usage);
      setAviso(`Dia de "${nome}" zerado.`);
    } catch (error) {
      setErro(mensagemErroCotas(error, "Falha ao zerar o dia"));
    } finally {
      setOcupado(null);
    }
  }

  if (erro && linhas === null) {
    return (
      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Cotas por usuário
        </h2>
        <p className="mt-2 text-sm text-ink-muted">{erro}</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        Cotas por usuário
      </h2>
      <p className="mt-1 text-xs text-ink-muted">
        Vazio = sem limite naquela janela. Admin nunca é bloqueado — os limites dele aqui são só
        informativos.
      </p>

      <div className="mt-3 flex flex-col gap-3 rounded border border-line p-3">
        <p className="text-[11px] uppercase tracking-wide text-ink-muted">
          Teto global do mês (bloqueia membros; admin passa direto)
        </p>
        {usoGlobal ? (
          SKUS_COTA_INDIVIDUAL.map((sku) => (
            <UsageMeter
              key={sku}
              label={SKU_LABELS[sku]}
              used={usoGlobal.usage[sku]}
              cap={usoGlobal.caps[sku]}
              freeQuota={usoGlobal.cotaGratis[sku]}
            />
          ))
        ) : (
          <SkeletonRows count={SKUS_COTA_INDIVIDUAL.length} className="h-6" />
        )}
      </div>

      <div className="mt-3 flex flex-col gap-3">
        {linhas === null && <SkeletonRows count={2} className="h-20 rounded border border-line" />}
        {(linhas ?? []).map((linha) => (
          <div key={linha.id} className="rounded border border-line p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-sm ${linha.ativo ? "text-foreground" : "text-ink-muted line-through"}`}>
                {linha.nome}
              </span>
              <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-ink-secondary">
                {linha.papel}
              </span>
              <button
                type="button"
                disabled={ocupado === `${linha.id}:zerar`}
                onClick={() => zerarDia(linha.id, linha.nome)}
                className="ml-auto text-xs text-accent hover:underline disabled:opacity-50"
              >
                Zerar dia
              </button>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <LinhaCota
                label="Buscas"
                uso={linha.buscas}
                prefixo="buscas"
                userId={linha.id}
                ocupado={ocupado}
                onSalvar={salvarLimite}
              />
              <LinhaCota
                label="Enriquecimentos"
                uso={linha.enriquecimentos}
                prefixo="enriquecimentos"
                userId={linha.id}
                ocupado={ocupado}
                onSalvar={salvarLimite}
              />
            </div>
          </div>
        ))}
      </div>

      {erro && <p className="mt-2 text-sm text-critical">{erro}</p>}
      {aviso && <p className="mt-2 text-sm text-good">{aviso}</p>}
    </section>
  );
}

const JANELAS_META: Array<{ chave: "dia" | "semana"; label: string; campo: keyof MetasUsuario }> = [
  { chave: "dia", label: "Hoje", campo: "prospeccoesDia" },
  { chave: "semana", label: "Semana", campo: "prospeccoesSemana" },
];

/** Mensagem de erro com o `code` da API — mesmo padrão de mensagemErroCotas. */
function mensagemErroMetas(error: unknown, fallback: string): string {
  return error instanceof ApiError ? `${fallback} (${error.code}): ${error.message}` : fallback;
}

/**
 * Metas de prospecção por integrante (admin): meta diária e semanal,
 * editáveis inline no mesmo padrão de CotasUsuariosSection (LimiteInput
 * reaproveitado, salva no blur). "Prospecção" = contador `buscas` de
 * usage_users (ver src/lib/usuarios/metas.ts) — o mesmo dado que a busca
 * já grava, sem nenhum contador novo. Meta é opcional: campo vazio = sem
 * meta, e a linha do usuário sem NENHUMA meta configurada não aparece em
 * lugar nenhum fora daqui (/hoje e o painel do admin escondem a janela sem
 * meta) — mas aqui ela continua listada, para o admin poder configurar.
 */
function MetasUsuariosSection() {
  const [linhas, setLinhas] = useState<MetasUsuariosResponse["usuarios"] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    api
      .getMetasUsuarios()
      .then(({ usuarios }) => {
        if (!ignore) setLinhas(usuarios);
      })
      .catch((error) => {
        if (ignore) return;
        setErro(
          error instanceof ApiError && error.status === 403
            ? "Metas são restritas ao admin."
            : mensagemErroMetas(error, "Falha ao carregar as metas"),
        );
      });
    return () => {
      ignore = true;
    };
  }, []);

  async function salvarMeta(id: string, campo: keyof MetasUsuario, valor: number | null) {
    const chave = `${id}:${campo}`;
    setOcupado(chave);
    setErro(null);
    try {
      const { usuario } = await api.patchUsuario(id, { metas: { [campo]: valor } });
      setLinhas((atual) =>
        (atual ?? []).map((linha) =>
          linha.id === id ? { ...linha, metas: usuario.metas ?? {} } : linha,
        ),
      );
    } catch (error) {
      setErro(mensagemErroMetas(error, "Falha ao salvar a meta"));
    } finally {
      setOcupado(null);
    }
  }

  if (erro && linhas === null) {
    return (
      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Metas por integrante
        </h2>
        <p className="mt-2 text-sm text-ink-muted">{erro}</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        Metas por integrante
      </h2>
      <p className="mt-1 text-xs text-ink-muted">
        Vazio = sem meta naquela janela. Indicador de ritmo — nunca bloqueia uma busca. O
        próprio integrante vê o progresso em /hoje; a visão do time fica no painel.
      </p>

      <div className="mt-3 flex flex-col gap-3">
        {linhas === null && <SkeletonRows count={2} className="h-24 rounded border border-line" />}
        {(linhas ?? []).map((linha) => (
          <div key={linha.id} className="rounded border border-line p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-sm ${linha.ativo ? "text-foreground" : "text-ink-muted line-through"}`}>
                {linha.nome}
              </span>
              <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-ink-secondary">
                {linha.papel}
              </span>
            </div>
            <div className="mt-3 flex flex-col gap-1.5">
              {JANELAS_META.map(({ chave, label, campo }) => {
                const { usado } = linha.prospeccao[chave];
                return (
                  <div key={chave} className="flex items-center gap-2 text-xs text-ink-secondary">
                    <span className="w-14 shrink-0">{label}</span>
                    <span className="font-mono text-foreground">{usado}</span>
                    <span className="text-ink-muted">/</span>
                    <LimiteInput
                      valor={linha.metas[campo]}
                      disabled={ocupado === `${linha.id}:${campo}`}
                      onSalvar={(valor) => salvarMeta(linha.id, campo, valor)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {erro && <p className="mt-2 text-sm text-critical">{erro}</p>}
    </section>
  );
}

/**
 * Frases de abordagem por nicho (ver "Frases de prospecção por nicho" no
 * ARCHITECTURE.md). A lista vem pronta de GET /api/frases: TODO nicho que já
 * apareceu em alguma busca, mais os que já têm frases salvas — nicho novo
 * aparece sozinho aqui na próxima carga, sem cadastro manual e sem deploy.
 *
 * Cada conjunto salva sozinho (PUT de um conjunto por vez), como as demais
 * seções auto-suficientes desta página — por isso vive FORA do formulário
 * principal, que tem um "Salvar" só para a config.
 */
function FrasesSection() {
  const [dados, setDados] = useState<FrasesResponse | null>(null);
  // Rascunho por conjunto (chave do nicho normalizada, ou a do genérico):
  // o que está nas caixas de texto antes de salvar.
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

  async function salvar(chave: string, nicho: string | null) {
    setSalvando(chave);
    setErro(null);
    setSalvo(null);
    try {
      const { conjunto } = await api.salvarFrases(nicho, rascunhos[chave] ?? []);
      setDados((atual) => (atual ? aplicarConjunto(atual, chave, conjunto) : atual));
      setRascunhos((atual) => ({ ...atual, [chave]: normalizarSlots(conjunto.frases) }));
      setSalvo(chave);
    } catch (error) {
      setErro(error instanceof ApiError ? error.message : "Falha ao salvar as frases.");
    } finally {
      setSalvando(null);
    }
  }

  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        Frases de prospecção por nicho
      </h2>
      <p className="mt-1 text-xs text-ink-muted">
        Três frases por nicho, girando 1 → 2 → 3 → 1. O contador é único por nicho e vale para
        o time inteiro; ele só anda no clique de enviar pro WhatsApp — abrir a ficha, copiar ou
        editar a frase não giram nada. Nicho sem nenhuma frase preenchida não participa: cai no
        conjunto genérico, depois na mensagem do grupo e por fim na mensagem padrão global.
      </p>
      <p className="mt-1 text-xs text-ink-muted">
        Valem os mesmos marcadores da mensagem padrão: <code className="font-mono">{"{nome}"}</code>,{" "}
        <code className="font-mono">{"{demo}"}</code> e{" "}
        <code className="font-mono">{"{penetracao}"}</code>.
      </p>

      <div className="mt-3 flex flex-col gap-3">
        {dados === null ? (
          <SkeletonRows count={3} className="h-44 rounded border border-line" />
        ) : (
          <>
            <ConjuntoFrasesEditor
              titulo="Conjunto genérico (fallback)"
              descricao="Usado quando o nicho do lead não tem frases próprias."
              conjunto={dados.genericas}
              valor={rascunhos[CHAVE_GENERICAS] ?? ["", "", ""]}
              onChange={(frases) =>
                setRascunhos((atual) => ({ ...atual, [CHAVE_GENERICAS]: frases }))
              }
              salvando={salvando === CHAVE_GENERICAS}
              salvo={salvo === CHAVE_GENERICAS}
              onSalvar={() => salvar(CHAVE_GENERICAS, null)}
            />
            {dados.conjuntos.map((conjunto) => {
              const chave = chaveNicho(conjunto.nicho);
              return (
                <ConjuntoFrasesEditor
                  key={chave}
                  titulo={conjunto.nicho}
                  conjunto={conjunto}
                  valor={rascunhos[chave] ?? ["", "", ""]}
                  onChange={(frases) => setRascunhos((atual) => ({ ...atual, [chave]: frases }))}
                  salvando={salvando === chave}
                  salvo={salvo === chave}
                  onSalvar={() => salvar(chave, conjunto.nicho)}
                />
              );
            })}
            {dados.conjuntos.length === 0 && (
              <p className="text-sm text-ink-muted">
                Nenhum nicho ainda — a primeira busca já traz o nicho dela para cá.
              </p>
            )}
          </>
        )}
      </div>

      {erro && <p className="mt-2 text-sm text-critical">{erro}</p>}
    </section>
  );
}

/** Rascunhos iniciais: o que está salvo, por chave de conjunto. */
function rascunhosDe(resposta: FrasesResponse): Record<string, string[]> {
  const rascunhos: Record<string, string[]> = {
    [CHAVE_GENERICAS]: normalizarSlots(resposta.genericas.frases),
  };
  for (const conjunto of resposta.conjuntos) {
    rascunhos[chaveNicho(conjunto.nicho)] = normalizarSlots(conjunto.frases);
  }
  return rascunhos;
}

/** Substitui um conjunto na resposta carregada, preservando a ordem da lista. */
function aplicarConjunto(
  atual: FrasesResponse,
  chave: string,
  conjunto: FrasesProspeccao,
): FrasesResponse {
  if (chave === CHAVE_GENERICAS) return { ...atual, genericas: conjunto };
  return {
    ...atual,
    conjuntos: atual.conjuntos.map((c) => (chaveNicho(c.nicho) === chave ? conjunto : c)),
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

function LinhaCota({
  label,
  uso,
  prefixo,
  userId,
  ocupado,
  onSalvar,
}: {
  label: string;
  uso: UsoUsuario;
  prefixo: "buscas" | "enriquecimentos";
  userId: string;
  ocupado: string | null;
  onSalvar: (id: string, campo: CampoLimite, valor: number | null) => void;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-ink-muted">{label}</p>
      <div className="mt-1.5 flex flex-col gap-1.5">
        {JANELAS.map(({ chave, label: janelaLabel, sufixo }) => {
          const campo = `${prefixo}${sufixo}` as CampoLimite;
          const { usado, limite } = uso[chave];
          return (
            <div key={chave} className="flex items-center gap-2 text-xs text-ink-secondary">
              <span className="w-14 shrink-0">{janelaLabel}</span>
              <span className="font-mono text-foreground">{usado}</span>
              <span className="text-ink-muted">/</span>
              <LimiteInput
                valor={limite}
                disabled={ocupado === `${userId}:${campo}`}
                onSalvar={(valor) => onSalvar(userId, campo, valor)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Input controlado: vazio = sem limite (null), número = limite. Salva no blur. */
function LimiteInput({
  valor,
  disabled,
  onSalvar,
}: {
  valor: number | undefined;
  disabled: boolean;
  onSalvar: (valor: number | null) => void;
}) {
  const [texto, setTexto] = useState(valor !== undefined ? String(valor) : "");
  // Ressincroniza quando o valor vem de fora (salvo com sucesso ou recarga)
  // — ajuste de estado durante a renderização, não em efeito (o valor pode
  // mudar sem esta instância ter disparado a mudança, ex.: outra aba).
  const [ultimoValor, setUltimoValor] = useState(valor);
  if (valor !== ultimoValor) {
    setUltimoValor(valor);
    setTexto(valor !== undefined ? String(valor) : "");
  }

  function commit() {
    const trimmed = texto.trim();
    if (trimmed === "") {
      if (valor !== undefined) onSalvar(null);
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
      setTexto(valor !== undefined ? String(valor) : ""); // inválido: reverte
      return;
    }
    if (n !== valor) onSalvar(n);
  }

  return (
    <input
      type="number"
      min={0}
      step={1}
      inputMode="numeric"
      value={texto}
      placeholder="∞"
      disabled={disabled}
      onChange={(event) => setTexto(event.target.value)}
      onBlur={commit}
      className="w-16 rounded border border-line bg-surface-2 px-2 py-1 text-center font-mono text-xs text-foreground outline-none focus:border-accent disabled:opacity-50"
    />
  );
}

interface NichoRow {
  id: string;
  nicho: string;
  multiplicador: string;
}

function linhasIniciais(value: Record<string, number>): NichoRow[] {
  return Object.entries(value).map(([nicho, multiplicador]) => ({
    id: crypto.randomUUID(),
    nicho,
    multiplicador: String(multiplicador),
  }));
}

/**
 * Lista chave-valor livre (nicho → multiplicador). Estado local em linhas
 * (com id estável pra key do React, já que a chave em si é editável);
 * sincroniza para `onChange` como Record a cada edição, ignorando linhas
 * com nicho vazio (rascunho ainda sendo digitado).
 */
function MultiplicadoresNichoEditor({
  value,
  onChange,
}: {
  value: Record<string, number>;
  onChange: (value: Record<string, number>) => void;
}) {
  const [linhas, setLinhas] = useState<NichoRow[]>(() => linhasIniciais(value));

  function propagar(novas: NichoRow[]) {
    setLinhas(novas);
    const record: Record<string, number> = {};
    for (const linha of novas) {
      const nome = linha.nicho.trim();
      const numero = Number(linha.multiplicador);
      if (nome && Number.isFinite(numero) && numero > 0) record[nome] = numero;
    }
    onChange(record);
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      {linhas.map((linha) => (
        <div key={linha.id} className="flex items-center gap-2">
          <input
            value={linha.nicho}
            onChange={(e) =>
              propagar(
                linhas.map((l) => (l.id === linha.id ? { ...l, nicho: e.target.value } : l)),
              )
            }
            placeholder="ex.: dentista"
            className={`${INPUT_CLS} flex-1`}
          />
          <input
            type="number"
            min={0}
            step={0.05}
            value={linha.multiplicador}
            onChange={(e) =>
              propagar(
                linhas.map((l) =>
                  l.id === linha.id ? { ...l, multiplicador: e.target.value } : l,
                ),
              )
            }
            className="w-24 rounded border border-line bg-surface-2 px-2 py-2 text-sm text-foreground outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={() => propagar(linhas.filter((l) => l.id !== linha.id))}
            className="shrink-0 text-xs text-critical hover:underline"
          >
            Remover
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          propagar([...linhas, { id: crypto.randomUUID(), nicho: "", multiplicador: "1" }])
        }
        className="self-start text-xs font-medium text-accent hover:underline"
      >
        + Adicionar nicho
      </button>
    </div>
  );
}

interface PresetRow {
  id: string;
  nome: string;
  valorBRL: string;
}

/** Presets do slider (nome + valor em BRL) — mesmo padrão de edição em linhas do editor acima. */
function PresetsEditor({
  value,
  onChange,
}: {
  value: PresetPrecificacao[];
  onChange: (value: PresetPrecificacao[]) => void;
}) {
  const [linhas, setLinhas] = useState<PresetRow[]>(() =>
    value.map((preset) => ({
      id: crypto.randomUUID(),
      nome: preset.nome,
      valorBRL: String(preset.valorBRL),
    })),
  );

  function propagar(novas: PresetRow[]) {
    setLinhas(novas);
    onChange(
      novas
        .map((linha) => ({ nome: linha.nome.trim(), valorBRL: Number(linha.valorBRL) }))
        .filter((preset) => preset.nome && Number.isFinite(preset.valorBRL) && preset.valorBRL > 0),
    );
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      {linhas.map((linha) => (
        <div key={linha.id} className="flex items-center gap-2">
          <input
            value={linha.nome}
            onChange={(e) =>
              propagar(linhas.map((l) => (l.id === linha.id ? { ...l, nome: e.target.value } : l)))
            }
            placeholder="ex.: Vitrine"
            className={`${INPUT_CLS} flex-1`}
          />
          <input
            type="number"
            min={SLIDER_MIN_BRL}
            max={SLIDER_MAX_BRL}
            step={SLIDER_STEP_BRL}
            value={linha.valorBRL}
            onChange={(e) =>
              propagar(
                linhas.map((l) => (l.id === linha.id ? { ...l, valorBRL: e.target.value } : l)),
              )
            }
            className="w-28 rounded border border-line bg-surface-2 px-2 py-2 text-sm text-foreground outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={() => propagar(linhas.filter((l) => l.id !== linha.id))}
            className="shrink-0 text-xs text-critical hover:underline"
          >
            Remover
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          propagar([...linhas, { id: crypto.randomUUID(), nome: "", valorBRL: "1000" }])
        }
        className="self-start text-xs font-medium text-accent hover:underline"
      >
        + Adicionar preset
      </button>
    </div>
  );
}
