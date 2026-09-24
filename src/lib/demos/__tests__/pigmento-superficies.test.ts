import { describe, expect, it } from "vitest";

import { contrasteWcag } from "../contraste";
import { getSkin } from "../registry";

/**
 * Contraste sobre as SUPERFÍCIES FINAIS das composições novas — não a
 * paleta em isolado (`pigmento-paletas.test.ts`, sessão de fundação,
 * mede tinta/mancha/pílula em abstrato), mas o fundo REAL que cada
 * composição visual compõe: etiquetas e selos (`investimento`), talão
 * (`agendar` da Boreal), fichas (`faq` da Boreal), bilhetes
 * (`depoimentos` da Aquarela), grifo (`manifesto` da Boreal) e carta
 * (`manifesto` da Terra). Item 30 do plano (docs/plano-tatuagem-
 * pigmento-vivo.md §16): "Contraste refeito com contrasteWcag, composto
 * sobre as superfícies REAIS das composições novas".
 *
 * Três superfícies do enunciado do item 4 da sessão não precisam de
 * número novo — ficam documentadas aqui, e não repetidas:
 * - `cartela` (abertura da Meia-noite): as manchas ocupam só os 52svh do
 *   topo (`.pv-hero-mancha { height: 52svh }`) e `.pv-hero-nome-bloco`
 *   (onde mora o `<h1>`) começa exatamente onde o padding-top de
 *   `.pv-hero` termina, com `background: var(--d-bg)` — não há overlap
 *   de pixel nenhum; o par que importa é texto/fundo, já coberto por
 *   `pigmento-paletas.test.ts`.
 * - "brilho screen do manifesto da Meia-noite" (`pilha`, o "acendendo em
 *   brilho" do §6 do plano): é `text-shadow: 0 0 1.1em currentColor` nas
 *   palavras acesas — um halo NA MESMA cor do texto, fora do glifo, não
 *   um fundo por baixo; não pode reduzir o contraste do par texto/fundo
 *   que já está coberto.
 * - `postal` (agendar da Terra): título com `color: var(--d-text)`
 *   sobre `.pv-agendar-conteudo { background: var(--d-bg-elev) }` — o
 *   mesmo par texto/elevado já medido em `pigmento-paletas.test.ts`.
 *
 * Mesma fórmula/método de `pigmento-paletas.test.ts` (alfa composto por
 * canal sobre o fundo opaco real).
 */
const skin = getSkin("tatuagem-pigmento-vivo")!;
const variantes = skin.variantes!;
const tema = (id: string) => variantes.find((v) => v.id === id)!.theme;

const canais = (cor: string): [number, number, number, number] => {
  const m = /rgba?\(([^)]+)\)/.exec(cor);
  if (m) {
    const [r, g, b, a = 1] = m[1].split(",").map(Number);
    return [r, g, b, a];
  }
  const h = cor.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).concat(1) as [number, number, number, number];
};
const hex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("");

/** Mistura linear por canal — `frente` (com seu próprio alfa) sobre `fundo` opaco. */
const sobre = (frente: string, fundo: string) => {
  const [r, g, b, a] = canais(frente);
  const [R, G, B] = canais(fundo);
  return hex(r * a + R * (1 - a), g * a + G * (1 - a), b * a + B * (1 - a));
};

const comAlfa = (cor: string, alfa: number) => {
  const [r, g, b] = canais(cor);
  return `rgba(${r}, ${g}, ${b}, ${alfa})`;
};

/** `color-mix(in srgb, A x%, B)` — mistura linear, mesma direção do CSS. */
const colorMix = (a: string, pctA: number, b: string) => sobre(comAlfa(a, pctA / 100), b);

