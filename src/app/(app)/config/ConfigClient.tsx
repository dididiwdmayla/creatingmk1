"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/Button";
import { PaineisConfigProvider } from "@/components/config/PainelColapsavel";
import {
  PAINEIS_ANTES,
  PAINEIS_DEPOIS,
  PAINEIS_FORMULARIO,
} from "@/components/config/registro";
import { ApiError, api } from "@/lib/api-client";
import { DEFAULT_CONFIG, type AppConfig } from "@/lib/config";
import type { PaineisConfigAbertos } from "@/lib/usuarios/preferencias";

/**
 * A /config: uma pilha de blocos colapsáveis, renderizada a partir do
 * REGISTRO de painéis (`components/config/registro.ts`) — não há JSX
 * escrito à mão por painel aqui, e é isso que faz painel novo ter um lugar
 * óbvio para nascer. Ver "Painéis colapsáveis da /config" no
 * ARCHITECTURE.md.
 *
 * O que sobra nesta casca é o que pertence à PÁGINA, e não a painel nenhum:
 * o `AppConfig` em edição, o único "Salvar" (um `PUT /api/config` com o
 * documento inteiro) e a lista de problemas que a validação devolve.
 */
export default function ConfigClient({
  paineisIniciais,
}: {
  paineisIniciais: PaineisConfigAbertos;
}) {
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
        {PAINEIS_ANTES.map(({ id, Componente }) => (
          <Componente key={id} />
        ))}

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {PAINEIS_FORMULARIO.map(({ id, Componente }) => (
            <Componente key={id} form={form} onChange={setForm} />
          ))}

          {/* Fora de qualquer painel de propósito: a validação reprova o
              documento INTEIRO, e a mensagem precisa aparecer mesmo quando
              o painel do campo culpado está fechado. */}
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

        {PAINEIS_DEPOIS.map(({ id, Componente }) => (
          <Componente key={id} />
        ))}
      </div>
    </PaineisConfigProvider>
  );
}
