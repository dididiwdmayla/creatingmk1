"use client";

import { useState } from "react";

import { getEfeitoComponenteDinamico } from "@/lib/demos/efeitos/dynamicComponents";
import { EFEITOS } from "@/lib/demos/efeitos/registry";
import type { EfeitoComponente, EfeitoIntensidade } from "@/lib/demos/efeitos/types";
import type { ThemePaleta } from "@/lib/demos/types";

/**
 * Harness interno pra avaliar os efeitos registrados (ver
 * lib/demos/efeitos/registry.ts) sobre fundo claro e escuro, com controle
 * de intensidade — celular e desktop. Rota fora do (app) (sem Nav/header,
 * canvas cheio pra avaliação) e fora do registro de skins; protegida pela
 * sessão como o resto do app (proxy.ts cobre por padrão — só /demo,
 * /login e /api/login ficam de fora).
 */

const PALETA_CLARA: ThemePaleta = {
  fundo: "#F5F1E8",
  fundoAlt: "#EDE6D6",
  fundoElevado: "#FFFFFF",
  destaque: "#B8862D",
  destaqueInk: "#1A1411",
  texto: "#1A1411",
  textoSuave: "#5C5346",
  borda: "rgba(26, 20, 17, 0.12)",
  acentoSecundario: "#C04A2B",
  acentoTerciario: "#5D6B4A",
};

const PALETA_ESCURA: ThemePaleta = {
  fundo: "#1A1411",
  fundoAlt: "#2B2118",
  fundoElevado: "#3D3025",
  destaque: "#E8B84B",
  destaqueInk: "#1A1411",
  texto: "#E8DCC4",
  textoSuave: "#A89882",
  borda: "rgba(232, 220, 196, 0.10)",
  acentoSecundario: "#FF6B4A",
  acentoTerciario: "#8FA876",
};

export default function EfeitosTestePage() {
  const [intensidade, setIntensidade] = useState<EfeitoIntensidade>(2);
  const [pausado, setPausado] = useState(false);

  return (
    <main className="min-h-dvh bg-background px-4 py-6 text-foreground sm:px-8">
      <header className="mx-auto mb-6 max-w-5xl">
        <h1 className="font-display text-xl font-bold">Teste de efeitos</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Harness interno — não faz parte do registro de skins. Cada efeito registrado, sobre
          fundo claro e escuro, no mesmo intensidade escolhida abaixo.
        </p>
      </header>

      <div className="mx-auto mb-8 flex max-w-5xl flex-wrap items-center gap-6 rounded-xl border border-line bg-surface p-4">
        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-sm">
          <span>Intensidade: {intensidade}</span>
          <input
            type="range"
            min={0}
            max={3}
            step={1}
            value={intensidade}
            onChange={(event) =>
              setIntensidade(Number(event.target.value) as EfeitoIntensidade)
            }
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={pausado}
            onChange={(event) => setPausado(event.target.checked)}
          />
          Pausado (sinal externo)
        </label>
      </div>

      <div className="mx-auto flex max-w-5xl flex-col gap-10">
        {EFEITOS.map((efeito) => {
          const Componente = getEfeitoComponenteDinamico(efeito.id);
          return (
            <section key={efeito.id}>
              <h2 className="mb-1 text-lg font-semibold">{efeito.nome}</h2>
              <p className="mb-3 text-xs text-ink-muted">
                id: {efeito.id} · nichos recomendados: {efeito.nichosRecomendados.join(", ")}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <PainelEfeito
                  rotulo="Fundo claro"
                  cores={PALETA_CLARA}
                  Componente={Componente}
                  intensidade={intensidade}
                  pausado={pausado}
                />
                <PainelEfeito
                  rotulo="Fundo escuro"
                  cores={PALETA_ESCURA}
                  Componente={Componente}
                  intensidade={intensidade}
                  pausado={pausado}
                />
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}

function PainelEfeito({
  rotulo,
  cores,
  Componente,
  intensidade,
  pausado,
}: {
  rotulo: string;
  cores: ThemePaleta;
  Componente: EfeitoComponente | undefined;
  intensidade: EfeitoIntensidade;
  pausado: boolean;
}) {
  return (
    <div
      className="relative flex h-[60vh] min-h-[320px] items-center justify-center overflow-hidden rounded-xl border"
      style={{ backgroundColor: cores.fundo, color: cores.texto, borderColor: cores.borda }}
    >
      <span
        className="pointer-events-none absolute left-3 top-3 rounded-full px-2 py-1 text-xs"
        style={{ backgroundColor: cores.fundoElevado, color: cores.textoSuave }}
      >
        {rotulo}
      </span>
      <p
        className="pointer-events-none relative z-10 max-w-xs px-6 text-center text-sm"
        style={{ color: cores.textoSuave }}
      >
        Conteúdo de exemplo pra avaliar contraste e legibilidade sobre o efeito.
      </p>
      {Componente ? (
        <Componente intensidade={intensidade} cores={cores} pausado={pausado} />
      ) : null}
    </div>
  );
}
