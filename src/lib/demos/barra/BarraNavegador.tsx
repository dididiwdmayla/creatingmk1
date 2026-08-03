"use client";

import { useEffect } from "react";

import { corEmFoco } from "./foco";
import { faixasAtuais, medirSecoes, type SecaoMedida } from "./medir";
import { limparPlano, pintarPlano } from "./plano";
import { corHex, lerCor } from "./srgb";

/**
 * A COR DA BARRA DO NAVEGADOR ACOMPANHANDO A SEÇÃO EM FOCO — o modo
 * `automatico` de `Theme.barraCor` (ver ../types.ts). Só é montado nesse
 * modo: nos modos fixos a cor já sai pronta do `generateViewport` e não
 * existe componente nenhum na página.
 *
 * Ele escreve a cor em DOIS lugares, porque os navegadores em uso hoje
 * leem a cor da barra de dois lugares diferentes (ver "Barra do
 * navegador" em ARCHITECTURE.md, que tem o levantamento completo):
 *
 *   1. **`content` da meta `theme-color`** — a tag que JÁ EXISTE, a que o
 *      `generateViewport` emitiu no HTML do servidor com a cor de partida
 *      certa. Mesmo padrão do `TemaSeletor` da plataforma; não se cria uma
 *      segunda tag porque o navegador considera a primeira, e duas seriam
 *      uma cor congelada e outra viva. É o caminho do Chrome/Brave/Edge no
 *      Android, do Samsung Internet e do Safari ≤ 18.
 *   2. **`background-color` do `<body>`** — de onde o Safari 26+ amostra a
 *      cor da barra, com observador ao vivo (ver ./plano.ts). É também o
 *      plano que aparece no rubber-band do overscroll, então a cor certa
 *      ali é a mesma, em qualquer navegador.
 *
 * **Nenhum pixel do CONTEÚDO muda.** A segunda saída pinta o plano do
 * `<body>`, que na demo fica inteiramente coberto pelas seções da skin —
 * o que ele troca é a cor do que já não se via (e a do overscroll, que
 * hoje mostra a cor do app, errada). Fora isso o componente não renderiza
 * nada e não lê nada que outro componente escreva. Num navegador que
 * ignore as duas coisas (Firefox, Opera, Chrome/Edge no desktop fora de
 * PWA), o efeito de tudo isto é medir umas caixas e escrever um atributo
 * que ninguém lê: degrada sozinho, sem ramo de código dedicado.
 *
 * Custo: um `getBoundingClientRect` por seção marcada (~10) por quadro de
 * rolagem, dentro de um listener passivo throttled por `requestAnimationFrame`
 * — o mesmo orçamento e o mesmo padrão do `LedEdges` e do
 * `medirCobertura`. Nenhum estado React por quadro (o destino é o DOM,
 * não o render) e nenhum `requestAnimationFrame` em laço: parou de rolar,
 * parou tudo. A varredura CARA (a cor de cada seção, que chama
 * `getComputedStyle`) roda no mount, num beat seguinte e no resize —
 * nunca por quadro. Ver ./medir.ts.
 *
 * `prefers-reduced-motion` NÃO desliga isto, pela mesma razão que não
 * desliga a cobertura animada: a cor só muda quando a PESSOA rola a
 * página, como um `position: sticky`. Não é movimento autônomo.
 */
export function BarraNavegador({ corInicial }: { corInicial: string }) {
  useEffect(() => {
    const base = lerCor(corInicial);
    if (!base) return;
    // A meta tag pode faltar (uma rota que não declare `themeColor`); o
    // plano da página continua valendo sozinho, então isto NÃO aborta.
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const original = meta?.content;
    let secoes: SecaoMedida[] = [];
    let ultimo = "";

    const pintar = () => {
      const cor = corHex(corEmFoco(faixasAtuais(secoes), window.innerHeight, base));
      // Só escreve quando o BYTE muda: a interpolação passa por milhares
      // de posições de scroll e apenas 256 níveis por canal, e reescrever
      // o mesmo valor faria o navegador reavaliar a barra à toa.
      if (cor === ultimo) return;
      ultimo = cor;
      if (meta) meta.content = cor;
      pintarPlano(cor);
    };
    const remedir = () => {
      secoes = medirSecoes();
      pintar();
    };

    let raf = 0;
    const aoRolar = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        pintar();
      });
    };

    remedir();
    // As alturas ainda mudam depois do primeiro quadro (fontes e imagens
    // chegando) — mesmo beat do LedEdges, pelo mesmo motivo.
    const beat = setTimeout(remedir, 400);
    window.addEventListener("scroll", aoRolar, { passive: true });
    window.addEventListener("resize", remedir, { passive: true });

    return () => {
      clearTimeout(beat);
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", aoRolar);
      window.removeEventListener("resize", remedir);
      // Devolve a cor que o servidor emitiu: sem isto, sair da demo por
      // navegação client-side deixaria a barra na cor da última seção.
      if (meta && original !== undefined) meta.content = original;
      limparPlano();
    };
  }, [corInicial]);

  return null;
}
