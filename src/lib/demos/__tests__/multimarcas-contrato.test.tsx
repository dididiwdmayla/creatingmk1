import { existsSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

import type { Lead } from "@/lib/leads/types";
import { montarDemoDataAvulsa, patchIdentidadeAvulsa } from "../avulsas/identidade";
import { contrasteWcag } from "../contraste";
import { montarDemoData } from "../montar";
import { getSkin, getTheme } from "../registry";
import type { DemoData } from "../types";
import { exemploDaSkin } from "../variantes";

/**
 * Contrato da `multimarcas-vortice` no HTML DO SERVIDOR, com JavaScript
 * desligado — irmã de `lancheria-contrato.test.tsx`. `renderToStaticMarkup`
 * + JSDOM sem executar script: o preloader, as revelações e a contagem de
 * preço nascem na hidratação, e nada disso pode esconder o documento
 * servido (docs/plano-multimarcas.md §1, "O `<h1>` existe, e tem três
 * defeitos", defeito 3; item 7 do §9).
 *
 * A etapa 4 (item 24) completa este arquivo com a prova do §6.1 e o §7.
 */
const skin = getSkin("multimarcas-vortice")!;
const lead = { nome: "Garagem Contrato Real", placeId: "qa", status: "novo" } as Lead;
const alvos = skin.variantes!.map((v) => v.id);

const normalizar = (texto: string) => texto.replace(/\s+/g, " ").trim();

const documento = (id: string, data: DemoData, idioma?: string) =>
  new JSDOM(
    renderToStaticMarkup(
      createElement(skin.componente, { data, theme: getTheme(skin, id), idioma }),
    ),
  ).window.document;

describe.each(alvos)("multimarcas: nove seções sem duplicata, um <h1> com o nome (item 24): %s", (id) => {
  it("data-d-secao cobre as nove seções do contrato, sem duplicata, e o <h1> é o nome inteiro na âncora hero", () => {
    const doc = documento(id, montarDemoData(exemploDaSkin(skin, id), lead, undefined, skin.id));
    const marcadores = [...doc.querySelectorAll("[data-d-secao]")].map((el) => el.getAttribute("data-d-secao"));
    expect(new Set(marcadores).size, "sem duplicata").toBe(marcadores.length);
    expect([...marcadores].sort()).toEqual(skin.secoes.map((s) => s.id).sort());
    const h1s = doc.querySelectorAll('[data-d-secao="hero"] h1');
    expect(h1s).toHaveLength(1);
    expect(normalizar(h1s[0].textContent!)).toBe(lead.nome);
  });
});

describe.each(alvos)("multimarcas SSR sem JavaScript: %s", (id) => {
  const base = montarDemoData(exemploDaSkin(skin, id), lead, undefined, skin.id);

  it("o preloader não sai no HTML do servidor, mesmo com a intro ligada", () => {
    const theme = { ...getTheme(skin, id), intro: true };
    const html = renderToStaticMarkup(createElement(skin.componente, { data: base, theme }));
    // O preloader é o único `fixed inset-0` de fundo opaco da skin.
    expect(html).not.toMatch(/class="[^"]*fixed inset-0 z-\[9990\]/);
    expect(html).not.toContain("GIRI");
  });

  it("nada no documento servido nasce transparente ou deslocado para fora da caixa", () => {
    const html = renderToStaticMarkup(
      createElement(skin.componente, { data: base, theme: { ...getTheme(skin, id), intro: true } }),
    );
    // Só o `style` INLINE conta: os `@keyframes` da folha (o anel do
    // WhatsApp esmaece até 0) não escondem nada no documento servido.
    const inline = [...html.matchAll(/ style="([^"]*)"/g)].map((m) => m[1]);
    expect(inline.filter((s) => /opacity:\s*0(?![.\d])/.test(s))).toEqual([]);
    expect(inline.filter((s) => s.includes("translateY(115%)"))).toEqual([]);
  });

  it("o preço de cada carro sai já formatado, não o zero de partida do contador", () => {
    const doc = documento(id, base);
    const cards = [...doc.querySelectorAll("[data-car]")];
    expect(cards).toHaveLength(base.servicos.length);
    const textos = cards.map((c) => c.textContent ?? "");
    for (const [i, servico] of base.servicos.entries()) {
      const milhar = servico.precoValor!.toLocaleString("pt-BR");
      expect(textos[i], `${servico.nome} sem o preço ${milhar}`).toContain(milhar);
    }
  });
});

