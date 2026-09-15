"use client";

import { useEffect, useState } from "react";

import { BarraFaixasPreview } from "@/components/BarraDoDia";
import { Button } from "@/components/Button";
import { ConfirmModal } from "@/components/ConfirmModal";
import { SkeletonRows } from "@/components/Skeleton";
import { UsageMeter } from "@/components/UsageMeter";
import {
  ApiError,
  api,
  type CotasUsuariosResponse,
  type FilaDiagnosticoResponse,
  type FilaTesteEstadoResponse,
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
import { formatDateTime, formatInt, formatTempoAte, formatTempoRelativo } from "@/lib/format";
import { frasesEfetivas, normalizarSlots, posicaoAtual } from "@/lib/frases/rotacao";
import {
  FAMILIAS_JANELA_CONTATO,
  NIVEIS_CONTATO,
  ROTULO_FAMILIA,
  type FaixaNivelContato,
  type FamiliaJanelaContato,
  type HoraMinuto,
  type NivelContato,
} from "@/lib/leads/janelaContato";
import type { FilaConfig } from "@/lib/fila/config";
import {
  ETAPAS_TESTE,
  type EtapaTeste,
  type FilaTesteDoc,
  type LinhaFilaPainel,
  type PendenciaEnvio,
} from "@/lib/fila/estado";
import {
  FRASES_SLOTS,
  type FrasesProspeccao,
  type RelatorioMigracao,
} from "@/lib/frases/types";
import { SLIDER_MAX_BRL, SLIDER_MIN_BRL, SLIDER_STEP_BRL } from "@/lib/precificacao/calc";
import { bandeiraDoPais, type PaisProspeccao } from "@/lib/prospeccao/paises";
import { SKUS, SKU_LABELS } from "@/lib/sku-labels";
import type { LimitesUsuario, MetasUsuario, Papel, UsuarioPublico } from "@/lib/usuarios/types";

/** SKUs relevantes à cota individual — resumo compacto no topo da seção de cotas. */
const SKUS_COTA_INDIVIDUAL: Sku[] = [
  "textSearch",
  "textSearchEnterprise",
  "detailsEnterprise",
  "detailsProHours",
  "aiGeneration",
  "aiTraducao",
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
      <FilaEnvioSection />
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

      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Faixas de contato por família
        </h2>
        <p className="mt-1 text-xs text-ink-muted">
          Três níveis — bom, razoável e ruim — ao longo do dia, por família de negócio e por dia da
          semana. Determinístico: nenhuma IA gera horário aqui. É esta tabela que pinta a barra do
          dia na ficha do lead, sempre recortada pelo horário de funcionamento e na hora local
          dele. Trecho aberto sem faixa marcada vale &ldquo;razoável&rdquo;.
        </p>
        <div className="mt-3 flex flex-col gap-3">
          {FAMILIAS_JANELA_CONTATO.map((familiaId) => (
            <JanelaFamiliaEditor
              key={familiaId}
              familiaId={familiaId}
              valor={form.janelasContato[familiaId]}
              onChange={(valor) =>
                setForm({
                  ...form,
                  janelasContato: { ...form.janelasContato, [familiaId]: valor },
                })
              }
            />
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Países candidatos (tela Mundo)
        </h2>
        <p className="mt-1 text-xs text-ink-muted">
          A lista curta que a tela &ldquo;Onde prospectar agora&rdquo; percorre: o critério de
          entrada é o WhatsApp ser canal padrão de contato comercial por lá. O fuso decide a hora
          local do país (fuso padrão, sem horário de verão), os idiomas decidem a ordem da tela
          (português, inglês, espanhol, depois os demais) e o índice é o de partida — assim que
          uma cidade daquele país entra em /regioes, vale a média das cidades reais.
        </p>
        <PaisesProspeccaoEditor
          value={form.paisesProspeccao}
          onChange={(paisesProspeccao) => setForm({ ...form, paisesProspeccao })}
        />
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
 * usuário, para os três tipos (buscas/enriquecimentos/gerações de IA) —
 * reserveQuota já garante o bloqueio no servidor; esta seção só edita os
 * limites e mostra o uso. Edição inline com efeito imediato (cada campo
 * salva sozinho no blur, sem botão "Salvar" à parte — a config é lida
 * fresca a cada request, então vale na ação seguinte). "Zerar dia" refaz a
 * leitura inteira: mais simples e correto que tentar ajustar local a soma
 * de semana/mês, que é agregação pura sobre os dias.
 *
 * `geracoesIA` é UM contador para três ações distintas — geração de texto
 * da demo (SKU `aiGeneration`), tradução de frase por skin (SKU
 * `aiTraducao`) e análise interna do grupo (SKU `aiGeneration`) — cada uma
 * disputando o mesmo limite individual, embora consumam SKUs (tetos
 * globais) diferentes. Precificação regional e tradução de nicho também
 * usam `aiGeneration`, mas ficam de fora desta cota individual: são
 * geradas uma vez e cacheadas para o time inteiro, não uma ação pessoal
 * repetida — cobrar do primeiro a abrir uma região nova seria injusto.
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
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
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
              <LinhaCota
                label="Gerações de IA"
                uso={linha.geracoesIA}
                prefixo="geracoesIA"
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

/** Mensagem de erro com o `code` da API — mesmo padrão de mensagemErroMetas. */
function mensagemErroFila(error: unknown, fallback: string): string {
  return error instanceof ApiError ? `${fallback} (${error.code}): ${error.message}` : fallback;
}

const FILA_CAMPOS_NUMERO: Array<{
  campo: keyof Pick<
    FilaConfig,
    "metaDiaria" | "tetoPorHora" | "intervaloMinimoSegundos" | "inicioDiaOperacionalHora"
  >;
  label: string;
  max?: number;
  sufixo?: string;
}> = [
  { campo: "metaDiaria", label: "Meta diária" },
  { campo: "tetoPorHora", label: "Teto por hora" },
  { campo: "intervaloMinimoSegundos", label: "Intervalo mínimo", sufixo: "s" },
  { campo: "inicioDiaOperacionalHora", label: "Início do dia operacional", max: 23, sufixo: "h" },
];

/**
 * Painel "Fila de envio" (admin): estado e tetos que o celular (MacroDroid)
 * consulta antes de puxar o próximo lead — ver "Fila de envio" no
 * ARCHITECTURE.md. Mesmo padrão de MetasUsuariosSection acima (seção
 * autocontida: busca e salva sozinha, cada campo no seu próprio blur/clique
 * — sem botão "salvar" geral). `ativo` é o botão de pausa: o rótulo mostra
 * o estado atual sem precisar clicar, e o clique já aplica (sem confirmação
 * — pausar/retomar a fila é reversível na hora).
 */
function FilaEnvioSection() {
  const [config, setConfig] = useState<FilaConfig | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  // Sobe a cada config salva: o funil e as listas abaixo dependem dela
  // (exigirJanelaBoa e nichosPermitidos mudam quem é elegível AGORA).
  const [versaoConfig, setVersaoConfig] = useState(0);
  // Os leads que a visão já carregou, emprestados ao disparo de teste como
  // atalho de escolha de alvo. Vêm de lá em vez de uma segunda chamada: o
  // funil e as listas saem da MESMA `ordenarCandidatos`, e recalculá-las
  // aqui seriam duas respostas capazes de discordar entre si.
  const [leadsDaVisao, setLeadsDaVisao] = useState<LinhaFilaPainel[]>([]);

  useEffect(() => {
    let ignore = false;
    api
      .getFilaConfig()
      .then(({ fila }) => {
        if (!ignore) setConfig(fila);
      })
      .catch((error) => {
        if (ignore) return;
        setErro(
          error instanceof ApiError && error.status === 403
            ? "Fila de envio é restrita ao admin."
            : mensagemErroFila(error, "Falha ao carregar a fila"),
        );
      });
    return () => {
      ignore = true;
    };
  }, []);

  async function salvar(patch: Partial<FilaConfig>, chave: string) {
    setOcupado(chave);
    setErro(null);
    try {
      const { fila } = await api.putFilaConfig(patch);
      setConfig(fila);
      setVersaoConfig((n) => n + 1);
    } catch (error) {
      setErro(mensagemErroFila(error, "Falha ao salvar"));
    } finally {
      setOcupado(null);
    }
  }

  if (erro && config === null) {
    return (
      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Fila de envio
        </h2>
        <p className="mt-2 text-sm text-ink-muted">{erro}</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Fila de envio
        </h2>
        {config && (
          <button
            type="button"
            onClick={() => salvar({ ativo: !config.ativo }, "ativo")}
            disabled={ocupado === "ativo"}
            title={
              config.ativo
                ? "Pausar a fila — o celular para de receber leads novos"
                : "Retomar a fila"
            }
            className={`rounded px-2 py-1 text-xs font-semibold disabled:opacity-50 ${
              config.ativo ? "bg-good/15 text-good" : "bg-critical/15 text-critical"
            }`}
          >
            {config.ativo ? "Ativa ✓" : "Pausada ⏸"}
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-ink-muted">
        Estado e tetos que o celular consulta antes de puxar o próximo lead. Com a fila pausada,
        nenhum envio sai.
      </p>

      {config === null && !erro && (
        <SkeletonRows count={1} className="mt-3 h-32 rounded border border-line" />
      )}

      {config && (
        <div className="mt-3 flex flex-col gap-2">
          {FILA_CAMPOS_NUMERO.map(({ campo, label, max, sufixo }) => (
            <div key={campo} className="flex items-center gap-2 text-xs text-ink-secondary">
              <span className="w-48 shrink-0">{label}</span>
              <FilaNumeroInput
                valor={config[campo]}
                max={max}
                disabled={ocupado === campo}
                onSalvar={(valor) => salvar({ [campo]: valor }, campo)}
              />
              {sufixo && <span className="text-ink-muted">{sufixo}</span>}
            </div>
          ))}

          <div className="flex items-center gap-2 text-xs text-ink-secondary">
            <span className="w-48 shrink-0">Exigir janela boa</span>
            <button
              type="button"
              onClick={() => salvar({ exigirJanelaBoa: !config.exigirJanelaBoa }, "exigirJanelaBoa")}
              disabled={ocupado === "exigirJanelaBoa"}
              aria-pressed={config.exigirJanelaBoa}
              className={`rounded border px-2 py-1 text-xs disabled:opacity-50 ${
                config.exigirJanelaBoa
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-line bg-surface-2 text-ink-muted"
              }`}
            >
              {config.exigirJanelaBoa ? "sim" : "não"}
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-ink-secondary">
            <span className="w-48 shrink-0">Nichos permitidos</span>
            <FilaNichosInput
              valor={config.nichosPermitidos}
              disabled={ocupado === "nichosPermitidos"}
              onSalvar={(valor) => salvar({ nichosPermitidos: valor }, "nichosPermitidos")}
            />
          </div>
          <p className="text-xs text-ink-muted">Vazio = todos os nichos.</p>

          <div className="flex items-center gap-2 text-xs text-ink-secondary">
            <span className="w-48 shrink-0">Número do teste</span>
            <FilaNumeroTesteInput
              valor={config.numeroTeste}
              disabled={ocupado === "numeroTeste"}
              onSalvar={(valor) => salvar({ numeroTeste: valor }, "numeroTeste")}
            />
          </div>
          <p className="text-xs text-ink-muted">
            Destino de TODO disparo de teste — nunca o telefone do lead. Dígitos com DDI; vazio
            desliga o disparo.
          </p>
        </div>
      )}

      <VisaoFila versao={versaoConfig} onLeads={setLeadsDaVisao} />
      <DisparoTeste versao={versaoConfig} leadsDaVisao={leadsDaVisao} />
      <PrintPendenteLista />

      {erro && <p className="mt-2 text-sm text-critical">{erro}</p>}
    </section>
  );
}

/**
 * Rótulo de cada portão de ritmo — o motivo pelo qual NINGUÉM sai agora,
 * seja qual for o lead. Mesma ordem e mesmos nomes de `MOTIVOS_SEM_TAREFA`
 * (lib/fila/selecao.ts); o `?? motivo` na tela é a rede para um motivo novo
 * aparecer cru em vez de sumir.
 */
const RITMO_LABEL: Record<string, string> = {
  pausado: "a fila está pausada",
  meta_atingida: "a meta do dia já foi atingida",
  teto_hora: "o teto por hora foi atingido",
  intervalo: "ainda não passou o intervalo mínimo entre envios",
};

/**
 * As sete peneiras ESTRUTURAIS na ordem real de avaliação (`motivoEstrutural`,
 * lib/fila/candidatos.ts) — um lead que falha em várias conta só na
 * primeira, então a ordem é o que torna a coluna de números legível.
 */
const FUNIL_ESTRUTURAL: Array<{ chave: string; label: string }> = [
  { chave: "status", label: "já não está em “novo”" },
  { chave: "descartado", label: "descartado à mão" },
  { chave: "telefoneInvalido", label: "número sem WhatsApp" },
  { chave: "semTelefone", label: "sem telefone" },
  { chave: "semDemo", label: "sem demo" },
  { chave: "capturaNaoPronta", label: "print da demo não pronto" },
  { chave: "semFuso", label: "sem fuso conhecido" },
];

/** Uma linha do funil: rótulo à esquerda, quantos pararam ali à direita. */
function LinhaFunil({ label, valor }: { label: string; valor: number }) {
  return (
    <li className="flex items-baseline justify-between gap-2">
      <span className={valor > 0 ? "text-ink-secondary" : "text-ink-muted"}>{label}</span>
      <span
        className={`shrink-0 font-mono ${valor > 0 ? "text-foreground" : "text-ink-muted"}`}
      >
        {formatInt(valor)}
      </span>
    </li>
  );
}

/** Selo do nível da janela — mesmas cores da barra do dia. `null` = fechado. */
function SeloNivel({ nivel }: { nivel: NivelContato | null }) {
  if (nivel === null) {
    return (
      <span className="rounded border border-line bg-surface-2 px-1 text-[10px] text-ink-muted">
        fechado
      </span>
    );
  }
  return (
    <span className={`rounded border px-1 text-[10px] ${NIVEL_CLS[nivel]}`}>
      {NIVEL_LABEL[nivel]}
    </span>
  );
}

/**
 * Uma linha de lead nas listas da visão. A ÚNICA ação é "tirar da fila", e
 * ela é o `descartar` que já existe (`PATCH /api/leads/{id}`) — o mesmo do
 * card e da ficha, já reversível por lá, e que já exclui o lead do pool na
 * próxima reconstrução. Nada de campo novo, e nada de `telefoneInvalido`,
 * que quer dizer outra coisa (o número não tem WhatsApp).
 */
function LinhaLeadFila({
  linha,
  ocupado,
  onTirar,
  esperando = false,
}: {
  linha: LinhaFilaPainel;
  ocupado: boolean;
  onTirar: () => void;
  /** Linha da lista de BLOQUEADOS: é ela que fala da próxima faixa aceita. */
  esperando?: boolean;
}) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-2 rounded border border-line p-2">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <a
            href={`/leads/${linha.leadId}`}
            className="text-xs text-foreground underline decoration-line underline-offset-2"
          >
            {linha.nome || linha.leadId}
          </a>
          {linha.nicho && <span className="text-[10px] text-ink-muted">{linha.nicho}</span>}
          <SeloNivel nivel={linha.nivel} />
        </div>
        <p className="mt-0.5 text-[10px] text-ink-muted">
          {linha.horaLocal} na hora do lead
          {/* A PRÓXIMA FAIXA ACEITA, não o "próximo bom": com
              `exigirJanelaBoa` desmarcado, o razoável vale e vem antes.
              Sem nenhuma em 7 dias, dizer isso é melhor do que calar — calado
              pareceria que o lead entra a qualquer hora. */}
          {esperando &&
            (linha.proximaFaixa
              ? ` · entra ${linha.proximaFaixa.rotuloDia} ${linha.proximaFaixa.hora}`
              : " · sem faixa aceita nos próximos 7 dias")}
        </p>
      </div>
      <button
        type="button"
        onClick={onTirar}
        disabled={ocupado}
        title="Descarta o lead: sai da fila de envio. É o mesmo descarte do card, reversível na ficha."
        className="shrink-0 rounded border border-line bg-surface-2 px-2 py-1 text-xs text-ink-muted hover:border-critical/60 hover:text-critical disabled:opacity-50"
      >
        tirar da fila
      </button>
    </li>
  );
}

/**
 * A VISÃO da fila — o que vai acontecer, quando, com quem, e por que os
 * demais não entram. Subordinada ao painel "Fila de envio" (mesma seção,
 * separada por um filete), como a lista de print pendente.
 *
 * É LEITURA mais uma ação pontual: nada aqui dispara envio. Quem entrega é
 * o celular, quando pedir a próxima tarefa — esta tela só mostra o que ele
 * vai encontrar quando pedir.
 *
 * `versao` sobe a cada config salva no painel acima: mexer em
 * `exigirJanelaBoa` ou nos nichos muda o funil inteiro, e um funil que não
 * reage à edição ao lado dele seria um número defasado lido como se fosse
 * agora — exatamente o que esta tela existe para não fazer.
 */
function VisaoFila({
  versao,
  onLeads,
}: {
  versao: number;
  /** Empresta ao disparo de teste os leads já carregados — sem outra chamada. */
  onLeads: (linhas: LinhaFilaPainel[]) => void;
}) {
  const [dados, setDados] = useState<FilaDiagnosticoResponse | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);
  // Instante FIXO do carregamento — nunca Date.now() no render.
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    let ignore = false;
    api
      .getFilaDiagnostico()
      .then((resposta) => {
        if (ignore) return;
        setDados(resposta);
        setAgora(Date.now());
        onLeads([...resposta.proximos, ...resposta.bloqueados]);
      })
      .catch((error) => {
        if (ignore) return;
        setErro(
          error instanceof ApiError && error.status === 403
            ? "A visão da fila é restrita ao admin."
            : mensagemErroFila(error, "Falha ao carregar a visão da fila"),
        );
      });
    return () => {
      ignore = true;
    };
    // `onLeads` é o setState do pai (identidade estável): entra na lista por
    // exigência do lint, sem recarregar nada a mais.
  }, [versao, recarga, onLeads]);

  async function tirarDaFila(leadId: string) {
    setOcupado(leadId);
    setErro(null);
    try {
      await api.patchLead(leadId, { descartado: true });
      // Relê: quem decide se o lead sumiu da lista é o servidor, que
      // reconfere cada linha contra o doc fresco do lead.
      setRecarga((n) => n + 1);
    } catch (error) {
      setErro(mensagemErroFila(error, "Falha ao tirar da fila"));
    } finally {
      setOcupado(null);
    }
  }

  const motivoRitmo = dados?.ritmo ? (RITMO_LABEL[dados.ritmo] ?? dados.ritmo) : null;

  return (
    <div className="mt-4 border-t border-line pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-medium text-ink-secondary">O que vai acontecer</h3>
        <button
          type="button"
          onClick={() => setRecarga((n) => n + 1)}
          className="rounded px-1.5 py-0.5 text-xs text-ink-muted hover:text-foreground"
        >
          atualizar
        </button>
      </div>
      <p className="mt-1 text-xs text-ink-muted">
        Só leitura: nada aqui dispara envio. Quem entrega é o celular, quando pedir a próxima
        tarefa.
      </p>

      {dados === null && !erro && (
        <SkeletonRows count={1} className="mt-2 h-40 rounded border border-line" />
      )}

      {dados && (
        <>
          {/* ── Contador do dia ───────────────────────────────────────── */}
          <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs">
            <span>
              <span className="font-mono text-sm text-foreground">
                {formatInt(dados.contador.enviados)}
              </span>
              <span className="text-ink-muted"> de {formatInt(dados.contador.meta)} hoje</span>
            </span>
            <span className="text-ink-secondary">
              {dados.contador.restante === 0
                ? "meta cumprida"
                : `faltam ${formatInt(dados.contador.restante)}`}
            </span>
            <span className="text-ink-muted">
              {formatInt(dados.contador.ultimaHora)}/{formatInt(dados.contador.tetoPorHora)} na
              última hora
            </span>
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            O dia operacional vira às {dados.contador.inicioHora}h (
            {formatTempoAte(dados.contador.viraEm, agora)}) — é quando o contador zera.
          </p>

          {motivoRitmo ? (
            <p className="mt-2 rounded border border-warning/40 bg-warning/10 px-2 py-1 text-xs text-warning">
              Nada sai agora: {motivoRitmo}.
            </p>
          ) : (
            <p className="mt-2 text-xs text-good">
              Ritmo liberado — o próximo pedido do celular leva tarefa, se houver lead em janela.
            </p>
          )}

          {/* ── Funil ─────────────────────────────────────────────────── */}
          <h4 className="mt-3 text-xs font-medium text-ink-secondary">
            Por onde os leads param
          </h4>
          <p className="mt-1 text-[10px] text-ink-muted">
            {dados.pool.geradoEm ? (
              <>
                Retrato do pool de {formatDateTime(dados.pool.geradoEm)} (
                {formatTempoRelativo(dados.pool.geradoEm, agora)}), {formatInt(dados.pool.lidos)}{" "}
                leads lidos. Estas sete contagens só são apuráveis na varredura completa, então
                são desse instante — não de agora.
                {dados.pool.truncado && " A base passou do teto e o pool saiu cortado."}
              </>
            ) : (
              <>
                O pool ainda não foi construído — o celular não pediu tarefa nenhuma. As sete
                contagens abaixo ficam zeradas até a primeira chamada.
              </>
            )}
          </p>
          <ul className="mt-1 flex flex-col gap-0.5 text-xs">
            {FUNIL_ESTRUTURAL.map(({ chave, label }) => (
              <LinhaFunil key={chave} label={label} valor={dados.pool.estrutural[chave] ?? 0} />
            ))}
          </ul>

          <p className="mt-2 text-[10px] text-ink-muted">
            {/* Sem pool não há "esse mesmo pool" a que se referir — e a
                etapa continua sendo calculada agora, sobre nada. */}
            {dados.pool.geradoEm ? "Calculado agora, sobre esse mesmo pool:" : "Calculado agora:"}
          </p>
          <ul className="mt-1 flex flex-col gap-0.5 text-xs">
            <LinhaFunil label="fora dos nichos permitidos" valor={dados.nichoBarrado} />
            <LinhaFunil label="em hora razoável (não aceita agora)" valor={dados.janela.razoavel} />
            <LinhaFunil label="em hora ruim" valor={dados.janela.ruim} />
            <LinhaFunil label="fechado na hora do lead" valor={dados.janela.semNivel} />
          </ul>
          <p className="mt-1 flex items-baseline justify-between gap-2 border-t border-line pt-1 text-xs">
            <span className="text-foreground">elegíveis agora</span>
            <span className="shrink-0 font-mono text-foreground">{formatInt(dados.elegiveis)}</span>
          </p>

          {/* ── Próximos ──────────────────────────────────────────────── */}
          <h4 className="mt-3 text-xs font-medium text-ink-secondary">Próximos a receber</h4>
          {dados.proximos.length === 0 ? (
            <p className="mt-1 text-xs text-ink-muted">
              {motivoRitmo
                ? `Ninguém sai enquanto ${motivoRitmo}.`
                : "Nenhum lead elegível agora."}
            </p>
          ) : (
            <>
              {/* `data-lista` é o gancho do QA visual: o funil também usa
                  <li>, e "sobrou linha de lista" só pode olhar as de LEAD. */}
              <ul data-lista="proximos" className="mt-1 flex flex-col gap-1.5">
                {dados.proximos.map((linha) => (
                  <LinhaLeadFila
                    key={linha.leadId}
                    linha={linha}
                    ocupado={ocupado === linha.leadId}
                    onTirar={() => tirarDaFila(linha.leadId)}
                  />
                ))}
              </ul>
              {dados.elegiveis > dados.proximos.length && (
                <p className="mt-1 text-[10px] text-ink-muted">
                  e mais {formatInt(dados.elegiveis - dados.proximos.length)} na fila, nesta ordem.
                </p>
              )}
            </>
          )}

          {/* ── Bloqueados por janela ─────────────────────────────────── */}
          <h4 className="mt-3 text-xs font-medium text-ink-secondary">Bloqueados por janela</h4>
          {dados.bloqueados.length === 0 ? (
            <p className="mt-1 text-xs text-ink-muted">Ninguém parado na janela.</p>
          ) : (
            <>
              <ul data-lista="bloqueados" className="mt-1 flex flex-col gap-1.5">
                {dados.bloqueados.map((linha) => (
                  <LinhaLeadFila
                    key={linha.leadId}
                    linha={linha}
                    ocupado={ocupado === linha.leadId}
                    onTirar={() => tirarDaFila(linha.leadId)}
                    esperando
                  />
                ))}
              </ul>
              {totalJanela(dados) > dados.bloqueados.length && (
                <p className="mt-1 text-[10px] text-ink-muted">
                  e mais {formatInt(totalJanela(dados) - dados.bloqueados.length)} parados na
                  janela.
                </p>
              )}
            </>
          )}
        </>
      )}

      {erro && <p className="mt-2 text-xs text-critical">{erro}</p>}
    </div>
  );
}

/** Quantos pararam na janela ao todo — a soma dos três baldes do diagnóstico. */
function totalJanela(dados: FilaDiagnosticoResponse): number {
  return dados.janela.razoavel + dados.janela.ruim + dados.janela.semNivel;
}


/* ── Disparo de teste ──────────────────────────────────────────────────── */

/** Rótulo de cada etapa onde o disparo de teste pode parar. */
const ETAPA_TESTE_LABEL: Record<string, string> = {
  numero: "número do teste",
  ritmo: "ritmo",
  estruturais: "filtros estruturais",
  nicho: "nicho",
  janela: "janela de contato",
  conteudo: "o que enviar",
};

/**
 * O motivo DENTRO da etapa, em português. As chaves são os códigos que
 * `avaliarTeste` devolve (`MotivoSemTarefa`, `MotivoEstrutural`, o nível da
 * janela) — o `?? motivo` na tela é a rede para um código novo aparecer cru
 * em vez de sumir, mesmo padrão de `RITMO_LABEL`.
 */
const MOTIVO_TESTE_LABEL: Record<string, string> = {
  numero_teste_vazio: "o “Número do teste” acima está vazio — sem destino não há disparo",
  pausado: "a fila está pausada",
  meta_atingida: "a meta do dia já foi atingida",
  teto_hora: "o teto por hora foi atingido",
  intervalo: "ainda não passou o intervalo mínimo entre envios",
  status: "o lead já não está em “novo”",
  descartado: "o lead foi descartado à mão",
  telefoneInvalido: "o número do lead está marcado como sem WhatsApp",
  semTelefone: "o lead não tem telefone",
  semDemo: "o lead não tem demo",
  capturaNaoPronta: "o print da demo não está pronto",
  semFuso: "o lead não tem fuso conhecido",
  fora_dos_nichos: "o nicho do lead não está em “nichos permitidos”",
  sem_janela: "não dá para saber que horas são no lead (sem fuso)",
  fechado: "o lead está fechado neste minuto",
  razoavel: "a hora do lead é razoável, e a config só aceita “boa”",
  ruim: "a hora do lead está ruim agora",
  sem_demo: "sem demo, não há o que enviar",
  captura_nao_pronta: "a captura não está pronta: não há print para mandar",
  sem_print: "a captura não tem imagem de celular: não há print para mandar",
};

/** Rótulo curto de cada interruptor, na ordem real de avaliação. */
const ETAPA_PULAR_LABEL: Record<EtapaTeste, string> = {
  ritmo: "ritmo",
  estruturais: "estruturais",
  nicho: "nicho",
  janela: "janela",
};

const RESULTADO_TESTE_LABEL: Record<string, string> = {
  enviado: "enviado",
  invalido: "número inválido",
  falhou: "falhou",
};

/** Valor do seletor de alvo quando o operador vai digitar um id à mão. */
const ALVO_OUTRO = "__outro__";

/**
 * A linha de estado da tarefa atual — o que ela é AGORA, sem o operador
 * abrir log de aparelho. Pendente mostra o tempo restante; expirada diz
 * isso em vez de ficar eternamente "aguardando", que seria um estado que
 * mente.
 */
function estadoDoTeste(doc: FilaTesteDoc, agora: number): { texto: string; tom: string } {
  if (doc.estado === "pendente") {
    return new Date(doc.expiraEm).getTime() <= agora
      ? { texto: "Expirou sem o aparelho puxar.", tom: "text-ink-muted" }
      : {
          texto: `Aguardando o aparelho puxar — expira ${formatTempoAte(doc.expiraEm, agora)}.`,
          tom: "text-accent",
        };
  }
  if (doc.estado === "entregue") {
    return {
      texto: `O aparelho puxou ${formatTempoRelativo(doc.entregueEm ?? doc.criadoEm, agora)} — aguardando o confirmar.`,
      tom: "text-accent",
    };
  }
  const resultado = RESULTADO_TESTE_LABEL[doc.resultado ?? ""] ?? doc.resultado ?? "";
  return {
    texto:
      `Confirmado ${formatTempoRelativo(doc.confirmadoEm ?? doc.criadoEm, agora)}: ${resultado}` +
      (doc.detalhe ? ` — ${doc.detalhe}` : "."),
    tom: doc.resultado === "enviado" ? "text-good" : "text-warning",
  };
}

/**
 * O DISPARO DE TESTE — a única coisa nesta seção que faz o aparelho mandar
 * mensagem. Bloco subordinado ao painel "Fila de envio", como a visão e a
 * lista de pendência.
 *
 * **O operador ESCOLHE o lead**, com o fixo de teste pré-selecionado. Não é
 * "o próximo elegível" de propósito: aquele é justamente quem já passou por
 * todos os filtros, e testá-lo não ensina nada. Os interruptores existem
 * para rodar um lead ESPECÍFICO pelo pipeline e ver onde ele para — daí o
 * resultado dizer qual etapa barrou, nominalmente.
 *
 * O destino é sempre o "Número do teste" do painel acima, nunca o telefone
 * do lead: é a rede de segurança de quando o alvo escolhido é um negócio
 * real.
 */
function DisparoTeste({
  versao,
  leadsDaVisao,
}: {
  versao: number;
  leadsDaVisao: LinhaFilaPainel[];
}) {
  const [estado, setEstado] = useState<FilaTesteEstadoResponse | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const [agora, setAgora] = useState(() => Date.now());
  const [alvo, setAlvo] = useState("");
  const [outroId, setOutroId] = useState("");
  const [pular, setPular] = useState<EtapaTeste[]>([]);
  const [barreira, setBarreira] = useState<{ etapa: string; motivo: string; nome: string } | null>(
    null,
  );

  useEffect(() => {
    let ignore = false;
    api
      .getFilaTeste()
      .then((resposta) => {
        if (ignore) return;
        setEstado(resposta);
        setAgora(Date.now());
      })
      .catch((error) => {
        if (ignore) return;
        setErro(
          error instanceof ApiError && error.status === 403
            ? "O disparo de teste é restrito ao admin."
            : mensagemErroFila(error, "Falha ao carregar o disparo de teste"),
        );
      });
    return () => {
      ignore = true;
    };
  }, [versao, recarga]);

  async function disparar() {
    setOcupado(true);
    setErro(null);
    setBarreira(null);
    const leadId = alvo === ALVO_OUTRO ? outroId.trim() : alvo;
    try {
      const resposta = await api.postFilaTeste({
        ...(leadId && { leadId }),
        ...(pular.length > 0 && { pular }),
      });
      if (!resposta.injetada) {
        setBarreira({ etapa: resposta.etapa, motivo: resposta.motivo, nome: resposta.nome });
      }
      setRecarga((n) => n + 1);
    } catch (error) {
      setErro(mensagemErroFila(error, "Falha ao disparar o teste"));
    } finally {
      setOcupado(false);
    }
  }

  function alternarEtapa(etapa: EtapaTeste) {
    setPular((atual) =>
      atual.includes(etapa) ? atual.filter((e) => e !== etapa) : [...atual, etapa],
    );
  }

  const fixo = estado?.leadDeTeste;
  const linha = estado?.atual ? estadoDoTeste(estado.atual, agora) : null;

  return (
    <div className="mt-4 border-t border-line pt-3">
      <h3 className="text-xs font-medium text-ink-secondary">Disparo de teste</h3>
      <p className="mt-1 text-xs text-ink-muted">
        Injeta UMA tarefa na fila. O aparelho a recebe na próxima vez que pedir trabalho — e ele
        pergunta a cada ~3 minutos, então pode levar até isso para sair. Clicar de novo não
        acelera: substitui a tarefa que está esperando.
      </p>

      {estado === null && !erro && (
        <SkeletonRows count={1} className="mt-2 h-24 rounded border border-line" />
      )}

      {estado && (
        <>
          <p className="mt-2 text-xs text-ink-secondary">
            Destino:{" "}
            {estado.numeroTeste ? (
              <span className="font-mono text-foreground">{estado.numeroTeste}</span>
            ) : (
              <span className="text-critical">não configurado</span>
            )}{" "}
            <span className="text-ink-muted">— nunca o telefone do lead.</span>
          </p>

          {/* ── Alvo ──────────────────────────────────────────────────── */}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-secondary">
            <span className="w-20 shrink-0">Lead alvo</span>
            <select
              value={alvo}
              onChange={(event) => setAlvo(event.target.value)}
              className="min-w-0 flex-1 rounded border border-line bg-surface-2 px-2 py-1 text-xs text-foreground outline-none focus:border-accent"
            >
              <option value="">
                {fixo?.nome ?? "lead fixo de teste"} (fixo de teste)
                {fixo && !fixo.pronto ? " — sem print" : ""}
              </option>
              {leadsDaVisao.map((lead) => (
                <option key={lead.leadId} value={lead.leadId}>
                  {lead.nome}
                </option>
              ))}
              <option value={ALVO_OUTRO}>outro lead (por id)…</option>
            </select>
          </div>
          {alvo === ALVO_OUTRO && (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-secondary">
              <span className="w-20 shrink-0" />
              <input
                value={outroId}
                placeholder="placeId do lead"
                onChange={(event) => setOutroId(event.target.value)}
                className="min-w-0 flex-1 rounded border border-line bg-surface-2 px-2 py-1 font-mono text-xs text-foreground outline-none focus:border-accent"
              />
            </div>
          )}
          {fixo && !fixo.pronto && (
            <p className="mt-1 text-[10px] text-warning">
              O lead fixo de teste ainda não tem print:{" "}
              <a
                href={`/leads/${fixo.leadId}`}
                className="underline decoration-line underline-offset-2"
              >
                abra a ficha dele
              </a>{" "}
              e gere as capturas uma vez — depois disso elas não expiram.
            </p>
          )}

          {/* ── Interruptores, na ordem real de avaliação ──────────────── */}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-secondary">
            <span className="w-20 shrink-0">Pular</span>
            {ETAPAS_TESTE.map((etapa) => (
              <button
                key={etapa}
                type="button"
                onClick={() => alternarEtapa(etapa)}
                aria-pressed={pular.includes(etapa)}
                className={`rounded border px-2 py-1 text-xs ${
                  pular.includes(etapa)
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-line bg-surface-2 text-ink-muted"
                }`}
              >
                {ETAPA_PULAR_LABEL[etapa]}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[10px] text-ink-muted">
            Na ordem em que a seleção avalia. Ligado = a etapa não barra este disparo. Mesmo com
            tudo ligado, sem demo, sem captura pronta ou sem print a tarefa não é injetada — tarefa
            sem print quebra o ciclo no aparelho sem ensinar nada.
          </p>

          <button
            type="button"
            onClick={disparar}
            disabled={ocupado}
            className="mt-2 rounded border border-accent bg-accent/15 px-2 py-1 text-xs font-semibold text-accent disabled:opacity-50"
          >
            {ocupado ? "disparando…" : "Disparar teste"}
          </button>

          {/* ── O resultado do último clique ───────────────────────────── */}
          {barreira && (
            <p className="mt-2 rounded border border-warning/40 bg-warning/10 px-2 py-1 text-xs text-warning">
              Não injetou — {barreira.nome} parou em{" "}
              <strong>{ETAPA_TESTE_LABEL[barreira.etapa] ?? barreira.etapa}</strong>:{" "}
              {MOTIVO_TESTE_LABEL[barreira.motivo] ?? barreira.motivo}.
            </p>
          )}

          {/* ── A tarefa atual ─────────────────────────────────────────── */}
          {linha && estado.atual ? (
            <div className="mt-2 rounded border border-line p-2">
              <p className={`text-xs ${linha.tom}`}>{linha.texto}</p>
              <p className="mt-0.5 text-[10px] text-ink-muted">
                {estado.atual.nome} · para{" "}
                <span className="font-mono">{estado.atual.numero}</span> · disparada em{" "}
                {formatDateTime(estado.atual.criadoEm)}
                {estado.atual.pulou.length > 0 &&
                  ` · pulou ${estado.atual.pulou.map((e) => ETAPA_PULAR_LABEL[e]).join(", ")}`}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-xs text-ink-muted">Nenhum teste disparado ainda.</p>
          )}
        </>
      )}

      {erro && <p className="mt-2 text-xs text-critical">{erro}</p>}
    </div>
  );
}


/**
 * Lista de pendência de PRINT, subordinada ao painel "Fila de envio".
 *
 * Quando o texto da prospecção sai e o anexo falha, o celular reporta
 * "enviado" com o detalhe preenchido (ver `detalheEnvio` em
 * lib/fila/estado.ts) — reportar falha devolveria o lead à fila e mandaria
 * a mesma mensagem duas vezes. O preço são leads contactados sem a peça que
 * vende, e esta lista é o único lugar onde eles aparecem.
 *
 * É lista de trabalho MANUAL: o operador abre a conversa e anexa o print à
 * mão, depois marca "resolvido". Sem ação em massa e sem botão de reenvio —
 * reenviar produziria justamente a mensagem duplicada que a escolha de
 * reportar "enviado" existe para evitar.
 */
function PrintPendenteLista() {
  const [linhas, setLinhas] = useState<PendenciaEnvio[] | null>(null);
  const [verResolvidas, setVerResolvidas] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    // Sem zerar a lista aqui: trocar de visão troca as linhas no lugar, sem
    // piscar esqueleto. `null` é só o primeiro carregamento.
    api
      .getFilaPendencias(verResolvidas)
      .then(({ pendencias }) => {
        if (!ignore) setLinhas(pendencias);
      })
      .catch((error) => {
        if (ignore) return;
        setLinhas([]);
        setErro(mensagemErroFila(error, "Falha ao carregar as pendências"));
      });
    return () => {
      ignore = true;
    };
  }, [verResolvidas]);

  async function alternar(leadId: string, resolvido: boolean) {
    setOcupado(leadId);
    setErro(null);
    try {
      await api.patchFilaPendencia(leadId, resolvido);
      // Relê em vez de remendar a lista local: marcar resolvido TIRA a linha
      // da visão padrão, e é a resposta do servidor que decide isso.
      const { pendencias } = await api.getFilaPendencias(verResolvidas);
      setLinhas(pendencias);
    } catch (error) {
      setErro(mensagemErroFila(error, "Falha ao salvar"));
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="mt-4 border-t border-line pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-medium text-ink-secondary">Print pendente</h3>
        <button
          type="button"
          onClick={() => setVerResolvidas(!verResolvidas)}
          aria-pressed={verResolvidas}
          className="rounded px-1.5 py-0.5 text-xs text-ink-muted hover:text-foreground"
        >
          {verResolvidas ? "ver só as abertas" : "ver resolvidas"}
        </button>
      </div>
      <p className="mt-1 text-xs text-ink-muted">
        O texto saiu, o print não foi anexado.
        {/* A instrução só aparece quando há o que fazer: com a lista vazia,
            mandar abrir a conversa é instrução para uma tarefa que não existe. */}
        {linhas !== null && linhas.length > 0 && " Abra a conversa e mande a imagem à mão."}
      </p>

      {linhas === null && <SkeletonRows count={1} className="mt-2 h-14 rounded border border-line" />}

      {linhas?.length === 0 && !erro && (
        // Estado vazio de UMA linha: nada de caixa vazia ocupando o painel.
        // `!erro` porque falhar ao carregar não é "não há pendência": dizer
        // isso quando a lista nem chegou esconderia justamente o que ela
        // existe para mostrar.
        <p className="mt-2 text-xs text-ink-muted">
          {verResolvidas ? "Nenhuma pendência resolvida." : "Nenhuma pendência."}
        </p>
      )}

      {linhas && linhas.length > 0 && (
        <ul data-lista="pendencias" className="mt-2 flex flex-col gap-1.5">
          {linhas.map((linha) => (
            <li
              key={linha.leadId}
              className="flex flex-wrap items-start justify-between gap-2 rounded border border-line p-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <a
                    href={`/leads/${linha.leadId}`}
                    className="text-xs text-foreground underline decoration-line underline-offset-2"
                  >
                    {linha.nome || linha.leadId}
                  </a>
                  {linha.enviadoEm && (
                    <span className="text-[10px] text-ink-muted">
                      {formatDateTime(linha.enviadoEm)}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 font-mono text-[10px] text-ink-muted">{linha.leadId}</p>
                <p className="mt-1 text-xs text-ink-secondary">{linha.detalhe}</p>
              </div>
              <button
                type="button"
                onClick={() => alternar(linha.leadId, !linha.resolvido)}
                disabled={ocupado === linha.leadId}
                aria-pressed={linha.resolvido}
                title={
                  linha.resolvido
                    ? "Reabrir — volta para a lista de pendências"
                    : "Marcar como resolvido — o print já foi anexado à mão"
                }
                className={`shrink-0 rounded border px-2 py-1 text-xs disabled:opacity-50 ${
                  linha.resolvido
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-line bg-surface-2 text-ink-muted"
                }`}
              >
                {linha.resolvido ? "✓ resolvido" : "resolvido"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {erro && <p className="mt-2 text-xs text-critical">{erro}</p>}
    </div>
  );
}

/** Inteiro ≥ 0 (e ≤ `max`, quando informado). Salva no blur, como LimiteInput. */
function FilaNumeroInput({
  valor,
  max,
  disabled,
  onSalvar,
}: {
  valor: number;
  max?: number;
  disabled: boolean;
  onSalvar: (valor: number) => void;
}) {
  const [texto, setTexto] = useState(String(valor));
  const [ultimoValor, setUltimoValor] = useState(valor);
  if (valor !== ultimoValor) {
    setUltimoValor(valor);
    setTexto(String(valor));
  }

  function commit() {
    const n = Number(texto.trim());
    if (
      !Number.isFinite(n) ||
      !Number.isInteger(n) ||
      n < 0 ||
      (max !== undefined && n > max)
    ) {
      setTexto(String(valor)); // inválido: reverte
      return;
    }
    if (n !== valor) onSalvar(n);
  }

  return (
    <input
      type="number"
      min={0}
      max={max}
      step={1}
      inputMode="numeric"
      value={texto}
      disabled={disabled}
      onChange={(event) => setTexto(event.target.value)}
      onBlur={commit}
      className="w-20 rounded border border-line bg-surface-2 px-2 py-1 text-center font-mono text-xs text-foreground outline-none focus:border-accent disabled:opacity-50"
    />
  );
}

/**
 * O número de destino do disparo de teste. Dígitos com DDI, vazio = disparo
 * desligado. Reverte o que não for dígito em vez de mandar ao servidor: a
 * validação de verdade está lá (`validateFilaConfigPatch`), mas o WhatsApp
 * do celular não resolve parêntese nem traço, e é melhor o campo dizer isso
 * na hora do que a mensagem falhar de madrugada.
 */
function FilaNumeroTesteInput({
  valor,
  disabled,
  onSalvar,
}: {
  valor: string;
  disabled: boolean;
  onSalvar: (valor: string) => void;
}) {
  const [texto, setTexto] = useState(valor);
  const [ultimoValor, setUltimoValor] = useState(valor);
  if (valor !== ultimoValor) {
    setUltimoValor(valor);
    setTexto(valor);
  }

  function commit() {
    const limpo = texto.trim();
    if (limpo !== "" && !/^\d{10,15}$/.test(limpo)) {
      setTexto(valor); // inválido: reverte
      return;
    }
    if (limpo !== valor) onSalvar(limpo);
    else setTexto(valor);
  }

  return (
    <input
      inputMode="numeric"
      value={texto}
      placeholder="desligado"
      disabled={disabled}
      onChange={(event) => setTexto(event.target.value)}
      onBlur={commit}
      className="min-w-0 flex-1 rounded border border-line bg-surface-2 px-2 py-1 font-mono text-xs text-foreground outline-none focus:border-accent disabled:opacity-50"
    />
  );
}

/** Lista livre separada por vírgula. Vazio = nenhum nicho digitado = todos liberados. */
function FilaNichosInput({
  valor,
  disabled,
  onSalvar,
}: {
  valor: string[];
  disabled: boolean;
  onSalvar: (valor: string[]) => void;
}) {
  const [texto, setTexto] = useState(valor.join(", "));
  const [ultimoValor, setUltimoValor] = useState(valor);
  if (valor !== ultimoValor) {
    setUltimoValor(valor);
    setTexto(valor.join(", "));
  }

  function commit() {
    const lista = texto
      .split(",")
      .map((n) => n.trim())
      .filter((n) => n.length > 0);
    if (JSON.stringify(lista) !== JSON.stringify(valor)) onSalvar(lista);
    else setTexto(lista.join(", ")); // normaliza espaçamento sem round-trip
  }

  return (
    <input
      value={texto}
      placeholder="todos"
      disabled={disabled}
      onChange={(event) => setTexto(event.target.value)}
      onBlur={commit}
      className="min-w-0 flex-1 rounded border border-line bg-surface-2 px-2 py-1 text-xs text-foreground outline-none focus:border-accent disabled:opacity-50"
    />
  );
}

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
function FrasesSection() {
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

  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        Frases de prospecção por skin
      </h2>
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
    </section>
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
  prefixo: "buscas" | "enriquecimentos" | "geracoesIA";
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

interface PaisRow {
  id: string;
  codigo: string;
  nome: string;
  /** Fuso em HORAS (o que se digita); vira minutos no patch. */
  horas: string;
  /** Idiomas separados por vírgula. */
  idiomas: string;
  indice: string;
}

/**
 * Editor da lista de países da tela Mundo. Como `PresetsEditor` e
 * `MultiplicadoresNichoEditor`: as linhas são rascunho local (dá pra
 * esvaziar um campo enquanto se digita) e o que sobe pro `form` é só o que
 * está completo. Linha incompleta não vira país meio pronto no doc — some
 * do patch até ficar preenchida, e a validação do servidor continua sendo
 * a palavra final.
 */
function PaisesProspeccaoEditor({
  value,
  onChange,
}: {
  value: PaisProspeccao[];
  onChange: (value: PaisProspeccao[]) => void;
}) {
  const [linhas, setLinhas] = useState<PaisRow[]>(() =>
    value.map((pais) => ({
      id: crypto.randomUUID(),
      codigo: pais.codigo,
      nome: pais.nome,
      horas: String(pais.utcOffsetMinutos / 60),
      idiomas: pais.idiomas.join(", "),
      indice: String(pais.indice),
    })),
  );

  function propagar(novas: PaisRow[]) {
    setLinhas(novas);
    onChange(
      novas
        .map((linha) => ({
          codigo: linha.codigo.trim().toUpperCase(),
          nome: linha.nome.trim(),
          utcOffsetMinutos: Math.round(Number(linha.horas) * 60),
          idiomas: linha.idiomas
            .split(",")
            .map((idioma) => idioma.trim())
            .filter(Boolean),
          indice: Number(linha.indice),
        }))
        .filter(
          (pais) =>
            pais.codigo.length === 2 &&
            pais.nome !== "" &&
            Number.isFinite(pais.utcOffsetMinutos) &&
            pais.idiomas.length > 0 &&
            Number.isFinite(pais.indice) &&
            pais.indice > 0,
        ),
    );
  }

  function atualizar(id: string, campo: keyof Omit<PaisRow, "id">, valor: string) {
    propagar(linhas.map((l) => (l.id === id ? { ...l, [campo]: valor } : l)));
  }

  return (
    <div className="mt-3 flex flex-col gap-3">
      {linhas.map((linha) => (
        <div key={linha.id} className="rounded border border-line bg-surface-2 p-2">
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-lg leading-none" aria-hidden="true">
              {linha.codigo.trim().length === 2 ? bandeiraDoPais(linha.codigo) : "🏳"}
            </span>
            <input
              value={linha.nome}
              onChange={(e) => atualizar(linha.id, "nome", e.target.value)}
              placeholder="País em português (ex.: Portugal)"
              aria-label="Nome do país"
              className={`${INPUT_CLS} min-w-0 flex-1`}
            />
            <button
              type="button"
              onClick={() => propagar(linhas.filter((l) => l.id !== linha.id))}
              className="shrink-0 text-xs text-critical hover:underline"
            >
              Remover
            </button>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-ink-muted">ISO</span>
              <input
                value={linha.codigo}
                onChange={(e) => atualizar(linha.id, "codigo", e.target.value)}
                maxLength={2}
                placeholder="PT"
                className={INPUT_CLS}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-ink-muted">UTC (h)</span>
              <input
                type="number"
                step={0.5}
                min={-12}
                max={14}
                value={linha.horas}
                onChange={(e) => atualizar(linha.id, "horas", e.target.value)}
                className={INPUT_CLS}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-ink-muted">Índice</span>
              <input
                type="number"
                step={0.1}
                min={0.1}
                value={linha.indice}
                onChange={(e) => atualizar(linha.id, "indice", e.target.value)}
                className={INPUT_CLS}
              />
            </label>
          </div>
          <label className="mt-2 flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-ink-muted">
              Idiomas (o primeiro manda na ordem)
            </span>
            <input
              value={linha.idiomas}
              onChange={(e) => atualizar(linha.id, "idiomas", e.target.value)}
              placeholder="pt-PT, es-ES"
              className={INPUT_CLS}
            />
          </label>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          propagar([
            ...linhas,
            { id: crypto.randomUUID(), codigo: "", nome: "", horas: "0", idiomas: "", indice: "1" },
          ])
        }
        className="self-start text-xs font-medium text-accent hover:underline"
      >
        + Adicionar país
      </button>
    </div>
  );
}

// Segunda primeiro (semana de trabalho), domingo por último — mesma ordem
// de leitura de `resumirHorarios` (lib/leads/horarios.ts).
const DIAS_SEMANA_ORDEM: Array<{ dia: number; abrev: string }> = [
  { dia: 1, abrev: "SEG" },
  { dia: 2, abrev: "TER" },
  { dia: 3, abrev: "QUA" },
  { dia: 4, abrev: "QUI" },
  { dia: 5, abrev: "SEX" },
  { dia: 6, abrev: "SÁB" },
  { dia: 0, abrev: "DOM" },
];


/** Dias úteis que o botão "aplicar a seg–qui" preenche de uma vez. */
const DIAS_UTEIS = [1, 2, 3, 4];

const NIVEL_LABEL: Record<NivelContato, string> = {
  bom: "bom",
  razoavel: "razoável",
  ruim: "ruim",
};

/**
 * Cor + preenchimento por nível, o mesmo par usado na barra do dia da ficha
 * (`components/BarraDoDia.tsx`) — quem edita aqui vê a mesma linguagem que
 * vai aparecer lá.
 */
const NIVEL_CLS: Record<NivelContato, string> = {
  bom: "border-good/60 bg-good/20 text-good",
  razoavel: "border-warning/60 bg-warning/20 text-warning",
  ruim: "border-critical/60 bg-critical/20 text-critical",
};

/** "9h30" ↔ "09:30" — HoraMinuto guarda hora/minuto separados; <input type="time"> quer "HH:MM". */
function horaMinutoParaInputTime(valor: HoraMinuto): string {
  return `${String(valor.hora).padStart(2, "0")}:${String(valor.minuto).padStart(2, "0")}`;
}

function inputTimeParaHoraMinuto(valor: string): HoraMinuto | null {
  const [horaTexto, minutoTexto] = valor.split(":");
  const hora = Number(horaTexto);
  const minuto = Number(minutoTexto);
  if (!Number.isInteger(hora) || !Number.isInteger(minuto)) return null;
  return { hora, minuto };
}

function ordenarFaixas(faixas: FaixaNivelContato[]): FaixaNivelContato[] {
  return [...faixas].sort(
    (a, b) => a.inicio.hora * 60 + a.inicio.minuto - (b.inicio.hora * 60 + b.inicio.minuto),
  );
}

/** Uma faixa do dia: início, fim e o nível em três botões (sem select). */
function FaixaNivelEditor({
  faixa,
  onChange,
  onRemover,
}: {
  faixa: FaixaNivelContato;
  onChange: (faixa: FaixaNivelContato) => void;
  onRemover: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="time"
        aria-label="início"
        value={horaMinutoParaInputTime(faixa.inicio)}
        onChange={(e) => {
          const novo = inputTimeParaHoraMinuto(e.target.value);
          if (novo) onChange({ ...faixa, inicio: novo });
        }}
        className="rounded border border-line bg-surface-2 px-2 py-1.5 text-sm text-foreground outline-none focus:border-accent"
      />
      <span className="text-xs text-ink-muted">até</span>
      <input
        type="time"
        aria-label="fim"
        value={horaMinutoParaInputTime(faixa.fim)}
        onChange={(e) => {
          const novo = inputTimeParaHoraMinuto(e.target.value);
          if (novo) onChange({ ...faixa, fim: novo });
        }}
        className="rounded border border-line bg-surface-2 px-2 py-1.5 text-sm text-foreground outline-none focus:border-accent"
      />
      <div className="flex gap-1">
        {NIVEIS_CONTATO.map((nivel) => (
          <button
            key={nivel}
            type="button"
            aria-pressed={faixa.nivel === nivel}
            onClick={() => onChange({ ...faixa, nivel })}
            className={`rounded border px-2 py-1 text-[11px] font-medium ${
              faixa.nivel === nivel
                ? NIVEL_CLS[nivel]
                : "border-line bg-surface-2 text-ink-muted hover:text-foreground"
            }`}
          >
            {NIVEL_LABEL[nivel]}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onRemover}
        aria-label="remover faixa"
        className="ml-auto text-xs text-ink-muted hover:text-critical"
      >
        remover
      </button>
    </div>
  );
}

/**
 * Uma família: os 7 dias como abas (o dia selecionado é o que se edita) e,
 * dentro do dia, as faixas de nível. Dia sem faixa nenhuma é um dia
 * DESMARCADO — o que estiver aberto vale "razoável", que é o neutro; não
 * existe quarto nível.
 */
function JanelaFamiliaEditor({
  familiaId,
  valor,
  onChange,
}: {
  familiaId: string;
  valor: FamiliaJanelaContato;
  onChange: (valor: FamiliaJanelaContato) => void;
}) {
  const [diaAtivo, setDiaAtivo] = useState(1);
  const faixas = ordenarFaixas(valor.dias[diaAtivo] ?? []);

  function trocarDia(dia: number, lista: FaixaNivelContato[]) {
    onChange({ ...valor, dias: { ...valor.dias, [dia]: ordenarFaixas(lista) } });
  }

  return (
    <div className="rounded border border-line p-3">
      <p className="text-sm font-medium text-foreground">{ROTULO_FAMILIA[familiaId] ?? familiaId}</p>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {DIAS_SEMANA_ORDEM.map(({ dia, abrev }) => {
          const doDia = valor.dias[dia] ?? [];
          const ativo = dia === diaAtivo;
          return (
            <button
              key={dia}
              type="button"
              aria-pressed={ativo}
              title={doDia.length === 0 ? "desmarcado" : `${doDia.length} faixa(s)`}
              onClick={() => setDiaAtivo(dia)}
              className={`rounded border px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide ${
                ativo
                  ? "border-accent bg-accent/15 text-accent"
                  : doDia.length > 0
                    ? "border-line bg-surface-2 text-foreground"
                    : "border-line bg-surface-2 text-ink-muted"
              }`}
            >
              {abrev}
              <span className="ml-1 font-sans font-normal normal-case">
                {doDia.length === 0 ? "—" : doDia.length}
              </span>
            </button>
          );
        })}
      </div>

      <BarraFaixasPreview faixas={faixas} className="mt-2" />

      <div className="mt-2 flex flex-col gap-2">
        {faixas.length === 0 && (
          <p className="text-xs text-ink-muted">
            Dia desmarcado — o expediente inteiro vale &ldquo;razoável&rdquo;.
          </p>
        )}
        {faixas.map((faixa, i) => (
          <FaixaNivelEditor
            key={i}
            faixa={faixa}
            onChange={(nova) => trocarDia(diaAtivo, faixas.map((f, j) => (j === i ? nova : f)))}
            onRemover={() => trocarDia(diaAtivo, faixas.filter((_, j) => j !== i))}
          />
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() =>
            trocarDia(diaAtivo, [
              ...faixas,
              {
                inicio: { hora: 9, minuto: 0 },
                fim: { hora: 11, minuto: 0 },
                nivel: "bom",
              },
            ])
          }
          className="text-xs font-medium text-accent hover:underline"
        >
          + Adicionar faixa
        </button>
        <button
          type="button"
          onClick={() => {
            const dias = { ...valor.dias };
            for (const dia of DIAS_UTEIS) dias[dia] = faixas.map((f) => ({ ...f }));
            onChange({ ...valor, dias });
          }}
          className="text-xs text-ink-muted hover:text-foreground"
        >
          aplicar a seg–qui
        </button>
      </div>
    </div>
  );
}
