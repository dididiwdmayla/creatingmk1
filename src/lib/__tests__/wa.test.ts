import { describe, expect, it } from "vitest";

import { buildWhatsAppLink } from "@/lib/wa";

describe("buildWhatsAppLink", () => {
  it("substitui {nome} e monta o wa.me só com dígitos", () => {
    const link = buildWhatsAppLink("Oi {nome}!", "Barbearia do Zé", "+55 44 3222-1111");
    expect(link).toBe(
      `https://wa.me/554432221111?text=${encodeURIComponent("Oi Barbearia do Zé!")}`,
    );
  });

  it("substitui {demo} pelo link da demo quando fornecido", () => {
    const link = buildWhatsAppLink(
      "Oi {nome}, montei uma prévia: {demo}",
      "Zé",
      "+55 44 3222-1111",
      "https://radar.example/demo/abc123",
    );
    expect(decodeURIComponent(link.split("text=")[1])).toBe(
      "Oi Zé, montei uma prévia: https://radar.example/demo/abc123",
    );
  });

  it("sem demoUrl, {demo} fica intacto (mensagem não perde conteúdo em silêncio)", () => {
    const link = buildWhatsAppLink("Veja: {demo}", "Zé", "+55 44 3222-1111");
    expect(decodeURIComponent(link.split("text=")[1])).toBe("Veja: {demo}");
  });
});
