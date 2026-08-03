"use client";

import dynamic from "next/dynamic";
import { Component, type ReactNode } from "react";

import { idEfeitoAtual } from "./registry";
import type { EfeitoComponente, EfeitoProps } from "./types";

/**
 * Resolve o componente de um efeito por id — SEMPRE por import dinâmico
 * sem SSR (nunca bloqueia o first paint da demo; efeitos usam window/
 * canvas/IntersectionObserver, que não existem no server de qualquer
 * forma). Cada `dynamic(() => import(...))` fica escrito por extenso e no
 * nível superior do módulo — é o que o bundler precisa pra casar o chunk
 * com a chamada e poder fazer code-splitting de verdade (ver
 * node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md).
 */
const AuraDinamico = dynamic(() => import("./aura/Aura").then((m) => m.Aura), { ssr: false });
const GraoDinamico = dynamic(() => import("./grao/Grao").then((m) => m.Grao), { ssr: false });
const GradienteDinamico = dynamic(() => import("./gradiente/Gradiente").then((m) => m.Gradiente), {
  ssr: false,
});
const ParticulasDinamico = dynamic(
  () => import("./particulas/Particulas").then((m) => m.Particulas),
  { ssr: false },
);
const VeiosDinamico = dynamic(() => import("./veios/Veios").then((m) => m.Veios), { ssr: false });
const FilotaxiaDinamico = dynamic(() => import("./filotaxia/Filotaxia").then((m) => m.Filotaxia), {
  ssr: false,
});
const OndasDinamico = dynamic(() => import("./ondas/Ondas").then((m) => m.Ondas), { ssr: false });
const FaiscasDinamico = dynamic(() => import("./faiscas/Faiscas").then((m) => m.Faiscas), {
  ssr: false,
});
const VarreduraDeLuzDinamico = dynamic(
  () => import("./varredura-de-luz/VarreduraDeLuz").then((m) => m.VarreduraDeLuz),
  { ssr: false },
);

const COMPONENTES_DINAMICOS: Record<string, EfeitoComponente> = {
  aura: AuraDinamico,
  grao: GraoDinamico,
  gradiente: GradienteDinamico,
  particulas: ParticulasDinamico,
  veios: VeiosDinamico,
  filotaxia: FilotaxiaDinamico,
  ondas: OndasDinamico,
  faiscas: FaiscasDinamico,
  "varredura-de-luz": VarreduraDeLuzDinamico,
};

/**
 * `idEfeitoAtual` no caminho de resolução: um id de efeito REMOVIDO (ver
 * EFEITOS_MIGRADOS em ./registry.ts) chega aqui vindo de uma demo antiga e
 * renderiza o substituto, em vez de cair no `undefined` de "id que não
 * existe" — o mesmo que `getEfeito` faz do lado do metadado.
 */
export function getEfeitoComponenteDinamico(id: string): EfeitoComponente | undefined {
  return COMPONENTES_DINAMICOS[idEfeitoAtual(id)];
}

/**
 * Isola qualquer erro de render de um efeito (bug num efeito específico,
 * falha do chunk dinâmico, etc.) sem derrubar o resto da demo — a camada
 * decorativa é opcional por definição, nunca pode ser o motivo de uma
 * página pública quebrar. `getDerivedStateFromError` também intercepta erro
 * durante o SSR (Server Components renderizam esta árvore via Fizz, que
 * respeita error boundaries de Client Component do mesmo jeito que no
 * cliente).
 */
class EfeitoErrorBoundary extends Component<{ children: ReactNode }, { comErro: boolean }> {
  state = { comErro: false };
  static getDerivedStateFromError() {
    return { comErro: true };
  }
  componentDidCatch(error: unknown) {
    console.error("[radar] efeito de fundo falhou, demo segue sem ele:", error);
  }
  render() {
    if (this.state.comErro) return null;
    return this.props.children;
  }
}

/**
 * Wrapper client que resolve E renderiza o efeito por id — usar isto (em
 * vez de chamar `getEfeitoComponenteDinamico` direto) quando quem monta o
 * JSX é um Server Component, como a rota pública `/demo/[leadId]`. Chamar a
 * função acima como função comum (não como JSX) a partir de um Server
 * Component derruba a rota inteira em produção: todo export de um módulo
 * "use client" vira uma client reference no bundle do servidor, e invocar
 * essa referência como função (em vez de renderizá-la como componente)
 * lança em runtime ("Attempted to call ... from the server"). Mantendo a
 * resolução E a invocação dentro deste mesmo componente client, o Server
 * Component só precisa renderizar `<EfeitoDinamico />` com props
 * serializáveis — o caminho suportado de Server → Client Component.
 * Também envolve o resultado no error boundary acima: efeito com bug não
 * derruba a demo pública.
 */
export function EfeitoDinamico({ id, ...props }: { id: string } & EfeitoProps) {
  const Componente = COMPONENTES_DINAMICOS[idEfeitoAtual(id)];
  if (!Componente) return null;
  return (
    <EfeitoErrorBoundary>
      <Componente {...props} />
    </EfeitoErrorBoundary>
  );
}
