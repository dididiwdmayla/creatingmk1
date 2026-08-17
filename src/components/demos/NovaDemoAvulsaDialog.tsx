"use client";

import { useState } from "react";

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
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const nomeValido = nome.trim().length > 0;

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
