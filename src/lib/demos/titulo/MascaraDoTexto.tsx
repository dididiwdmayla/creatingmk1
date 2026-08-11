"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";

/** useLayoutEffect avisa no servidor (onde não roda); useEffect não. */
const useEfeitoDeLayout = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Máscara DERIVADA de uma caixa de texto — a peça que deixa o vídeo rodar
 * dentro das letras sem existir uma segunda cópia do título.
 *
 * `<text>` de SVG não quebra linha sozinho: escrever o título inteiro nele
 * dava um layout próprio, que divergia do da caixa de texto assim que o
 * nome era longo (a caixa quebrava por `white-space: pre-line` + largura do
 * container, a máscara não) — e como a caixa continuava pintando o
 * gradiente por baixo, o título aparecia duas vezes, em quebras
 * diferentes. Aqui o sentido é o inverso: as linhas saem da caixa JÁ
 * renderizada (`Range.getClientRects` devolve um retângulo por linha
 * REAL), e cada uma vira um `<text>` na posição medida. A máscara não
 * decide nada sobre o texto — ela copia o que o CSS já decidiu.
 *
 * Sem medição possível (fonte ainda carregando, caixa de altura zero, nó
 * de texto ausente) devolve `null`: quem chama trata isso como "o nível de
 * vídeo não sobe" e mantém o preenchimento próprio da caixa, nunca um
 * título sem preenchimento nenhum.
 */

type LinhaMedida = {
  texto: string;
  /** Início da linha, em px na origem do wordmark (text-anchor: start). */
  x: number;
  /** Linha de base, em px na origem do wordmark. */
  base: number;
};

export type Metrica = {
  linhas: LinhaMedida[];
  letterSpacing: CSSProperties["letterSpacing"];
  textTransform: CSSProperties["textTransform"];
  /** Caixa do wordmark em px CSS — o tamanho do bitmap do vídeo. */
  caixa: { largura: number; altura: number };
};

/**
 * Distância do TOPO da caixa de fonte de uma linha até a linha de base,
 * medida numa sonda fora da tela com a mesma tipografia. Um inline-block
 * de altura zero e `overflow: hidden` assenta a borda inferior EXATAMENTE
 * na linha de base — então a conta é exata e não depende de
 * `TextMetrics.fontBoundingBoxAscent` (que o Firefox só tem desde a 116).
 */
function medirAscent(estilo: CSSStyleDeclaration): number | null {
  const sonda = document.createElement("span");
  sonda.setAttribute("aria-hidden", "true");
  Object.assign(sonda.style, {
    position: "absolute",
    left: "-99999px",
    top: "0",
    visibility: "hidden",
    whiteSpace: "pre",
    fontFamily: estilo.fontFamily,
    fontSize: estilo.fontSize,
    fontWeight: estilo.fontWeight,
    fontStyle: estilo.fontStyle,
    lineHeight: estilo.lineHeight,
  });
  const texto = document.createTextNode("H");
  const base = document.createElement("span");
  Object.assign(base.style, {
    display: "inline-block",
    width: "0",
    height: "0",
    overflow: "hidden",
    verticalAlign: "baseline",
  });
  sonda.append(texto, base);
  document.body.appendChild(sonda);
  const faixa = document.createRange();
  faixa.selectNodeContents(texto);
  const topo = faixa.getBoundingClientRect().top;
  const linhaDeBase = base.getBoundingClientRect().bottom;
  sonda.remove();
  const ascent = linhaDeBase - topo;
  return Number.isFinite(ascent) && ascent > 0 ? ascent : null;
}

/** Primeiro nó de texto da caixa (a caixa não tem elementos filhos). */
function noDeTexto(caixa: HTMLElement): Text | null {
  for (const filho of caixa.childNodes) {
    if (filho.nodeType === Node.TEXT_NODE && filho.textContent?.trim()) return filho as Text;
  }
  return null;
}

/**
 * Um retângulo por linha renderizada. `getClientRects` pode devolver mais
 * de um retângulo na mesma linha (o motor fatia por trecho); retângulos com
 * o mesmo topo viram uma linha só.
 */