/**
 * §6.1 do plano: o `<h1>` é SEMPRE o nome; `secoes.hero.titulo` salvo vira
 * a linha de apoio, sem perder o texto. Montado pelo caminho real — exemplo
 * da variante ← lead ← `lead.demo.dados` com o título salvo.
 */
describe.each(alvos)("multimarcas §6.1 — o <h1> e o título já salvo: %s", (id) => {
  const TITULO = "Seminovos com garantia de fábrica";
  const comTitulo = (titulo: string) =>
    montarDemoData(exemploDaSkin(skin, id), lead, { secoes: { hero: { titulo } } }, skin.id);
  const hero = (doc: Document) => doc.querySelector('[data-d-secao="hero"]')!;

  it("um único <h1>, na âncora hero, com o nome inteiro e sem o título", () => {
    const doc = documento(id, comTitulo(TITULO));
    expect(doc.querySelectorAll("h1")).toHaveLength(1);
    const h1 = hero(doc).querySelector("h1")!;
    expect(normalizar(h1.textContent!)).toBe(lead.nome);
    expect(h1.textContent).not.toContain(TITULO);
  });

  it("o título salvo aparece inteiro, depois do <h1>, na mesma âncora, sem nada que o esconda", () => {
    const doc = documento(id, comTitulo(TITULO));
    const h1 = hero(doc).querySelector("h1")!;
    const apoio = hero(doc).querySelector('[data-demo-slot="secoes.hero.titulo"]');
    expect(apoio).not.toBeNull();
    expect(normalizar(apoio!.textContent!)).toBe(TITULO);
    expect(h1.compareDocumentPosition(apoio!) & 4 /* FOLLOWING */).toBeTruthy();
    for (const el of [apoio!, ...apoio!.querySelectorAll("*")]) {
      expect(el.hasAttribute("hidden")).toBe(false);
      expect(el.getAttribute("aria-hidden")).not.toBe("true");
      const estilo = el.getAttribute("style") ?? "";
      expect(estilo).not.toMatch(/display:\s*none|opacity:\s*0(?![.\d])|translateY/);
    }
  });

  it("controle: título vazio ou só espaço não desenha linha", () => {
    for (const titulo of ["", "   "]) {
      const doc = documento(id, comTitulo(titulo));
      expect(hero(doc).querySelector('[data-demo-slot="secoes.hero.titulo"]')).toBeNull();
      expect(normalizar(hero(doc).querySelector("h1")!.textContent!)).toBe(lead.nome);
    }
  });

  it("controle: título igual ao nome (sem caixa, sem espaços nas pontas) não desenha linha", () => {
    const doc = documento(id, comTitulo(`  ${lead.nome.toUpperCase()} `));
    expect(hero(doc).querySelector('[data-demo-slot="secoes.hero.titulo"]')).toBeNull();
  });

  it("o caso normal de lead (título = quebrarTitulo(nome)) também não repete o nome", () => {
    const doc = documento(id, montarDemoData(exemploDaSkin(skin, id), lead, undefined, skin.id));
    expect(hero(doc).querySelector('[data-demo-slot="secoes.hero.titulo"]')).toBeNull();
  });
});

describe("multimarcas: rótulos e títulos vazios não viram elemento vazio", () => {
  it("<h2>, rótulo e link de nav com string vazia/espaço não renderizam em branco", () => {
    const base = montarDemoData(exemploDaSkin(skin, "vortice"), lead, undefined, skin.id);
    const secoes = Object.fromEntries(
      Object.entries(base.secoes).map(([k, v]) => [k, { ...v, rotulo: " ", titulo: "" }]),
    );
    const doc = documento("vortice", { ...base, secoes });
    for (const el of doc.querySelectorAll("h2, [data-demo-slot$='.rotulo'], nav a")) {
      expect(normalizar(el.textContent ?? ""), el.outerHTML.slice(0, 120)).not.toBe("");
    }
  });
});

