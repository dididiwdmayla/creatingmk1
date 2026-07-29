"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/Button";
import { UsageMeter } from "@/components/UsageMeter";
import { ApiError, api, type CotasUsuariosResponse, type UsageResponse } from "@/lib/api-client";
import { DEFAULT_CONFIG, type AppConfig, type FiltroPresenca } from "@/lib/config";
import type { Sku, UsoUsuario } from "@/lib/costs";
import { SKUS, SKU_LABELS } from "@/lib/sku-labels";
import type { LimitesUsuario, Papel, UsuarioPublico } from "@/lib/usuarios/types";

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

  if (loading) {
    return <p className="text-sm text-ink-muted">Carregando…</p>;
  }

  return (
    <div className="flex flex-col gap-6 pb-6">
      <UsuariosSection />
      <CotasUsuariosSection />
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

      {problemas.length > 0 && (
        <ul className="rounded border border-critical/40 bg-critical/10 p-3 text-sm text-critical">
          {problemas.map((problema) => (
            <li key={problema}>{problema}</li>
          ))}
        </ul>
      )}
      {erro && <p className="text-sm text-critical">{erro}</p>}
      {salvo && <p className="text-sm text-good">Configuração salva.</p>}

      <Button type="submit" loading={saving}>
        Salvar
      </Button>
      </form>
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

      {usoGlobal && (
        <div className="mt-3 flex flex-col gap-3 rounded border border-line p-3">
          <p className="text-[11px] uppercase tracking-wide text-ink-muted">
            Teto global do mês (bloqueia membros; admin passa direto)
          </p>
          {SKUS_COTA_INDIVIDUAL.map((sku) => (
            <UsageMeter
              key={sku}
              label={SKU_LABELS[sku]}
              used={usoGlobal.usage[sku]}
              cap={usoGlobal.caps[sku]}
              freeQuota={usoGlobal.cotaGratis[sku]}
            />
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-col gap-3">
        {linhas === null && <p className="text-sm text-ink-muted">Carregando…</p>}
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