function retangulosPorLinha(faixa: Range): DOMRect[] {
  const linhas: DOMRect[] = [];
  for (const r of faixa.getClientRects()) {
    if (r.width <= 0 || r.height <= 0) continue;
    const anterior = linhas[linhas.length - 1];
    if (anterior && Math.abs(anterior.top - r.top) < 1) {
      linhas[linhas.length - 1] = new DOMRect(
        Math.min(anterior.x, r.x),
        anterior.y,
        Math.max(anterior.right, r.right) - Math.min(anterior.x, r.x),
        anterior.height,
      );
      continue;
    }
    linhas.push(new DOMRect(r.x, r.y, r.width, r.height));
  }
  return linhas;
}

function medir(caixa: HTMLElement): Metrica | null {
  const no = noDeTexto(caixa);
  const origem = caixa.parentElement; // .d-wordmark — o referencial do <svg> absoluto
  if (!no || !origem) return null;

  const faixa = document.createRange();
  faixa.selectNodeContents(no);
  const porLinha = retangulosPorLinha(faixa);
  if (porLinha.length === 0) return null;

  // Cada caractere cai numa das linhas. Os separadores (o "\n" e o espaço
  // colapsado no ponto da quebra) medem zero e ficam de fora — é
  // exatamente o que se quer, o texto de cada linha sai sem sobra.
  const conteudo = no.textContent ?? "";
  const partes: string[][] = porLinha.map(() => []);
  for (let i = 0; i < conteudo.length; i++) {
    faixa.setStart(no, i);
    faixa.setEnd(no, i + 1);
    const r = faixa.getBoundingClientRect();
    if (r.width <= 0) continue;
    // Linha mais próxima em vez de igualdade com tolerância: assim nenhum
    // caractere se perde por diferença de subpixel entre a medida do
    // trecho e a da linha inteira.
    let linha = 0;
    let menor = Infinity;
    porLinha.forEach((l, j) => {
      const d = Math.abs(l.top - r.top);
      if (d < menor) {
        menor = d;
        linha = j;
      }
    });
    partes[linha].push(conteudo[i]);
  }

  const estilo = getComputedStyle(caixa);
  const ascent = medirAscent(estilo);
  if (ascent === null) return null;

  const base = origem.getBoundingClientRect();
  const linhas = porLinha
    .map((r, i) => ({
      // O espaço do ponto de quebra sobra no fim da linha (mede largura,
      // então entra na varredura acima) e não desenha nada — fora dele.
      texto: partes[i].join("").trimEnd(),
      x: r.left - base.left,
      base: r.top - base.top + ascent,
    }))
    .filter((l) => l.texto !== "");
  if (linhas.length === 0) return null;

  return {
    linhas,
    // Lidos do CSS em vez de repetidos aqui: se a skin mudar o
    // espaçamento/caixa do wordmark, a máscara acompanha sozinha.
    letterSpacing: estilo.letterSpacing,
    textTransform: estilo.textTransform,
    caixa: { largura: base.width, altura: base.height },
  };
}

/** Duas medidas são a MESMA se nada que a máscara usa mudou. */
const IGUAL = 0.05;
const perto = (a: number, b: number) => Math.abs(a - b) < IGUAL;

function mesmaMetrica(a: Metrica | null, b: Metrica | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.letterSpacing === b.letterSpacing &&
    a.textTransform === b.textTransform &&
    perto(a.caixa.largura, b.caixa.largura) &&
    perto(a.caixa.altura, b.caixa.altura) &&
    a.linhas.length === b.linhas.length &&
    a.linhas.every(
      (l, i) =>
        l.texto === b.linhas[i].texto &&
        perto(l.x, b.linhas[i].x) &&
        perto(l.base, b.linhas[i].base),
    )
  );
}

