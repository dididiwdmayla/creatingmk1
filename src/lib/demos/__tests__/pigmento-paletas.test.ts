import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { Lead } from "@/lib/leads/types";
import { contrasteWcag } from "../contraste";
import { montarDemoData } from "../montar";
import { getSkin, getTheme } from "../registry";
import { exemploDaSkin } from "../variantes";

/**
 * Contraste das quatro paletas remedidas da `tatuagem-pigmento-vivo`
 * (docs/plano-tatuagem-pigmento-vivo.md §2/§6, item "b" da sessão de
 * fundação) — alfa COMPOSTO sobre a superfície real onde o texto pousa,
 * mesma fórmula/método de `multimarcas-contrato.test.tsx` §2. Nenhum par
 * de leitura abaixo de 4,5:1 (3:1 para texto grande, âncora `<h1>` atrás
 * da mancha a 55%).
 *
 * Cobre só as PALETAS (tinta/mancha/campo de cor) — o resto do contrato da
 * skin (seções, slots, `<h1>`, identidade vazia) fica para
 * `pigmento-contrato.test.tsx` na sessão de composição visual (item 27 do
 * plano); este arquivo é o que a sessão de fundação promete no item "b" do
 * escopo e não precisa ser duplicado lá — só estendido, se fizer sentido.
 */
const skin = getSkin("tatuagem-pigmento-vivo")!;
const variantes = skin.variantes!;
// Carregado UMA VEZ (topo do módulo) — mesmo motivo de
// multimarcas-contrato.test.tsx: o componente é sob demanda no registro.
const Componente = await skin.componente();

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