describe("multimarcas: o simulador (item 10)", () => {
  const base = montarDemoData(exemploDaSkin(skin, "vortice"), lead, undefined, skin.id);
  const valorDoSlider = (doc: Document) => doc.querySelector('#simulador input[type="range"]')!;

  it("a faixa do slider cobre os nove carros do estoque (39.900 a 149.900)", () => {
    const slider = valorDoSlider(documento("vortice", base));
    const precos = base.servicos.map((s) => s.precoValor!);
    expect(Number(slider.getAttribute("min"))).toBeLessThanOrEqual(Math.min(...precos));
    expect(Number(slider.getAttribute("max"))).toBeGreaterThanOrEqual(Math.max(...precos));
  });

  it("em en-US/USD não sobra R$ nem separador pt-BR no simulador", () => {
    const html = renderToStaticMarkup(
      createElement(skin.componente, { data: base, theme: getTheme(skin, "vortice"), idioma: "en-US", moeda: "USD" }),
    );
    const doc = new JSDOM(html).window.document;
    const sim = doc.getElementById("simulador")!.textContent!;
    expect(sim).not.toContain("R$");
    expect(sim).toContain("$");
    expect(sim).toMatch(/\d{2},\d{3}/);
  });

  it("'simular este carro' só existe com a seção simulador visível", () => {
    const com = documento("vortice", base);
    expect(com.querySelectorAll('[data-car] a[href="#simulador"]')).toHaveLength(base.servicos.length);
    const semSimulador = {
      ...base,
      secoes: { ...base.secoes, simulador: { ...base.secoes.simulador, oculta: true } },
    };
    expect(documento("vortice", semSimulador).querySelectorAll('a[href="#simulador"]')).toHaveLength(0);
  });
});

/**
 * §7 do plano — lead SEM dado de identidade é o caso normal. Montado como
 * demo avulsa (identidade em branco por baixo: nem o endereço do exemplo
 * sobrevive), e o lado cheio com os seis campos.
 */
