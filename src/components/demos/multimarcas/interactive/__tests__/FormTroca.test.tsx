import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

import { microcopiaDemo } from "@/lib/demos/microcopy";
import { FormTroca } from "../FormTroca";

const doc = (props: Partial<Parameters<typeof FormTroca>[0]>) =>
  new JSDOM(
    renderToStaticMarkup(createElement(FormTroca, { cta: "Receber avaliação", marcas: ["Fiat", "Toyota"], ...props })),
  ).window.document;

describe("FormTroca no HTML do servidor (§7 do plano)", () => {
  it("sem WhatsApp não renderiza nada — formulário que não envia é pior que nenhum", () => {
    expect(doc({ whatsapp: undefined }).querySelector("form")).toBeNull();
    expect(doc({ whatsapp: "  " }).querySelector("form")).toBeNull();
  });

  it("sem CTA não renderiza (o botão é o slot da seção)", () => {
    expect(doc({ whatsapp: "+55 44 99999-0000", cta: " " }).querySelector("form")).toBeNull();
  });

  it("sem JavaScript envia para o wa.me com a mensagem genérica; campos do carro sem name", () => {
    const form = doc({ whatsapp: "+55 44 99999-0000" }).querySelector("form")!;
    expect(form.getAttribute("action")).toBe("https://wa.me/5544999990000");
    expect(form.getAttribute("method")).toBe("get");
    const nomeados = [...form.querySelectorAll("input[name]")];
    expect(nomeados.map((i) => [i.getAttribute("name"), i.getAttribute("value")])).toEqual([
      ["text", microcopiaDemo("pt-BR").trocaMensagem],
    ]);
    expect(form.querySelectorAll("input:not([type=hidden])")).toHaveLength(4);
    expect(form.querySelector('button[type="submit"]')!.textContent).toBe("RECEBER AVALIAÇÃO");
  });

  it("rótulos e mensagem no idioma da demo", () => {
    const form = doc({ whatsapp: "41791234567", idioma: "de-CH" }).querySelector("form")!;
    expect(form.textContent).toContain("MARKE");
    expect(form.querySelector('input[name="text"]')!.getAttribute("value")).toBe(microcopiaDemo("de-CH").trocaMensagem);
  });
});
