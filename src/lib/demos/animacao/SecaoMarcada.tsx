import type { ReactNode } from "react";

/**
 * Marcador de seção no DOM — o único elo entre a estrutura da demo
 * (`DemoSecao.animacao`, aba Estrutura do editor) e a camada decorativa,
 * que é irmã da skin e portanto não tem como saber onde uma seção começa
 * e termina. Toda skin envolve cada seção renderizada com isto (uma linha
 * no `visiveis.map` de cada `Skin.tsx`), e quem precisa medir só consulta
 * `[data-d-anim]` no documento (ver ./cobertura.ts + useCoberturaAnimada).
 *
 * É um `<div>` CRU de propósito: sem classe, sem position, sem transform.
 * Um wrapper com qualquer um desses quebraria `position: sticky` interno
 * (a sidebar de Serviços da barbearia) ou criaria containing block pra
 * elementos fixos — os mesmos cuidados que o `SectionReveal` de cada skin
 * já documenta. Em fluxo normal, uma div sem estilo em volta de um
 * `<section>` não muda layout nenhum.
 */
export function SecaoMarcada({
  id,
  animada,
  children,
}: {
  id: string;
  animada: boolean;
  children: ReactNode;
}) {
  return (
    <div data-d-secao={id} data-d-anim={animada ? "1" : "0"}>
      {children}
    </div>
  );
}