describe("tatuagem-pigmento-vivo §16 item 30 — contraste nas superfícies finais", () => {
  it("Aquarela — bilhetes (depoimentos): color-mix(mancha 7%, elevado)", () => {
    const t = tema("aquarela");
    const { paleta } = t;
    const manchas = t.pigmento!.manchas;
    const tintas = [paleta.destaque, paleta.acentoSecundario, paleta.acentoTerciario];
    for (let i = 0; i < 3; i++) {
      const fundo = colorMix(manchas[i], 7, paleta.fundoElevado);
      expect(contrasteWcag(paleta.texto, fundo), `texto/bilhete ${i}`).toBeGreaterThanOrEqual(4.5);
      expect(contrasteWcag(paleta.textoSuave, fundo), `autor(suave)/bilhete ${i}`).toBeGreaterThanOrEqual(4.5);
      expect(contrasteWcag(tintas[i], fundo), `estrelas(tinta)/bilhete ${i}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("Boreal — fichas (faq): color-mix(mancha-2 6%, alt)", () => {
    const t = tema("boreal");
    const { paleta } = t;
    const manchas = t.pigmento!.manchas;
    const fundo = colorMix(manchas[1], 6, paleta.fundoAlt);
    expect(contrasteWcag(paleta.texto, fundo), "pergunta/ficha").toBeGreaterThanOrEqual(4.5);
    expect(contrasteWcag(paleta.textoSuave, fundo), "resposta(suave)/ficha").toBeGreaterThanOrEqual(4.5);
  });

  it("Boreal — talão (agendar): campo-texto sobre color-mix(campo-1 82%, campo-1|campo-2)", () => {
    const t = tema("boreal");
    const { paleta } = t;
    const tintas = [paleta.destaque, paleta.acentoSecundario, paleta.acentoTerciario];
    const campoTexto = "#FFFFFF"; // Boreal é claro — regra 4 do §2.
    for (const extremo of [tintas[0], tintas[1]]) {
      const fundo = colorMix(tintas[0], 82, extremo);
      expect(contrasteWcag(campoTexto, fundo), `título/talão sobre ${extremo}`).toBeGreaterThanOrEqual(3);
    }
  });

  it("Terra — selos (investimento): item-tinta sobre color-mix(item-mancha 10%, alt)", () => {
    const t = tema("terra");
    const { paleta } = t;
    const manchas = t.pigmento!.manchas;
    const tintas = [paleta.destaque, paleta.acentoSecundario, paleta.acentoTerciario];
    for (let i = 0; i < 3; i++) {
      const fundo = colorMix(manchas[i], 10, paleta.fundoAlt);
      expect(contrasteWcag(tintas[i], fundo), `selo ${i}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("Boreal — grifo (manifesto, palavra acesa): texto grande, 3:1, color-mix(mancha-2 27%, fundo)", () => {
    const t = tema("boreal");
    const { paleta } = t;
    const manchas = t.pigmento!.manchas;
    const tintas = [paleta.destaque, paleta.acentoSecundario, paleta.acentoTerciario];
    const fundo = colorMix(manchas[1], 27, paleta.fundo);
    expect(contrasteWcag(paleta.texto, fundo), "palavra normal/grifo").toBeGreaterThanOrEqual(3);
    for (const tinta of tintas) {
      expect(contrasteWcag(tinta, fundo), `palavra destacada ${tinta}/grifo`).toBeGreaterThanOrEqual(3);
    }
  });

  it("Terra — carta (manifesto, linha pautada): texto grande, 3:1, color-mix(mancha-3 16%, elevado)", () => {
    const t = tema("terra");
    const { paleta } = t;
    const manchas = t.pigmento!.manchas;
    const tintas = [paleta.destaque, paleta.acentoSecundario, paleta.acentoTerciario];
    const fundo = colorMix(manchas[2], 16, paleta.fundoElevado);
    expect(contrasteWcag(paleta.texto, fundo), "palavra normal/carta").toBeGreaterThanOrEqual(3);
    for (const tinta of tintas) {
      expect(contrasteWcag(tinta, fundo), `palavra destacada ${tinta}/carta`).toBeGreaterThanOrEqual(3);
    }
  });
});
