"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/Button";
import {
  ConfigDemoCampos,
  configDemoInicial,
  type ConfigDemo,
} from "@/components/demos/ConfigDemoCampos";
import { ApiError, api } from "@/lib/api-client";
import type { DemoAvulsa } from "@/lib/demos/avulsas/types";
import { patchCriacaoLote } from "@/lib/demos/lote";
import { PAISES_COM_IDIOMA } from "@/lib/idioma";

/**
 * "Nova demo avulsa" — cria uma demo SEM lead associado.
 *
 * Duas metades: os MESMOS quatro seletores do diálogo de geração em lote
 * (skin, preset, efeito, modo de imagem — `ConfigDemoCampos`, componente
 * compartilhado) e os campos de identidade, digitados à mão.
 *
 * Campo de identidade deixado vazio SOME da página publicada — não cai no
 * texto de exemplo do template (ver `identidadeEmBranco` em
 * lib/demos/avulsas/identidade.ts). O nome é o único obrigatório: sem ele
 * não há título hero nem rótulo na listagem.
 *
 * Uma avulsa não vira lead, não conta em meta, não entra na penetração por
 * nicho/cidade e não aparece em /leads nem na fila de /hoje.
 */

const INPUT_CLASS =
  "w-full rounded border border-line bg-surface-2 px-2 py-1.5 text-sm text-foreground outline-none focus:border-accent";

/** Os campos de identidade, na ordem em que fazem sentido preencher. */
const CAMPOS: Array<{
  chave: "cidade" | "endereco" | "telefone" | "whatsapp" | "horarios" | "instagram";
  rotulo: string;
  exemplo: string;
  multilinha?: boolean;
}> = [
  { chave: "cidade", rotulo: "Cidade", exemplo: "Maringá - PR" },
  { chave: "endereco", rotulo: "Endereço", exemplo: "Av. Brasil, 2785" },
  { chave: "telefone", rotulo: "Telefone", exemplo: "(44) 3222-1111" },
  { chave: "whatsapp", rotulo: "WhatsApp", exemplo: "+55 44 99999-0000" },
  { chave: "instagram", rotulo: "Instagram", exemplo: "@seunegocio" },
  {
    chave: "horarios",
    rotulo: "Horários",
    exemplo: "Terça a sábado, 9h às 19h",
    multilinha: true,
  },
];

type Identidade = Record<(typeof CAMPOS)[number]["chave"], string>;

const IDENTIDADE_VAZIA: Identidade = {
  cidade: "",
  endereco: "",
  telefone: "",
  whatsapp: "",
  horarios: "",
  instagram: "",
};