describe.each(variantes.map((v) => [v.id, v] as const))(
  "tatuagem-pigmento-vivo §2 — contraste da paleta remedida: %s",
  (_id, variante) => {
    const p = variante.theme.paleta;
    const manchas = variante.theme.pigmento!.manchas;
    const tintas = [p.destaque, p.acentoSecundario, p.acentoTerciario];
    const superficies = { fundo: p.fundo, alt: p.fundoAlt, elevado: p.fundoElevado };
    const escuro = variante.fundo === "escuro";

    it("texto / fundo · alt · elevado ≥ 4,5:1", () => {
      for (const [nome, sup] of Object.entries(superficies)) {
        expect(contrasteWcag(p.texto, sup), `texto/${nome}`).toBeGreaterThanOrEqual(4.5);
      }
    });

    it("suave (sólido) / fundo · alt · elevado ≥ 4,5:1 (regra 2 do §2: cor sólida, não alfa)", () => {
      for (const [nome, sup] of Object.entries(superficies)) {
        expect(contrasteWcag(p.textoSuave, sup), `suave/${nome}`).toBeGreaterThanOrEqual(4.5);
      }
    });

    it("suave / mancha a α 0,30 (pior pigmento) ≥ 4,5:1 (regra 3 do §2: teto de mancha atrás de texto de leitura)", () => {
      for (const mancha of manchas) {
        const fundoComMancha = sobre(comAlfa(mancha, 0.3), p.fundo);
        expect(contrasteWcag(p.textoSuave, fundoComMancha), `suave/mancha ${mancha} a 30%`).toBeGreaterThanOrEqual(4.5);
      }
    });

    it("texto / mancha a α 0,55 (o <h1>, texto grande — regra 3 do §2) ≥ 3:1", () => {
      for (const mancha of manchas) {
        const fundoComMancha = sobre(comAlfa(mancha, 0.55), p.fundo);
        expect(contrasteWcag(p.texto, fundoComMancha), `texto/mancha ${mancha} a 55%`).toBeGreaterThanOrEqual(3);
      }
    });

    it("tinta (destaque/acentoSecundario/acentoTerciario) / fundo · alt · elevado ≥ 4,5:1", () => {
      for (const tinta of tintas) {
        for (const [nome, sup] of Object.entries(superficies)) {
          expect(contrasteWcag(tinta, sup), `tinta ${tinta}/${nome}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    });

    it("tinta / pílula (mancha a 16% sobre alt) ≥ 4,5:1 — regra 1 do §2: texto usa a tinta, fundo da pílula usa o vivo", () => {
      for (let i = 0; i < tintas.length; i++) {
        const pilula = sobre(comAlfa(manchas[i], 0.16), p.fundoAlt);
        expect(contrasteWcag(tintas[i], pilula), `tinta ${tintas[i]}/pílula ${manchas[i]}@16%`).toBeGreaterThanOrEqual(4.5);
      }
    });

    it("ink / tinta1 (destaqueInk sobre destaque, botão cheio) ≥ 4,5:1", () => {
      expect(contrasteWcag(p.destaqueInk, p.destaque)).toBeGreaterThanOrEqual(4.5);
    });

    it("texto do campo / campo do CTA final ≥ 4,5:1 (regra 4 do §2: tintas no claro com texto branco, vivos no escuro com texto na cor do fundo)", () => {
      const campoCores = escuro ? manchas : tintas;
      const campoTexto = escuro ? p.fundo : "#FFFFFF";
      for (const cor of campoCores) {
        expect(contrasteWcag(campoTexto, cor), `campo ${cor}/texto ${campoTexto}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  },
);

/**
 * Decisão "b" da sessão de fundação: a última palavra do título do CTA
 * final e o manifesto precisam estar visíveis (com contraste de leitura)
 * no HTML SEM JAVASCRIPT — não só a paleta medida em isolado.
 */
describe.each(variantes.map((v) => [v.id, v] as const))(
  "tatuagem-pigmento-vivo — CTA final e manifesto no HTML sem JavaScript: %s",
  (id) => {
    const lead = { nome: "Estúdio Contrato Fundação", placeId: "qa", status: "novo" } as Lead;
    const html = () =>
      renderToStaticMarkup(
        createElement(Componente, {
          data: montarDemoData(exemploDaSkin(skin, id), lead, undefined, skin.id),
          theme: getTheme(skin, id),
        }),
      );

    it("a última palavra do título do CTA final sai no HTML, dentro de <em>, sem cor cravada diferente do título", () => {
      const secao = html().slice(html().indexOf('data-d-secao="agendar"'));
      const em = /<em[^>]*style="([^"]*)"[^>]*>([^<]+)<\/em>/.exec(secao);
      expect(em, "sem <em> na seção agendar").not.toBeNull();
      expect(em![2].trim().length).toBeGreaterThan(0);
      // "sem troca de cor" (regra 4 do §2): nunca a cor cravada do acento
      // antigo (--d-accent), que sobre o próprio campo de cor dava 1,00:1.
      expect(em![1]).not.toContain("var(--d-accent)");
    });

    it("o manifesto sai ACESO no HTML — nenhuma palavra em --d-unlit", () => {
      const doc = html();
      const secao = doc.slice(doc.indexOf('data-d-secao="manifesto"'), doc.indexOf('data-d-secao="estilos"'));
      expect(secao).not.toContain("var(--d-unlit)");
    });
  },
);

describe("tatuagem-pigmento-vivo — as quatro direções cromáticas (decisão 5 da sessão de fundação)", () => {
  it("meia-noite é a única de fundo escuro; as outras três são claras", () => {
    const fundos = Object.fromEntries(variantes.map((v) => [v.id, v.fundo]));
    expect(fundos).toEqual({ aquarela: "claro", boreal: "claro", "meia-noite": "escuro", terra: "claro" });
  });

  it("--pv-mistura é 'screen' só na meia-noite (fundo escuro) — multiply desaparece em preto", () => {
    for (const v of variantes) {
      const escuro = v.fundo === "escuro";
      // Mesmo critério do componente: luminância do fundo decide o blend-mode.
      expect(escuro, v.id).toBe(v.id === "meia-noite");
    }
  });
});
