"use client";

import { useEffect, useState } from "react";

import { BarraFaixasPreview } from "@/components/BarraDoDia";
import { Button } from "@/components/Button";
import { ConfirmModal } from "@/components/ConfirmModal";
import { SkeletonRows } from "@/components/Skeleton";
import { PaineisConfigProvider, PainelColapsavel } from "@/components/config/PainelColapsavel";
import { Field, INPUT_CLS, NIVEL_CLS, NIVEL_LABEL } from "@/components/config/comum";
import { CotasUsuariosSection } from "@/components/config/paineis/CotasUsuarios";
import { FilaEnvioSection } from "@/components/config/paineis/FilaEnvio";
import { MetasUsuariosSection } from "@/components/config/paineis/MetasUsuarios";
import { RespostasPendentesSection } from "@/components/config/paineis/RespostasPendentes";
import { UsuariosSection } from "@/components/config/paineis/Usuarios";
import { ApiError, api, type FrasesResponse } from "@/lib/api-client";
import {
  DEFAULT_CONFIG,
  type AppConfig,
  type FiltroPresenca,
  type PresetPrecificacao,
} from "@/lib/config";
import { frasesEfetivas, normalizarSlots, posicaoAtual } from "@/lib/frases/rotacao";
import {
  FRASES_SLOTS,
  type FrasesProspeccao,
  type RelatorioMigracao,
} from "@/lib/frases/types";
import {
  FAMILIAS_JANELA_CONTATO,
  NIVEIS_CONTATO,
  ROTULO_FAMILIA,
  type FaixaNivelContato,
  type FamiliaJanelaContato,
  type HoraMinuto,
} from "@/lib/leads/janelaContato";
import { SLIDER_MAX_BRL, SLIDER_MIN_BRL, SLIDER_STEP_BRL } from "@/lib/precificacao/calc";
import { bandeiraDoPais, type PaisProspeccao } from "@/lib/prospeccao/paises";
import { SKUS, SKU_LABELS } from "@/lib/sku-labels";
import type { PaineisConfigAbertos } from "@/lib/usuarios/preferencias";

/** Chave da persistência do painel de frases — ver `PainelColapsavel`. */
const PAINEL_FRASES = "frases";

const PRESENCA_OPTIONS: Array<{ value: FiltroPresenca; label: string }> = [
  { value: "qualquer", label: "Qualquer" },
  { value: "com", label: "Com" },
  { value: "sem", label: "Sem" },
];

export default function ConfigClient({ paineisIniciais }: { paineisIniciais: PaineisConfigAbertos }) {
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
    <PaineisConfigProvider inicial={paineisIniciais}>
    <div className="flex flex-col gap-6 pb-6">
      <UsuariosSection />
      <CotasUsuariosSection />
      <MetasUsuariosSection />
      <FilaEnvioSection />
      <RespostasPendentesSection />
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
    </PaineisConfigProvider>
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