/**
 * Medida VIVA da caixa de texto. Fica em quem RENDERIZA a caixa (e não
 * dentro da máscara) porque a resposta decide as duas coisas ao mesmo
 * tempo: se a máscara pode ser desenhada e se a caixa desliga o
 * preenchimento próprio. Se a medida falhar, o preenchimento tem de
 * continuar — um título só com contorno seria pior que o defeito.
 *
 * "Viva" é o ponto. Medida UMA vez, a máscara fica onde estava: trocar o
 * alinhamento MOVE a caixa sem REDIMENSIONÁ-LA (`.d-wordmark-text` é
 * inline-block), o `ResizeObserver` não acorda e as duas camadas ficam
 * deslocadas — mudar o TAMANHO da fonte "consertava" só porque aí a caixa
 * muda de tamanho. A recontagem tem de acontecer em TUDO que move os
 * glifos: alinhamento, texto, tamanho, fonte, entre-letras e largura do
 * contêiner. São três gatilhos, porque nenhum sozinho pega os seis:
 *
 *   1. o efeito de layout SEM lista de dependências — roda a cada commit,
 *      que é o caminho de toda mudança vinda do editor (texto, escala,
 *      fonte, entre-letras, alinhamento por prop);
 *   2. `ResizeObserver` na caixa E no contêiner — largura do contêiner e
 *      rotação de tela não passam por render nenhum;
 *   3. `MutationObserver` em `class`/`style` do wordmark e do bloco que o
 *      envolve — o alinhamento é a troca que não redimensiona nada, e
 *      pode chegar sem render (estilo mexido direto no DOM).
 *
 * O laço se fecha na comparação: só um valor DIFERENTE vira estado, então
 * medir a cada commit não realimenta render.
 *
 * `ativo` desliga a medição (e os observadores) quando o nível de mídia
 * nem é vídeo: no caso comum não se mede nada.
 */
export function useMedidaDoTexto(
  caixaRef: RefObject<HTMLSpanElement | null>,
  ativo: boolean,
): Metrica | null {
  const [metrica, setMetrica] = useState<Metrica | null>(null);

  const remedir = useCallback(() => {
    const caixa = caixaRef.current;
    const nova = ativo && caixa ? medir(caixa) : null;
    setMetrica((atual) => (mesmaMetrica(atual, nova) ? atual : nova));
  }, [caixaRef, ativo]);

  // Mede depois do layout e antes da pintura, então a máscara nasce já no
  // lugar em vez de aparecer deslocada por um quadro. Sem lista de
  // dependências DE PROPÓSITO (ver acima): qualquer commit pode ter movido
  // os glifos, e a comparação impede que isso vire laço.
  useEfeitoDeLayout(() => {
    remedir();
  });

  useEffect(() => {
    const caixa = caixaRef.current;
    const wordmark = caixa?.parentElement ?? null;
    if (!ativo || !caixa || !wordmark) return;
    const bloco = wordmark.parentElement;

    const ro = new ResizeObserver(remedir);
    ro.observe(caixa);
    // O contêiner: a caixa pode ficar do mesmo tamanho e as linhas
    // mudarem de lugar (bloco mais estreito, rotação de tela).
    if (bloco) ro.observe(bloco);

    // Só atributos, e só destes dois nós: `subtree` pegaria o próprio
    // canvas do vídeo sendo redimensionado e realimentaria a medição.
    const mo = new MutationObserver(remedir);
    const soAtributos = { attributes: true, attributeFilter: ["class", "style"] };
    mo.observe(wordmark, soAtributos);
    if (bloco) mo.observe(bloco, soAtributos);

    // Trocar a fonte (escolha do editor, ou a webfont chegando depois do
    // primeiro desenho) muda as métricas sem mudar o tamanho da caixa.
    const fontes = document.fonts;
    fontes?.addEventListener("loadingdone", remedir);
    fontes?.ready.then(remedir).catch(() => {});
    return () => {
      ro.disconnect();
      mo.disconnect();
      fontes?.removeEventListener("loadingdone", remedir);
    };
  }, [ativo, caixaRef, remedir]);

  return metrica;
}

export function MascaraDoTexto({
  metrica,
  children,
}: {
  /** Medida da ÚNICA caixa de texto do título (ver useMedidaDoTexto). */
  metrica: Metrica;
  /** Conteúdo recortado pela máscara (recebe o id gerado). */
  children: (maskId: string) => ReactNode;
}) {
  const maskId = useId();

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <mask id={maskId}>
          <rect x="0" y="0" width="100%" height="100%" fill="black" />
          {metrica.linhas.map((linha, i) => (
            <text
              key={i}
              x={linha.x}
              y={linha.base}
              fill="white"
              style={{
                // Família/tamanho/peso vêm por herança do .d-wordmark, que
                // é o pai deste <svg> — os mesmos da caixa de texto.
                letterSpacing: metrica.letterSpacing,
                textTransform: metrica.textTransform,
              }}
            >
              {linha.texto}
            </text>
          ))}
        </mask>
      </defs>
      {children(maskId)}
    </svg>
  );
}