export function NovaDemoAvulsaDialog({
  onFechar,
  onCriada,
}: {
  onFechar: () => void;
  /** A avulsa recém-criada — o caller insere na listagem e leva pro editor. */
  onCriada: (avulsa: DemoAvulsa) => void;
}) {
  const [config, setConfig] = useState<ConfigDemo>(configDemoInicial);
  const [nome, setNome] = useState("");
  const [pais, setPais] = useState("");
  const [identidade, setIdentidade] = useState<Identidade>(IDENTIDADE_VAZIA);
  const [linkMaps, setLinkMaps] = useState("");
  const [cotacao, setCotacao] = useState<{
    chamadas: number;
    sku: string;
    custo: { usd: number; brl: number };
  } | null>(null);
  const [buscandoMaps, setBuscandoMaps] = useState(false);
  const [erroMaps, setErroMaps] = useState<string | null>(null);
  const [leadExistente, setLeadExistente] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const nomeValido = nome.trim().length > 0;

  useEffect(() => {
    let ativo = true;
    api
      .cotacaoImportacaoMaps()
      .then((valor) => ativo && setCotacao(valor))
      .catch(() => ativo && setCotacao(null));
    return () => {
      ativo = false;
    };
  }, []);

  async function buscarNoMaps() {
    if (!linkMaps.trim() || buscandoMaps || criando) return;
    setBuscandoMaps(true);
    setErroMaps(null);
    setLeadExistente(null);
    try {
      const resultado = await api.importarDemoAvulsaMaps(linkMaps.trim());
      const dados = resultado.identidade;
      setNome(dados.nome);
      setPais(dados.pais ?? "");
      setIdentidade({
        cidade: dados.cidade ?? "",
        endereco: dados.endereco ?? "",
        telefone: dados.telefone ?? "",
        whatsapp: dados.whatsapp ?? "",
        horarios: dados.horarios ?? "",
        instagram: dados.instagram ?? "",
      });
      setLeadExistente(resultado.leadExistente?.id ?? null);
    } catch (error) {
      setErroMaps(
        error instanceof ApiError
          ? `${error.message} Você ainda pode preencher tudo manualmente.`
          : "Não foi possível buscar esse estabelecimento. Você ainda pode preencher tudo manualmente.",
      );
    } finally {
      setBuscandoMaps(false);
    }
  }

  async function criar() {
    if (!nomeValido || criando) return;
    setCriando(true);
    setErro(null);
    try {
      // Mesmo patch de criação do lote: efeito "nenhum" e modo "foto" (os
      // defaults) não escrevem nada — o registro nasce sem ruído.
      const { dados, tema } = patchCriacaoLote(config);
      const preenchidos = Object.fromEntries(
        Object.entries(identidade)
          .map(([chave, valor]) => [chave, valor.trim()])
          .filter(([, valor]) => valor !== ""),
      );
      const { avulsa } = await api.criarDemoAvulsa({
        nome: nome.trim(),
        ...(pais.trim() && { pais: pais.trim() }),
        ...preenchidos,
        skinId: config.skinId,
        themeId: config.themeId,
        dados,
        ...(tema && { tema }),
      });
      onCriada(avulsa);
    } catch (error) {
      setErro(error instanceof ApiError ? error.message : "Falha ao criar a demo avulsa.");
    } finally {
      setCriando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={criando ? undefined : onFechar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Nova demo avulsa"
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-y-auto rounded-lg border border-line bg-surface p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">Nova demo avulsa</h2>
          {!criando && (
            <button
              type="button"
              onClick={onFechar}
              className="text-xs text-ink-muted hover:text-foreground"
            >
              Fechar
            </button>
          )}
        </div>

        <p className="mt-1 text-xs text-ink-muted">
          Uma demo sem lead associado — não vira lead, não conta em metas, não entra na penetração
          por nicho/cidade e não aparece em /leads nem na fila de hoje. Render do Firestore,
          gratuito, não consome cota.
        </p>

        <div className="mt-3">
          <ConfigDemoCampos config={config} onChange={setConfig} desabilitado={criando} />
        </div>

        <section className="mt-4 rounded-md border border-line bg-surface-2 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Preencher pelo Google Maps
          </h3>
          <p className="mt-1 text-xs text-ink-muted">
            Cole o link e revise o custo. Nada é buscado só por colar e nenhuma demo é gravada
            nesta etapa.
          </p>
          <label className="mt-2 block text-xs text-ink-secondary">
            Link do estabelecimento
            <input
              type="url"
              value={linkMaps}
              onChange={(event) => setLinkMaps(event.target.value)}
              placeholder="https://maps.app.goo.gl/…"
              disabled={criando || buscandoMaps}
              className={`mt-1 ${INPUT_CLASS}`}
            />
          </label>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-ink-muted">
              {cotacao ? (
                <>
                  <strong className="text-foreground">{cotacao.chamadas} chamada</strong> · SKU{" "}
                  <code>{cotacao.sku}</code> · custo agora: R${" "}
                  {cotacao.custo.brl.toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 4,
                  })}
                </>
              ) : (
                "Custo indisponível — a busca fica desabilitada; o preenchimento manual continua livre."
              )}
            </p>
            <Button
              variant="secondary"
              onClick={buscarNoMaps}
              loading={buscandoMaps}
              disabled={!cotacao || !linkMaps.trim() || criando}
            >
              Buscar detalhes
            </Button>
          </div>
          <p className="mt-1 text-[11px] text-ink-muted">
            Usa sua cota individual de enriquecimentos. Não busca fotos.
          </p>
          {erroMaps && <p className="mt-2 text-xs text-critical">{erroMaps}</p>}
          {leadExistente && (
            <p className="mt-2 rounded border border-warning/40 bg-warning/10 p-2 text-xs text-foreground">
              Este estabelecimento já existe como lead. Você pode criar a avulsa mesmo assim. {" "}
              <a className="font-semibold text-accent underline" href={`/leads/${leadExistente}`}>
                Abrir ficha
              </a>
            </p>
          )}
        </section>

        <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Identidade do negócio
        </h3>
        <p className="mt-1 text-xs text-ink-muted">
          Campo deixado em branco <strong className="text-foreground">some da página</strong> — não
          vira o texto de exemplo do template. Dá pra editar tudo depois, no editor.
        </p>

        <div className="mt-2 flex flex-col gap-2">
          <label className="block text-xs text-ink-secondary">
            Nome <span className="text-critical">*</span>
            <input
              type="text"
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              placeholder="Barbearia do Zé"
              autoFocus
              disabled={criando}
              className={`mt-1 ${INPUT_CLASS}`}
            />
          </label>

          <label className="block text-xs text-ink-secondary">
            País
            <input
              type="text"
              value={pais}
              onChange={(event) => setPais(event.target.value)}
              list="paises-avulsa"
              placeholder="Brasil"
              disabled={criando}
              className={`mt-1 ${INPUT_CLASS}`}
            />
            <datalist id="paises-avulsa">
              {PAISES_COM_IDIOMA.map((nomePais) => (
                <option key={nomePais} value={nomePais} />
              ))}
            </datalist>
            <span className="mt-0.5 block text-[11px] text-ink-muted">
              De onde saem o idioma dos textos e a moeda dos preços.
            </span>
          </label>

          {CAMPOS.map(({ chave, rotulo, exemplo, multilinha }) => (
            <label key={chave} className="block text-xs text-ink-secondary">
              {rotulo}
              {multilinha ? (
                <textarea
                  value={identidade[chave]}
                  onChange={(event) =>
                    setIdentidade((atual) => ({ ...atual, [chave]: event.target.value }))
                  }
                  placeholder={exemplo}
                  rows={2}
                  disabled={criando}
                  className={`mt-1 ${INPUT_CLASS}`}
                />
              ) : (
                <input
                  type="text"
                  value={identidade[chave]}
                  onChange={(event) =>
                    setIdentidade((atual) => ({ ...atual, [chave]: event.target.value }))
                  }
                  placeholder={exemplo}
                  disabled={criando}
                  className={`mt-1 ${INPUT_CLASS}`}
                />
              )}
            </label>
          ))}
        </div>

        {erro && <p className="mt-3 text-sm text-critical">{erro}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={onFechar} disabled={criando}>
            Cancelar
          </Button>
          <Button onClick={criar} loading={criando} disabled={!nomeValido}>
            Criar e abrir no editor
          </Button>
        </div>
      </div>
    </div>
  );
}