describe.each(alvos)("multimarcas §7 — a regra do vazio: %s", (id) => {
  const vazio = montarDemoDataAvulsa(exemploDaSkin(skin, id), patchIdentidadeAvulsa({ nome: lead.nome }), skin.id);
  const cheio = montarDemoDataAvulsa(
    exemploDaSkin(skin, id),
    patchIdentidadeAvulsa({
      nome: lead.nome,
      endereco: "Rua Digitada, 100",
      cidade: "Maringá - PR",
      telefone: "(44) 3222-1111",
      whatsapp: "+55 44 99999-0000",
      horarios: "Seg a sáb, 9h às 18h",
      instagram: "@garagemreal",
    }),
    skin.id,
  );

  it("sem dado: nenhuma escada, nenhum rótulo órfão, nenhuma grade vazia no rodapé", () => {
    const doc = documento(id, vazio);
    expect(doc.querySelector(".mm-dados")).toBeNull();
    const contato = doc.getElementById("contato")!;
    expect(contato.querySelector(".grid")).toBeNull();
    expect(contato.querySelector("dt")).toBeNull();
  });

  it("sem dado: nenhum link de rota, nenhuma rede social apontando para #topo", () => {
    const doc = documento(id, vazio);
    const hrefs = [...doc.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")!);
    expect(hrefs.filter((h) => /waze\.com|maps\.google/.test(h))).toEqual([]);
    expect(doc.querySelectorAll('[aria-label="Instagram"], [aria-label="Facebook"], [aria-label="YouTube"]')).toHaveLength(0);
    // O único #topo legítimo é a marca da nav.
    expect(hrefs.filter((h) => h === "#topo")).toHaveLength(1);
  });

  it("sem dado: o rodapé degrada para título + link ao estoque; o simulador fica sem botão", () => {
    const doc = documento(id, vazio);
    expect(doc.querySelector('#contato a[href="#estoque"]')).not.toBeNull();
    expect(doc.querySelector('[data-demo-slot="secoes.simulador.cta"]')).toBeNull();
  });

  it("com dado: a escada na ordem endereço → horário → telefone → Instagram, rota e ícone", () => {
    const doc = documento(id, cheio);
    // A escada aparece UMA vez por página — no rodapé, ou na abertura da
    // busca (Pátio), que a leva para cima.
    expect(doc.querySelectorAll(".mm-dados")).toHaveLength(1);
    const slots = [...doc.querySelectorAll(".mm-dados dd")].map((dd) => dd.getAttribute("data-demo-slot"));
    expect(slots).toEqual(["endereco", "horarios", "telefone", "instagram"]);
    const hrefs = [...doc.querySelectorAll("#contato a[href]")].map((a) => a.getAttribute("href")!);
    expect(hrefs.some((h) => h.startsWith("https://waze.com/"))).toBe(true);
    expect(doc.querySelector('#contato [aria-label="Instagram"]')!.getAttribute("href")).toBe("https://instagram.com/garagemreal");
  });

  it("CTA do simulador: WhatsApp com a simulação; só telefone → tel:", () => {
    const comWa = documento(id, cheio).querySelector('[data-demo-slot="secoes.simulador.cta"]')!;
    expect(comWa.getAttribute("href")).toMatch(/^https:\/\/wa\.me\/5544999990000\?text=/);
    const soTel = documento(id, { ...cheio, whatsapp: undefined }).querySelector('[data-demo-slot="secoes.simulador.cta"]')!;
    expect(soTel.getAttribute("href")).toBe("tel:4432221111");
  });
});

describe("multimarcas: cromo pela microcópia (item 13)", () => {
  // Literais que ESTAVAM cravados no componente (docs/plano-multimarcas.md
  // §1). Comparação sem caixa: o componente põe vários em caixa alta, e o
  // contrato genérico de microcópia compara com a caixa do dicionário.
  // ("Falar no WhatsApp" e "Tenho interesse" sozinhos NÃO entram: são o
  // CTA secundário da abertura e o do estoque — conteúdo, traduzido pela
  // IA. O literal cravado era o do menu, e ele só monta no cliente.)
  const CRAVADOS = [
    "Valor do veículo",
    "Parcela estimada",
    "Valores simulados",
    "Solicitar proposta",
    "Abrir no Waze",
    "Abrir no Google Maps",
    "Conteúdo ilustrativo",
    "Vim pelo site",
    "Olá! Tenho interesse",
    "VEGLIA",
    "GIRI",
    "/mês",
  ];
  const cheio = montarDemoDataAvulsa(
    exemploDaSkin(skin, "vortice"),
    patchIdentidadeAvulsa({ nome: lead.nome, endereco: "Bahnhofstrasse 1", whatsapp: "+41 79 123 45 67" }),
    skin.id,
  );

  it.each(["de-CH", "fr-CH", "en-US"])("%s: nenhum literal de cromo em português no HTML", (idioma) => {
    const bruto = renderToStaticMarkup(
        createElement(skin.componente, {
          // CTA do simulador e texto do rodapé VAZIOS: é quando o fallback
          // cravado aparecia ("Solicitar proposta", "Conteúdo ilustrativo.").
          data: {
            ...cheio,
            secoes: {
              ...cheio.secoes,
              simulador: { ...cheio.secoes.simulador, cta: "" },
              contato: { ...cheio.secoes.contato, texto: "" },
            },
          },
          theme: { ...getTheme(skin, "vortice"), intro: true },
          idioma,
          moeda: "CHF",
        }),
      ).replace(/<style[^>]*>[\s\S]*?<\/style>/g, "");
    // As mensagens de WhatsApp vão codificadas no href: decodifica só eles.
    const hrefs = [...bruto.matchAll(/href="([^"]*)"/g)].map((m) => decodeURIComponent(m[1]));
    const html = [bruto, ...hrefs].join("\n").toLowerCase();
    for (const literal of CRAVADOS) expect(html, literal).not.toContain(literal.toLowerCase());
  });

  it("nav sem rótulo cai no rótulo da microcópia, não num mapa em português", () => {
    const semRotulo = {
      ...cheio,
      secoes: Object.fromEntries(Object.entries(cheio.secoes).map(([k, v]) => [k, { ...v, rotulo: "" }])),
    };
    const doc = new JSDOM(
      renderToStaticMarkup(
        createElement(skin.componente, { data: semRotulo, theme: getTheme(skin, "vortice"), idioma: "de-CH" }),
      ),
    ).window.document;
    const nav = [...doc.querySelectorAll("nav a[href^='#']")].map((a) => a.textContent);
    expect(nav).toContain("BESTAND");
    expect(nav).not.toContain("ESTOQUE");
  });
});

describe.each(alvos)("multimarcas: o exemplo não inventa fato sobre o lead (item 15): %s", (id) => {
  // Lead REAL sem endereço (o caso comum): antes, o endereço do exemplo
  // sobrevivia na montagem e ligava Waze/Maps para um lugar inventado.
  const doc = documento(id, montarDemoData(exemploDaSkin(skin, id), lead, undefined, skin.id));
  // Texto VISÍVEL: o conteúdo de <style> (a folha de composição, com seus
  // comentários) não é texto da página.
  for (const estilo of doc.querySelectorAll("style")) estilo.remove();
  const texto = doc.body.textContent ?? "";

  it("sem endereço do lead: nem texto de endereço, nem Waze, nem Maps", () => {
    expect(doc.querySelector('[data-demo-slot="endereco"]')).toBeNull();
    const hrefs = [...doc.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")!);
    expect(hrefs.filter((h) => /waze\.com|maps\.google/.test(h))).toEqual([]);
  });

  it("nenhuma nota, estrela ou selo de plataforma de terceiros", () => {
    expect(texto).not.toMatch(/★|Google|Reclame Aqui|Webmotors/i);
  });

  it("nenhum nome de marca do exemplo vaza para a demo do lead", () => {
    expect(texto).not.toMatch(/v[óo]rtice/i);
    const alts = [...doc.querySelectorAll("img[alt]")].map((i) => i.getAttribute("alt")!).join(" ");
    expect(alts).not.toMatch(/v[óo]rtice/i);
  });
});

describe.each(alvos)("multimarcas: slots de imagem por composição (§8): %s", (id) => {
  it("todo slot desenhado está no HTML; o declarado em imagensOcultas, não", () => {
    const doc = documento(id, montarDemoData(exemploDaSkin(skin, id), lead, undefined, skin.id));
    const variante = skin.variantes!.find((v) => v.id === id)!;
    const ocultos = new Set(Object.keys(variante.imagensOcultas ?? {}));
    for (const slot of Object.keys(skin.demoDataExemplo.imagens)) {
      const presente = doc.querySelector(`[data-demo-slot="imagens.${slot}"]`) !== null;
      expect(presente, `${slot} em ${id}`).toBe(!ocultos.has(slot));
    }
  });
});

describe("multimarcas: o painel de instrumentos nas quatro escalas (§3, item 18)", () => {
  const ESCALA: Record<string, string> = { vortice: "selo", patio: "marcador", garagem: "mostrador", campo: "canto" };
  it.each(alvos)("%s: um mostrador só, na âncora hero, na escala da abertura", (id) => {
    const doc = documento(id, montarDemoData(exemploDaSkin(skin, id), lead, undefined, skin.id));
    const mostradores = doc.querySelectorAll(".mm-gauge-svg");
    expect(mostradores).toHaveLength(1);
    expect(mostradores[0].getAttribute("data-escala")).toBe(ESCALA[id]);
    expect(mostradores[0].closest('[data-d-secao="hero"]')).not.toBeNull();
  });
});

describe("multimarcas: as quatro declarações (item 19)", () => {
  const variantes = skin.variantes!;
  it("a intro nasce ligada só na vortice (§6, Intro)", () => {
    expect(variantes.filter((v) => v.theme.intro).map((v) => v.id)).toEqual(["vortice"]);
  });
  it("cada variante tem a sua composição, e as quatro diferem em TODOS os nove knobs", () => {
    const comps = variantes.map((v) => v.theme.multimarcas!);
    for (const knob of Object.keys(comps[0]) as (keyof typeof comps[0])[]) {
      expect(new Set(comps.map((c) => c[knob])).size, knob).toBe(4);
    }
  });
  it("o alinhamento inicial da abertura segue a composição (a sangrada centra)", () => {
    const al = Object.fromEntries(variantes.map((v) => [v.id, v.theme.heroTitulo.alinhamento]));
    expect(al).toEqual({ vortice: "esquerda", patio: "esquerda", garagem: "centro", campo: "esquerda" });
  });
  it("nenhuma variante nasce com seção oculta", () => {
    for (const v of variantes) expect(v.arranjo.ocultas ?? []).toEqual([]);
  });
});

/**
 * §2 do plano — as regras de contraste das paletas novas, refeitas aqui
 * (item 20): `textoSuave` COMPOSTO sobre fundo, alt, elevado e chip
 * (elevado + 3% de texto); o acento como texto contra as três superfícies;
 * o ink inteiro sobre o acento. Mistura linear por canal, fórmula WCAG.
 */
describe("multimarcas §2 — contraste das quatro paletas (item 20)", () => {
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
  const sobre = (frente: string, fundo: string) => {
    const [r, g, b, a] = canais(frente);
    const [R, G, B] = canais(fundo);
    return hex(r * a + R * (1 - a), g * a + G * (1 - a), b * a + B * (1 - a));
  };

  it.each(skin.variantes!.map((v) => [v.id, v.theme.paleta] as const))("%s: todo par de leitura a ≥ 4,5:1", (_id, p) => {
    const [tr, tg, tb] = canais(p.texto);
    const chip = sobre(`rgba(${tr}, ${tg}, ${tb}, 0.03)`, p.fundoElevado);
    const superficies = { fundo: p.fundo, alt: p.fundoAlt, elevado: p.fundoElevado, chip };
    for (const [nome, sup] of Object.entries(superficies)) {
      expect(contrasteWcag(p.texto, sup), `texto/${nome}`).toBeGreaterThanOrEqual(4.5);
      expect(contrasteWcag(sobre(p.textoSuave, sup), sup), `suave/${nome}`).toBeGreaterThanOrEqual(4.5);
    }
    for (const nome of ["fundo", "alt", "elevado"] as const) {
      expect(contrasteWcag(p.destaque, superficies[nome]), `destaque/${nome}`).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrasteWcag(p.destaqueInk, p.destaque), "ink/destaque").toBeGreaterThanOrEqual(4.5);
  });
});

describe("multimarcas: a cópia de cada loja (item 21)", () => {
  const exemplo = (id: string) => skin.variantes!.find((v) => v.id === id)!.exemplo;

  it.each(alvos)("%s: nove carros (um por slot carro-N), todos com preço, ano/km/câmbio/combustível", (id) => {
    const carros = exemplo(id).servicos;
    expect(carros).toHaveLength(9);
    for (const c of carros) {
      expect(c.precoValor, c.nome).toBeGreaterThan(0);
      expect(c.destaques, c.nome).toHaveLength(4);
    }
  });

  it.each(alvos)("%s: todo depoimento fala de um carro do próprio estoque", (id) => {
    const nomes = exemplo(id).servicos.map((c) => c.nome.split(" ").slice(0, 2).join(" "));
    for (const d of exemplo(id).depoimentos) {
      expect(nomes.some((n) => d.contexto?.startsWith(n)), `${d.autor}: ${d.contexto}`).toBe(true);
    }
  });

  it("o Pátio vende até 70 mil; a Garagem, nenhum carro abaixo dos seminovos premium", () => {
    expect(Math.max(...exemplo("patio").servicos.map((c) => c.precoValor!))).toBeLessThanOrEqual(70000);
    expect(Math.min(...exemplo("garagem").servicos.map((c) => c.precoValor!))).toBeGreaterThan(150000);
  });

  it("as quatro lojas não repetem o mesmo estoque", () => {
    const estoques = alvos.map((id) => exemplo(id).servicos.map((c) => c.nome).join("|"));
    expect(new Set(estoques).size).toBe(4);
  });
});

describe("multimarcas: miniaturas das variantes (item 22)", () => {
  it.each(alvos)("%s: a miniatura declarada existe em public/", (id) => {
    const v = skin.variantes!.find((x) => x.id === id)!;
    expect(v.thumbnail).toBe(`/demos/multimarcas/${id}.jpg`);
    expect(existsSync(path.join(process.cwd(), "public", v.thumbnail!))).toBe(true);
  });
});

/**
 * §5 do plano — "o custo que não aparece na tabela": `destaque` nasceu
 * depois de toda demo que o operador já tinha reordenado, então o
 * `ordemSecoes` salvo nunca a lista. Sem `ordemEfetiva` (item 2), a seção
 * nova entraria no FIM da fila — depois do próprio rodapé. A ordem abaixo é
 * o Pátio já reordenado pelo operador ANTES desta migração (sem `destaque`,
 * que ainda não existia), terminando em `contato`, como toda demo publicada
 * de fato termina.
 */
describe("multimarcas: destaque numa demo com ordemSecoes antigo cai antes de contato (item 24)", () => {
  const ORDEM_ANTIGA = ["estoque", "simulador", "avaliacao", "numeros", "vantagens", "depoimentos", "contato"];

  it("destaque (não listado) entra antes da sua sucessora no contrato (simulador) — e, com isso, antes de contato", () => {
    const data = montarDemoData(exemploDaSkin(skin, "patio"), lead, { ordemSecoes: ORDEM_ANTIGA }, skin.id);
    const ordem = [...documento("patio", data).querySelectorAll("[data-d-secao]")].map((el) =>
      el.getAttribute("data-d-secao"),
    );
    expect(ordem).not.toContain(null);
    expect(ordem.indexOf("destaque")).toBeGreaterThan(-1);
    expect(ordem.indexOf("destaque")).toBeLessThan(ordem.indexOf("simulador"));
    expect(ordem.indexOf("destaque")).toBeLessThan(ordem.indexOf("contato"));
  });
});
