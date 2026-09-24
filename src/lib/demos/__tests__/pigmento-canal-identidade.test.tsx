import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

import { montarDemoDataAvulsa, patchIdentidadeAvulsa } from "../avulsas/identidade";
import { getSkin, getTheme } from "../registry";
import { exemploDaSkin } from "../variantes";

/**
 * Itens "e" e "f" da sessão de fundação (docs/plano-tatuagem-pigmento-vivo.md
 * §12, decisão 4): a escada de canal (WhatsApp → telefone → Instagram →
 * nenhum) e a regra do vazio (campo sem dado some, nunca bloco oco nem
 * `#agendar` circular). Montado como demo AVULSA — identidade em branco por
 * baixo, mesmo caminho real de um lead recém-criado sem dado nenhum (ver
 * `CAMPOS_IDENTIDADE_AVULSA`).
 */
const skin = getSkin("tatuagem-pigmento-vivo")!;
const Componente = await skin.componente();
const alvos = skin.variantes!.map((v) => v.id);

const documento = (id: string, identidade: Parameters<typeof patchIdentidadeAvulsa>[0]) => {
  const data = montarDemoDataAvulsa(exemploDaSkin(skin, id), patchIdentidadeAvulsa(identidade), skin.id);
  return new JSDOM(
    renderToStaticMarkup(createElement(Componente, { data, theme: getTheme(skin, id) })),
  ).window.document;
};

describe.each(alvos)("tatuagem-pigmento-vivo §12 — canal de agendamento: %s", (id) => {
  it("sem WhatsApp, telefone nem Instagram: nenhum botão de agendar, nenhum #agendar circular", () => {
    const doc = documento(id, { nome: "Estúdio Sem Canal" });
    const hrefs = [...doc.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")!);
    expect(hrefs.filter((h) => h === "#agendar" || h.startsWith("#agendar"))).toEqual([]);
    expect(doc.querySelector('[data-demo-slot="secoes.hero.cta"]')).toBeNull();
    expect(doc.querySelector('[data-demo-slot="secoes.agendar.cta"]')).toBeNull();
    expect(doc.querySelector('[data-demo-slot="secoes.agendar.ctaSecundaria"]')).toBeNull();
    const secaoAgendar = doc.querySelector("#agendar");
    expect(secaoAgendar?.getAttribute("data-sem-canal")).toBe("true");
    expect(secaoAgendar?.querySelector('[data-demo-slot="secoes.agendar.titulo"]')).not.toBeNull();
    // Nav: sem canal, nenhum link de CTA — só o nome e as âncoras de seção.
    const nav = doc.querySelector("header");
    expect(nav?.querySelector(".d-nav-cta")).toBeNull();
  });

  it("só com WhatsApp: os botões usam wa.me com os dígitos", () => {
    const doc = documento(id, { nome: "Estúdio Com Whats", whatsapp: "+55 44 99999-0000" });
    const cta = doc.querySelector('[data-demo-slot="secoes.hero.cta"]')!;
    expect(cta.getAttribute("href")).toBe("https://wa.me/5544999990000");
  });

  it("sem WhatsApp, só com telefone: os botões usam tel:", () => {
    const doc = documento(id, { nome: "Estúdio Só Telefone", telefone: "(44) 3222-1111" });
    const cta = doc.querySelector('[data-demo-slot="secoes.hero.cta"]')!;
    expect(cta.getAttribute("href")).toBe("tel:4432221111");
  });

  it("sem WhatsApp nem telefone, só com Instagram: os botões abrem o perfil", () => {
    const doc = documento(id, { nome: "Estúdio Só Insta", instagram: "@estudio.exemplo" });
    const cta = doc.querySelector('[data-demo-slot="secoes.hero.cta"]')!;
    expect(cta.getAttribute("href")).toBe("https://instagram.com/estudio.exemplo");
  });
});

describe.each(alvos)("tatuagem-pigmento-vivo §12 — identidade vazia, sem bloco oco: %s", (id) => {
  it("sem endereço, telefone, horário, cidade nem Instagram: nenhum desses slots aparece, e o rodapé não fica com rótulo órfão", () => {
    const doc = documento(id, { nome: "Estúdio Sem Dado" });
    for (const slot of ["endereco", "cidade", "horarios", "telefone", "instagram"]) {
      expect(doc.querySelector(`[data-demo-slot="${slot}"]`), slot).toBeNull();
    }
    // O rodapé ainda existe (nome + copyright), só sem a coluna de dados.
    expect(doc.querySelectorAll('[data-demo-slot="nome"]').length).toBeGreaterThan(0);
  });

  it("com todos os dados: cada um aparece, no rodapé", () => {
    const doc = documento(id, {
      nome: "Estúdio Completo",
      endereco: "Rua Digitada, 100",
      cidade: "Maringá - PR",
      telefone: "(44) 3222-1111",
      whatsapp: "+55 44 99999-0000",
      horarios: "Seg a sáb, 9h às 18h",
      instagram: "@estudiocompleto",
    });
    for (const slot of ["endereco", "cidade", "horarios", "instagram"]) {
      expect(doc.querySelector(`[data-demo-slot="${slot}"]`), slot).not.toBeNull();
    }
    // telefone só aparece se DIFERENTE do whatsapp (regra já existente).
  });
});
